import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PieChart } from "react-native-chart-kit";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import { Typography } from "@/constants/theme";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { CustomerChartsData, fetchCustomerChartsApi } from "@/services/customerService";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";

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
];

export default function CustomerAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
  const { user, permissionProfile, isLoading } = useAuth();
  const roleText = `${user?.role || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
  const isSuperuser = Boolean(
    (user as any)?.is_superuser ||
    roleText.includes("superuser") ||
    user?.username?.toLowerCase() === "infected" ||
    (user?.permissions || []).includes("*") ||
    (permissionProfile?.permissions || []).includes("*")
  );
  const userHasRole = (role: string) =>
    hasRole(permissionProfile, role) || roleText.includes(role);
  const isAdminUser = isSuperuser || userHasRole("admin") || roleText.includes("admin") || user?.username?.toLowerCase() === "infected";
  const canOpen =
    isSuperuser ||
    isAdminUser ||
    userHasRole("sales_head") ||
    hasPermission(permissionProfile, "customer.view_all");
  const [data, setData] = useState<CustomerChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);

  const load = useCallback(async () => {
    if (!canOpen) return;
    setError("");
    try {
      const result = await fetchCustomerChartsApi();
      setData(result);
    } catch {
      setData(null);
      setError("Analytics could not be loaded. Check your connection and permissions, then refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canOpen]);

  useEffect(() => {
    if (isLoading) return;
    if (!canOpen) {
      router.replace("/(employee)/customers/dashboard");
      return;
    }
    void load();
  }, [canOpen, isLoading, load]);

  const foreground = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";
  const card = { backgroundColor: t.surface, borderColor: t.border };
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(260, screenWidth - 72);

  const maxState = Math.max(1, ...(data?.stateDistribution.map((x) => x.count) || [1]));
  const maxSales = Math.max(1, ...(data?.salespersonDistribution.map((x) => x.customers) || [1]));

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
            <Text numberOfLines={1} style={[styles.barLabel, { color: foreground, flex: 1 }]}>
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

        {/* Dual Bars: Total (top) & Active (bottom) matching web dashboard */}
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

  const salespersonPieData = (data?.salespersonDistribution || []).slice(0, 15).map((item, idx) => ({
    name: item.name ? (item.name.length > 12 ? `${item.name.slice(0, 10)}…` : item.name) : "Unassigned",
    customers: item.customers,
    color: PIE_COLORS[idx % PIE_COLORS.length],
    legendFontColor: isDark ? "#D1D5DB" : "#374151",
    legendFontSize: 11,
  }));

  const statePieData = (data?.stateDistribution || []).slice(0, 10).map((item, idx) => ({
    name: item.state ? (item.state.length > 12 ? `${item.state.slice(0, 10)}…` : item.state) : "Other",
    count: item.count,
    color: PIE_COLORS[(idx + 2) % PIE_COLORS.length],
    legendFontColor: isDark ? "#D1D5DB" : "#374151",
    legendFontSize: 11,
  }));

  const chartConfig = {
    backgroundGradientFrom: t.surface,
    backgroundGradientTo: t.surface,
    color: (opacity = 1) => `rgba(32, 185, 154, ${opacity})`,
    labelColor: () => muted,
  };

  if (!canOpen) return null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <View style={styles.top}>
          <TouchableOpacity
            accessibilityLabel="Open customer navigation menu"
            onPress={() => setDrawerVisible(true)}
            style={[styles.back, card]}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={22} color={foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.eyebrow, { color: "#20B99A" }]}>CUSTOMERS</Text>
            <Text style={[styles.title, { color: foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Analytics
            </Text>
          </View>
          <SubAppHomeButton size={38} isAdmin={isAdminUser} />
        </View>

        {error ? (
          <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={[styles.notice, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}>
            <Text style={{ color: foreground, fontFamily: Typography.regular }}>{error}</Text>
          </TouchableOpacity>
        ) : null}

      <View style={styles.kpiGrid}>
        <View style={[styles.kpiItem, card]}>
          <Ionicons name="people" size={17} color="#20B99A" />
          <Text style={[styles.kpiValue, { color: foreground }]} numberOfLines={1}>{data?.totalCustomers ?? 0}</Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Total Accounts</Text>
        </View>
        <View style={[styles.kpiItem, card]}>
          <Ionicons name="person" size={17} color="#7C6CF2" />
          <Text style={[styles.kpiValue, { color: foreground }]} numberOfLines={1}>
            {data?.salespersonsCount ?? (data?.salespersonDistribution?.length || 0)}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Salespersons</Text>
        </View>
        <View style={[styles.kpiItem, card]}>
          <Ionicons name="map" size={17} color="#F59E0B" />
          <Text style={[styles.kpiValue, { color: foreground }]} numberOfLines={1}>
            {data?.statesCount ?? (data?.stateDistribution?.length || 0)}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>States</Text>
        </View>
        <View style={[styles.kpiItem, card]}>
          <Ionicons name="checkmark-circle" size={17} color="#10B981" />
          <Text style={[styles.kpiValue, { color: isDark ? "#35D6A0" : "#00A879" }]} numberOfLines={1}>
            {data?.activeCustomers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Active Accounts</Text>
        </View>
        <View style={[styles.kpiItem, card]}>
          <Ionicons name="time" size={17} color="#E34B59" />
          <Text style={[styles.kpiValue, { color: "#E34B59" }]} numberOfLines={1}>
            {data?.inactiveCustomers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Inactive</Text>
        </View>
        <View style={[styles.kpiItem, card]}>
          <Ionicons name="cash" size={17} color="#0EA5E9" />
          <Text style={[styles.kpiValue, { color: foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {data?.totalOutstandingFormatted || "₹0"}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Outstanding</Text>
        </View>
      </View>

      {/* Salesperson Distribution: Pie Chart + Dual Bar List (Total vs Active) */}
      <View style={[styles.section, card]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: foreground }]}>Salesperson Share</Text>
          <Text style={[styles.sectionSubtitle, { color: muted }]}>Customer account allocation & activity</Text>
        </View>
        {loading ? (
          <SkeletonBlock height={190} borderRadius={16} />
        ) : salespersonPieData.length > 0 ? (
          <>
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

            <View style={styles.chartLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
                <Text style={[styles.legendText, { color: muted }]}>Total Customers</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.legendText, { color: muted }]}>Active Customers</Text>
              </View>
            </View>

            <View style={{ gap: 12, marginTop: 4 }}>
              {(data?.salespersonDistribution || []).map((x) => (
                <DualBarRow
                  key={x.name}
                  label={x.name}
                  total={x.customers}
                  active={x.active}
                  max={maxSales}
                  totalColor="#3B82F6"
                  activeColor="#10B981"
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={{ color: muted, fontFamily: Typography.regular }}>No salesperson distribution data available.</Text>
        )}
      </View>

      {/* State Distribution: Pie Chart + Dual Bar List Drilldown */}
      <View style={[styles.section, card]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: foreground }]}>State Share</Text>
          <Text style={[styles.sectionSubtitle, { color: muted }]}>Tap any state to view district share & pie chart</Text>
        </View>
        {loading ? (
          <SkeletonBlock height={190} borderRadius={16} />
        ) : statePieData.length > 0 ? (
          <>
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

            <View style={{ gap: 10, marginTop: 4 }}>
              {(data?.stateDistribution || []).map((x) => (
                <TouchableOpacity
                  key={x.state}
                  onPress={() => {
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
          </>
        ) : (
          <Text style={{ color: muted, fontFamily: Typography.regular }}>No state distribution data available.</Text>
        )}
      </View>
    </ScrollView>

    <CustomerNavDrawer
      visible={drawerVisible}
      onClose={() => setDrawerVisible(false)}
      isAdmin={isAdminUser}
    />
  </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  back: { borderWidth: 1, width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#20B99A", fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: Typography.heading, fontSize: 25, marginTop: 3 },
  notice: { padding: 12, borderRadius: 12 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiItem: { width: "31%", flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 10 },
  kpiValue: { fontFamily: Typography.bold, fontSize: 17, marginTop: 6 },
  kpiLabel: { fontFamily: Typography.regular, fontSize: 10.5, marginTop: 2 },
  activeBadge: { fontFamily: Typography.semiBold, fontSize: 11 },
  section: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  sectionHeader: { gap: 2, marginBottom: 4 },
  sectionTitle: { fontFamily: Typography.headingSemi, fontSize: 15 },
  sectionSubtitle: { fontFamily: Typography.regular, fontSize: 11 },
  chartLegendRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: Typography.medium, fontSize: 11 },
  metricTag: { fontFamily: Typography.bold, fontSize: 12 },
  chartBox: { alignItems: "center", justifyContent: "center", marginVertical: 4 },
  barRow: { gap: 6 },
  barLabelLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  barLabel: { fontFamily: Typography.medium, flex: 1, fontSize: 13 },
  barValue: { fontFamily: Typography.semiBold, fontSize: 13 },
  track: { height: 8, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  stateCard: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  districtPill: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  districtPillText: { fontFamily: Typography.bold, fontSize: 11 },
});
