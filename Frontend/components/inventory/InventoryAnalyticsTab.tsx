import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";

interface ProductABC {
  id: string;
  name: string;
  category: string;
  sales_value: number;
  sales_value_display: string;
  units_sold: number;
  percentage: number;
  cumulative_pct: number;
  tier: "A" | "B" | "C";
}

interface CategoryRevenue {
  category: string;
  sales_value: number;
  sales_value_display: string;
  units_sold: number;
  percentage: number;
}

interface AnalyticsData {
  period_days: number;
  grand_total: number;
  grand_total_display: string;
  total_units_sold: number;
  products: ProductABC[];
  categories: CategoryRevenue[];
}

export function InventoryAnalyticsTab() {
  const { colors, isDark } = useTheme();

  const [days, setDays] = useState<30 | 60 | 90 | 180>(90);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [tierFilter, setTierFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (selectedDays = days) => {
    try {
      setLoading(true);
      const res = await api.get("/inventory/analytics/", {
        params: { days: selectedDays },
      });
      if (res.data?.status === "success") {
        setData(res.data);
      }
    } catch (err: any) {
      console.warn("[InventoryAnalyticsTab] Error:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics(days);
  };

  const products = data?.products || [];
  const classACount = products.filter((p) => p.tier === "A").length;
  const filteredProducts = tierFilter === "ALL" ? products : products.filter((p) => p.tier === tierFilter);

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
          <Text style={[styles.title, { color: foreground }]}>Inventory Intelligence & BI</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            Pareto 80/20 ABC classification & revenue analytics
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <Ionicons name="refresh" size={16} color="#00A879" />
        </TouchableOpacity>
      </View>

      {/* Days Switcher */}
      <View style={styles.daysRow}>
        {([30, 60, 90, 180] as const).map((d) => {
          const isSelected = days === d;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => setDays(d)}
              style={[
                styles.dayPill,
                {
                  backgroundColor: isSelected ? "#00A879" : cardBg,
                  borderColor: isSelected ? "#00A879" : cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayPillText,
                  {
                    color: isSelected ? "#FFFFFF" : foreground,
                    fontFamily: isSelected ? Typography.bold : Typography.medium,
                  },
                ]}
              >
                Last {d} Days
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: muted }]}>TOTAL REVENUE</Text>
          <Text style={[styles.kpiValue, { color: "#00A879" }]}>
            {data?.grand_total_display || "₹0"}
          </Text>
          <Text style={[styles.kpiSub, { color: muted }]}>Invoiced sales</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: muted }]}>UNITS DISPATCHED</Text>
          <Text style={[styles.kpiValue, { color: foreground }]}>
            {(data?.total_units_sold || 0).toLocaleString()}
          </Text>
          <Text style={[styles.kpiSub, { color: muted }]}>Physical units</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: muted }]}>CLASS A SKUS</Text>
          <Text style={[styles.kpiValue, { color: "#10B981" }]}>{classACount}</Text>
          <Text style={[styles.kpiSub, { color: muted }]}>80% revenue drivers</Text>
        </View>
      </View>

      {/* Category Revenue Distribution */}
      {data?.categories && data.categories.length > 0 && (
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: foreground }]}>Category Revenue Share</Text>
          <Text style={[styles.sectionSub, { color: muted }]}>
            Top categories by value contribution
          </Text>

          <View style={styles.catBarsList}>
            {data.categories.map((cat, idx) => (
              <View key={idx} style={styles.catBarItem}>
                <View style={styles.catBarHeader}>
                  <Text style={[styles.catBarName, { color: foreground }]} numberOfLines={1}>
                    {cat.category}
                  </Text>
                  <Text style={[styles.catBarVal, { color: foreground }]}>
                    {cat.sales_value_display} ({cat.percentage}%)
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(cat.percentage, 100)}%`, backgroundColor: "#00A879" },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ABC Classification Filter */}
      <View style={[styles.abcHeader, { marginTop: 14 }]}>
        <View>
          <Text style={[styles.sectionTitle, { color: foreground }]}>Pareto ABC Classification</Text>
          <Text style={[styles.sectionSub, { color: muted }]}>
            80/20 prioritization of catalog SKUs
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(["ALL", "A", "B", "C"] as const).map((tier) => {
          const isSelected = tierFilter === tier;
          return (
            <TouchableOpacity
              key={tier}
              onPress={() => setTierFilter(tier)}
              style={[
                styles.tabItem,
                isSelected && { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isSelected ? foreground : muted,
                    fontFamily: isSelected ? Typography.bold : Typography.medium,
                  },
                ]}
              >
                {tier === "ALL" ? "All" : `Tier ${tier}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Products List */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#00A879" />
          <Text style={[styles.loadingText, { color: muted }]}>Computing revenue distributions...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="bar-chart-outline" size={38} color={muted} />
          <Text style={[styles.emptyTitle, { color: foreground }]}>No Products in Tier</Text>
          <Text style={[styles.emptySub, { color: muted }]}>
            No products match the selected classification tier.
          </Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {filteredProducts.map((p, index) => {
            const tierColor = p.tier === "A" ? "#10B981" : p.tier === "B" ? "#F59E0B" : "#64748B";
            const tierBg = p.tier === "A" ? "rgba(16,185,129,0.12)" : p.tier === "B" ? "rgba(245,158,11,0.12)" : "rgba(100,116,139,0.12)";
            return (
              <View
                key={p.id || index}
                style={[styles.productCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.tierBadge, { backgroundColor: tierBg }]}>
                    <Text style={[styles.tierText, { color: tierColor }]}>{p.tier}</Text>
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text style={[styles.prodName, { color: foreground }]} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={[styles.prodCategory, { color: muted }]}>{p.category}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.prodRevenue, { color: "#00A879" }]}>
                      {p.sales_value_display}
                    </Text>
                    <Text style={[styles.prodUnits, { color: muted }]}>
                      {p.units_sold.toLocaleString()} sold
                    </Text>
                  </View>
                </View>
                <View style={[styles.cumTrack, { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" }]}>
                  <View
                    style={[
                      styles.cumFill,
                      { width: `${Math.min(p.cumulative_pct, 100)}%`, backgroundColor: tierColor },
                    ]}
                  />
                </View>
                <View style={styles.cumMeta}>
                  <Text style={[styles.cumText, { color: muted }]}>
                    Contribution: {p.percentage}%
                  </Text>
                  <Text style={[styles.cumText, { color: muted }]}>
                    Cumulative: {p.cumulative_pct}%
                  </Text>
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
  daysRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillText: {
    fontSize: 12,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    ...Shadows.card,
  },
  kpiLabel: {
    fontSize: 9,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: Typography.bold,
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 9.5,
    fontFamily: Typography.medium,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 14,
    ...Shadows.card,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Typography.bold,
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
    fontFamily: Typography.regular,
  },
  catBarsList: {
    gap: 10,
  },
  catBarItem: {
    gap: 4,
  },
  catBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  catBarName: {
    fontSize: 12,
    fontFamily: Typography.medium,
    flex: 1,
    marginRight: 8,
  },
  catBarVal: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
  },
  abcHeader: {
    marginBottom: 10,
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
  productCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tierBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tierText: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  prodName: {
    fontSize: 12,
    fontFamily: Typography.bold,
    lineHeight: 16,
  },
  prodCategory: {
    fontSize: 10.5,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  prodRevenue: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  prodUnits: {
    fontSize: 10,
    fontFamily: Typography.regular,
  },
  cumTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  cumFill: {
    height: "100%",
  },
  cumMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cumText: {
    fontSize: 10,
    fontFamily: Typography.regular,
  },
});
