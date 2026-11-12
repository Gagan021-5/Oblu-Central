import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { SearchBar } from "@/components/ui/SearchBar";
import api from "@/services/api";

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  unit: string;
  threshold: number;
  deficit: number;
  daily_run_rate: number;
  days_left: number;
  severity: "critical" | "warning";
  severity_label: string;
}

interface InventoryLowStockTabProps {
  onOpenProduct: (itemId: string, tab?: "forecast" | "trends" | "ledger") => void;
}

export function InventoryLowStockTab({ onOpenProduct }: InventoryLowStockTabProps) {
  const { colors, isDark } = useTheme();

  const [criticalAlerts, setCriticalAlerts] = useState<LowStockItem[]>([]);
  const [warningAlerts, setWarningAlerts] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");
  const [search, setSearch] = useState("");

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/inventory/alerts/low-stock/");
      if (res.data?.status === "success") {
        setCriticalAlerts(res.data.critical_alerts || []);
        setWarningAlerts(res.data.warning_alerts || []);
      }
    } catch (err: any) {
      console.warn("[InventoryLowStockTab] Error:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const combinedAlerts = [...criticalAlerts, ...warningAlerts];
  const filteredList = (
    filter === "critical"
      ? criticalAlerts
      : filter === "warning"
      ? warningAlerts
      : combinedAlerts
  ).filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase().trim()) ||
      item.sku.toLowerCase().includes(search.toLowerCase().trim()) ||
      item.category.toLowerCase().includes(search.toLowerCase().trim())
  );

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const cardBorder = isDark ? "#1E332D" : "#E2E8F0";
  const foreground = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: foreground }]}>Low Stock & Deficit Alerts</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            High-priority safety threshold violations and stockouts
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <Ionicons name="refresh" size={16} color="#00A879" />
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <TouchableOpacity
          onPress={() => setFilter(filter === "critical" ? "all" : "critical")}
          style={[
            styles.kpiCard,
            {
              backgroundColor: cardBg,
              borderColor: filter === "critical" ? "#EF4444" : cardBorder,
            },
          ]}
          activeOpacity={0.8}
        >
          <View style={styles.kpiTop}>
            <Text style={[styles.kpiLabel, { color: "#EF4444" }]}>CRITICAL STOCKOUTS</Text>
            <View style={[styles.badge, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: "#EF4444" }]}>{criticalAlerts.length}</Text>
          <Text style={[styles.kpiSub, { color: muted }]}>0 units on hand</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter(filter === "warning" ? "all" : "warning")}
          style={[
            styles.kpiCard,
            {
              backgroundColor: cardBg,
              borderColor: filter === "warning" ? "#F59E0B" : cardBorder,
            },
          ]}
          activeOpacity={0.8}
        >
          <View style={styles.kpiTop}>
            <Text style={[styles.kpiLabel, { color: "#F59E0B" }]}>SAFETY DEFICITS</Text>
            <View style={[styles.badge, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
              <Ionicons name="warning" size={14} color="#F59E0B" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>{warningAlerts.length}</Text>
          <Text style={[styles.kpiSub, { color: muted }]}>Below reorder level</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setFilter("all")}
          style={[
            styles.tabItem,
            filter === "all" && { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: filter === "all" ? foreground : muted,
                fontFamily: filter === "all" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            All Alerts ({combinedAlerts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter("critical")}
          style={[
            styles.tabItem,
            filter === "critical" && { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: filter === "critical" ? "#EF4444" : muted,
                fontFamily: filter === "critical" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Critical ({criticalAlerts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter("warning")}
          style={[
            styles.tabItem,
            filter === "warning" && { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: filter === "warning" ? "#F59E0B" : muted,
                fontFamily: filter === "warning" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Deficit ({warningAlerts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholders={[
          'Search "low stock SKUs"',
          'Search "critical items"',
          'Search "category"',
        ]}
        intervalMs={2000}
        onClear={() => setSearch("")}
      />

      {/* Content */}
      {loading && !refreshing ? (
        <SkeletonCardList count={4} height={98} />
      ) : filteredList.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="checkmark-circle-outline" size={38} color="#10B981" />
          <Text style={[styles.emptyTitle, { color: foreground }]}>All Levels Healthy</Text>
          <Text style={[styles.emptySub, { color: muted }]}>
            {search ? "No matching low stock alerts found." : "No safety deficit alerts for active inventory items."}
          </Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {filteredList.map((item) => {
            const isCrit = item.severity === "critical";
            const badgeBg = isCrit ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)";
            const badgeColor = isCrit ? "#EF4444" : "#F59E0B";

            return (
              <View
                key={item.id}
                style={[styles.alertCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                {/* Header */}
                <View style={styles.alertHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.itemName, { color: foreground }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemMeta, { color: muted }]}>
                      {item.sku} · {item.category}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                      {item.severity_label}
                    </Text>
                  </View>
                </View>

                {/* Stock Stats Grid */}
                <View style={[styles.statsGrid, { backgroundColor: isDark ? "#0A1310" : "#F8FAFC", borderColor: cardBorder }]}>
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: muted }]}>ON HAND</Text>
                    <Text style={[styles.statValue, { color: isCrit ? "#EF4444" : "#F59E0B" }]}>
                      {item.stock} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: muted }]}>MIN TARGET</Text>
                    <Text style={[styles.statValue, { color: foreground }]}>
                      {item.threshold} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: muted }]}>DEFICIT</Text>
                    <Text style={[styles.statValue, { color: "#EF4444" }]}>
                      -{item.deficit} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: muted }]}>RUNOUT IN</Text>
                    <Text style={[styles.statValue, { color: foreground }]}>
                      {item.days_left === 0 ? "0d" : item.days_left > 90 ? "90+ d" : `${item.days_left}d`}
                    </Text>
                  </View>
                </View>

                {/* Quick Actions Row */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => onOpenProduct(item.id, "forecast")}
                    style={[styles.actionBtn, { borderColor: cardBorder }]}
                  >
                    <Ionicons name="analytics-outline" size={14} color="#00A879" />
                    <Text style={[styles.actionBtnText, { color: "#00A879" }]}>Forecast</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onOpenProduct(item.id, "trends")}
                    style={[styles.actionBtn, { borderColor: cardBorder }]}
                  >
                    <Ionicons name="trending-up-outline" size={14} color="#3B82F6" />
                    <Text style={[styles.actionBtnText, { color: "#3B82F6" }]}>Trends</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onOpenProduct(item.id, "ledger")}
                    style={[styles.actionBtn, { borderColor: cardBorder }]}
                  >
                    <Ionicons name="receipt-outline" size={14} color="#8B5CF6" />
                    <Text style={[styles.actionBtnText, { color: "#8B5CF6" }]}>Ledger</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: Typography.bold,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    ...Shadows.card,
  },
  kpiTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiLabel: {
    fontSize: 9.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: Typography.bold,
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 11,
    fontFamily: Typography.medium,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Typography.regular,
  },
  centerBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Typography.medium,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: Typography.regular,
    textAlign: "center",
  },
  cardList: {
    gap: 12,
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    fontFamily: Typography.bold,
    lineHeight: 18,
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: Typography.bold,
    letterSpacing: 0.4,
  },
  statsGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  statLabel: {
    fontSize: 8.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
  },
});
