import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterChip } from "@/components/ui/FilterChip";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadCard } from "@/components/employee/LeadCard";
import { MetricCard } from "@/components/employee/MetricCard";
import { Lead, LeadStage } from "@/data/mockLeads";
import { fetchLeadsFromApi } from "@/services/leadService";

type LeadFilter = "All" | LeadStage;

// Memoized List Item row to prevent unnecessary re-renders in large VirtualizedLists
const LeadListItem = React.memo(
  ({
    item,
    onPress,
  }: {
    item: Lead;
    onPress: (id: string | number) => void;
  }) => {
    const handlePress = useCallback(() => {
      onPress(item.id);
    }, [item.id, onPress]);

    return <LeadCard lead={item} onPress={handlePress} />;
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.item.name === next.item.name &&
      prev.item.stage === next.item.stage &&
      prev.item.intent === next.item.intent &&
      prev.onPress === next.onPress
    );
  }
);


const STAGES: Array<{ key: LeadStage; label: string; count: number }> = [
  { key: "New", label: "New", count: 9 },
  { key: "Contacted", label: "Contacted", count: 8 },
  { key: "Qualified", label: "Qualified", count: 7 },
  { key: "Proposal", label: "Proposal", count: 6 },
  { key: "Won", label: "Won", count: 4 },
];

