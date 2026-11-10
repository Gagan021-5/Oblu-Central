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

interface SalesComparisonData {
  current_period_label: string;
  previous_period_label: string;
  current_revenue: number;
  current_revenue_display: string;
  previous_revenue: number;
  previous_revenue_display: string;
  growth_pct: number;
  is_growth_positive: boolean;
  current_units: number;
  previous_units: number;
  units_growth_pct: number;
  is_units_growth_positive: boolean;
}

interface InventoryReportData {
  total_skus: number;
  total_units: number;
  healthy_skus: number;
  low_skus: number;
  out_of_stock_skus: number;
  healthy_pct: number;
  low_pct: number;
  out_pct: number;
}

interface AnalyticsData {
  period_days: number;
  grand_total: number;
  grand_total_display: string;
  total_units_sold: number;
  products: ProductABC[];
  categories: CategoryRevenue[];
  sales_comparison?: SalesComparisonData;
  inventory_report?: InventoryReportData;
}

interface InventoryAnalyticsTabProps {
  initialSection?: "contribution" | "category" | "comparison" | "report";
}

export function InventoryAnalyticsTab({ initialSection = "contribution" }: InventoryAnalyticsTabProps) {
  const { colors, isDark } = useTheme();

  const [section, setSection] = useState<"contribution" | "category" | "comparison" | "report">(initialSection);
  const [days, setDays] = useState<30 | 60 | 90 | 180>(90);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [tierFilter, setTierFilter] = useState<"ALL" | "A" | "B" | "C">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);

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

      {/* 4-Way Intelligence & Reports Switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScroll}
      >
        <TouchableOpacity
          onPress={() => setSection("contribution")}
          style={[
            styles.tabPill,
            section === "contribution" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="pie-chart-outline"
            size={13}
            color={section === "contribution" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "contribution" ? "#FFFFFF" : muted,
                fontFamily: section === "contribution" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Sales Contribution
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSection("category")}
          style={[
            styles.tabPill,
            section === "category" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="bar-chart-outline"
            size={13}
            color={section === "category" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "category" ? "#FFFFFF" : muted,
                fontFamily: section === "category" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Category Analytics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSection("comparison")}
          style={[
            styles.tabPill,
            section === "comparison" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={13}
            color={section === "comparison" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "comparison" ? "#FFFFFF" : muted,
                fontFamily: section === "comparison" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Sales Comparison
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSection("report")}
          style={[
            styles.tabPill,
            section === "report" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={13}
            color={section === "report" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "report" ? "#FFFFFF" : muted,
                fontFamily: section === "report" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Inventory Report
          </Text>
        </TouchableOpacity>
      </ScrollView>

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

      {/* ── SECTION 1: SALES CONTRIBUTION ── */}
      {section === "contribution" && (
        <>
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
                const tierBg =
                  p.tier === "A"
                    ? "rgba(16,185,129,0.12)"
                    : p.tier === "B"
                    ? "rgba(245,158,11,0.12)"
                    : "rgba(100,116,139,0.12)";
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
        </>
      )}

      {/* ── SECTION 2: CATEGORY ANALYTICS ── */}
      {section === "category" && (
        <View style={{ gap: 12 }}>
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: foreground }]}>Category Revenue Share</Text>
            <Text style={[styles.sectionSub, { color: muted }]}>
              Top product categories ranked by value contribution
            </Text>

            <View style={styles.catBarsList}>
              {data?.categories && data.categories.length > 0 ? (
                data.categories.map((cat, idx) => (
                  <View key={idx} style={styles.catBarItem}>
                    <View style={styles.catBarHeader}>
                      <Text style={[styles.catBarName, { color: foreground }]} numberOfLines={1}>
                        #{idx + 1} {cat.category}
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
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: muted }}>
                        Physical Units: {cat.units_sold.toLocaleString()} units
                      </Text>
                      <Text style={{ fontSize: 11, color: "#00A879", fontFamily: Typography.bold }}>
                        {cat.percentage}% of catalog sales
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: muted, padding: 12 }}>No category data available.</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ── SECTION 3: SALES COMPARISON ── */}
      {section === "comparison" && (
        <View style={{ gap: 12 }}>
          {data?.sales_comparison ? (
            <>
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: foreground }]}>Period-over-Period Performance</Text>
                <Text style={[styles.sectionSub, { color: muted }]}>
                  Comparing {data.sales_comparison.current_period_label} vs {data.sales_comparison.previous_period_label}
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  {/* Current Revenue */}
                  <View
                    style={[
                      styles.kpiCard,
                      { flex: 1, backgroundColor: isDark ? "#12201C" : "#E2F7F1", borderColor: cardBorder },
                    ]}
                  >
                    <Text style={[styles.kpiLabel, { color: "#00A879" }]}>CURRENT PERIOD</Text>
                    <Text style={[styles.kpiValue, { color: foreground }]}>
                      {data.sales_comparison.current_revenue_display}
                    </Text>
                    <Text style={[styles.kpiSub, { color: muted }]}>
                      {data.sales_comparison.current_units.toLocaleString()} units sold
                    </Text>
                  </View>

                  {/* Previous Revenue */}
                  <View style={[styles.kpiCard, { flex: 1, backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[styles.kpiLabel, { color: muted }]}>PREVIOUS PERIOD</Text>
                    <Text style={[styles.kpiValue, { color: muted }]}>
                      {data.sales_comparison.previous_revenue_display}
                    </Text>
                    <Text style={[styles.kpiSub, { color: muted }]}>
                      {data.sales_comparison.previous_units.toLocaleString()} units sold
                    </Text>
                  </View>
                </View>

                {/* Growth Metric */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 14,
                    marginTop: 14,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: cardBorder,
                  }}
                >
                  <Text style={{ fontFamily: Typography.bold, color: foreground, fontSize: 13 }}>
                    Revenue Growth:
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: data.sales_comparison.is_growth_positive
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(239,68,68,0.12)",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: Radius.pill,
                    }}
                  >
                    <Ionicons
                      name={data.sales_comparison.is_growth_positive ? "arrow-up" : "arrow-down"}
                      size={13}
                      color={data.sales_comparison.is_growth_positive ? "#10B981" : "#EF4444"}
                    />
                    <Text
                      style={{
                        fontFamily: Typography.bold,
                        fontSize: 12,
                        color: data.sales_comparison.is_growth_positive ? "#10B981" : "#EF4444",
                      }}
                    >
                      {data.sales_comparison.is_growth_positive ? "+" : "-"}
                      {data.sales_comparison.growth_pct}%
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <Text style={{ fontFamily: Typography.bold, color: foreground, fontSize: 13 }}>
                    Unit Volume Growth:
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: data.sales_comparison.is_units_growth_positive
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(239,68,68,0.12)",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: Radius.pill,
                    }}
                  >
                    <Ionicons
                      name={data.sales_comparison.is_units_growth_positive ? "arrow-up" : "arrow-down"}
                      size={13}
                      color={data.sales_comparison.is_units_growth_positive ? "#10B981" : "#EF4444"}
                    />
                    <Text
                      style={{
                        fontFamily: Typography.bold,
                        fontSize: 12,
                        color: data.sales_comparison.is_units_growth_positive ? "#10B981" : "#EF4444",
                      }}
                    >
                      {data.sales_comparison.is_units_growth_positive ? "+" : "-"}
                      {data.sales_comparison.units_growth_pct}%
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ActivityIndicator size="small" color="#00A879" />
              <Text style={[styles.emptySub, { color: muted }]}>Loading comparison metrics...</Text>
            </View>
          )}
        </View>
      )}

      {/* ── SECTION 4: INVENTORY REPORT ── */}
      {section === "report" && (
        <View style={{ gap: 12 }}>
          {data?.inventory_report ? (
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: foreground }]}>Catalog Health Audit Report</Text>
              <Text style={[styles.sectionSub, { color: muted }]}>
                Complete breakdown of {data.inventory_report.total_skus} unique SKUs and{" "}
                {data.inventory_report.total_units.toLocaleString()} stored units
              </Text>

              {/* Progress bar */}
              <View
                style={{
                  height: 12,
                  flexDirection: "row",
                  borderRadius: 6,
                  overflow: "hidden",
                  marginVertical: 14,
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${data.inventory_report.healthy_pct}%`,
                    backgroundColor: "#10B981",
                  }}
                />
                <View
                  style={{
                    height: "100%",
                    width: `${data.inventory_report.low_pct}%`,
                    backgroundColor: "#F59E0B",
                  }}
                />
                <View
                  style={{
                    height: "100%",
                    width: `${data.inventory_report.out_pct}%`,
                    backgroundColor: "#EF4444",
                  }}
                />
              </View>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                    <Text style={{ fontSize: 13, color: foreground }}>Optimal Health</Text>
                  </View>
                  <Text style={{ fontFamily: Typography.bold, color: foreground }}>
                    {data.inventory_report.healthy_skus} SKUs ({data.inventory_report.healthy_pct}%)
                  </Text>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" }} />
                    <Text style={{ fontSize: 13, color: foreground }}>Low Stock Deficit</Text>
                  </View>
                  <Text style={{ fontFamily: Typography.bold, color: "#F59E0B" }}>
                    {data.inventory_report.low_skus} SKUs ({data.inventory_report.low_pct}%)
                  </Text>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
                    <Text style={{ fontSize: 13, color: foreground }}>Critical Out of Stock</Text>
                  </View>
                  <Text style={{ fontFamily: Typography.bold, color: "#EF4444" }}>
                    {data.inventory_report.out_of_stock_skus} SKUs ({data.inventory_report.out_pct}%)
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ActivityIndicator size="small" color="#00A879" />
              <Text style={[styles.emptySub, { color: muted }]}>Loading report audit...</Text>
            </View>
          )}
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
  tabScroll: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 14,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  tabPillText: {
    fontSize: 12,
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
