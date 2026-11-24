import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PieChart } from "react-native-chart-kit";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import {
  DashboardStats,
  CustomerChartsData,
  fetchDashboardStatsApi,
  fetchCustomerChartsApi,
} from "@/services/customerService";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { Typography } from "@/constants/theme";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";
import { triggerLightHaptic } from "@/utils/haptics";
import { isSalespersonActive } from "@/constants/salespeople";

const PIE_COLORS = [
  "#20B99A",
  "#0EA5E9",
  "#6366F1",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#14B8A6",
  "#F97316",
  "#10B981",
  "#64748B",
  "#A855F7",
  "#06B6D4",
  "#0D9488",
  "#E11D48",
  "#D97706",
];

const links = [
  { title: "Customer Directory", description: "Search accounts and open customer records", icon: "people-outline", route: "/(employee)/customers", color: "#20B99A", permissions: ["customer.view", "customer.view_all"] },
  { title: "Team Customers", description: "Review customers in your permitted team scope", icon: "person-add-outline", route: "/(employee)/customers/tool/team-customers", color: "#159A7C", permissions: ["customer.view", "customer.view_all"] },
  { title: "Payment Follow-ups", description: "Review customers with pending or overdue payments", icon: "cash-outline", route: "/(employee)/customers/tool/payment-followups", color: "#F59E0B", permission: "payment.view" },
  { title: "Monthly Sales Report", description: "Review monthly sales performance", icon: "calendar-outline", route: "/(employee)/customers/tool/monthly-sales", color: "#0EA5E9", permissions: ["customer.view", "customer.view_all", "payment.view"] },
  { title: "Detailed Map", description: "Browse customer locations by city and state", icon: "map-outline", route: "/(employee)/customers/map", color: "#0EA5E9", permission: "customer.view_all" },
  { title: "My Incentives", description: "View your incentive workspace", icon: "wallet-outline", route: "/(employee)/incentives", color: "#A855F7" },
  { title: "RSM Team Incentives", description: "Review team incentive performance", icon: "people-outline", route: "/(employee)/customers/tool/rsm-incentives", color: "#6366F1", roles: ["rsm", "sales_head", "admin", "accountant", "finance"] },
  { title: "Sales Head Incentives", description: "Review sales head incentive performance", icon: "git-network-outline", route: "/(employee)/customers/tool/sales-head-incentives", color: "#6366F1", roles: ["sales_head", "business", "admin", "finance"] },
  { title: "Cross-Selling Matrix", description: "Identify customer product gap opportunities", icon: "grid-outline", route: "/(employee)/customers/tool/cross-selling", color: "#159A7C", permissions: ["customer.view", "customer.view_all"] },
  { title: "Voucher Approvals", description: "Review pending voucher claims", icon: "checkbox-outline", route: "/(employee)/customers/tool/voucher-approvals", color: "#F59E0B", roles: ["admin", "accounts_operations", "sales_head", "finance", "business"] },
  { title: "Unassigned Customers", description: "Review and assign unattached accounts", icon: "person-remove-outline", route: "/(employee)/customers/tool/unassigned", color: "#EF4444", permissions: ["customer.view_all", "customer.view"] },
];

