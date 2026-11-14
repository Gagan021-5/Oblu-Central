import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomerCard } from "@/components/employee/CustomerCard";
import { Customer } from "@/data/customerTypes";
import {
  DashboardStats,
  fetchCustomerPageFromApi,
  fetchCustomersFromApi,
  fetchDashboardStatsApi,
} from "@/services/customerService";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";
import {
  CustomerBalanceFilter,
  CustomerFilterSheet,
  CustomerPaymentFilter,
  CustomerSortOption,
} from "@/components/ui/CustomerFilterSheet";

type FilterTab = "all" | "followup_due" | "payment_pending" | "recently_contacted";

// Memoized List Item row to prevent unnecessary re-renders in large VirtualizedLists
const CustomerListItem = React.memo(
  ({
    item,
    onPress,
  }: {
    item: Customer;
    onPress: (id: string | number) => void;
  }) => {
    const handlePress = useCallback(() => {
      onPress(item.id);
    }, [item.id, onPress]);

    return <CustomerCard customer={item} onPress={handlePress} />;
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.item.name === next.item.name &&
      prev.item.paymentStatus === next.item.paymentStatus &&
      prev.item.lastContactTime === next.item.lastContactTime &&
      prev.item.nextFollowUp === next.item.nextFollowUp &&
      prev.onPress === next.onPress
    );
  }
);