export default function LeadsDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStage, setActiveStage] = useState<LeadFilter>("All");
  const [showSearch, setShowSearch] = useState(false);

  const loadLeads = useCallback(async (isPullToRefresh = false) => {
    if (!isPullToRefresh) setLoading(true);
    try {
      const data = await fetchLeadsFromApi({
        stage: activeStage,
        search: searchQuery,
      });
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStage, searchQuery]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads(true);
  };

  const filteredLeads = useMemo(() => {
    let list = [...leads];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          (l.companyName || l.company || l.name || "").toLowerCase().includes(q) ||
          (l.contactPerson || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q) ||
          (l.leadSource || (l as any).source_name || "").toLowerCase().includes(q)
      );
    }

    if (activeStage !== "All") {
      list = list.filter((l) => l.stage === activeStage);
    }

    return list;
  }, [leads, searchQuery, activeStage]);

  const listHeaderComponent = useMemo(() => (
    <View>
      {/* Navigation Header */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(employee)"))}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={isDark ? "#F1F7F4" : "#101513"}
          />
        </TouchableOpacity>

        <View style={styles.titleColumn}>
          <Text
            style={[
              styles.screenTitle,
              { color: isDark ? "#F1F7F4" : "#101513" },
            ]}
          >
            Leads Pipeline
          </Text>
          <Text
            style={[
              styles.screenSubtitle,
              { color: isDark ? "#8FA09A" : "#5E6964" },
            ]}
          >
            34 active prospects
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.iconBtn,
            {
              backgroundColor: showSearch
                ? isDark
                  ? "rgba(53, 214, 160, 0.16)"
                  : "#DDF4EA"
                : isDark
                ? "#121F1B"
                : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
          onPress={() => setShowSearch(!showSearch)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={
              showSearch
                ? isDark
                  ? "#35D6A0"
                  : "#00A879"
                : isDark
                ? "#F1F7F4"
                : "#101513"
            }
          />
        </TouchableOpacity>
      </View>

      {/* Pipeline Summary Horizontal Stage Ribbon */}
      <View
        style={[
          styles.ribbonContainer,
          {
            backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
            borderColor: isDark ? "#294039" : "#D8E0DC",
          },
        ]}
      >
        <Text
          style={[
            styles.ribbonLabel,
            { color: isDark ? "#8FA09A" : "#5E6964" },
          ]}
        >
          PIPELINE STAGE BREAKDOWN
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ribbonScroll}
        >
          {STAGES.map((s, idx) => {
            const isSelected = activeStage === s.key;
            return (
              <React.Fragment key={s.key}>
                <TouchableOpacity
                  style={[
                    styles.ribbonItem,
                    isSelected && {
                      backgroundColor: isDark
                        ? "rgba(53, 214, 160, 0.14)"
                        : "#DDF4EA",
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() =>
                    setActiveStage(activeStage === s.key ? "All" : s.key)
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.ribbonCount,
                      {
                        color:
                          s.key === "Won"
                            ? isDark
                              ? "#B7F34A"
                              : "#2E7D32"
                            : isDark
                            ? "#35D6A0"
                            : "#00A879",
                      },
                    ]}
                  >
                    {s.count}
                  </Text>
                  <Text
                    style={[
                      styles.ribbonStageName,
                      {
                        color: isSelected
                          ? isDark
                            ? "#35D6A0"
                            : "#00A879"
                          : isDark
                          ? "#8FA09A"
                          : "#5E6964",
                        fontFamily: isSelected
                          ? Typography.semiBold
                          : Typography.regular,
                      },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>

                {idx < STAGES.length - 1 && (
                  <View style={styles.stageArrow}>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={isDark ? "#294039" : "#D8E0DC"}
                    />
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>

      {/* Summary Metrics (4 blocks) */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Active Leads"
            value="34"
            subValue="Pipeline total"
            icon="people-outline"
          />
          <MetricCard
            label="High Intent"
            value="8"
            subValue="Probable close"
            icon="flash-outline"
            isHighlight
          />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Pipeline Value"
            value="₹4.2L"
            subValue="Weighted ARR"
            icon="cash-outline"
            isHighlight
          />
          <MetricCard
            label="Follow-ups Today"
            value="6"
            subValue="2 demos scheduled"
            icon="calendar-outline"
          />
        </View>
      </View>

      {/* Collapsible Search */}
      {showSearch && (
        <View style={styles.searchWrap}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholders={[
              'Search "company or lead"',
              'Search "contact name"',
              'Search "lead source"',
              'Search "city"',
            ]}
            intervalMs={2000}
          />
        </View>
      )}

      {/* Filter Chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["All", "New", "Contacted", "Qualified", "Proposal", "Won"] as const).map(
            (tab) => {
              const count =
                tab === "All"
                  ? leads.length
                  : leads.filter((l) => l.stage === tab).length;
              return (
                <FilterChip
                  key={tab}
                  label={tab}
                  count={count}
                  isActive={activeStage === tab}
                  onPress={() => setActiveStage(tab)}
                />
              );
            }
          )}
        </ScrollView>
      </View>

      {/* List count */}
      <View style={styles.listHeaderRow}>
        <Text
          style={[
            styles.listCountText,
            { color: isDark ? "#8FA09A" : "#5E6964" },
          ]}
        >
          Showing {filteredLeads.length} lead{filteredLeads.length === 1 ? "" : "s"}
        </Text>
      </View>
    </View>
  ), [
    isDark,
    searchQuery,
    activeStage,
    leads.length,
    filteredLeads.length,
  ]);

  const handleLeadPress = useCallback((id: string | number) => {
    router.push(`/(employee)/leads/${id}` as any);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Lead }) => (
      <LeadListItem item={item} onPress={handleLeadPress} />
    ),
    [handleLeadPress]
  );

  const keyExtractor = useCallback((item: Lead) => String(item.id), []);

  const emptyComponent = useMemo(
    () => (
      <EmptyState
        icon="search-outline"
        title="No leads found"
        description={
          searchQuery
            ? `No leads matched "${searchQuery}". Try a different keyword.`
            : "No prospective leads in this stage."
        }
        actionLabel="Show All Leads"
        onAction={() => {
          setSearchQuery("");
          setActiveStage("All");
        }}
      />
    ),
    [searchQuery]
  );

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
          data={filteredLeads}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={emptyComponent}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
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
  backBtn: {
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ribbonContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  ribbonLabel: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  ribbonScroll: {
    flexDirection: "row",
    alignItems: "center",
  },
  ribbonItem: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 70,
  },
  ribbonCount: {
    fontSize: 18,
    fontFamily: Typography.bold,
  },
  ribbonStageName: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.micro,
    marginTop: 2,
  },
  stageArrow: {
    marginHorizontal: 2,
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchWrap: {
    marginBottom: 12,
  },
  filterBar: {
    marginBottom: 12,
  },
  listHeaderRow: {
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  listCountText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.medium,
  },
});
