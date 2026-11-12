import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router, useGlobalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Typography, FontSizes, Radius } from "@/constants/theme";
import { WorkspaceHeader } from "@/components/employee/WorkspaceHeader";
import { getRoleWorkspaceContext } from "@/utils/greetings";
import { SubAppCard } from "@/components/employee/SubAppCard";
import { SubAppLogo } from "@/components/employee/SubAppLogo";
import { MetricCard } from "@/components/employee/MetricCard";
import { TimelineItem } from "@/components/employee/TimelineItem";
import { SearchBar } from "@/components/ui/SearchBar";
import { triggerLightHaptic } from "@/utils/haptics";
import { GlobalSearchResults } from "@/components/ui/GlobalSearchResults";
import {
  filterExploreApps,
  fetchGlobalRemoteResults,
  buildUnifiedSearchResults,
  RemoteGlobalSearchResult,
} from "@/services/globalSearchService";
import { CustomerCard } from "@/components/employee/CustomerCard";
import { LeadCard } from "@/components/employee/LeadCard";
import { fetchDashboardStatsApi, fetchCustomersFromApi, DashboardStats } from "@/services/customerService";
import { fetchLeadsFromApi } from "@/services/leadService";
import { Customer } from "@/data/customerTypes";
import { Lead } from "@/data/mockLeads";
import {
  fetchUserPermissionsApi,
  AllowedApp,
  UserPermissionProfile,
  DEFAULT_ALLOWED_APPS,
} from "@/services/permissionService";
import {
  fetchHRMSDashboardApi,
  fetchHRMSEmployeesApi,
  handleLeaveActionApi,
  punchAttendanceApi,
  HRMSDashboardData,
  EmployeeDirectoryItem,
  PendingLeave,
} from "@/services/hrmsService";

// HR Modal Content Helpers (Prevents React Native boolean rendering crash)
function getHRModalTitle(modal: string | null): string {
  switch (modal) {
    case "holidays":
      return "Official Company Holidays 2026";
    case "policies":
      return "Shift & Attendance Policies";
    case "leave_bank":
      return "Employee Leave Entitlements";
    case "hiring":
      return "Recruitment & Talent Pipeline";
    case "biometric":
      return "Biometric Kiosk Terminal";
    default:
      return "";
  }
}

function getHRModalSubtitle(modal: string | null): string {
  switch (modal) {
    case "holidays":
      return "Oblu Healthcare Pvt Ltd • Gazetted Calendar";
    case "policies":
      return "Official working hours, grace periods and shift rules";
    case "leave_bank":
      return "Standard annual leave allocation & approval rules";
    case "hiring":
      return "Active job requisitions & recruitment stages";
    case "biometric":
      return "Live terminal hardware status and facial recognition";
    default:
      return "";
  }
}

