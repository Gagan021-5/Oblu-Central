import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import { DashboardStats, fetchDashboardStatsApi, fetchCustomerChartsApi } from "@/services/customerService";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { Typography } from "@/constants/theme";

const links = [
  { title: "Customer Directory", description: "Search accounts and open customer records", icon: "people-outline", route: "/(employee)/customers", color: "#20B99A", permissions: ["customer.view", "customer.view_all"] },
  { title: "Team Customers", description: "Review customers in your permitted team scope", icon: "person-add-outline", route: "/(employee)/customers/tool/team-customers", color: "#159A7C", permissions: ["customer.view", "customer.view_all"] },
  { title: "Payment Follow-ups", description: "Review customers with pending or overdue payments", icon: "cash-outline", route: "/(employee)/customers/tool/payment-followups", color: "#F59E0B", permission: "payment.view" },
  { title: "Monthly Sales Report", description: "Review monthly sales performance", icon: "calendar-outline", route: "/(employee)/customers/tool/monthly-sales", color: "#0EA5E9", permissions: ["customer.view", "customer.view_all", "payment.view"] },
  { title: "Analytics", description: "Customer, salesperson and state summaries", icon: "bar-chart-outline", route: "/(employee)/customers/analytics", color: "#6366F1", permission: "customer.view_all" },
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
  const { colors, isDark } = useTheme();
  const { user, permissionProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);

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
      const data = await fetchDashboardStatsApi();
      setStats(data);
      if (can("customer.view_all") || isFinance) {
        try {
          await fetchCustomerChartsApi();
        } catch {}
      }
    } catch {
      setError("Could not reach the customer dashboard. Check your connection and sign-in.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [can, isFinance]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (route: string) => router.push(route as never);
  const cardBg = isDark ? "#111B18" : "#FFFFFF";
  const text = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";

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

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: isDark ? colors.background : "#F5F8FA" }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 110 },
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
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: "#20B99A" }]}>OBLU CUSTOMER WORKSPACE</Text>
            <Text style={[styles.title, { color: text }]}>Customers, managed smarter.</Text>
            <Text style={[styles.subtitle, { color: muted }]}>
              Your customer accounts, payment follow-ups and sales tools in one place.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Open customer navigation"
            onPress={() => setDrawerVisible(true)}
            style={[styles.profileIcon, { backgroundColor: cardBg }]}
          >
            <Ionicons name="menu" size={22} color={text} />
          </TouchableOpacity>
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

        <View style={styles.metricRow}>
          {metricItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              onPress={() => open(item.route)}
              style={[
                styles.metric,
                { backgroundColor: cardBg, borderColor: isDark ? "#263A32" : "#E4EAF0" },
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

        <View style={[styles.balanceCard, { backgroundColor: "#0E9E83" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceLabel}>TOTAL OUTSTANDING</Text>
            <Text style={styles.balanceValue}>{stats?.totalOutstandingFormatted ?? "₹0"}</Text>
            <Text style={styles.balanceHint}>Total customer balances</Text>
          </View>
          <Ionicons name="trending-up" size={30} color="#D9FFF5" />
        </View>

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
              { backgroundColor: cardBg, borderColor: isDark ? "#263A32" : "#E4EAF0" },
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
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 },
  eyebrow: { fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  title: { fontFamily: Typography.heading, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  subtitle: { fontFamily: Typography.regular, marginTop: 6, fontSize: 13, lineHeight: 19 },
  profileIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4EAF0",
  },
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
  sectionHeading: { marginTop: 5 },
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