export default function CustomerDashboardScreen() {
  const scrollRef = useRef<any>(null);
  const reqIdRef = useRef(0);
  const routeParams = useLocalSearchParams<{ filter?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const isBusinessManager = useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    const uname = (user?.username || "").toLowerCase();
    return role.includes("business") || role.includes("buss_mgr") || uname.includes("vibhuti");
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomerCount, setTotalCustomerCount] = useState(0);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const dashboardStatsRef = useRef<DashboardStats | null>(null);
  useEffect(() => {
    dashboardStatsRef.current = dashboardStats;
  }, [dashboardStats]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>(() => {
    const value = routeParams.filter;
    return value === "followup_due" || value === "payment_pending" || value === "recently_contacted" ? value : "all";
  });

  useEffect(() => {
    const value = routeParams.filter;
    if (value === "followup_due" || value === "payment_pending" || value === "recently_contacted") {
      setActiveFilter(value);
      setCurrentPage(1);
    } else if (!value) {
      setActiveFilter("all");
    }
  }, [routeParams.filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim();
      if (trimmed !== debouncedSearch) {
        setDebouncedSearch(trimmed);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<CustomerPaymentFilter>("all");
  const [balanceFilter, setBalanceFilter] = useState<CustomerBalanceFilter>("all");
  const [sortOption, setSortOption] = useState<CustomerSortOption>("default");

  const loadDashboardStats = useCallback(async () => {
    try {
      const stats = await fetchDashboardStatsApi();
      setDashboardStats(stats);
      if (stats?.totalCustomers) {
        setTotalCustomerCount((prev) => (prev > 0 ? prev : stats.totalCustomers));
      }
    } catch {
      setDashboardStats(null);
    }
  }, []);

  useEffect(() => {
    void loadDashboardStats();
  }, [loadDashboardStats]);

  const loadData = useCallback(
    async (
      isPullToRefresh = false,
      page = 1,
      overrides?: {
        search?: string;
        filter?: FilterTab;
        payment_status?: CustomerPaymentFilter;
        balance?: CustomerBalanceFilter;
        sort?: CustomerSortOption;
      }
    ) => {
      const activeSearch = overrides?.search !== undefined ? overrides.search : debouncedSearch;
      const currentActiveFilter = overrides?.filter !== undefined ? overrides.filter : activeFilter;
      const currentPaymentFilter = overrides?.payment_status !== undefined ? overrides.payment_status : paymentFilter;
      const currentBalanceFilter = overrides?.balance !== undefined ? overrides.balance : balanceFilter;
      const currentSort = overrides?.sort !== undefined ? overrides.sort : sortOption;

      const reqId = ++reqIdRef.current;
      if (page === 1 && !isPullToRefresh) {
        setLoading(true);
      } else {
        setPageLoading(true);
      }
      if (page === 1) setLoadError("");

      try {
        const result = await fetchCustomerPageFromApi({
          search: activeSearch || undefined,
          filter: currentActiveFilter !== "all" ? currentActiveFilter : undefined,
          payment_status: currentPaymentFilter !== "all" ? currentPaymentFilter : undefined,
          has_outstanding: currentBalanceFilter === "outstanding",
          ordering: currentSort !== "default" ? currentSort : undefined,
          page,
          page_size: 25,
        });

        if (reqId !== reqIdRef.current) return;

        let customerList = result?.customers || [];
        let count = typeof result?.count === "number" ? result.count : customerList.length;

        // Fallback safety net: if page-specific result gave 0 customers when no text search is active
        if (
          customerList.length === 0 &&
          !activeSearch &&
          page === 1 &&
          currentActiveFilter === "all" &&
          currentPaymentFilter === "all" &&
          currentBalanceFilter === "all"
        ) {
          try {
            const fallbackCustomers = await fetchCustomersFromApi({
              page: 1,
              page_size: 25,
            });
            if (reqId === reqIdRef.current && fallbackCustomers.length > 0) {
              customerList = fallbackCustomers;
              count = Math.max(count, dashboardStatsRef.current?.totalCustomers ?? fallbackCustomers.length);
            }
          } catch {}
        }

        if (reqId !== reqIdRef.current) return;

        setCustomers(customerList);
        setTotalCustomerCount(count > 0 ? count : (dashboardStatsRef.current?.totalCustomers ?? customerList.length));
      } catch (error: any) {
        if (reqId !== reqIdRef.current) return;
        setCustomers([]);
        if (page === 1) {
          setLoadError(
            error?.response?.status === 403
              ? "Your account does not have permission to view these customers."
              : "Could not load customer records from the server. Check your connection and access, then retry."
          );
        }
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setPageLoading(false);
          setRefreshing(false);
        }
      }
    },
    [debouncedSearch, activeFilter, paymentFilter, balanceFilter, sortOption]
  );

  useEffect(() => {
    void loadData(false, currentPage);
  }, [loadData, currentPage]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData(true, currentPage);
    void loadDashboardStats();
  };

  const effectiveTotalCount =
    totalCustomerCount > 0 ? totalCustomerCount : (dashboardStats?.totalCustomers ?? customers.length);
  const totalPages = Math.max(1, Math.ceil(effectiveTotalCount / 25));

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages || loading || pageLoading) return;
      setCurrentPage(newPage);
      scrollRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    },
    [totalPages, loading, pageLoading]
  );

  const filtersActive =
    activeFilter !== "all" || paymentFilter !== "all" || balanceFilter !== "all" || sortOption !== "default";

  const resetDirectoryFilters = useCallback(() => {
    router.setParams({ filter: undefined });
    setActiveFilter("all");
    setPaymentFilter("all");
    setBalanceFilter("all");
    setSortOption("default");
    setSearchQuery("");
    setDebouncedSearch("");
    setCurrentPage(1);
    void loadData(true, 1, {
      search: "",
      filter: "all",
      payment_status: "all",
      balance: "all",
      sort: "default",
    });
  }, [loadData]);

  const rangeStart = effectiveTotalCount > 0 ? (currentPage - 1) * 25 + 1 : 0;
  const rangeEnd = Math.min(currentPage * 25, effectiveTotalCount);

  const listHeaderComponent = useMemo(
    () => (
      <View>
        {/* Top Workspace Bar */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
                borderColor: isDark ? "#294039" : "#D8E0DC",
              },
            ]}
            onPress={() => setDrawerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open customer navigation"
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={18} color={isDark ? "#F1F7F4" : "#101513"} />
          </TouchableOpacity>

          <View style={styles.titleColumn}>
            <Text style={[styles.screenTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
              {isBusinessManager ? "Enterprise Accounts" : "Customers"}
            </Text>
            <Text style={[styles.screenSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
              {effectiveTotalCount}{" "}
              {isBusinessManager || user?.hierarchy_scope?.can_view_all_salespersons
                ? "enterprise relationships"
                : "assigned accounts"}
            </Text>
          </View>
        </View>

        {/* Summary Bento Card */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
            PORTFOLIO SUMMARY
          </Text>
          <View style={styles.summaryMetricsRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                {dashboardStats?.totalCustomers ?? effectiveTotalCount}
              </Text>
              <Text style={[styles.summaryLbl, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Total</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: isDark ? "#1C2D26" : "#E8EFEB" }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                {dashboardStats?.activeCustomersCount ?? 0}
              </Text>
              <Text style={[styles.summaryLbl, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Active</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: isDark ? "#1C2D26" : "#E8EFEB" }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: isDark ? "#B7F34A" : "#2E7D32" }]}>
                {dashboardStats?.followUpsDueCount ?? 0}
              </Text>
              <Text style={[styles.summaryLbl, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Follow-ups</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: isDark ? "#1C2D26" : "#E8EFEB" }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: isDark ? "#F2B84B" : "#C97A1E" }]}>
                {dashboardStats?.pendingPaymentsCount ?? 0}
              </Text>
              <Text style={[styles.summaryLbl, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Search with filters beside it */}
        <View style={styles.searchFilterRow}>
          <View style={styles.searchInputWrap}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholders={[
                'Search "company name"',
                'Search "contact person"',
                'Search "city"',
                'Search "phone number"',
              ]}
              intervalMs={2000}
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Filter and sort customers"
            accessibilityState={{ selected: filtersActive }}
            onPress={() => setFilterVisible(true)}
            activeOpacity={0.75}
            style={[
              styles.filterButton,
              {
                backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
                borderColor: filtersActive ? (isDark ? "#35D6A0" : "#00A879") : isDark ? "#294039" : "#D8E0DC",
              },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={filtersActive ? (isDark ? "#35D6A0" : "#00A879") : isDark ? "#F1F7F4" : "#101513"}
            />
          </TouchableOpacity>
        </View>

        {/* List Header Count */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.listCountText, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
            Showing {customers.length > 0 ? `${rangeStart}–${rangeEnd}` : "0"} of {effectiveTotalCount} customer
            {effectiveTotalCount === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
    ),
    [
      isDark,
      isBusinessManager,
      searchQuery,
      filtersActive,
      dashboardStats,
      effectiveTotalCount,
      customers.length,
      rangeStart,
      rangeEnd,
      user?.hierarchy_scope?.can_view_all_salespersons,
    ]
  );

  const handleCustomerPress = useCallback((id: string | number) => {
    router.push(`/(employee)/customers/${id}` as any);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Customer }) => item && item.id ? <CustomerListItem item={item} onPress={handleCustomerPress} /> : null,
    [handleCustomerPress]
  );

  const keyExtractor = useCallback((item: Customer, index: number) => (item?.id ? `customer-${item.id}` : `cust-${index}`), []);

  const emptyComponent = useMemo(
    () => (
      <EmptyState
        icon={loadError ? "cloud-offline-outline" : "search-outline"}
        title={
          loadError
            ? "Customer data unavailable"
            : filtersActive || searchQuery
            ? "No matching customers"
            : "No customers found"
        }
        description={
          loadError ||
          (searchQuery || filtersActive || activeFilter !== "all"
            ? "No customers matched your current search or filter criteria. Tap below to clear filters and view all accounts."
            : "No customer accounts are currently loaded. Tap below to refresh.")
        }
        actionLabel={
          loadError
            ? "Retry"
            : filtersActive || searchQuery || activeFilter !== "all"
            ? "Reset Filters"
            : "Refresh List"
        }
        onAction={() => {
          if (loadError) {
            void loadData(true, currentPage);
            return;
          }
          if (filtersActive || searchQuery || activeFilter !== "all") {
            resetDirectoryFilters();
          } else {
            void loadData(true, 1);
          }
        }}
      />
    ),
    [searchQuery, filtersActive, activeFilter, resetDirectoryFilters, loadError, loadData, currentPage]
  );

  const listFooterComponent = useMemo(() => {
    if (totalPages <= 1) return undefined;
    return (
      <View style={styles.paginationRow}>
        <TouchableOpacity
          style={[
            styles.pageBtn,
            {
              borderColor: isDark ? "#294039" : "#DDE5E1",
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
            },
            (currentPage <= 1 || pageLoading) && styles.pageBtnDisabled,
          ]}
          onPress={() => handlePageChange(1)}
          disabled={currentPage <= 1 || loading || pageLoading}
          activeOpacity={0.7}
        >
          <Ionicons
            name="play-back"
            size={14}
            color={currentPage <= 1 ? (isDark ? "#435750" : "#A6B5AF") : isDark ? "#35D6A0" : "#00A879"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pageBtn,
            {
              borderColor: isDark ? "#294039" : "#DDE5E1",
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
            },
            (currentPage <= 1 || pageLoading) && styles.pageBtnDisabled,
          ]}
          onPress={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading || pageLoading}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={currentPage <= 1 ? (isDark ? "#435750" : "#A6B5AF") : isDark ? "#35D6A0" : "#00A879"}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.pageIndicator,
            {
              backgroundColor: isDark ? "#152420" : "#EAF8F4",
              borderColor: isDark ? "#233D35" : "#BDE7D8",
            },
          ]}
        >
          {pageLoading ? (
            <ActivityIndicator size="small" color={isDark ? "#35D6A0" : "#00A879"} />
          ) : (
            <Text style={[styles.pageIndicatorText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
              Page {currentPage} of {totalPages}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.pageBtn,
            {
              borderColor: isDark ? "#294039" : "#DDE5E1",
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
            },
            (currentPage >= totalPages || pageLoading) && styles.pageBtnDisabled,
          ]}
          onPress={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading || pageLoading}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={currentPage >= totalPages ? (isDark ? "#435750" : "#A6B5AF") : isDark ? "#35D6A0" : "#00A879"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pageBtn,
            {
              borderColor: isDark ? "#294039" : "#DDE5E1",
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
            },
            (currentPage >= totalPages || pageLoading) && styles.pageBtnDisabled,
          ]}
          onPress={() => handlePageChange(totalPages)}
          disabled={currentPage >= totalPages || loading || pageLoading}
          activeOpacity={0.7}
        >
          <Ionicons
            name="play-forward"
            size={14}
            color={currentPage >= totalPages ? (isDark ? "#435750" : "#A6B5AF") : isDark ? "#35D6A0" : "#00A879"}
          />
        </TouchableOpacity>
      </View>
    );
  }, [totalPages, currentPage, isDark, handlePageChange, loading, pageLoading]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          {listHeaderComponent}
          <SkeletonCard height={120} />
          <SkeletonCard height={120} />
          <SkeletonCard height={120} />
        </View>
      ) : (
        <FlatList
          ref={scrollRef}
          data={customers}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListFooterComponent={listFooterComponent}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={emptyComponent}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#35D6A0" : "#00A879"}
              colors={[isDark ? "#35D6A0" : "#00A879"]}
            />
          }
        />
      )}
      <CustomerFilterSheet
        visible={filterVisible}
        activityFilter={activeFilter}
        onActivityFilterChange={setActiveFilter}
        paymentFilter={paymentFilter}
        balanceFilter={balanceFilter}
        sortOption={sortOption}
        onPaymentFilterChange={setPaymentFilter}
        onBalanceFilterChange={setBalanceFilter}
        onSortOptionChange={setSortOption}
        onClose={() => setFilterVisible(false)}
        onReset={resetDirectoryFilters}
      />
      <CustomerNavDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    paddingHorizontal: 16,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleColumn: {
    flex: 1,
    marginLeft: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: Typography.bold,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  summaryMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryVal: {
    fontSize: 20,
    fontFamily: Typography.bold,
    letterSpacing: -0.3,
  },
  summaryLbl: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.medium,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  searchFilterRow: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 13,
  },
  listHeaderRow: {
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  listCountText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.medium,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 20,
    marginTop: 6,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.semiBold,
  },
  pageIndicator: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  pageIndicatorText: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.bold,
  },
});
