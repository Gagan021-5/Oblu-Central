import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PieChart } from "react-native-chart-kit";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import { Typography } from "@/constants/theme";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { CustomerChartsData, fetchCustomerChartsApi } from "@/services/customerService";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";

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
  const { colors, isDark } = useTheme();
  const { user, permissionProfile } = useAuth();
  const roleText = `${user?.role || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
  const isSuperuser = Boolean((user as any)?.is_superuser || roleText.includes("superuser"));
  const userHasRole = (role: string) =>
    hasRole(permissionProfile, role) || roleText.includes(role);
  const isAdminUser = isSuperuser || userHasRole("admin") || roleText.includes("admin");
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
    if (!canOpen) {
      router.replace("/(employee)/customers/dashboard");
      return;
    }
    void load();
  }, [canOpen, load]);

  const foreground = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";
  const card = { backgroundColor: isDark ? "#111B18" : "#FFFFFF", borderColor: isDark ? "#263A32" : "#E4EAF0" };
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = Math.max(280, screenWidth - 68);

  const maxState = Math.max(1, ...(data?.stateDistribution.map((x) => x.count) || [1]));
  const maxSales = Math.max(1, ...(data?.salespersonDistribution.map((x) => x.customers) || [1]));

  const Bar = ({ label, value, max, tint }: { label: string; value: number; max: number; tint: string }) => (
    <View style={styles.barRow}>
      <View style={styles.barLabelLine}>
        <Text numberOfLines={1} style={[styles.barLabel, { color: foreground }]}>{label || "Other"}</Text>
        <Text style={[styles.barValue, { color: muted }]}>{value}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: isDark ? "#23322D" : "#EDF2F5" }]}>
        <View style={[styles.fill, { width: `${Math.max(value ? 4 : 0, (value / max) * 100)}%`, backgroundColor: tint }]} />
      </View>
    </View>
  );

  const salespersonPieData = (data?.salespersonDistribution || []).slice(0, 6).map((item, idx) => ({
    name: item.name ? (item.name.length > 12 ? `${item.name.slice(0, 10)}…` : item.name) : "Unassigned",
    customers: item.customers,
    color: PIE_COLORS[idx % PIE_COLORS.length],
    legendFontColor: isDark ? "#D1D5DB" : "#374151",
    legendFontSize: 11,
  }));

  const statePieData = (data?.stateDistribution || []).slice(0, 6).map((item, idx) => ({
    name: item.state ? (item.state.length > 12 ? `${item.state.slice(0, 10)}…` : item.state) : "Other",
    count: item.count,
    color: PIE_COLORS[(idx + 2) % PIE_COLORS.length],
    legendFontColor: isDark ? "#D1D5DB" : "#374151",
    legendFontSize: 11,
  }));

  const voucherPieData = [
    {
      name: "Paid",
      count: data?.vouchers.paid || 0,
      color: "#16A67A",
      legendFontColor: isDark ? "#D1D5DB" : "#374151",
      legendFontSize: 11,
    },
    {
      name: "Pending",
      count: data?.vouchers.pending || 0,
      color: "#E59C18",
      legendFontColor: isDark ? "#D1D5DB" : "#374151",
      legendFontSize: 11,
    },
    {
      name: "Overdue",
      count: data?.vouchers.overdue || 0,
      color: "#E34B59",
      legendFontColor: isDark ? "#D1D5DB" : "#374151",
      legendFontSize: 11,
    },
  ].filter((item) => item.count > 0);

  const chartConfig = {
    backgroundGradientFrom: isDark ? "#111B18" : "#FFFFFF",
    backgroundGradientTo: isDark ? "#111B18" : "#FFFFFF",
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
          <View>
            <Text style={[styles.eyebrow, { color: "#20B99A" }]}>CUSTOMERS</Text>
            <Text style={[styles.title, { color: foreground }]}>Analytics</Text>
          </View>
        </View>

        {error ? (
          <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={[styles.notice, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}>
            <Text style={{ color: foreground, fontFamily: Typography.regular }}>{error}</Text>
          </TouchableOpacity>
        ) : null}

      <View style={styles.kpis}>
        {[
          { label: "Customers", value: data?.totalCustomers, icon: "people-outline" as const },
          { label: "Total Exposure", value: data?.totalOutstandingFormatted, icon: "cash-outline" as const },
        ].map((x) => (
          <View key={x.label} style={[styles.kpi, card]}>
            <Ionicons name={x.icon} size={19} color="#20B99A" />
            <Text style={[styles.kpiValue, { color: foreground }]}>{x.value ?? (x.label.includes("Exposure") ? "₹0" : 0)}</Text>
            <Text style={[styles.kpiLabel, { color: muted }]}>{x.label}</Text>
          </View>
        ))}
      </View>

      {/* Voucher Status Section */}
      <View style={[styles.section, card]}>
        <Text style={[styles.sectionTitle, { color: foreground }]}>Voucher status</Text>
        <View style={styles.vouchers}>
          {[
            { label: "Overdue", value: data?.vouchers.overdue, color: "#E34B59" },
            { label: "Pending", value: data?.vouchers.pending, color: "#E59C18" },
            { label: "Paid", value: data?.vouchers.paid, color: "#16A67A" },
          ].map((x) => (
            <View key={x.label} style={styles.voucher}>
              <Text style={[styles.voucherValue, { color: x.color }]}>{x.value ?? 0}</Text>
              <Text style={[styles.kpiLabel, { color: muted }]}>{x.label}</Text>
            </View>
          ))}
        </View>
        {voucherPieData.length > 0 && !loading ? (
          <View style={styles.chartBox}>
            <PieChart
              data={voucherPieData}
              width={chartWidth}
              height={160}
              chartConfig={chartConfig}
              accessor="count"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        ) : null}
      </View>

      {/* Salesperson Distribution: Bar + Pie Chart */}
      <View style={[styles.section, card]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: foreground }]}>Salesperson Share</Text>
          <Text style={[styles.sectionSubtitle, { color: muted }]}>Customer account allocation</Text>
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
            <View style={{ gap: 8, marginTop: 4 }}>
              {(data?.salespersonDistribution || []).map((x) => (
                <Bar key={x.name} label={x.name} value={x.customers} max={maxSales} tint="#7C6CF2" />
              ))}
            </View>
          </>
        ) : (
          <Text style={{ color: muted, fontFamily: Typography.regular }}>No salesperson distribution data available.</Text>
        )}
      </View>

      {/* State Distribution: Bar + Pie Chart */}
      <View style={[styles.section, card]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: foreground }]}>State Share</Text>
          <Text style={[styles.sectionSubtitle, { color: muted }]}>Geographic presence breakdown</Text>
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
            <View style={{ gap: 8, marginTop: 4 }}>
              {(data?.stateDistribution || []).map((x) => (
                <Bar key={x.state} label={x.state} value={x.count} max={maxState} tint="#20B99A" />
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
  kpis: { flexDirection: "row", gap: 10 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 15 },
  kpiValue: { fontFamily: Typography.bold, fontSize: 22, marginTop: 12 },
  kpiLabel: { fontFamily: Typography.regular, fontSize: 11, marginTop: 3 },
  section: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  sectionHeader: { gap: 2, marginBottom: 4 },
  sectionTitle: { fontFamily: Typography.headingSemi, fontSize: 15 },
  sectionSubtitle: { fontFamily: Typography.regular, fontSize: 11 },
  chartBox: { alignItems: "center", justifyContent: "center", marginVertical: 4 },
  vouchers: { flexDirection: "row", justifyContent: "space-between" },
  voucher: { flex: 1 },
  voucherValue: { fontFamily: Typography.bold, fontSize: 20 },
  barRow: { gap: 6 },
  barLabelLine: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  barLabel: { fontFamily: Typography.medium, flex: 1, fontSize: 12 },
  barValue: { fontFamily: Typography.semiBold, fontSize: 12 },
  track: { height: 8, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
});