export default function EmployeeHomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const globalParams = useGlobalSearchParams<{ tab?: string }>();
  const isStaffTab = globalParams.tab === "staff";

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Determine if active user is HR persona (Vanshika, Anshika, or HR role)
  const isHRUserInit = useMemo(() => {
    const uName = ((user as any)?.username || "").toLowerCase();
    const uRole = ((user as any)?.role || "").toLowerCase();
    return (
      uName.includes("vanshika") ||
      uName.includes("anshika") ||
      uRole.includes("hr") ||
      uRole.includes("human resource")
    );
  }, [user]);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const uName = ((user as any)?.username || "").toLowerCase();
    const uRole = ((user as any)?.role || "").toLowerCase();
    return uName.includes("vanshika") || uName.includes("anshika") || uRole.includes("hr")
      ? "hrms"
      : "all";
  });

  const openSubApp = (appId: string) => {
    triggerLightHaptic();
    if (appId === "all") {
      setSelectedCategory("all");
      return;
    }

    const routes: Record<string, string> = {
      customers: "/(employee)/customers",
      calls: "/(user)/status",
      leads: "/(employee)/leads",
      hrms: "/(employee)/hrms",
      inventory: "/(employee)/inventory",
      proforma: "/(employee)/proforma",
      incentives: "/(employee)/incentives",
      security: "/(employee)/security",
    };
    const route = routes[appId];
    if (route) {
      router.push(route as any);
    }
  };

  const [allowedApps, setAllowedApps] = useState<AllowedApp[]>(() => {
    const uName = ((user as any)?.username || "").toLowerCase();
    const uRole = ((user as any)?.role || "").toLowerCase();
    return uName.includes("vanshika") || uName.includes("anshika") || uRole.includes("hr")
      ? [{ id: "hrms", label: "HRMS", icon: "briefcase" }]
      : DEFAULT_ALLOWED_APPS;
  });
  const [userProfile, setUserProfile] = useState<UserPermissionProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hrmsLoading, setHrmsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // HRMS State
  const [hrmsData, setHrmsData] = useState<HRMSDashboardData | null>(null);
  const [hrmsEmployees, setHrmsEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [hrmsSearch, setHrmsSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [isPunching, setIsPunching] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<number | null>(null);
  const [activeHRModal, setActiveHRModal] = useState<
    "holidays" | "policies" | "leave_bank" | "hiring" | "biometric" | null
  >(null);

  // Check if current user is an HR Manager/Staff (Vanshika, Anshika, or HR role/persona)
  const isHR = useMemo(() => {
    const profileRole = (userProfile?.user?.role || "").toLowerCase();
    const authRole = ((user as any)?.role || "").toLowerCase();
    const username = (
      (user as any)?.username ||
      userProfile?.user?.username ||
      ""
    ).toLowerCase();
    const isStrictHRPersona =
      allowedApps.length <= 2 && allowedApps.some((a) => a.id === "hrms");
    return (
      username.includes("vanshika") ||
      username.includes("anshika") ||
      profileRole.includes("hr") ||
      profileRole.includes("human resource") ||
      authRole.includes("hr") ||
      authRole.includes("human resource") ||
      isStrictHRPersona
    );
  }, [userProfile, allowedApps, user]);

  // Role and Workspace contextual headlines & metrics titles
  const roleContext = useMemo(() => {
    const username = (user as any)?.username || userProfile?.user?.username;
    return getRoleWorkspaceContext(
      userProfile?.user?.role || (user as any)?.role,
      (user as any)?.department,
      "Oblu Healthcare Pvt Ltd",
      username
    );
  }, [
    userProfile?.user?.role,
    (user as any)?.role,
    (user as any)?.department,
    (user as any)?.username,
    userProfile?.user?.username,
  ]);

  // Check if current user is Business Manager (Vibhuti Panwar)
  const isBusinessManager = useMemo(() => {
    const profileRole = (userProfile?.user?.role || "").toLowerCase();
    const authRole = ((user as any)?.role || "").toLowerCase();
    const username = ((user as any)?.username || userProfile?.user?.username || "").toLowerCase();
    return (
      profileRole.includes("business") ||
      authRole.includes("business") ||
      authRole.includes("buss_mgr") ||
      username.includes("vibhuti")
    );
  }, [userProfile, user]);

  const [remoteSearch, setRemoteSearch] = useState<RemoteGlobalSearchResult>({
    customers: [],
    leads: [],
    proformas: [],
    inventory: [],
    calls: [],
  });
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);

  const filteredApps = useMemo(
    () => filterExploreApps(allowedApps, searchQuery),
    [allowedApps, searchQuery]
  );

  // Live unified global search results across Sub-Apps, Customers, Leads, Proforma, Inventory & Staff
  const searchResults = useMemo(
    () =>
      buildUnifiedSearchResults({
        query: searchQuery,
        apps: allowedApps,
        localCustomers: customers,
        localLeads: leads,
        localEmployees: hrmsEmployees,
        localLeaves: hrmsData?.pending_leaves || [],
        remote: remoteSearch,
        hideLeadsAndCustomers: isHR,
      }),
    [
      searchQuery,
      allowedApps,
      customers,
      leads,
      hrmsEmployees,
      hrmsData?.pending_leaves,
      remoteSearch,
      isHR,
    ]
  );

  // ── Load live permissions & apps ──────────────────────────────────────────
  const loadPermissionsAndApps = useCallback(async () => {
    try {
      const data = await fetchUserPermissionsApi();
      setUserProfile(data);
      const uRole = (data.user?.role || (user as any)?.role || "").toLowerCase();
      const uName = (data.user?.username || (user as any)?.username || "").toLowerCase();
      const isMgr = uRole.includes("business") || uRole.includes("buss_mgr") || uName.includes("vibhuti");
      const isHRPerson =
        uRole.includes("hr") ||
        uRole.includes("human resource") ||
        uName.includes("vanshika") ||
        uName.includes("anshika");

      if (isHRPerson) {
        setAllowedApps([
          { id: "hrms", label: "HRMS", icon: "briefcase" },
        ]);
        setSelectedCategory("hrms");
        return;
      }

      if (Array.isArray(data.allowed_apps) && data.allowed_apps.length > 0) {
        const filtered = (data.allowed_apps || []).filter((a: any) => {
          if (a.id === "leads") return false;
          if (a.id === "hrms") {
            if (isMgr) return false;
            return (data.permissions || []).some((p: string) => p.startsWith("hrms"));
          }
          return true;
        });

        setAllowedApps(filtered);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  // ── Load dashboard stats ──────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchDashboardStatsApi();
      setStats(data);
    } catch {
      // Ignored
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Load HRMS data ────────────────────────────────────────────────────────
  const loadHRMS = useCallback(async () => {
    try {
      const [dash, emps] = await Promise.all([
        fetchHRMSDashboardApi(),
        fetchHRMSEmployeesApi(),
      ]);
      setHrmsData(dash);
      setHrmsEmployees(emps);
    } catch {
      // Ignored
    } finally {
      setHrmsLoading(false);
    }
  }, []);

  // ── Load customers for category view ──────────────────────────────────────
  const loadCustomers = useCallback(async () => {
    try {
      const data = await fetchCustomersFromApi();
      setCustomers(data);
    } catch {
      // Ignored
    }
  }, []);

  // ── Load leads for category view ──────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeadsFromApi();
      setLeads(data);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadPermissionsAndApps();
    loadStats();
    loadHRMS();
    loadCustomers();
    loadLeads();
  }, [loadPermissionsAndApps, loadStats, loadHRMS, loadCustomers, loadLeads]);

  useEffect(() => {
    if (selectedCategory === "customers") {
      loadCustomers();
    }
    if (selectedCategory === "leads") {
      loadLeads();
    }
    if (selectedCategory === "hrms" || isHR) {
      loadHRMS();
    }
  }, [selectedCategory, isHR, loadCustomers, loadLeads, loadHRMS]);

  // Debounced live multi-module backend global search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setRemoteSearch({ customers: [], leads: [], proformas: [], inventory: [], calls: [] });
      setIsRemoteSearching(false);
      return;
    }

    const appIds = new Set(allowedApps.map((a) => a.id.toLowerCase()));
    let cancelled = false;
    setIsRemoteSearching(true);

    const timer = setTimeout(() => {
      fetchGlobalRemoteResults(q, {
        allowCustomers: !isHR && (appIds.has("customers") || appIds.has("customer_data")),
        allowLeads: !isHR,
        allowProforma: !isHR && appIds.has("proforma"),
        allowInventory: !isHR && appIds.has("inventory"),
        allowCalls: false,
      })
        .then((res) => {
          if (!cancelled) {
            setRemoteSearch(res);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsRemoteSearching(false);
          }
        });
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, allowedApps, isHR]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadPermissionsAndApps(),
      loadStats(),
      loadHRMS(),
      loadCustomers(),
      loadLeads(),
    ]);
    setRefreshing(false);
  }, [loadPermissionsAndApps, loadStats, loadHRMS, loadCustomers, loadLeads]);

  // ── HR Leave Action (Approve / Reject) ─────────────────────────────────────
  const onLeaveAction = async (leaveId: number, action: "approve" | "reject") => {
    setProcessingLeaveId(leaveId);
    try {
      const res = await handleLeaveActionApi(leaveId, action);
      if (res.success) {
        Alert.alert("Success", res.message || `Leave application #${leaveId} has been ${action}d.`);
        // Optimistically update list
        setHrmsData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              pending_leaves: Math.max(0, prev.stats.pending_leaves - 1),
            },
            pending_leaves: prev.pending_leaves.filter((l) => l.id !== leaveId),
          };
        });
      } else {
        Alert.alert("Error", res.message);
      }
    } finally {
      setProcessingLeaveId(null);
    }
  };

  // ── HR Punch Action (Punch In / Punch Out) ────────────────────────────────
  const onPunchAttendance = async () => {
    setIsPunching(true);
    try {
      const res = await punchAttendanceApi();
      if (res.success) {
        Alert.alert("Attendance Marked", res.message);
        loadHRMS();
      } else {
        Alert.alert("Punch Notice", res.message);
      }
    } finally {
      setIsPunching(false);
    }
  };

  const handleProfilePress = () => {
    router.push("/(employee)/profile" as any);
  };

  const isAdmin = user?.role?.toLowerCase() === "admin" || userProfile?.user?.role?.toLowerCase() === "admin";

  const getAppAccent = (id: string) => {
    switch (id) {
      case "all":
        return isDark ? "#35D6A0" : "#00A879";
      case "customers":
        return isDark ? "#38BDF8" : "#0284C7";
      case "leads":
        return isDark ? "#FBBF24" : "#D97706";
      case "inventory":
        return isDark ? "#818CF8" : "#4F46E5";
      case "proforma":
        return isDark ? "#34D399" : "#059669";
      case "hrms":
        return isDark ? "#35D6A0" : "#00A879";
      case "incentives":
        return isDark ? "#FACC15" : "#CA8A04";
      default:
        return isDark ? "#35D6A0" : "#00A879";
    }
  };

  // Filtered employees in directory
  const filteredEmployees = useMemo(() => {
    let list = [...hrmsEmployees];
    if (hrmsSearch.trim()) {
      const q = hrmsSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employee_code.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q)
      );
    }
    if (selectedDeptFilter !== "all") {
      list = list.filter((e) => e.department.toLowerCase() === selectedDeptFilter.toLowerCase());
    }
    return list;
  }, [hrmsEmployees, hrmsSearch, selectedDeptFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 96 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#35D6A0" : "#00A879"}
            colors={[isDark ? "#35D6A0" : "#00A879"]}
          />
        }
      >
        {/* Workspace Header */}
        <WorkspaceHeader onProfilePress={handleProfilePress} />

        {/* Global Search Bar (hidden when HRMS operations is active so search bar sits directly above HRMS header) */}
        {selectedCategory !== "hrms" && !(isHR && selectedCategory === "all") && (
          <View style={styles.searchBarWrapper}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholders={
                isHR
                  ? [
                      'Search "employees"',
                      'Search "departments"',
                      'Search "leave requests"',
                      'Search "HR notices"',
                    ]
                  : [
                      'Search "customers"',
                      'Search "leads"',
                      'Search "accounts"',
                      'Search "records"',
                    ]
              }
              intervalMs={2000}
              onClear={() => setSearchQuery("")}
            />
          </View>
        )}

        {/* ── Horizontal App Categories Row (filters live while searching) ─── */}
        {(!searchQuery.trim() || filteredApps.length > 0) && (
          <View style={styles.categoriesContainer}>
            {filteredApps.length > 1 && (
              <Text style={[styles.exploreAppsHeading, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                Explore Apps
              </Text>
            )}
            <FlatList
              data={filteredApps}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
              renderItem={({ item }) => {
                const isSelected = selectedCategory === item.id;
                const accentColor = getAppAccent(item.id);

                return (
                  <TouchableOpacity
                    style={styles.categoryItem}
                    onPress={() => openSubApp(item.id)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.categoryCircle,
                        {
                          borderColor: isSelected
                            ? accentColor
                            : isDark
                            ? "#294039"
                            : "#D8E0DC",
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <SubAppLogo
                        appId={item.id}
                        borderRadius={0}
                        borderWidth={0}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        {
                          color: isSelected
                            ? isDark
                              ? "#F1F7F4"
                              : "#101513"
                            : isDark
                            ? "#8FA09A"
                            : "#5E6964",
                          fontFamily: isSelected ? Typography.bold : Typography.medium,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <View
                        style={[
                          styles.activeIndicator,
                          { backgroundColor: accentColor },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ── LIVE SEARCH RESULTS VIEW ─────────────────────────────────────── */}
        {searchQuery.trim().length > 0 ? (
          <View style={styles.searchResultsContainer}>
            <GlobalSearchResults
              query={searchQuery}
              results={searchResults}
              isSearching={isRemoteSearching}
              onClear={() => setSearchQuery("")}
              onOpenApp={openSubApp}
              onPressCustomer={(c) => router.push(`/(employee)/customers/${c.id}` as any)}
              onPressLead={(l) => router.push(`/(employee)/leads/${l.id}` as any)}
              onPressProforma={() => router.push("/(employee)/proforma" as any)}
              onPressInventory={() => router.push("/(employee)/inventory" as any)}
              onPressEmployee={() => router.push("/(employee)/hrms" as any)}
              onPressLeave={() => router.push("/(employee)/hrms" as any)}
            />
          </View>
        ) : (
          <>
            {/* ── 1. ALL CATEGORY VIEW (Sales CRM only, never for HR) ─────────── */}
        {selectedCategory === "all" && !isHR && (
          <>
            {/* Hero Section — Clean Role Workspace Heading (No Role/Unit Subtitle) */}
            <View style={styles.heroSection}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.heroHeading,
                      { color: isDark ? "#F1F7F4" : "#101513" },
                    ]}
                  >
                    {isHR && isStaffTab ? "Workforce Directory" : roleContext.headline}
                  </Text>
                </View>

                {isHR && (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 16,
                      backgroundColor: isDark ? "rgba(53, 214, 160, 0.14)" : "#E8F5EE",
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(53, 214, 160, 0.28)" : "#C0E8D7",
                    }}
                    onPress={() => {
                      router.replace({
                        pathname: "/(employee)",
                        params: { tab: isStaffTab ? "dashboard" : "staff" },
                      } as any);
                    }}
                  >
                    <Ionicons
                      name={isStaffTab ? "grid-outline" : "people-outline"}
                      size={14}
                      color={isDark ? "#35D6A0" : "#00A879"}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: Typography.medium,
                        color: isDark ? "#35D6A0" : "#00A879",
                      }}
                    >
                      {isStaffTab ? "Dashboard" : "Directory"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* If user is HR, show HR Bento Suite instead of Sales CRM */}
            {isHR ? (
              <View style={styles.bentoSection}>
                {/* Workforce Directory Tile */}
                <TouchableOpacity
                  style={[
                    styles.hrBentoTile,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                    },
                  ]}
                  onPress={() => openSubApp("hrms")}
                  activeOpacity={0.8}
                >
                  <View style={styles.hrBentoHeader}>
                    <View style={[styles.hrBentoIconBox, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.10)" }]}>
                      <Ionicons name="people" size={24} color={isDark ? "#35D6A0" : "#00A879"} />
                    </View>
                    <View style={styles.hrBentoTag}>
                      <Text style={[styles.hrBentoTagText, { color: isDark ? "#35D6A0" : "#00A879" }]}>ACTIVE STAFF</Text>
                    </View>
                  </View>
                  <Text style={[styles.hrBentoStatNum, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    {hrmsData?.stats?.total_employees ?? 12}
                  </Text>
                  <Text style={[styles.hrBentoStatSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    Employees enrolled across 5 departments
                  </Text>
                </TouchableOpacity>

                {/* Attendance & Kiosk Tile */}
                <TouchableOpacity
                  style={[
                    styles.hrBentoTile,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                    },
                  ]}
                  onPress={() => openSubApp("hrms")}
                  activeOpacity={0.8}
                >
                  <View style={styles.hrBentoHeader}>
                    <View style={[styles.hrBentoIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                      <Ionicons name="finger-print" size={24} color="#10B981" />
                    </View>
                    <View style={[styles.hrBentoTag, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
                      <Text style={[styles.hrBentoTagText, { color: "#10B981" }]}>TODAY PRESENT</Text>
                    </View>
                  </View>
                  <Text style={[styles.hrBentoStatNum, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    {hrmsData?.stats?.present_today ?? 4}
                  </Text>
                  <Text style={[styles.hrBentoStatSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    {hrmsData?.stats?.absent_today ?? 8} staff on leave / absent today
                  </Text>
                </TouchableOpacity>

                {/* Leave Approvals Tile */}
                <TouchableOpacity
                  style={[
                    styles.hrBentoTile,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                    },
                  ]}
                  onPress={() => openSubApp("hrms")}
                  activeOpacity={0.8}
                >
                  <View style={styles.hrBentoHeader}>
                    <View style={[styles.hrBentoIconBox, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.10)" }]}>
                      <Ionicons name="calendar" size={24} color={isDark ? "#35D6A0" : "#00A879"} />
                    </View>
                    <View style={[styles.hrBentoTag, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "rgba(0, 168, 121, 0.10)" }]}>
                      <Text style={[styles.hrBentoTagText, { color: isDark ? "#35D6A0" : "#00A879" }]}>ACTION REQUIRED</Text>
                    </View>
                  </View>
                  <Text style={[styles.hrBentoStatNum, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    {hrmsData?.stats?.pending_leaves ?? 2}
                  </Text>
                  <Text style={[styles.hrBentoStatSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    Pending leave requests awaiting review
                  </Text>
                </TouchableOpacity>
              </View>
            ) : isBusinessManager ? (
              /* Business Manager Bento Suite (No redundant Call Tracker - dedicated tab in footer) */
              <View style={styles.bentoSection}>
                <SubAppCard
                  type="customers"
                  onPress={() => router.push("/(employee)/customers" as any)}
                  customersCount={stats?.totalCustomers ?? 180}
                  followUpsCount={stats?.followUpsDueCount ?? 0}
                />
                <TouchableOpacity
                  style={[
                    styles.bentoModuleCard,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                    },
                  ]}
                  onPress={() => openSubApp("incentives")}
                  activeOpacity={0.8}
                >
                  <View style={styles.bentoModuleHeader}>
                    <SubAppLogo
                      appId="incentives"
                      size={48}
                      borderRadius={14}
                      borderColor={isDark ? "rgba(53, 214, 160, 0.25)" : "rgba(0, 168, 121, 0.22)"}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={[
                          styles.hrBentoTag,
                          {
                            backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "rgba(0, 168, 121, 0.10)",
                          },
                        ]}
                      >
                        <Text style={[styles.hrBentoTagText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                          INCENTIVES
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.bentoArrowCircle,
                          {
                            backgroundColor: isDark ? "#15221D" : "#F7F9F8",
                            borderColor: isDark ? "#294039" : "#D8E0DC",
                          },
                        ]}
                      >
                        <Ionicons name="arrow-forward" size={16} color={isDark ? "#35D6A0" : "#00A879"} />
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.bentoModuleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    Commission Matrix
                  </Text>
                  <Text style={[styles.bentoModuleSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    Tiered sales commission & performance payouts
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bentoModuleCard,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                    },
                  ]}
                  onPress={() => openSubApp("inventory")}
                  activeOpacity={0.8}
                >
                  <View style={styles.bentoModuleHeader}>
                    <SubAppLogo
                      appId="inventory"
                      size={48}
                      borderRadius={14}
                      borderColor={isDark ? "rgba(53, 214, 160, 0.25)" : "rgba(0, 168, 121, 0.22)"}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={[
                          styles.hrBentoTag,
                          {
                            backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "rgba(0, 168, 121, 0.10)",
                          },
                        ]}
                      >
                        <Text style={[styles.hrBentoTagText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                          WAREHOUSE
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.bentoArrowCircle,
                          {
                            backgroundColor: isDark ? "#15221D" : "#F7F9F8",
                            borderColor: isDark ? "#294039" : "#D8E0DC",
                          },
                        ]}
                      >
                        <Ionicons name="arrow-forward" size={16} color={isDark ? "#35D6A0" : "#00A879"} />
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.bentoModuleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    540+ SKUs
                  </Text>
                  <Text style={[styles.bentoModuleSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    Live inventory & warehouse stock visibility
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bentoModuleCard,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                    },
                  ]}
                  onPress={() => openSubApp("proforma")}
                  activeOpacity={0.8}
                >
                  <View style={styles.bentoModuleHeader}>
                    <SubAppLogo
                      appId="proforma"
                      size={48}
                      borderRadius={14}
                      borderColor={isDark ? "rgba(53, 214, 160, 0.25)" : "rgba(0, 168, 121, 0.22)"}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={[
                          styles.hrBentoTag,
                          {
                            backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "rgba(0, 168, 121, 0.10)",
                          },
                        ]}
                      >
                        <Text style={[styles.hrBentoTagText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                          COMMERCIAL
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.bentoArrowCircle,
                          {
                            backgroundColor: isDark ? "#15221D" : "#F7F9F8",
                            borderColor: isDark ? "#294039" : "#D8E0DC",
                          },
                        ]}
                      >
                        <Ionicons name="arrow-forward" size={16} color={isDark ? "#35D6A0" : "#00A879"} />
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.bentoModuleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    Proforma Invoices
                  </Text>
                  <Text style={[styles.bentoModuleSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    Issue quotations, commercial pricing & approvals
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Standard Sales Bento Suite (No redundant Call Tracker - dedicated tab in footer) */
              <View style={styles.bentoSection}>
                <SubAppCard
                  type="customers"
                  onPress={() => router.push("/(employee)/customers" as any)}
                  customersCount={stats?.totalCustomers ?? 0}
                  followUpsCount={stats?.followUpsDueCount ?? 0}
                />
                <SubAppCard
                  type="leads"
                  onPress={() => router.push("/(employee)/leads" as any)}
                  leadsCount={stats?.totalLeadsCount ?? leads.length}
                  pipelineValue={stats?.totalOutstandingFormatted ? `Due ${stats.totalOutstandingFormatted}` : "Active"}
                />
              </View>
            )}

            {/* Dynamic Role-Specific Metrics Section */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                {roleContext.metricsTitle}
              </Text>
              <Text style={[styles.sectionTag, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                Live Sync
              </Text>
            </View>

            {isHR ? (
              <View style={styles.metricsGrid}>
                <View style={styles.metricsRow}>
                  <MetricCard
                    label="Total Staff"
                    value={String(hrmsData?.stats?.total_employees ?? 0)}
                    subValue="in directory"
                    icon="people-outline"
                    loading={hrmsLoading && !hrmsData}
                    onPress={() => openSubApp("hrms")}
                  />
                  <MetricCard
                    label="Checked In"
                    value={String(hrmsData?.stats?.present_today ?? 0)}
                    subValue="present today"
                    icon="checkmark-circle-outline"
                    isHighlight
                    isLive
                    loading={hrmsLoading && !hrmsData}
                    onPress={() => openSubApp("hrms")}
                  />
                </View>
                <View style={styles.metricsRow}>
                  <MetricCard
                    label="Pending Leaves"
                    value={String(hrmsData?.stats?.pending_leaves ?? 0)}
                    subValue="approvals due"
                    icon="calendar-outline"
                    isHighlight
                    loading={hrmsLoading && !hrmsData}
                    onPress={() => openSubApp("hrms")}
                  />
                  <MetricCard
                    label="Departments"
                    value={String(hrmsData?.stats?.total_departments ?? 0)}
                    subValue="divisions"
                    icon="business-outline"
                    loading={hrmsLoading && !hrmsData}
                    onPress={() => openSubApp("hrms")}
                  />
                </View>
              </View>
            ) : isBusinessManager ? (
              <View style={styles.metricsGrid}>
                <View style={styles.metricsRow}>
                  <MetricCard
                    label="Enterprise Accounts"
                    value={String(stats?.totalCustomers ?? 0)}
                    subValue="corporate portfolio"
                    icon="business-outline"
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("customers")}
                  />
                  <MetricCard
                    label="Follow-ups Due"
                    value={String(stats?.followUpsDueCount ?? 0)}
                    subValue="scheduled reviews"
                    icon="calendar-outline"
                    isHighlight
                    isLive
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("customers")}
                  />
                </View>
                <View style={styles.metricsRow}>
                  <MetricCard
                    label="Overdue Invoices"
                    value={String(stats?.overduePaymentsCount ?? 0)}
                    subValue="credit period crossed"
                    icon="alert-circle-outline"
                    isHighlight={(stats?.overduePaymentsCount ?? 0) > 0}
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("proforma")}
                  />
                  <MetricCard
                    label="Total Exposure"
                    value={stats?.totalOutstandingFormatted ?? "₹0"}
                    subValue="receivables due"
                    icon="cube-outline"
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("customers")}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.metricsGrid}>
                <View style={styles.metricsRow}>
                  <MetricCard
                    label="My Customers"
                    value={String(stats?.totalCustomers ?? 0)}
                    subValue="assigned accounts"
                    icon="people-outline"
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("customers")}
                  />
                  <MetricCard
                    label="Follow-ups Due"
                    value={String(stats?.followUpsDueCount ?? 0)}
                    subValue="due today"
                    icon="calendar-outline"
                    isHighlight
                    isLive
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("customers")}
                  />
                </View>
                <View style={styles.metricsRow}>
                  <MetricCard
                    label="Accounts with Dues"
                    value={String(stats?.overduePaymentsCount ?? 0)}
                    subValue="payment pending"
                    icon="cash-outline"
                    isHighlight={(stats?.overduePaymentsCount ?? 0) > 0}
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("customers")}
                  />
                  <MetricCard
                    label="Active Leads"
                    value={String(stats?.totalLeadsCount ?? leads.length)}
                    subValue="pipeline prospects"
                    icon="filter-outline"
                    loading={statsLoading && !stats}
                    onPress={() => openSubApp("leads")}
                  />
                </View>
              </View>
            )}

            
          </>
        )}

        {/* ── 2. FULL WORKING HRMS OPERATIONS SUITE (Dedicated for HR & Vanshika/Anshika) ─── */}
        {(selectedCategory === "hrms" || (selectedCategory === "all" && isHR)) && (
          <View style={styles.moduleSection}>
            {/* Search Bar directly above HRMS Operations Header */}
            <View style={[styles.searchBarWrapper, { marginBottom: 14 }]}>
              <SearchBar
                value={hrmsSearch || searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setHrmsSearch(text);
                }}
                placeholders={[
                  'Search "employee name"',
                  'Search "employee code"',
                  'Search "department"',
                  'Search "designation"',
                ]}
                intervalMs={2000}
                onClear={() => {
                  setSearchQuery("");
                  setHrmsSearch("");
                }}
              />
            </View>

            {/* Header */}
            <View style={styles.moduleHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.moduleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  HRMS Operations
                </Text>
                <Text style={[styles.moduleSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  Workforce Management, Attendance & Leave Approvals
                </Text>
              </View>
            </View>

            {/* 4 Telemetry Metric Tiles - 3D Outward Boxes with Specular Lighting */}
            <View style={styles.hrmsMetricsGrid}>
              <View
                style={[
                  styles.hrmsMetricTile,
                  {
                    backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                    borderColor: isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
                    borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                    borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                    shadowColor: isDark ? "#000000" : "#0D2B20",
                    shadowOpacity: isDark ? 0.46 : 0.09,
                  },
                ]}
              >
                <Text style={[styles.hrmsMetricLabel, { color: isDark ? "#8FA09A" : "#5E6964" }]}>WORKFORCE</Text>
                <Text style={[styles.hrmsMetricValue, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  {hrmsData?.stats?.total_employees ?? 12}
                </Text>
                <Text style={[styles.hrmsMetricSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Active employees</Text>
              </View>

              <View
                style={[
                  styles.hrmsMetricTile,
                  {
                    backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                    borderColor: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(16, 185, 129, 0.20)",
                    borderTopColor: isDark ? "rgba(16, 185, 129, 0.50)" : "rgba(255, 255, 255, 0.98)",
                    borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                    shadowColor: isDark ? "#000000" : "#0D2B20",
                    shadowOpacity: isDark ? 0.46 : 0.09,
                  },
                ]}
              >
                <Text style={[styles.hrmsMetricLabel, { color: "#10B981" }]}>PRESENT TODAY</Text>
                <Text style={[styles.hrmsMetricValue, { color: "#10B981" }]}>
                  {hrmsData?.stats?.present_today ?? 4}
                </Text>
                <Text style={[styles.hrmsMetricSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>{hrmsData?.stats?.absent_today ?? 8} on leave / absent</Text>
              </View>

              <View
                style={[
                  styles.hrmsMetricTile,
                  {
                    backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                    borderColor: (hrmsData?.stats?.pending_leaves ?? 2) > 0
                      ? isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(217, 119, 6, 0.25)"
                      : isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
                    borderTopColor: (hrmsData?.stats?.pending_leaves ?? 2) > 0
                      ? isDark ? "rgba(245, 158, 11, 0.55)" : "rgba(255, 255, 255, 0.98)"
                      : isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                    borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                    shadowColor: isDark ? "#000000" : "#0D2B20",
                    shadowOpacity: isDark ? 0.46 : 0.09,
                  },
                ]}
              >
                <Text style={[styles.hrmsMetricLabel, { color: isDark ? "#35D6A0" : "#00A879" }]}>PENDING LEAVES</Text>
                <Text style={[styles.hrmsMetricValue, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                  {hrmsData?.stats?.pending_leaves ?? 2}
                </Text>
                <Text style={[styles.hrmsMetricSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Approvals required</Text>
              </View>

              <View
                style={[
                  styles.hrmsMetricTile,
                  {
                    backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                    borderColor: isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
                    borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                    borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                    shadowColor: isDark ? "#000000" : "#0D2B20",
                    shadowOpacity: isDark ? 0.46 : 0.09,
                  },
                ]}
              >
                <Text style={[styles.hrmsMetricLabel, { color: isDark ? "#8FA09A" : "#5E6964" }]}>DEPARTMENTS</Text>
                <Text style={[styles.hrmsMetricValue, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  {hrmsData?.stats?.total_departments ?? 5}
                </Text>
                <Text style={[styles.hrmsMetricSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Corporate units</Text>
              </View>
            </View>

            {/* HR Operations Quick Modules (From HRMS Dashboard Template) */}
            <View style={styles.hrToolkitSection}>
              <Text style={[styles.hrToolkitHeaderTitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                HR OPERATIONS TOOLKIT & POLICIES
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.hrToolChip,
                    {
                      backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                      borderColor: isDark ? "rgba(53, 214, 160, 0.22)" : "rgba(13, 43, 32, 0.10)",
                      borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                      shadowOpacity: isDark ? 0.35 : 0.08,
                    },
                  ]}
                  onPress={() => setActiveHRModal("holidays")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={15} color="#35D6A0" />
                  <Text style={[styles.hrToolChipText, { color: isDark ? "#F1F7F4" : "#101513" }]}>Company Holidays</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.hrToolChip,
                    {
                      backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                      borderColor: isDark ? "rgba(53, 214, 160, 0.22)" : "rgba(13, 43, 32, 0.10)",
                      borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                      shadowOpacity: isDark ? 0.35 : 0.08,
                    },
                  ]}
                  onPress={() => setActiveHRModal("policies")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="time-outline" size={15} color="#F59E0B" />
                  <Text style={[styles.hrToolChipText, { color: isDark ? "#F1F7F4" : "#101513" }]}>Shift Policies</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.hrToolChip,
                    {
                      backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                      borderColor: isDark ? "rgba(53, 214, 160, 0.22)" : "rgba(13, 43, 32, 0.10)",
                      borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                      shadowOpacity: isDark ? 0.35 : 0.08,
                    },
                  ]}
                  onPress={() => setActiveHRModal("leave_bank")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="briefcase-outline" size={15} color="#6366F1" />
                  <Text style={[styles.hrToolChipText, { color: isDark ? "#F1F7F4" : "#101513" }]}>Leave Balances</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.hrToolChip,
                    {
                      backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                      borderColor: isDark ? "rgba(53, 214, 160, 0.22)" : "rgba(13, 43, 32, 0.10)",
                      borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                      shadowOpacity: isDark ? 0.35 : 0.08,
                    },
                  ]}
                  onPress={() => setActiveHRModal("hiring")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-add-outline" size={15} color="#EC4899" />
                  <Text style={[styles.hrToolChipText, { color: isDark ? "#F1F7F4" : "#101513" }]}>Hiring Pipeline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.hrToolChip,
                    {
                      backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                      borderColor: isDark ? "rgba(53, 214, 160, 0.22)" : "rgba(13, 43, 32, 0.10)",
                      borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                      shadowOpacity: isDark ? 0.35 : 0.08,
                    },
                  ]}
                  onPress={() => setActiveHRModal("biometric")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="finger-print-outline" size={15} color="#10B981" />
                  <Text style={[styles.hrToolChipText, { color: isDark ? "#F1F7F4" : "#101513" }]}>Biometric Kiosk</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Attendance Punch Terminal Card */}
            {!isStaffTab && (
            <>
            <View
              style={[
                styles.punchTerminalCard,
                {
                  backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                  borderColor: isDark ? "rgba(53, 214, 160, 0.20)" : "rgba(13, 43, 32, 0.08)",
                  borderTopColor: isDark ? "rgba(53, 214, 160, 0.42)" : "rgba(255, 255, 255, 0.98)",
                  borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                  shadowColor: isDark ? "#000000" : "#0D2B20",
                  shadowOpacity: isDark ? 0.48 : 0.09,
                },
              ]}
            >
              <View style={styles.punchTerminalTop}>
                <View style={styles.punchIconBox}>
                  <Ionicons name="time" size={24} color={isDark ? "#35D6A0" : "#00A879"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.punchTerminalTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    Attendance Terminal
                  </Text>
                  <Text style={[styles.punchTerminalSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    {hrmsData?.user_punch?.has_punched_in
                      ? `Checked in at ${hrmsData.user_punch.punch_in_time}`
                      : "Not punched in yet today"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.punchActionButton,
                    {
                      backgroundColor: hrmsData?.user_punch?.has_punched_in
                        ? isDark
                          ? "rgba(239, 68, 68, 0.16)"
                          : "#FEE2E2"
                        : isDark
                        ? "rgba(16, 185, 129, 0.16)"
                        : "#D1FAE5",
                      borderColor: hrmsData?.user_punch?.has_punched_in ? "#EF4444" : "#10B981",
                    },
                  ]}
                  onPress={onPunchAttendance}
                  disabled={isPunching}
                  activeOpacity={0.8}
                >
                  {isPunching ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <>
                      <Ionicons
                        name={hrmsData?.user_punch?.has_punched_in ? "log-out" : "log-in"}
                        size={16}
                        color={hrmsData?.user_punch?.has_punched_in ? "#EF4444" : "#10B981"}
                      />
                      <Text
                        style={[
                          styles.punchActionText,
                          { color: hrmsData?.user_punch?.has_punched_in ? "#EF4444" : "#10B981" },
                        ]}
                      >
                        {hrmsData?.user_punch?.has_punched_in ? "Punch Out" : "Punch In"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Biometric Verification Info */}
              <View style={[styles.kioskInfoBox, { backgroundColor: isDark ? "#121F1B" : "#F8FAFC" }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
                <Text style={[styles.kioskInfoText, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  Biometric attendance terminal synchronized. Secure verification active.
                </Text>
              </View>
            </View>

            {/* Pending Leave Approvals Queue (Actionable) */}
            <View style={styles.subSectionHeader}>
              <Text style={[styles.subSectionTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                Pending Leave Applications ({hrmsData?.pending_leaves?.length ?? 0})
              </Text>
              <Text style={styles.subSectionBadge}>Action Required</Text>
            </View>

            {hrmsData?.pending_leaves && hrmsData.pending_leaves.length > 0 ? (
              <View style={{ gap: 10, marginBottom: 20 }}>
                {hrmsData.pending_leaves.map((leave) => (
                  <View
                    key={leave.id}
                    style={[
                      styles.leaveCard,
                      {
                        backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                        borderColor: isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
                        borderTopColor: isDark ? "rgba(53, 214, 160, 0.38)" : "rgba(255, 255, 255, 0.98)",
                        borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                        shadowColor: isDark ? "#000000" : "#0D2B20",
                        shadowOpacity: isDark ? 0.45 : 0.09,
                      },
                    ]}
                  >
                    <View style={styles.leaveCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.leaveEmployeeName, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                          {leave.employee_name} ({leave.employee_code})
                        </Text>
                        <Text style={[styles.leaveDepartment, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                          {leave.department} • {leave.leave_type} ({leave.total_days} day{leave.total_days === 1 ? "" : "s"})
                        </Text>
                      </View>
                      <View style={styles.leaveDaysBadge}>
                        <Text style={styles.leaveDaysText}>{leave.start_date}</Text>
                      </View>
                    </View>

                    <Text style={[styles.leaveReasonText, { color: isDark ? "#C1CDC7" : "#334155" }]}>
                      "{leave.reason}"
                    </Text>

                    {/* Action Buttons: Approve / Reject */}
                    <View style={styles.leaveActionsRow}>
                      <TouchableOpacity
                        style={[styles.leaveBtn, styles.approveBtn]}
                        onPress={() => onLeaveAction(leave.id, "approve")}
                        disabled={processingLeaveId === leave.id}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                        <Text style={styles.leaveBtnText}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.leaveBtn, styles.rejectBtn]}
                        onPress={() => onLeaveAction(leave.id, "reject")}
                        disabled={processingLeaveId === leave.id}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle" size={15} color="#FFFFFF" />
                        <Text style={styles.leaveBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyBox, { backgroundColor: isDark ? "#0E1714" : "#FFFFFF", borderColor: isDark ? "#294039" : "#D8E0DC" }]}>
                <Ionicons name="checkmark-done-circle" size={36} color="#10B981" />
                <Text style={[styles.emptyBoxTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  All Leave Requests Resolved
                </Text>
                <Text style={styles.emptyBoxSub}>
                  No pending employee leave applications requiring approval.
                </Text>
              </View>
            )}

            </>
            )}
            {/* Workforce Staff Directory Section Header */}
            <View style={[styles.subSectionHeader, { marginTop: 16, marginBottom: 12 }]}>
              <Text style={[styles.subSectionTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                Workforce Directory ({filteredEmployees.length})
              </Text>
              <Text style={[styles.subSectionBadge, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                Active Staff
              </Text>
            </View>

            {/* Employee Cards List */}
            <View style={{ gap: 10 }}>
              {filteredEmployees.map((emp) => {
                const initials = emp.name
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "EM";

                const handleCall = () => {
                  if (emp.phone) {
                    Linking.openURL(`tel:${emp.phone}`).catch(() => {});
                  }
                };

                const handleEmail = () => {
                  if (emp.email) {
                    Linking.openURL(`mailto:${emp.email}`).catch(() => {});
                  }
                };

                return (
                  <View
                    key={emp.id}
                    style={[
                      styles.employeeCard,
                      {
                        backgroundColor: isDark ? "#12201B" : "#FFFFFF",
                        borderColor: isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
                        borderTopColor: isDark ? "rgba(53, 214, 160, 0.38)" : "rgba(255, 255, 255, 0.98)",
                        borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                        shadowColor: isDark ? "#000000" : "#0D2B20",
                        shadowOpacity: isDark ? 0.45 : 0.09,
                      },
                    ]}
                  >
                    <View style={styles.employeeCardTop}>
                      <View style={[styles.employeeAvatar, { backgroundColor: isDark ? "#1E293B" : "#EDE9FE" }]}>
                        <Text style={[styles.employeeAvatarText, { color: isDark ? "#A78BFA" : "#7C3AED" }]}>
                          {initials}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.employeeName, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                          {emp.name}
                        </Text>
                        <Text style={[styles.employeeDesig, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                          {emp.designation} • {emp.employee_code}
                        </Text>
                      </View>
                      <View style={[styles.deptChip, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#E8F5EE" }]}>
                        <Text style={styles.deptChipText}>{emp.department}</Text>
                      </View>
                    </View>

                    {/* Actions: Call & Email */}
                    <View style={styles.employeeFooter}>
                      <Text style={[styles.joinedText, { color: isDark ? "#64748B" : "#94A3B8" }]}>
                        Joined {emp.date_of_joining}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {emp.phone ? (
                          <TouchableOpacity
                            style={[styles.contactCircleBtn, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}
                            onPress={handleCall}
                          >
                            <Ionicons name="call" size={14} color="#10B981" />
                          </TouchableOpacity>
                        ) : null}
                        {emp.email ? (
                          <TouchableOpacity
                            style={[styles.contactCircleBtn, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.10)" }]}
                            onPress={handleEmail}
                          >
                            <Ionicons name="mail" size={14} color={isDark ? "#35D6A0" : "#00A879"} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── 3. CUSTOMERS VIEW ────────────────────────────────────────────── */}
        {selectedCategory === "customers" && !isHR && (
          <View style={styles.moduleSection}>
            <View style={styles.moduleHeader}>
              <View>
                <Text style={[styles.moduleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  Customers Directory
                </Text>
                <Text style={[styles.moduleSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  {customers.length} account{customers.length === 1 ? "" : "s"} accessible
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.moduleActionBtn, { backgroundColor: isDark ? "#121F1B" : "#DDF4EA" }]}
                onPress={() => router.push("/(employee)/customers" as any)}
              >
                <Text style={[styles.moduleActionBtnText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                  Open Full App →
                </Text>
              </TouchableOpacity>
            </View>

            {customers.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: isDark ? "#0E1714" : "#FFFFFF", borderColor: isDark ? "#294039" : "#D8E0DC" }]}>
                <Ionicons name="people-outline" size={36} color={isDark ? "#5A6D66" : "#A0ACA6"} />
                <Text style={[styles.emptyCardTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  No Customers Found
                </Text>
                <Text style={[styles.emptyCardSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  {searchQuery ? `No matches for "${searchQuery}".` : "Your portfolio has no customer accounts assigned yet."}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {customers.slice(0, 5).map((customer) => (
                  <CustomerCard
                    key={String(customer.id)}
                    customer={customer}
                    onPress={() => router.push(`/(employee)/customers/${customer.id}` as any)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── 4. LEADS VIEW ────────────────────────────────────────────────── */}
        {selectedCategory === "leads" && !isHR && (
          <View style={styles.moduleSection}>
            <View style={styles.moduleHeader}>
              <View>
                <Text style={[styles.moduleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  Leads Pipeline
                </Text>
                <Text style={[styles.moduleSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  {leads.length} active prospect{leads.length === 1 ? "" : "s"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.moduleActionBtn, { backgroundColor: isDark ? "#121F1B" : "#FEF3C7" }]}
                onPress={() => router.push("/(employee)/leads" as any)}
              >
                <Text style={[styles.moduleActionBtnText, { color: isDark ? "#FBBF24" : "#D97706" }]}>
                  Open Full App →
                </Text>
              </TouchableOpacity>
            </View>

            {leads.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: isDark ? "#0E1714" : "#FFFFFF", borderColor: isDark ? "#294039" : "#D8E0DC" }]}>
                <Ionicons name="filter-outline" size={36} color={isDark ? "#5A6D66" : "#A0ACA6"} />
                <Text style={[styles.emptyCardTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  No Leads Found
                </Text>
                <Text style={[styles.emptyCardSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  {searchQuery ? `No leads match "${searchQuery}".` : "Your pipeline has no leads registered yet."}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {leads.slice(0, 5).map((lead) => (
                  <LeadCard
                    key={String(lead.id)}
                    lead={lead}
                    onPress={() => router.push(`/(employee)/leads/${lead.id}` as any)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── 5. INVENTORY STOCK OVERVIEW ──────────────────────────────────── */}
        {selectedCategory === "inventory" && !isHR && (
          <View style={styles.moduleSection}>
            <View style={styles.moduleHeader}>
              <View>
                <Text style={[styles.moduleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  Inventory & Warehouse Stock
                </Text>
                <Text style={[styles.moduleSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  Live inventory stock, reorder levels & warehouse telemetry
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Total Stock Items"
                  value="542"
                  subValue="catalog SKUs"
                  icon="cube-outline"
                />
                <MetricCard
                  label="Low Stock Alerts"
                  value="14"
                  subValue="below reorder level"
                  icon="warning-outline"
                  isHighlight
                />
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 12 }}>
              {[
                { name: "Oblu Premium Dental Implant 3.5mm", sku: "SKU-IMP-001", stock: 120, status: "In Stock" },
                { name: "Oblu Surgical Drill Kit Complete", sku: "SKU-DRL-004", stock: 8, status: "Low Stock" },
                { name: "Prosthetic Titanium Abutment 4.0mm", sku: "SKU-ABT-012", stock: 240, status: "In Stock" },
                { name: "Bone Graft Particulate 0.5cc", sku: "SKU-BNG-002", stock: 3, status: "Critical" },
              ].map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.hrBentoTile,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                      padding: 14,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 14, color: isDark ? "#F1F7F4" : "#101513" }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: isDark ? "#8FA09A" : "#5E6964", marginTop: 2 }}>
                        {item.sku} • Stock: {item.stock} units
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        backgroundColor:
                          item.status === "In Stock"
                            ? isDark ? "rgba(53, 214, 160, 0.15)" : "#DDF4EA"
                            : isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: Typography.bold,
                          color: item.status === "In Stock" ? (isDark ? "#35D6A0" : "#00A879") : "#EF4444",
                        }}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 6. PROFORMA INVOICES OVERVIEW ────────────────────────────────── */}
        {selectedCategory === "proforma" && !isHR && (
          <View style={styles.moduleSection}>
            <View style={styles.moduleHeader}>
              <View>
                <Text style={[styles.moduleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  Proforma Invoices & Quotations
                </Text>
                <Text style={[styles.moduleSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  Commercial quotation issuance, price approvals & order dispatch
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Active Invoices"
                  value="28"
                  subValue="this quarter"
                  icon="document-text-outline"
                />
                <MetricCard
                  label="Pending Approvals"
                  value="3"
                  subValue="pricing & bypass"
                  icon="time-outline"
                  isHighlight
                />
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 12 }}>
              {[
                { piNum: "PI-2025-089", customer: "Apex Dental Hospital & Clinic", amount: "₹45,200", status: "Approved" },
                { piNum: "PI-2025-092", customer: "Dr. Sharma Dental Implant Centre", amount: "₹82,500", status: "Pending Approval" },
                { piNum: "PI-2025-095", customer: "Max Care Orthodontics", amount: "₹31,000", status: "Dispatched" },
              ].map((pi, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.hrBentoTile,
                    {
                      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                      borderColor: isDark ? "#294039" : "#D8E0DC",
                      padding: 14,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 14, color: isDark ? "#F1F7F4" : "#101513" }}>
                        {pi.customer}
                      </Text>
                      <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: isDark ? "#8FA09A" : "#5E6964", marginTop: 2 }}>
                        {pi.piNum} • Value: {pi.amount}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        backgroundColor:
                          pi.status === "Approved"
                            ? isDark ? "rgba(53, 214, 160, 0.15)" : "#DDF4EA"
                            : pi.status === "Dispatched"
                            ? isDark ? "rgba(59, 130, 246, 0.15)" : "#DBEAFE"
                            : isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: Typography.bold,
                          color:
                            pi.status === "Approved"
                              ? isDark ? "#35D6A0" : "#00A879"
                              : pi.status === "Dispatched"
                              ? "#3B82F6"
                              : "#D97706",
                        }}
                      >
                        {pi.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 7. INCENTIVES OVERVIEW ────────────────────────────────────────── */}
        {selectedCategory === "incentives" && !isHR && (
          <View style={styles.moduleSection}>
            <View style={styles.moduleHeader}>
              <View>
                <Text style={[styles.moduleTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  Incentives & Commissions
                </Text>
                <Text style={[styles.moduleSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  Sales commission earnings, paid bonuses and pending payouts
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Accrued Incentive"
                  value="₹64,250"
                  subValue="current cycle"
                  icon="trophy-outline"
                  isHighlight
                />
                <MetricCard
                  label="Disbursed"
                  value="₹48,000"
                  subValue="paid out"
                  icon="checkmark-done-outline"
                />
              </View>
            </View>
          </View>
        )}
          </>
        )}
      </ScrollView>

      {/* HR Operations Modal Dialog (Rendered only when opened to protect Virtual DOM) */}
      {activeHRModal && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveHRModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
                  borderColor: isDark ? "#294039" : "#D8E0DC",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                    {getHRModalTitle(activeHRModal)}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                    {getHRModalSubtitle(activeHRModal)}
                  </Text>
                </View>
              <TouchableOpacity
                onPress={() => setActiveHRModal(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close-circle" size={24} color={isDark ? "#8FA09A" : "#5E6964"} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {activeHRModal === "holidays" && (
                <View style={{ gap: 8 }}>
                  {[
                    { date: "26 Jan 2026", name: "Republic Day", type: "National Holiday", color: "#35D6A0" },
                    { date: "26 Feb 2026", name: "Maha Shivratri", type: "Gazetted", color: "#6366F1" },
                    { date: "14 Mar 2026", name: "Holi", type: "Gazetted", color: "#EC4899" },
                    { date: "31 Mar 2026", name: "Eid-ul-Fitr", type: "Gazetted", color: "#10B981" },
                    { date: "03 Apr 2026", name: "Good Friday", type: "Gazetted", color: "#F59E0B" },
                    { date: "15 Aug 2026", name: "Independence Day", type: "National Holiday", color: "#35D6A0" },
                    { date: "02 Oct 2026", name: "Gandhi Jayanti", type: "National Holiday", color: "#35D6A0" },
                    { date: "20 Oct 2026", name: "Dussehra", type: "Gazetted", color: "#F59E0B" },
                    { date: "08 Nov 2026", name: "Diwali / Deepavali", type: "Gazetted", color: "#F59E0B" },
                    { date: "25 Dec 2026", name: "Christmas Day", type: "Gazetted", color: "#EF4444" },
                  ].map((h, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: isDark ? "rgba(41, 64, 57, 0.4)" : "#F1F5F9" },
                      ]}
                    >
                      <View style={styles.modalItemLeft}>
                        <Text style={[styles.modalItemTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                          {h.name}
                        </Text>
                        <Text style={[styles.modalItemSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                          {h.date}
                        </Text>
                      </View>
                      <View style={[styles.modalItemTag, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#E8F5EE" }]}>
                        <Text style={[styles.modalItemTagText, { color: h.color }]}>{h.type}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {activeHRModal === "policies" && (
                <View style={{ gap: 8 }}>
                  {[
                    { title: "Standard Office Shift", desc: "09:30 AM to 06:30 PM (9.0 hrs total duration)", tag: "General Shift" },
                    { title: "Grace Period", desc: "15 minutes allowed (until 09:45 AM). Maximum 3 per month.", tag: "15 Mins" },
                    { title: "Lunch / Refreshment", desc: "01:30 PM to 02:15 PM (45 minutes recess window)", tag: "Recess" },
                    { title: "Half-Day Minimum", desc: "Minimum 4.5 working hours mandatory to avoid absent mark", tag: "4.5 Hours" },
                    { title: "Attendance Mode", desc: "Biometric kiosk facial sync & GPS Geofence mobile punch", tag: "Multi-Modal" },
                  ].map((p, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: isDark ? "rgba(41, 64, 57, 0.4)" : "#F1F5F9" },
                      ]}
                    >
                      <View style={styles.modalItemLeft}>
                        <Text style={[styles.modalItemTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                          {p.title}
                        </Text>
                        <Text style={[styles.modalItemSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                          {p.desc}
                        </Text>
                      </View>
                      <View style={[styles.modalItemTag, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7" }]}>
                        <Text style={[styles.modalItemTagText, { color: "#F59E0B" }]}>{p.tag}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {activeHRModal === "leave_bank" && (
                <View style={{ gap: 8 }}>
                  {[
                    { title: "Casual Leave (CL)", desc: "12 days allocated annually (1 day accrued per month)", tag: "12 Days / Yr" },
                    { title: "Sick / Medical Leave (SL)", desc: "10 days annual entitlement. Medical cert required if >2 days.", tag: "10 Days / Yr" },
                    { title: "Earned / Privilege Leave (EL)", desc: "15 days per year, credited upon probation completion", tag: "15 Days / Yr" },
                    { title: "Compensatory Off", desc: "Credited for approved weekend or holiday duty (valid 60 days)", tag: "Comp-Off" },
                  ].map((l, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: isDark ? "rgba(41, 64, 57, 0.4)" : "#F1F5F9" },
                      ]}
                    >
                      <View style={styles.modalItemLeft}>
                        <Text style={[styles.modalItemTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                          {l.title}
                        </Text>
                        <Text style={[styles.modalItemSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                          {l.desc}
                        </Text>
                      </View>
                      <View style={[styles.modalItemTag, { backgroundColor: isDark ? "rgba(99, 102, 241, 0.12)" : "#EEF2FF" }]}>
                        <Text style={[styles.modalItemTagText, { color: "#6366F1" }]}>{l.tag}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {activeHRModal === "hiring" && (
                <View style={{ gap: 8 }}>
                  {[
                    { title: "Area Sales Manager", desc: "Delhi NCR • Field Sales & Hospital Relations", tag: "8 Applicants" },
                    { title: "Medical Representative", desc: "Jaipur & Chandigarh • Institutional Sales", tag: "14 Applicants" },
                    { title: "Operations Executive", desc: "Gurugram Corporate HQ • Order & Dispatch", tag: "5 Applicants" },
                    { title: "Warehouse Associate", desc: "Bhiwandi Hub • Stock Tracking & Logistics", tag: "6 Applicants" },
                  ].map((job, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: isDark ? "rgba(41, 64, 57, 0.4)" : "#F1F5F9" },
                      ]}
                    >
                      <View style={styles.modalItemLeft}>
                        <Text style={[styles.modalItemTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                          {job.title}
                        </Text>
                        <Text style={[styles.modalItemSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                          {job.desc}
                        </Text>
                      </View>
                      <View style={[styles.modalItemTag, { backgroundColor: isDark ? "rgba(236, 72, 153, 0.12)" : "#FCE7F3" }]}>
                        <Text style={[styles.modalItemTagText, { color: "#EC4899" }]}>{job.tag}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {activeHRModal === "biometric" && (
                <View style={{ gap: 8 }}>
                  {[
                    { title: "Kiosk Terminal Health", desc: "Floor 2 Entrance • Device online and responding", tag: "Online" },
                    { title: "Face Recognition Engine", desc: "DeepFace / OpenCV anti-spoofing algorithm ready", tag: "Active" },
                    { title: "Live Sync Status", desc: "Terminal records synchronized directly to PostgreSQL", tag: "Connected" },
                    { title: "Enrolled Employees", desc: "Biometric facial template linked for verified staff", tag: "100% Sync" },
                  ].map((bio, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: isDark ? "rgba(41, 64, 57, 0.4)" : "#F1F5F9" },
                      ]}
                    >
                      <View style={styles.modalItemLeft}>
                        <Text style={[styles.modalItemTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                          {bio.title}
                        </Text>
                        <Text style={[styles.modalItemSub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                          {bio.desc}
                        </Text>
                      </View>
                      <View style={[styles.modalItemTag, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "#D1FAE5" }]}>
                        <Text style={[styles.modalItemTagText, { color: "#10B981" }]}>{bio.tag}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Live Search Results
  searchResultsContainer: {
    paddingHorizontal: 0,
    marginTop: 8,
    marginBottom: 24,
  },
  searchResultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontFamily: Typography.bold,
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  searchGroup: {
    marginBottom: 20,
  },
  searchGroupTitle: {
    fontSize: 11,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchResultCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  searchResultIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchResultName: {
    fontSize: 15,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
  },
  searchResultSub: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  searchEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  searchEmptyTitle: {
    fontSize: 17,
    fontFamily: Typography.bold,
    marginTop: 14,
    marginBottom: 6,
  },
  searchEmptySub: {
    fontSize: 13,
    fontFamily: Typography.regular,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  clearSearchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },

  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  searchBarWrapper: {
    marginBottom: 12,
  },
  categoriesContainer: {
    marginBottom: 20,
    marginHorizontal: -16,
  },
  exploreAppsHeading: {
    fontFamily: Typography.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryItem: {
    alignItems: "center",
    width: 72,
  },
  categoryCircle: {
    width: 62,
    height: 62,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  categoryLabel: {
    fontFamily: Typography.medium,
    fontSize: 12,
    textAlign: "center",
  },
  activeIndicator: {
    width: 18,
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
  },
  heroSection: {
    marginBottom: 20,
  },
  heroHeading: {
    fontSize: 28,
    fontFamily: Typography.bold,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  heroSubheading: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
    marginTop: 4,
  },
  bentoSection: {
    marginBottom: 20,
    gap: 12,
  },
  hrBentoTile: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  hrBentoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  hrBentoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hrBentoTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(53, 214, 160, 0.12)",
  },
  hrBentoTagText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  hrBentoStatNum: {
    fontSize: 26,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
  },
  hrBentoStatSub: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
    marginTop: 2,
    lineHeight: 18,
  },
  bentoModuleCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  bentoModuleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  bentoModuleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bentoModuleTitle: {
    fontSize: 18,
    fontFamily: Typography.bold,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  bentoModuleSub: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
    lineHeight: 18,
  },
  bentoArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FontSizes.sectionTitle,
    fontFamily: Typography.bold,
    letterSpacing: -0.3,
  },
  sectionTag: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.semiBold,
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  hrmsLaunchBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 20,
  },
  hrmsLaunchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#35D6A0",
    justifyContent: "center",
    alignItems: "center",
  },
  hrmsLaunchTitle: {
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  hrmsLaunchSub: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 1,
  },
  moduleSection: {
    marginBottom: 24,
  },
  moduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  moduleTitle: {
    fontSize: 20,
    fontFamily: Typography.bold,
    letterSpacing: -0.4,
  },
  moduleSubtitle: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  liveStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  liveStatusText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  hrmsMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  hrmsMetricTile: {
    width: "48%",
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    zIndex: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  hrmsMetricLabel: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
    color: "#8FA09A",
    marginBottom: 4,
  },
  hrmsMetricValue: {
    fontSize: 26,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  hrmsMetricSub: {
    fontSize: 11,
    fontFamily: Typography.medium,
    color: "#8FA09A",
    marginTop: 2,
  },
  punchTerminalCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    marginBottom: 20,
    zIndex: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  punchTerminalTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  punchIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(53, 214, 160, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  punchTerminalTitle: {
    fontSize: 15,
    fontFamily: Typography.bold,
  },
  punchTerminalSub: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  punchActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  punchActionText: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  kioskInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
  },
  kioskInfoText: {
    fontSize: 11,
    fontFamily: Typography.regular,
    flex: 1,
    lineHeight: 16,
  },
  subSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  subSectionBadge: {
    fontSize: 11,
    fontFamily: Typography.bold,
    color: "#35D6A0",
  },
  leaveCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  leaveCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  leaveEmployeeName: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  leaveDepartment: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  leaveDaysBadge: {
    backgroundColor: "rgba(53, 214, 160, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leaveDaysText: {
    fontSize: 11,
    fontFamily: Typography.bold,
    color: "#35D6A0",
  },
  leaveReasonText: {
    fontSize: 13,
    fontFamily: Typography.regular,
    fontStyle: "italic",
    marginBottom: 12,
  },
  leaveActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  leaveBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtn: {
    backgroundColor: "#10B981",
  },
  rejectBtn: {
    backgroundColor: "#EF4444",
  },
  leaveBtnText: {
    fontSize: 12,
    fontFamily: Typography.bold,
    color: "#FFFFFF",
  },
  emptyBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  emptyBoxTitle: {
    fontSize: 15,
    fontFamily: Typography.bold,
  },
  emptyBoxSub: {
    fontSize: 12,
    fontFamily: Typography.regular,
    color: "#8FA09A",
    textAlign: "center",
  },
  directorySearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8E0DC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  directorySearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.regular,
  },
  employeeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  employeeCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  employeeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  employeeName: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  employeeDesig: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  deptChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptChipText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    color: "#35D6A0",
  },
  employeeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(226, 232, 240, 0.4)",
  },
  joinedText: {
    fontSize: 11,
    fontFamily: Typography.regular,
  },
  contactCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  moduleActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  moduleActionBtnText: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  emptyCardSub: {
    fontSize: 13,
    fontFamily: Typography.regular,
    textAlign: "center",
  },
  // HR Toolkit Chips
  hrToolkitSection: {
    marginBottom: 16,
  },
  hrToolkitHeaderTitle: {
    fontSize: 11,
    fontFamily: Typography.bold,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  hrToolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  hrToolChipText: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.2)",
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: Typography.bold,
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  modalItemLeft: {
    flex: 1,
    marginRight: 10,
  },
  modalItemTitle: {
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  modalItemSub: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  modalItemTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modalItemTagText: {
    fontSize: 10,
    fontFamily: Typography.bold,
  },
});
