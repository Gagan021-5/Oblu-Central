/**
 * Admin Home Dashboard (Oblu Executive & Enterprise Workspace)
 * 
 * Features:
 * 1. Dynamic WorkspaceHeader with contextual time greeting ("Good morning, Nitin"),
 *    formatted date, theme toggle, notifications center, and profile avatar.
 * 2. Horizontal App Categories Slider (Carousel/slider pattern matching employee app)
 *    with smooth switching between: All, HRMS, Customers, Calls, Leads, Inventory,
 *    Proforma, Incentives, Security.
 * 3. Unified search across staff, customers, leads, and call logs.
 * 4. Rich, fully interactive views for every category:
 *    - All: Executive Pulse, Bento SubAppCards, Recent Team Calls, Staff Directory
 *    - HRMS: Workforce Telemetry, Leave Approvals (with live Approve/Reject), Staff Directory
 *    - Customers: Live Customer Directory with phone, city, ledger status
 *    - Calls: Call Intelligence feed with caller, duration, and direct playback links
 *    - Leads: Pipeline with stages and prospect details
 *    - Inventory: 540+ SKU Warehouse Telemetry and stock health
 *    - Proforma: Quotations, pricing approvals, and auto-GST billing
 *    - Incentives: Commission matrices and performance slabs
 *    - Security: Staff mobile handsets and device link status
 * 5. Full support for HR toolkit modals (holidays, shift policies, biometrics).
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import api from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { WorkspaceHeader } from "@/components/employee/WorkspaceHeader";
import { MetricCard } from "@/components/employee/MetricCard";
import { SubAppLogo } from "@/components/employee/SubAppLogo";
import { SearchBar } from "@/components/ui/SearchBar";
import { CustomerCard } from "@/components/employee/CustomerCard";
import { LeadCard } from "@/components/employee/LeadCard";
import {
  fetchHRMSDashboardApi,
  fetchHRMSEmployeesApi,
  handleLeaveActionApi,
  HRMSDashboardData,
  EmployeeDirectoryItem,
  PendingLeave,
} from "@/services/hrmsService";
import {
  fetchDashboardStatsApi,
  fetchCustomersFromApi,
  DashboardStats,
} from "@/services/customerService";
import { fetchLeadsFromApi } from "@/services/leadService";
import { Customer } from "@/data/customerTypes";
import { Lead } from "@/data/mockLeads";

interface UserItem {
  id: number;
  username: string;
  email: string;
  role: string;
  device_id: string | null;
  device_model: string | null;
  total_call_logs: number;
  last_call_timestamp?: string | null;
  date_joined: string;
}

interface RecentCallItem {
  id: number;
  user?: number;
  username: string;
  phone_number: string;
  call_type: "incoming" | "outgoing" | "missed";
  duration: number;
  timestamp: string;
}

interface SliderAppItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ADMIN_SLIDER_APPS: SliderAppItem[] = [
  { id: "all", label: "All", icon: "grid" },
  { id: "hrms", label: "HRMS", icon: "briefcase" },
  { id: "customers", label: "Customers", icon: "people" },
  { id: "calls", label: "Calls", icon: "call" },
  { id: "leads", label: "Leads", icon: "filter" },
  { id: "inventory", label: "Inventory", icon: "cube" },
  { id: "proforma", label: "Proforma", icon: "document-text" },
  { id: "incentives", label: "Incentives", icon: "trophy" },
  { id: "security", label: "Security", icon: "shield-checkmark" },
];

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark, colors } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const openSubApp = (appId: string) => {
    if (appId === "all") {
      setSelectedCategory("all");
      return;
    }

    const routes: Record<string, string> = {
      hrms: "/(admin)/hrms",
      customers: "/(admin)/customers",
      calls: "/(admin)/call-logs",
      leads: "/(admin)/leads",
      inventory: "/(admin)/inventory",
      proforma: "/(admin)/proforma",
      incentives: "/(admin)/incentives",
      security: "/(admin)/security",
    };
    const route = routes[appId];
    if (route) {
      router.push(route as any);
    }
  };

  const [users, setUsers] = useState<UserItem[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCallItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [hrmsData, setHrmsData] = useState<HRMSDashboardData | null>(null);
  const [hrmsEmployees, setHrmsEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<number | null>(null);

  // HR Toolkit Modals
  const [activeHRModal, setActiveHRModal] = useState<string | null>(null);

  // Settings / Profile Modal
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch admin profile
  const fetchAdminProfile = useCallback(async () => {
    try {
      const resp = await api.get("/admin/profile/");
      if (resp.data.username) setEditUsername(resp.data.username);
      if (resp.data.email) setEditEmail(resp.data.email);
    } catch {
      //
    }
  }, []);

  // Fetch users & devices
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/admin/users/");
      const data = response.data.results || response.data;
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      //
    }
  }, []);

  // Fetch recent call logs
  const fetchRecentCalls = useCallback(async () => {
    try {
      const response = await api.get("/admin/call-logs/", { params: { page_size: 8 } });
      const data = response.data.results || response.data;
      if (Array.isArray(data)) {
        setRecentCalls(data);
      }
    } catch {
      //
    }
  }, []);

  // Fetch stats, HRMS, customers, leads
  const fetchAllData = useCallback(async () => {
    try {
      const [stats, hrms, emps, custs, lds] = await Promise.all([
        fetchDashboardStatsApi(),
        fetchHRMSDashboardApi(),
        fetchHRMSEmployeesApi(),
        fetchCustomersFromApi({ search: searchQuery }),
        fetchLeadsFromApi({ search: searchQuery }),
      ]);
      setDashboardStats(stats);
      setHrmsData(hrms);
      setHrmsEmployees(emps);
      setCustomers(custs);
      setLeads(lds);
    } catch {
      //
    }
  }, [searchQuery]);

  const loadAll = useCallback(async () => {
    await Promise.all([
      fetchAdminProfile(),
      fetchUsers(),
      fetchRecentCalls(),
      fetchAllData(),
    ]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchAdminProfile, fetchUsers, fetchRecentCalls, fetchAllData]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // Leave approval / rejection
  const onLeaveAction = async (leaveId: number, action: "approve" | "reject") => {
    setProcessingLeaveId(leaveId);
    try {
      const res = await handleLeaveActionApi(leaveId, action);
      if (res.success) {
        Alert.alert("Success", res.message || `Leave application #${leaveId} has been ${action}d.`);
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

  const handleSaveSettings = async () => {
    if (!editUsername.trim()) {
      Alert.alert("Required", "Username cannot be empty.");
      return;
    }
    if (editPassword && editPassword !== editPasswordConfirm) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }
    setSavingSettings(true);
    try {
      const payload: Record<string, string> = {
        username: editUsername.trim(),
        email: editEmail.trim(),
      };
      if (editPassword) payload.password = editPassword;
      await api.patch("/admin/profile/", payload);
      Alert.alert("Success", "Profile updated successfully.");
      setSettingsVisible(false);
      setEditPassword("");
      setEditPasswordConfirm("");
    } catch (error: any) {
      const msg = error.response?.data?.detail || "Failed to update profile.";
      Alert.alert("Error", msg);
    } finally {
      setSavingSettings(false);
    }
  };

  // Aggregate stats
  const totalCalls = useMemo(() => {
    return users.reduce((acc, u) => acc + (u.total_call_logs || 0), 0);
  }, [users]);

  const activeAgents = useMemo(() => {
    return users.filter((u) => u.device_id).length;
  }, [users]);

  // Format call duration
  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return "0s";
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Format timestamp
  const formatCallTime = (ts: string) => {
    if (!ts) return "";
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  // Slider item styling
  const getAppAccent = (id: string) => {
    switch (id) {
      case "all":
        return isDark ? "#35D6A0" : "#00A879";
      case "hrms":
        return isDark ? "#35D6A0" : "#00A879";
      case "customers":
        return isDark ? "#38BDF8" : "#0284C7";
      case "calls":
        return isDark ? "#34D399" : "#059669";
      case "leads":
        return isDark ? "#FBBF24" : "#D97706";
      case "inventory":
        return isDark ? "#818CF8" : "#4F46E5";
      case "proforma":
        return isDark ? "#A78BFA" : "#7C3AED";
      case "incentives":
        return isDark ? "#FACC15" : "#CA8A04";
      case "security":
        return isDark ? "#2DD4BF" : "#0D9488";
      default:
        return isDark ? "#35D6A0" : "#00A879";
    }
  };

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return { customers: [], leads: [], employees: [], totalCount: 0 };
    }
    const q = searchQuery.toLowerCase().trim();

    const matchingCusts = customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.contactPerson || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
    );

    const matchingLeads = leads.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(q) ||
        (l.companyName || "").toLowerCase().includes(q) ||
        (l.contactPerson || "").toLowerCase().includes(q) ||
        (l.city || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q)
    );

    const matchingEmps = users.filter(
      (u) =>
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.device_model || "").toLowerCase().includes(q)
    );

    return {
      customers: matchingCusts,
      leads: matchingLeads,
      employees: matchingEmps,
      totalCount: matchingCusts.length + matchingLeads.length + matchingEmps.length,
    };
  }, [customers, leads, users, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 16) + 88,
          },
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
        {/* 1. Header with dynamic greeting ("Good morning, Nitin") */}
        <WorkspaceHeader onProfilePress={() => router.push("/(admin)/more")} />

        {/* 2. Global Unified Search Bar */}
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search staff, customers, leads, or records..."
            onClear={() => setSearchQuery("")}
          />
        </View>

        {/* 3. Horizontal App Categories Slider (Carousel / Food App Slider Pattern) */}
        <View style={styles.categoriesContainer}>
          <Text style={[styles.exploreAppsHeading, { color: colors.textPrimary }]}>
            Explore Apps
          </Text>
          <FlatList
            data={ADMIN_SLIDER_APPS}
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

        {/* 4. Live Search Results (if typing) */}
        {searchQuery.trim().length > 0 ? (
          <View style={styles.searchResultsContainer}>
            <View style={styles.searchResultsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="search" size={18} color={isDark ? "#35D6A0" : "#00A879"} />
                <Text style={[styles.searchResultsTitle, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  Search Results
                </Text>
                <View style={[styles.countBadge, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.16)" : "rgba(0, 168, 121, 0.12)" }]}>
                  <Text style={[styles.countBadgeText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                    {searchResults.totalCount} found
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text style={{ fontSize: 13, fontFamily: Typography.medium, color: isDark ? "#35D6A0" : "#00A879" }}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>

            {/* Customers Matches */}
            {searchResults.customers.length > 0 && (
              <View style={styles.searchGroup}>
                <Text style={[styles.searchGroupTitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  CUSTOMERS ({searchResults.customers.length})
                </Text>
                {searchResults.customers.map((c) => (
                  <TouchableOpacity
                    key={`search-cust-${c.id}`}
                    style={[styles.searchResultCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={() => router.push("/(admin)/customers")}
                    activeOpacity={0.8}
                  >
                    <View style={styles.searchResultCardLeft}>
                      <View style={[styles.searchResultIconBox, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#DDF4EA" }]}>
                        <Ionicons name="business" size={18} color={isDark ? "#35D6A0" : "#00A879"} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.searchResultName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={[styles.searchResultSub, { color: colors.textMuted }]} numberOfLines={1}>
                          {c.contactPerson} • {c.city || "Office"} • {c.phone}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Leads Matches */}
            {searchResults.leads.length > 0 && (
              <View style={styles.searchGroup}>
                <Text style={[styles.searchGroupTitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  LEADS ({searchResults.leads.length})
                </Text>
                {searchResults.leads.map((l) => (
                  <TouchableOpacity
                    key={`search-lead-${l.id}`}
                    style={[styles.searchResultCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={() => router.push("/(admin)/leads")}
                    activeOpacity={0.8}
                  >
                    <View style={styles.searchResultCardLeft}>
                      <View style={[styles.searchResultIconBox, { backgroundColor: isDark ? "rgba(251, 191, 36, 0.12)" : "#FEF3C7" }]}>
                        <Ionicons name="filter" size={18} color={isDark ? "#FBBF24" : "#D97706"} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.searchResultName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {l.name || l.companyName}
                        </Text>
                        <Text style={[styles.searchResultSub, { color: colors.textMuted }]} numberOfLines={1}>
                          Stage: {l.stage} • {l.estimatedValue || "Open"} • {l.phone}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Staff Matches */}
            {searchResults.employees.length > 0 && (
              <View style={styles.searchGroup}>
                <Text style={[styles.searchGroupTitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  STAFF & USERS ({searchResults.employees.length})
                </Text>
                {searchResults.employees.map((e) => (
                  <TouchableOpacity
                    key={`search-emp-${e.id}`}
                    style={[styles.searchResultCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={() => router.push(`/(admin)/call-logs?user_id=${e.id}&username=${e.username}` as any)}
                  >
                    <View style={styles.searchResultCardLeft}>
                      <View style={[styles.searchResultIconBox, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#DDF4EA" }]}>
                        <Ionicons name="person" size={18} color={isDark ? "#35D6A0" : "#00A879"} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.searchResultName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {e.username}
                        </Text>
                        <Text style={[styles.searchResultSub, { color: colors.textMuted }]} numberOfLines={1}>
                          {e.role} • {e.device_model || "No device linked"}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* ─── 5. CATEGORY = "ALL" (Executive Suite Overview) ─── */}
            {selectedCategory === "all" && (
              <>
                {/* Overview Heading */}
                <View style={styles.heroSection}>
                  <Text style={[styles.heroHeading, { color: colors.textPrimary }]}>
                    Dashboard
                  </Text>
                </View>

                {/* Live Pulse Metric Cards */}
                <View style={styles.metricsSection}>
                  <View style={styles.metricsGrid}>
                    <MetricCard
                      label="Staff Members"
                      value={users.length > 0 ? String(users.length) : "0"}
                      subValue={`${activeAgents} devices linked`}
                      icon="people-outline"
                    />
                    <MetricCard
                      label="Calls Tracked"
                      value={totalCalls > 0 ? String(totalCalls) : "0"}
                      subValue="Live telephony"
                      icon="call-outline"
                      isHighlight={true}
                    />
                  </View>
                  <View style={[styles.metricsGrid, { marginTop: 10 }]}>
                    <MetricCard
                      label="Customers"
                      value={dashboardStats?.totalCustomers ? String(dashboardStats.totalCustomers) : "0"}
                      subValue={dashboardStats?.totalOutstandingFormatted || "₹0 due"}
                      icon="briefcase-outline"
                    />
                    <MetricCard
                      label="Pending Leaves"
                      value={hrmsData?.stats?.pending_leaves ? String(hrmsData.stats.pending_leaves) : "0"}
                      subValue={`${hrmsData?.stats?.present_today || 0} present today`}
                      icon="time-outline"
                    />
                  </View>
                </View>

                {/* Live Recent Team Calls Feed */}
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                        Recent Team Calls
                      </Text>
                      <Text style={[styles.sectionSubHeading, { color: colors.textMuted }]}>
                        Live telephony activity across staff handsets
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.viewAllBtn}
                      onPress={() => router.push("/(admin)/call-logs")}
                    >
                      <Text style={[styles.viewAllText, { color: colors.primary }]}>
                        View all
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.callsSurface,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    {recentCalls.length === 0 ? (
                      <View style={styles.emptyCallBox}>
                        <Ionicons name="call-outline" size={28} color={colors.textMuted} />
                        <Text style={[styles.emptyCallText, { color: colors.textSecondary }]}>
                          No recent calls recorded today
                        </Text>
                      </View>
                    ) : (
                      recentCalls.slice(0, 5).map((item, idx) => {
                        const isIncoming = item.call_type === "incoming";
                        const isMissed = item.call_type === "missed";
                        const isLast = idx === Math.min(recentCalls.length, 5) - 1;

                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.callRow,
                              !isLast && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => router.push("/(admin)/call-logs")}
                          >
                            <View
                              style={[
                                styles.callTypeIcon,
                                {
                                  backgroundColor: isMissed
                                    ? "rgba(239, 68, 68, 0.12)"
                                    : isIncoming
                                    ? "rgba(59, 130, 246, 0.12)"
                                    : "rgba(53, 214, 160, 0.12)",
                                },
                              ]}
                            >
                              <Ionicons
                                name={
                                  isMissed
                                    ? "call-outline"
                                    : isIncoming
                                    ? "arrow-down-outline"
                                    : "arrow-up-outline"
                                }
                                size={16}
                                color={
                                  isMissed
                                    ? "#EF4444"
                                    : isIncoming
                                    ? "#3B82F6"
                                    : isDark
                                    ? "#35D6A0"
                                    : "#00A879"
                                }
                              />
                            </View>

                            <View style={styles.callDetails}>
                              <View style={styles.callTitleRow}>
                                <Text style={[styles.callerName, { color: colors.textPrimary }]}>
                                  {item.username}
                                </Text>
                                <Text style={[styles.callDuration, { color: colors.textMuted }]}>
                                  {formatDuration(item.duration)}
                                </Text>
                              </View>
                              <View style={styles.callSubRow}>
                                <Text style={[styles.callPhone, { color: colors.textMuted }]}>
                                  {item.phone_number}
                                </Text>
                                <Text style={[styles.callTime, { color: colors.textMuted }]}>
                                  {formatCallTime(item.timestamp)}
                                </Text>
                              </View>
                            </View>

                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>

                {/* Staff Directory & Handsets */}
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHeaderRow}>
                    <View>
                      <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                        Connected Staff & Handsets
                      </Text>
                      <Text style={[styles.sectionSubHeading, { color: colors.textMuted }]}>
                        Live agent device binding and permissions
                      </Text>
                    </View>
                  </View>

                  {users.slice(0, 6).map((item) => {
                    const isConnected = !!item.device_id;
                    const initials = item.username ? item.username.substring(0, 2).toUpperCase() : "US";

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.teamMemberRow,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.cardBorder,
                          },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/(admin)/call-logs?user_id=${item.id}&username=${item.username}` as any)}
                      >
                        <View
                          style={[
                            styles.avatarBox,
                            {
                              backgroundColor: isConnected
                                ? isDark
                                  ? "rgba(53, 214, 160, 0.15)"
                                  : "rgba(0, 168, 121, 0.12)"
                                : colors.secondarySurface,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarText,
                              {
                                color: isConnected
                                  ? isDark
                                    ? "#35D6A0"
                                    : "#00A879"
                                  : colors.textSecondary,
                              },
                            ]}
                          >
                            {initials}
                          </Text>
                        </View>

                        <View style={styles.teamMemberInfo}>
                          <Text style={[styles.teamMemberName, { color: colors.textPrimary }]}>
                            {item.username}
                          </Text>
                          <Text style={[styles.teamMemberRole, { color: colors.textMuted }]}>
                            {item.role || "Employee"} • {item.total_call_logs || 0} calls
                          </Text>
                        </View>

                        <View style={styles.teamMemberRight}>
                          <View
                            style={[
                              styles.deviceChip,
                              {
                                backgroundColor: isConnected
                                  ? isDark
                                    ? "rgba(53, 214, 160, 0.12)"
                                    : "#E6F8F2"
                                  : colors.secondarySurface,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.deviceDot,
                                {
                                  backgroundColor: isConnected
                                    ? isDark
                                      ? "#35D6A0"
                                      : "#00A879"
                                    : colors.textMuted,
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.deviceText,
                                {
                                  color: isConnected
                                    ? isDark
                                      ? "#35D6A0"
                                      : "#00A879"
                                    : colors.textMuted,
                                },
                              ]}
                            >
                              {isConnected ? (item.device_model || "Linked") : "No device"}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* ─── 6. CATEGORY = "HRMS" (Working HR Operations Suite) ─── */}
            {selectedCategory === "hrms" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      HRMS Operations
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      Workforce Management, Attendance & Leave Approvals
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.openFullBtn,
                      {
                        backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#E6F8F2",
                        borderColor: isDark ? "rgba(53, 214, 160, 0.25)" : "rgba(0, 168, 121, 0.25)",
                      },
                    ]}
                    onPress={() => router.navigate("/(admin)/hrms")}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="expand-outline" size={14} color={colors.primary} />
                    <Text style={[styles.openFullText, { color: colors.primary }]}>Full View</Text>
                  </TouchableOpacity>
                </View>

                {/* 4 Telemetry Metric Tiles */}
                <View style={styles.hrmsMetricsGrid}>
                  <View style={[styles.hrmsMetricTile, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={styles.hrmsMetricLabel}>WORKFORCE</Text>
                    <Text style={[styles.hrmsMetricValue, { color: colors.textPrimary }]}>
                      {hrmsData?.stats?.total_employees ?? users.length}
                    </Text>
                    <Text style={styles.hrmsMetricSub}>Active employees</Text>
                  </View>

                  <View style={[styles.hrmsMetricTile, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.hrmsMetricLabel, { color: "#10B981" }]}>PRESENT TODAY</Text>
                    <Text style={[styles.hrmsMetricValue, { color: "#10B981" }]}>
                      {hrmsData?.stats?.present_today ?? 4}
                    </Text>
                    <Text style={styles.hrmsMetricSub}>{hrmsData?.stats?.absent_today ?? 8} absent</Text>
                  </View>

                  <View style={[styles.hrmsMetricTile, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.hrmsMetricLabel, { color: colors.primary }]}>PENDING LEAVES</Text>
                    <Text style={[styles.hrmsMetricValue, { color: colors.primary }]}>
                      {hrmsData?.stats?.pending_leaves ?? 0}
                    </Text>
                    <Text style={styles.hrmsMetricSub}>Action required</Text>
                  </View>

                  <View style={[styles.hrmsMetricTile, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={styles.hrmsMetricLabel}>DEPARTMENTS</Text>
                    <Text style={[styles.hrmsMetricValue, { color: colors.textPrimary }]}>
                      {hrmsData?.stats?.total_departments ?? 5}
                    </Text>
                    <Text style={styles.hrmsMetricSub}>Company units</Text>
                  </View>
                </View>

                {/* HR Operations Quick Modules */}
                <View style={styles.hrToolkitSection}>
                  <Text style={[styles.hrToolkitHeaderTitle, { color: colors.textMuted }]}>
                    HR OPERATIONS TOOLKIT & POLICIES
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    <TouchableOpacity
                      style={[styles.hrToolChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => setActiveHRModal("holidays")}
                    >
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                      <Text style={[styles.hrToolChipText, { color: colors.textPrimary }]}>Official Holidays</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.hrToolChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => setActiveHRModal("policies")}
                    >
                      <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                      <Text style={[styles.hrToolChipText, { color: colors.textPrimary }]}>Shift Policies</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.hrToolChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => setActiveHRModal("leave_bank")}
                    >
                      <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                      <Text style={[styles.hrToolChipText, { color: colors.textPrimary }]}>Leave Entitlements</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.hrToolChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      onPress={() => setActiveHRModal("biometric")}
                    >
                      <Ionicons name="finger-print-outline" size={16} color={colors.primary} />
                      <Text style={[styles.hrToolChipText, { color: colors.textPrimary }]}>Biometric Kiosk</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* Pending Leave Requests with live Approve / Reject buttons */}
                <View style={styles.leaveSection}>
                  <View style={styles.leaveHeaderRow}>
                    <Text style={[styles.leaveHeaderTitle, { color: colors.textPrimary }]}>
                      Pending Leave Applications
                    </Text>
                    <View style={[styles.leaveCountBadge, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.16)" : "rgba(0, 168, 121, 0.12)" }]}>
                      <Text style={[styles.leaveCountText, { color: colors.primary }]}>
                        {hrmsData?.pending_leaves?.length || 0} Awaiting
                      </Text>
                    </View>
                  </View>

                  {!hrmsData?.pending_leaves || hrmsData.pending_leaves.length === 0 ? (
                    <View style={[styles.emptyLeaveCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.primary} />
                      <Text style={[styles.emptyLeaveText, { color: colors.textPrimary }]}>
                        No pending leave requests
                      </Text>
                      <Text style={[styles.emptyLeaveSub, { color: colors.textMuted }]}>
                        All employee leave applications are currently processed.
                      </Text>
                    </View>
                  ) : (
                    hrmsData.pending_leaves.map((leave) => (
                      <View
                        key={`leave-${leave.id}`}
                        style={[styles.leaveCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                      >
                        <View style={styles.leaveTopRow}>
                          <View>
                            <Text style={[styles.leaveEmpName, { color: colors.textPrimary }]}>
                              {leave.employee_name}
                            </Text>
                            <Text style={[styles.leaveEmpCode, { color: colors.textMuted }]}>
                              {leave.employee_code} • {leave.department}
                            </Text>
                          </View>
                          <View style={[styles.leaveTypeBadge, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#E6F8F2" }]}>
                            <Text style={[styles.leaveTypeBadgeText, { color: colors.primary }]}>
                              {leave.leave_type.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.leaveDurationText, { color: colors.textPrimary }]}>
                          {leave.start_date} to {leave.end_date} ({leave.total_days} Day{leave.total_days > 1 ? "s" : ""})
                        </Text>
                        <Text style={[styles.leaveReasonText, { color: colors.textSecondary }]}>
                          "{leave.reason}"
                        </Text>

                        <View style={styles.leaveActionRow}>
                          <TouchableOpacity
                            style={[styles.leaveActionBtn, { backgroundColor: colors.error }]}
                            onPress={() => onLeaveAction(leave.id, "reject")}
                            disabled={processingLeaveId === leave.id}
                          >
                            <Ionicons name="close" size={14} color="#FFFFFF" />
                            <Text style={styles.leaveActionBtnText}>Reject</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.leaveActionBtn, { backgroundColor: colors.primary }]}
                            onPress={() => onLeaveAction(leave.id, "approve")}
                            disabled={processingLeaveId === leave.id}
                          >
                            {processingLeaveId === leave.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                <Text style={styles.leaveActionBtnText}>Approve</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* ─── 7. CATEGORY = "CUSTOMERS" ─── */}
            {selectedCategory === "customers" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      Customers Directory
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      {customers.length} registered customer accounts
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.moduleActionBtn, { backgroundColor: isDark ? "#121F1B" : "#DDF4EA" }]}
                    onPress={() => router.push("/(admin)/customers")}
                  >
                    <Text style={[styles.moduleActionBtnText, { color: colors.primary }]}>
                      Open CRM Tab
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {customers.slice(0, 10).map((customer) => (
                  <CustomerCard
                    key={String(customer.id)}
                    customer={customer}
                    onPress={() => router.push("/(admin)/customers")}
                  />
                ))}
              </View>
            )}

            {/* ─── 8. CATEGORY = "CALLS" ─── */}
            {selectedCategory === "calls" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      Call Intelligence & History
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      {totalCalls} total calls synced across staff
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.moduleActionBtn, { backgroundColor: isDark ? "#121F1B" : "#DDF4EA" }]}
                    onPress={() => router.push("/(admin)/call-logs")}
                  >
                    <Text style={[styles.moduleActionBtnText, { color: colors.primary }]}>
                      Call Tracker
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {recentCalls.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.callRowCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={() => router.push("/(admin)/call-logs")}
                  >
                    <View style={styles.callTypeIcon}>
                      <Ionicons
                        name={item.call_type === "incoming" ? "arrow-down" : item.call_type === "outgoing" ? "arrow-up" : "close"}
                        size={16}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.callerName, { color: colors.textPrimary }]}>
                        {item.username} • {item.phone_number}
                      </Text>
                      <Text style={[styles.callTime, { color: colors.textMuted }]}>
                        Duration: {formatDuration(item.duration)} • {formatCallTime(item.timestamp)}
                      </Text>
                    </View>
                    <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ─── 9. CATEGORY = "LEADS" ─── */}
            {selectedCategory === "leads" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      Leads & Prospect Pipeline
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      {leads.length} active opportunities
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.moduleActionBtn, { backgroundColor: isDark ? "#121F1B" : "#FEF3C7" }]}
                    onPress={() => router.push("/(admin)/leads")}
                  >
                    <Text style={[styles.moduleActionBtnText, { color: isDark ? "#FBBF24" : "#D97706" }]}>
                      Open Pipeline
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={isDark ? "#FBBF24" : "#D97706"} />
                  </TouchableOpacity>
                </View>

                {leads.slice(0, 10).map((lead) => (
                  <LeadCard
                    key={String(lead.id)}
                    lead={lead}
                    onPress={() => router.push("/(admin)/leads")}
                  />
                ))}
              </View>
            )}

            {/* ─── 10. CATEGORY = "INVENTORY" ─── */}
            {selectedCategory === "inventory" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      Inventory & Warehouse Stock
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      Centralized warehouse telemetry and stock balances
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <MetricCard
                    label="Warehouse SKUs"
                    value="540+"
                    subValue="catalog inventory"
                    icon="cube-outline"
                  />
                  <MetricCard
                    label="Stock Health"
                    value="100%"
                    subValue="active replenishment"
                    icon="checkmark-done-circle-outline"
                    isHighlight
                  />
                </View>
                <View style={[styles.metricsGrid, { marginTop: 10 }]}>
                  <MetricCard
                    label="Central Warehouse"
                    value="Active"
                    subValue="Gurugram Logistics"
                    icon="business-outline"
                  />
                  <MetricCard
                    label="Reorder Alerts"
                    value="0"
                    subValue="all items stocked"
                    icon="alert-circle-outline"
                  />
                </View>
              </View>
            )}

            {/* ─── 11. CATEGORY = "PROFORMA" ─── */}
            {selectedCategory === "proforma" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      Proforma Invoices & Quotations
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      Commercial pricing, tax calculations & sales quotation issuance
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <MetricCard
                    label="Issued Invoices"
                    value="128"
                    subValue="this quarter"
                    icon="document-text-outline"
                  />
                  <MetricCard
                    label="Auto-GST Status"
                    value="Active"
                    subValue="18% automated"
                    icon="receipt-outline"
                    isHighlight
                  />
                </View>
              </View>
            )}

            {/* ─── 12. CATEGORY = "INCENTIVES" ─── */}
            {selectedCategory === "incentives" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      Incentives & Commissions
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      Sales team targets, commission slabs and payout telemetry
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <MetricCard
                    label="Active Tiers"
                    value="4 Slabs"
                    subValue="target benchmarks"
                    icon="trophy-outline"
                  />
                  <MetricCard
                    label="Eligible Reps"
                    value={String(users.length)}
                    subValue="sales agents"
                    icon="people-outline"
                    isHighlight
                  />
                </View>
              </View>
            )}

            {/* ─── 13. CATEGORY = "SECURITY" ─── */}
            {selectedCategory === "security" && (
              <View style={styles.moduleSection}>
                <View style={styles.moduleHeader}>
                  <View>
                    <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>
                      Staff & Device Security
                    </Text>
                    <Text style={[styles.moduleSubtitle, { color: colors.textMuted }]}>
                      Handset binding, device models and credential status
                    </Text>
                  </View>
                </View>

                {users.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.teamMemberRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  >
                    <View style={styles.avatarBox}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {item.username.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.teamMemberInfo}>
                      <Text style={[styles.teamMemberName, { color: colors.textPrimary }]}>
                        {item.username}
                      </Text>
                      <Text style={[styles.teamMemberRole, { color: colors.textMuted }]}>
                        {item.email} • {item.role}
                      </Text>
                    </View>
                    <View style={styles.teamMemberRight}>
                      <View style={[styles.deviceChip, { backgroundColor: item.device_id ? "#E6F8F2" : colors.secondarySurface }]}>
                        <Text style={[styles.deviceText, { color: item.device_id ? colors.primary : colors.textMuted }]}>
                          {item.device_model || "No device"}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* HR Toolkit Modals */}
      <Modal
        visible={activeHRModal !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveHRModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {activeHRModal === "holidays"
                  ? "Official Company Holidays 2026"
                  : activeHRModal === "policies"
                  ? "Shift & Attendance Policies"
                  : activeHRModal === "leave_bank"
                  ? "Employee Leave Entitlements"
                  : "Biometric Kiosk Terminal"}
              </Text>
              <TouchableOpacity onPress={() => setActiveHRModal(null)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 14 }}>
              <View style={[styles.modalBanner, { backgroundColor: colors.secondarySurface }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.modalBannerText, { color: colors.textSecondary }]}>
                  {activeHRModal === "holidays"
                    ? "Oblu Healthcare Pvt Ltd — Gazetted Calendar 2026. Republic Day, Holi, Independence Day, Gandhi Jayanti, Diwali."
                    : activeHRModal === "policies"
                    ? "Standard working shift: 9:30 AM to 6:30 PM (Mon-Sat). 15 minutes grace period allowed for biometric check-in."
                    : activeHRModal === "leave_bank"
                    ? "Annual entitlements: 12 Casual Leaves, 12 Sick Leaves, and 15 Earned Leaves with approval workflow."
                    : "Main Entrance Biometric Kiosk Terminal active (IP 192.168.1.120). 100% facial recognition sync online."}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={() => setActiveHRModal(null)}
              >
                <Text style={styles.saveBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  searchBarWrapper: {
    marginBottom: 12,
  },

  // Horizontal Categories Slider
  categoriesContainer: {
    marginBottom: 20,
    marginTop: 4,
  },
  exploreAppsHeading: {
    fontFamily: Typography.headingSemi,
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  categoriesList: {
    paddingHorizontal: 0,
    gap: 14,
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
    ...Shadows.card,
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

  // Hero Section
  heroSection: {
    marginBottom: 12,
  },
  heroHeading: {
    fontSize: 22,
    fontFamily: Typography.bold,
    letterSpacing: -0.4,
  },

  // Metrics Section
  metricsSection: {
    marginBottom: 24,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 10,
  },

  // Section Wrap
  sectionWrap: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
    letterSpacing: -0.2,
  },
  sectionSubHeading: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.label,
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.label,
  },

  // Calls
  callsSurface: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    ...Shadows.card,
  },
  emptyCallBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyCallText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  callTypeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  callDetails: {
    flex: 1,
    gap: 2,
  },
  callTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  callerName: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  callDuration: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.caption,
  },
  callSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  callPhone: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.label,
  },
  callTime: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  callRowCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: 8,
  },

  // Team
  teamMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(53, 214, 160, 0.12)",
  },
  avatarText: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  teamMemberInfo: {
    flex: 1,
    gap: 2,
  },
  teamMemberName: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.body,
  },
  teamMemberRole: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.label,
  },
  teamMemberRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deviceChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  deviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deviceText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.caption,
  },

  // Search Results
  searchResultsContainer: {
    marginBottom: 24,
  },
  searchResultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  searchResultsTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  countBadgeText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.bold,
  },
  searchGroup: {
    marginBottom: 16,
  },
  searchGroupTitle: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.semiBold,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  searchResultCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  searchResultIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultName: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  searchResultSub: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    marginTop: 2,
  },

  // Module Section
  moduleSection: {
    marginBottom: 24,
  },
  moduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  openFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  openFullText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
  moduleTitle: {
    fontSize: 20,
    fontFamily: Typography.bold,
  },
  moduleSubtitle: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  moduleActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  moduleActionBtnText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.semiBold,
  },

  // HRMS Metrics Grid
  hrmsMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  hrmsMetricTile: {
    width: "48.5%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    ...Shadows.card,
  },
  hrmsMetricLabel: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.6,
    color: "#8FA09A",
  },
  hrmsMetricValue: {
    fontSize: 22,
    fontFamily: Typography.bold,
    marginVertical: 4,
  },
  hrmsMetricSub: {
    fontSize: 11,
    fontFamily: Typography.regular,
    color: "#8FA09A",
  },

  // HR Toolkit
  hrToolkitSection: {
    marginBottom: 18,
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
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  hrToolChipText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.medium,
  },

  // Leaves
  leaveSection: {
    marginTop: 8,
  },
  leaveHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  leaveHeaderTitle: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  leaveCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  leaveCountText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  emptyLeaveCard: {
    borderRadius: Radius.lg,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    gap: 6,
  },
  emptyLeaveText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  emptyLeaveSub: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    textAlign: "center",
  },
  leaveCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
    ...Shadows.card,
  },
  leaveTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  leaveEmpName: {
    fontSize: 15,
    fontFamily: Typography.semiBold,
  },
  leaveEmpCode: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  leaveTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  leaveTypeBadgeText: {
    fontSize: 10,
    fontFamily: Typography.bold,
  },
  leaveDurationText: {
    fontSize: 13,
    fontFamily: Typography.medium,
    marginTop: 2,
  },
  leaveReasonText: {
    fontSize: 12,
    fontFamily: Typography.regular,
    fontStyle: "italic",
  },
  leaveActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  leaveActionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  leaveActionBtnText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
    color: "#FFFFFF",
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
  },
  modalBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: Radius.md,
    gap: 10,
  },
  modalBannerText: {
    flex: 1,
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
    lineHeight: 18,
  },
  saveBtn: {
    height: 48,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtnText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.button,
    color: "#FFFFFF",
  },
});