export default function CustomerWorkspaceScreen({ isAdmin = false }: { isAdmin?: boolean }) {
  const insets = useSafeAreaInsets();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
  const { user, permissionProfile } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartsData, setChartsData] = useState<CustomerChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [showAllSalespersons, setShowAllSalespersons] = useState(false);
  const [showAllStates, setShowAllStates] = useState(false);

  const roleText = `${user?.role || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
  const userIsSuperuser =
    roleText.includes("superuser") ||
    (user?.permissions || []).includes("*") ||
    (permissionProfile?.permissions || []).includes("*") ||
    hasRole(permissionProfile, "admin") ||
    roleText.includes("admin") ||
    isAdmin;

  const isFinance = roleText.includes("finance") || hasRole(permissionProfile, "finance");

  const userHasRole = useCallback(
    (role: string) => {
      const r = role.toLowerCase();
      if (userIsSuperuser) return true;
      if (r === "finance" && isFinance) return true;
      if (r === "sales_head" && (isFinance || roleText.includes("sales head") || roleText.includes("sales_head") || hasRole(permissionProfile, "sales_head"))) return true;
      if (r === "business" && (isFinance || roleText.includes("business") || hasRole(permissionProfile, "business"))) return true;
      if (r === "admin" && (userIsSuperuser || isFinance)) return true;
      if (r === "rsm" && (roleText.includes("rsm") || roleText.includes("regional sales manager") || hasRole(permissionProfile, "rsm"))) return true;
      return hasRole(permissionProfile, role);
    },
    [userIsSuperuser, isFinance, roleText, permissionProfile]
  );

  const can = useCallback(
    (permission: string) => {
      if (userIsSuperuser || isFinance) return true;
      return hasPermission(permissionProfile, permission);
    },
    [userIsSuperuser, isFinance, permissionProfile]
  );

  const load = useCallback(async () => {
    setError("");
    try {
      const [statsRes, chartsRes] = await Promise.allSettled([
        fetchDashboardStatsApi(),
        fetchCustomerChartsApi(),
      ]);

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
      }
      if (chartsRes.status === "fulfilled") {
        setChartsData(chartsRes.value);
      }
    } catch {
      setError("Could not reach the customer dashboard. Check your connection and sign-in.");
    } finally {
      setLoading(false);
      setChartsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (route: string) => router.push(route as never);
  const cardBg = t.surface;
  const text = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";
  const chartWidth = Math.max(260, screenWidth - 72);

  const availableLinks = links.filter((item) => {
    if (userIsSuperuser || isFinance) return true;
    if (item.permission && !can(item.permission)) return false;
    if (item.permissions && !item.permissions.some(can)) return false;
    if (item.roles && !item.roles.some(userHasRole)) return false;
    return true;
  });

  const metricItems = [
    {
      title: "Customers",
      value: stats?.totalCustomers,
      icon: "people" as const,
      tint: "#DDF8F0",
      route: isAdmin ? "/(admin)/customers" : "/(employee)/customers",
    },
    {
      title: "Follow-ups due",
      value: stats?.followUpsDueCount,
      icon: "calendar" as const,
      tint: "#FFF2D8",
      route: "/(employee)/customers?filter=followup_due",
    },
    {
      title: "Overdue payments",
      value: stats?.overduePaymentsCount,
      icon: "alert-circle" as const,
      tint: "#FFE5E8",
      route: "/(employee)/customers?filter=payment_pending",
    },
  ];

  const cleanSalespersonDist = useMemo(() => {
    return (chartsData?.salespersonDistribution || []).filter(
      (item) => item.name && isSalespersonActive(item.name)
    );
  }, [chartsData?.salespersonDistribution]);

  // Chart data calculations
  const salespersonPieData = useMemo(() => {
    return cleanSalespersonDist
      .filter((item) => item.customers > 0)
      .slice(0, 15)
      .map((item, idx) => ({
        name: item.name ? (item.name.length > 12 ? `${item.name.slice(0, 10)}…` : item.name) : "Salesperson",
        customers: item.customers,
        color: PIE_COLORS[idx % PIE_COLORS.length],
        legendFontColor: isDark ? "#D1D5DB" : "#374151",
        legendFontSize: 11,
      }));
  }, [cleanSalespersonDist, isDark]);

  const statePieData = useMemo(() => {
    return (chartsData?.stateDistribution || [])
      .filter((item) => item.count > 0)
      .slice(0, 10)
      .map((item, idx) => ({
        name: item.state ? (item.state.length > 12 ? `${item.state.slice(0, 10)}…` : item.state) : "Other",
        count: item.count,
        color: PIE_COLORS[(idx + 2) % PIE_COLORS.length],
        legendFontColor: isDark ? "#D1D5DB" : "#374151",
        legendFontSize: 11,
      }));
  }, [chartsData?.stateDistribution, isDark]);

  const maxSales = useMemo(() => {
    return Math.max(1, ...(cleanSalespersonDist.map((x) => x.customers) || [1]));
  }, [cleanSalespersonDist]);

  const maxState = useMemo(() => {
    return Math.max(1, ...(chartsData?.stateDistribution?.map((x) => x.count) || [1]));
  }, [chartsData?.stateDistribution]);

  const chartConfig = {
    backgroundGradientFrom: cardBg,
    backgroundGradientTo: cardBg,
    color: (opacity = 1) => `rgba(32, 185, 154, ${opacity})`,
    labelColor: () => muted,
  };

  const displayedSalespersons = useMemo(() => {
    return showAllSalespersons ? cleanSalespersonDist : cleanSalespersonDist.slice(0, 3);
  }, [cleanSalespersonDist, showAllSalespersons]);

  const displayedStates = useMemo(() => {
    const list = chartsData?.stateDistribution || [];
    return showAllStates ? list.slice(0, 10) : list.slice(0, 3);
  }, [chartsData?.stateDistribution, showAllStates]);

  // Dual Bar Row Component matching Web Dashboard (Total vs Active)
  const DualBarRow = ({
    label,
    total,
    active,
    max,
    totalColor,
    activeColor,
    icon,
    rightAction,
  }: {
    label: string;
    total: number;
    active?: number;
    max: number;
    totalColor: string;
    activeColor: string;
    icon?: string;
    rightAction?: React.ReactNode;
  }) => {
    const activeVal = typeof active === "number" ? active : 0;
    const totalPct = Math.max(total ? 4 : 0, (total / max) * 100);
    const activePct = Math.max(activeVal ? 4 : 0, (activeVal / max) * 100);

    return (
      <View style={{ gap: 6 }}>
        <View style={styles.barLabelLine}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            {icon ? <Ionicons name={icon as any} size={15} color={totalColor} /> : null}
            <Text numberOfLines={1} style={[styles.barLabel, { color: text, flex: 1 }]}>
              {label || "Other"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.metricTag, { color: totalColor }]}>
                {total} <Text style={{ fontSize: 10, color: muted, fontFamily: Typography.regular }}>total</Text>
              </Text>
              {typeof active === "number" && (
                <Text style={[styles.metricTag, { color: activeColor }]}>
                  {activeVal} <Text style={{ fontSize: 10, color: muted, fontFamily: Typography.regular }}>active</Text>
                </Text>
              )}
            </View>
            {rightAction}
          </View>
        </View>

        {/* Dual Bars: Total (top) & Active (bottom) */}
        <View style={{ gap: 3 }}>
          <View style={[styles.track, { backgroundColor: isDark ? "#23322D" : "#EDF2F5", height: 6 }]}>
            <View style={[styles.fill, { width: `${totalPct}%`, backgroundColor: totalColor }]} />
          </View>
          {typeof active === "number" && activeVal > 0 && (
            <View style={[styles.track, { backgroundColor: isDark ? "#23322D" : "#EDF2F5", height: 5 }]}>
              <View style={[styles.fill, { width: `${activePct}%`, backgroundColor: activeColor }]} />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: isDark ? colors.background : "#F5F8FA" }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 20) + 10, paddingBottom: 110 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        {/* Top Navigation Row: Left Menu Button + Right 3D Home Button */}
        <View style={styles.topNavRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open customer navigation menu"
            onPress={() => {
              triggerLightHaptic();
              setDrawerVisible(true);
            }}
            style={[styles.navButton, { backgroundColor: cardBg, borderColor: t.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={21} color={text} />
          </TouchableOpacity>

          {/* Right 3D Home Button (Redirects to Main Home) */}
          <SubAppHomeButton isAdmin={isAdmin} size={42} />
        </View>

        {/* Hero Title Section */}
        <View style={styles.heroHeader}>
          <Text style={[styles.eyebrow, { color: "#20B99A" }]}>OBLU CUSTOMER WORKSPACE</Text>
          <Text style={[styles.title, { color: text }]}>Customers, managed smarter.</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            Your customer accounts, payment follow-ups and sales tools in one place.
          </Text>
        </View>

        {!!error && (
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              void load();
            }}
            style={[styles.error, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}
          >
            <Text style={{ color: isDark ? "#FFD9A8" : "#8A4B08", fontFamily: Typography.regular }}>
              {error} Tap to retry.
            </Text>
          </TouchableOpacity>
        )}

        {/* Top Key Metrics Row */}
        <View style={styles.metricRow}>
          {metricItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              onPress={() => open(item.route)}
              style={[
                styles.metric,
                { backgroundColor: cardBg, borderColor: t.border },
              ]}
            >
              <View style={[styles.metricIcon, { backgroundColor: item.tint }]}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={
                    item.title === "Overdue payments"
                      ? "#E34B59"
                      : item.title === "Follow-ups due"
                      ? "#D18A00"
                      : "#149B80"
                  }
                />
              </View>
              <Text style={[styles.metricValue, { color: text }]}>
                {(item.value ?? 0).toLocaleString()}
              </Text>
              <Text style={[styles.metricLabel, { color: muted }]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Outstanding Card */}
        <View style={[styles.balanceCard, { backgroundColor: "#0E9E83" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceLabel}>TOTAL OUTSTANDING</Text>
            <Text style={styles.balanceValue}>{stats?.totalOutstandingFormatted ?? "₹0"}</Text>
            <Text style={styles.balanceHint}>Total customer balances</Text>
          </View>
          <Ionicons name="trending-up" size={30} color="#D9FFF5" />
        </View>

        {/* ── Section 1: Customers per Salesperson & Salesperson Share ── */}
        <View style={[styles.chartSection, { backgroundColor: cardBg, borderColor: t.border }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Ionicons name="person-circle-outline" size={20} color="#159A7C" />
              <Text style={[styles.chartTitle, { color: text }]}>Customers per Salesperson</Text>
            </View>
            <Text style={[styles.chartSubtitle, { color: muted }]}>
              Customer allocation & active performance by salesperson
            </Text>
          </View>

          {chartsLoading ? (
            <SkeletonBlock height={190} borderRadius={16} />
          ) : salespersonPieData.length > 0 ? (
            <>
              {/* Salesperson Share Donut / Pie Chart */}
              <View style={styles.chartBox}>
                <PieChart
                  data={salespersonPieData}
                  width={chartWidth}
                  height={190}
                  chartConfig={chartConfig}
                  accessor="customers"
                  backgroundColor="transparent"
                  paddingLeft="10"
                  absolute
                />
              </View>

              {/* Legend Row: Total vs Active */}
              <View style={styles.chartLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#0D9488" }]} />
                  <Text style={[styles.legendText, { color: muted }]}>Total Customers</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                  <Text style={[styles.legendText, { color: muted }]}>Active Customers</Text>
                </View>
              </View>

              {/* Dual Bar Rows for each salesperson */}
              <View style={{ gap: 12, marginTop: 4 }}>
                {displayedSalespersons.map((x) => (
                  <DualBarRow
                    key={x.name}
                    label={x.name}
                    total={x.customers}
                    active={x.active}
                    max={maxSales}
                    totalColor="#0D9488"
                    activeColor="#10B981"
                  />
                ))}
              </View>

              {cleanSalespersonDist.length > 3 && (
                <TouchableOpacity
                  onPress={() => setShowAllSalespersons(!showAllSalespersons)}
                  style={[
                    styles.toggleButton,
                    {
                      borderColor: t.border,
                      backgroundColor: isDark ? "rgba(21, 154, 124, 0.1)" : "#EBF7F3",
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleButtonText, { color: "#159A7C" }]}>
                    {showAllSalespersons
                      ? "Show Top 3"
                      : `Show Remaining (${cleanSalespersonDist.length - 3}) Salespersons`}
                  </Text>
                  <Ionicons
                    name={showAllSalespersons ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#159A7C"
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={{ color: muted, fontFamily: Typography.regular }}>
              No salesperson distribution data available.
            </Text>
          )}
        </View>

        {/* ── Section 2: Top 10 States & State Share (with District Drilldown) ── */}
        <View style={[styles.chartSection, { backgroundColor: cardBg, borderColor: t.border }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Ionicons name="map-outline" size={20} color="#EF4444" />
              <Text style={[styles.chartTitle, { color: text }]}>Top 10 States & State Share</Text>
            </View>
            <Text style={[styles.chartSubtitle, { color: muted }]}>
              Customer distribution across states. Tap any state to view district share & pie chart.
            </Text>
          </View>

          {chartsLoading ? (
            <SkeletonBlock height={190} borderRadius={16} />
          ) : statePieData.length > 0 ? (
            <>
              {/* State Share Pie Chart */}
              <View style={styles.chartBox}>
                <PieChart
                  data={statePieData}
                  width={chartWidth}
                  height={190}
                  chartConfig={chartConfig}
                  accessor="count"
                  backgroundColor="transparent"
                  paddingLeft="10"
                  absolute
                />
              </View>

              {/* Legend Row: Total vs Active */}
              <View style={styles.chartLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={[styles.legendText, { color: muted }]}>Total Customers</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                  <Text style={[styles.legendText, { color: muted }]}>Active Customers</Text>
                </View>
              </View>

              {/* Clickable Dual Bar Rows for each State */}
              <View style={{ gap: 10, marginTop: 4 }}>
                {displayedStates.map((x) => (
                  <TouchableOpacity
                    key={x.state}
                    onPress={() => {
                      triggerLightHaptic();
                      router.push({
                        pathname: "/(employee)/customers/district-share" as any,
                        params: { state: x.state },
                      });
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.stateCard,
                      {
                        borderColor: isDark ? "#2D493F" : "#E2EBE6",
                        backgroundColor: isDark ? "rgba(32, 185, 154, 0.05)" : "#F8FCFA",
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`View district share for ${x.state}`}
                  >
                    <DualBarRow
                      label={x.state || "Other"}
                      total={x.count}
                      active={x.active}
                      max={maxState}
                      totalColor="#EF4444"
                      activeColor="#10B981"
                      icon="location-sharp"
                      rightAction={
                        <View
                          style={[
                            styles.districtPill,
                            {
                              backgroundColor: isDark ? "rgba(53, 214, 160, 0.15)" : "#E6F8F2",
                              borderColor: isDark ? "#35D6A0" : "#00A879",
                            },
                          ]}
                        >
                          <Text style={[styles.districtPillText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                            Districts
                          </Text>
                          <Ionicons name="chevron-forward" size={12} color={isDark ? "#35D6A0" : "#00A879"} />
                        </View>
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {(chartsData?.stateDistribution?.length || 0) > 3 && (
                <TouchableOpacity
                  onPress={() => setShowAllStates(!showAllStates)}
                  style={[
                    styles.toggleButton,
                    {
                      borderColor: t.border,
                      backgroundColor: isDark ? "rgba(21, 154, 124, 0.1)" : "#EBF7F3",
                      marginTop: 8,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleButtonText, { color: "#159A7C" }]}>
                    {showAllStates
                      ? "Show Top 3"
                      : `Show Remaining (${Math.min(10, chartsData?.stateDistribution?.length || 0) - 3}) States`}
                  </Text>
                  <Ionicons
                    name={showAllStates ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#159A7C"
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={{ color: muted, fontFamily: Typography.regular }}>
              No state distribution data available.
            </Text>
          )}
        </View>

        {/* ── Section 3: Workspace Tools ── */}
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>Workspace</Text>
          <Text style={[styles.sectionHint, { color: muted }]}>Tools available to your account</Text>
        </View>

        {availableLinks.map((item) => (
          <TouchableOpacity
            key={item.title}
            onPress={() =>
              open(
                isAdmin && item.title === "Customer Directory"
                  ? "/(admin)/customers"
                  : isAdmin && item.title === "My Incentives"
                  ? "/(admin)/incentives"
                  : item.route
              )
            }
            activeOpacity={0.75}
            style={[
              styles.linkCard,
              { backgroundColor: cardBg, borderColor: t.border },
            ]}
          >
            <View style={[styles.linkIcon, { backgroundColor: `${item.color}18` }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: text }]}>{item.title}</Text>
              <Text style={[styles.linkDescription, { color: muted }]}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={muted} />
          </TouchableOpacity>
        ))}

        {loading && <SkeletonBlock height={96} borderRadius={16} style={{ marginTop: 4 }} />}
      </ScrollView>

      <CustomerNavDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        isAdmin={isAdmin}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 14 },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginBottom: 4,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroHeader: {
    marginTop: 2,
    marginBottom: 6,
  },
  eyebrow: { fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  title: { fontFamily: Typography.heading, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  subtitle: { fontFamily: Typography.regular, marginTop: 6, fontSize: 13, lineHeight: 19 },
  error: { padding: 12, borderRadius: 12 },
  metricRow: { flexDirection: "row", gap: 9 },
  metric: { flex: 1, minHeight: 116, padding: 12, borderRadius: 16, borderWidth: 1 },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  metricValue: { fontFamily: Typography.bold, fontSize: 21 },
  metricLabel: { fontFamily: Typography.regular, fontSize: 11, lineHeight: 15, marginTop: 3 },
  balanceCard: { borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center" },
  balanceLabel: { color: "#D9FFF5", fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1 },
  balanceValue: { color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 26, marginTop: 5 },
  balanceHint: { color: "#D9FFF5", fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },

  // Chart sections
  chartSection: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    gap: 2,
    marginBottom: 4,
  },
  chartTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: 16,
  },
  chartSubtitle: {
    fontFamily: Typography.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  chartLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Typography.medium,
    fontSize: 11,
  },
  metricTag: {
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  chartBox: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  barLabelLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    fontFamily: Typography.medium,
    flex: 1,
    fontSize: 13,
  },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  districtPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  districtPillText: {
    fontFamily: Typography.bold,
    fontSize: 11,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  toggleButtonText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },

  // Workspace tools
  sectionHeading: { marginTop: 8 },
  sectionTitle: { fontFamily: Typography.headingSemi, fontSize: 20 },
  sectionHint: { fontFamily: Typography.regular, marginTop: 3, fontSize: 12 },
  linkCard: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 74,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linkIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  linkTitle: { fontFamily: Typography.semiBold, fontSize: 14 },
  linkDescription: { fontFamily: Typography.regular, fontSize: 11, lineHeight: 15, marginTop: 3 },
});
