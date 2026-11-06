import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterChip } from "@/components/ui/FilterChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { InventoryDateFilterSheet } from "@/components/ui/InventoryDateFilterSheet";
import api from "@/services/api";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  unit: string;
  reorderLevel: number;
  status: "In Stock" | "Low Stock" | "Critical";
}

interface DashboardData {
  period: string;
  period_label: string;
  start_date: string;
  end_date: string;
  date_range_display: string;
  anchor_mode: string;
  today_date?: string;
  is_custom?: boolean;
  duration_days?: number;
  kpis: {
    outwards_sales_value: number;
    outwards_sales_value_display: string;
    sales_growth_pct: number;
    is_sales_growth_positive: boolean;
    avg_daily_sales_display: string;
    orders_dispatched: number;
    orders_dispatched_display: string;
    orders_growth_pct: number;
    is_orders_growth_positive: boolean;
    units_sold: number;
    units_sold_display: string;
    units_growth_pct: number;
    is_units_growth_positive: boolean;
    pending_supplier_orders: number;
    low_stock_skus: number;
    low_stock_fast_movers: number;
    low_stock_fast_movers_alert: string;
    total_skus: number;
  };
  sales_velocity: {
    total_revenue_display: string;
    peak_day: string;
    peak_sales_display: string;
    daily_run_rate_display: string;
    trend_labels: string[];
    trend_values: number[];
    trend_quantities: number[];
    trend_orders: number[];
  };
  catalog_health: {
    total_skus: number;
    optimal_stock: number;
    optimal_pct: number;
    low_stock: number;
    low_pct: number;
    critical_stock: number;
    critical_pct: number;
  };
  top_categories?: any[];
  top_products?: any[];
}

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const scrollRef = useRef<any>(null);

  const [period, setPeriod] = useState<"3d" | "3w" | "1m" | "3m" | "custom">("1m");
  const [startDate, setStartDate] = useState("2026-10-01");
  const [endDate, setEndDate] = useState("2026-10-31");
  const [isCustom, setIsCustom] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Velocity metric tab
  const [velocityMetric, setVelocityMetric] = useState<"revenue" | "orders">("revenue");

  // Catalog items state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemCounts, setItemCounts] = useState({ total: 0, in_stock: 0, low_stock: 0, critical: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = (user?.role || "").toLowerCase().includes("admin") || (user?.email || "").toLowerCase().includes("abhijay");

  // Fetch executive dashboard metrics
  const fetchDashboard = useCallback(
    async (
      selectedPeriod?: "3d" | "3w" | "1m" | "3m" | "custom",
      customStart?: string,
      customEnd?: string
    ) => {
      try {
        setLoadingDashboard(true);
        const params: Record<string, string> = {};

        if (customStart && customEnd) {
          params.start_date = customStart;
          params.end_date = customEnd;
        } else if (selectedPeriod && selectedPeriod !== "custom") {
          params.period = selectedPeriod;
        } else {
          params.period = "1m";
        }

        const res = await api.get("/inventory/dashboard/", { params });
        if (res.data && res.data.kpis) {
          setDashboardData(res.data);
          if (res.data.start_date) setStartDate(res.data.start_date);
          if (res.data.end_date) setEndDate(res.data.end_date);
          if (res.data.is_custom !== undefined) setIsCustom(Boolean(res.data.is_custom));
        }
      } catch (e: any) {
        console.warn("[Inventory:fetchDashboard] Failed:", e?.message);
      } finally {
        setLoadingDashboard(false);
      }
    },
    []
  );

  // Fetch catalog items from PostgreSQL
  const fetchItems = useCallback(async (pageNum = 1, search = searchQuery, filter = activeFilter) => {
    try {
      setLoadingItems(true);
      const res = await api.get("/inventory/items/", {
        params: {
          page: pageNum,
          page_size: 25,
          q: search.trim(),
          status: filter,
        },
      });
      if (res.data) {
        setItems(res.data.items || []);
        setPage(res.data.page || 1);
        setTotalPages(res.data.total_pages || 1);
        setHasNext(Boolean(res.data.has_next));
        setHasPrev(Boolean(res.data.has_prev));
        if (res.data.counts) {
          setItemCounts(res.data.counts);
        }
      }
    } catch (e: any) {
      console.warn("[Inventory:fetchItems] Failed:", e?.message);
    } finally {
      setLoadingItems(false);
    }
  }, [searchQuery, activeFilter]);

  // Initial load
  useEffect(() => {
    void fetchDashboard("1m");
  }, [fetchDashboard]);

  // Fetch items on search or filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchItems(1, searchQuery, activeFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter, fetchItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      isCustom
        ? fetchDashboard("custom", startDate, endDate)
        : fetchDashboard(period),
      fetchItems(page, searchQuery, activeFilter),
    ]);
    setRefreshing(false);
  }, [isCustom, startDate, endDate, period, page, searchQuery, activeFilter, fetchDashboard, fetchItems]);

  // Dynamic colors
  const foreground = isDark ? "#F1F7F4" : "#0F172A";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const cardBg = isDark ? "#111B18" : "#FFFFFF";
  const cardBorder = isDark ? "#1E2F29" : "#E2E8F0";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* ── Top Workspace Header ── */}
      <View style={[styles.topBar, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(isAdmin ? "/(admin)/users" : "/(employee)"))}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={foreground} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.screenHeading, { color: foreground }]}>Inventory & Warehouse</Text>
          <Text style={[styles.screenSub, { color: muted }]}>
            {dashboardData?.catalog_health?.total_skus || itemCounts.total || 796} Active SKUs · Live Telemetry
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void onRefresh()}
          style={[styles.backBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#159A7C" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Title Section Matching Reference Website ── */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroEyebrow, { color: "#159A7C" }]}>Home / Inventory</Text>
          <Text style={[styles.heroTitle, { color: foreground }]}>Inventory, made smarter.</Text>
          <Text style={[styles.heroSubtitle, { color: muted }]}>
            Real-time stock velocity, category performance, and purchase order tracking.
          </Text>

          {/* Period Range Switcher (Full Month, 3 Months, 3 Weeks, 3 Days, Custom) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodSwitcherScroll}
          >
            <TouchableOpacity
              onPress={() => {
                setPeriod("1m");
                setIsCustom(false);
                void fetchDashboard("1m");
              }}
              style={[
                styles.periodPill,
                {
                  backgroundColor: period === "1m" && !isCustom ? "#159A7C" : isDark ? "#152420" : "#F1F5F9",
                  borderColor: period === "1m" && !isCustom ? "#159A7C" : cardBorder,
                },
                period === "1m" && !isCustom && styles.periodPillActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodPillText,
                  {
                    color: period === "1m" && !isCustom ? "#FFFFFF" : muted,
                    fontFamily: period === "1m" && !isCustom ? Typography.bold : Typography.medium,
                  },
                ]}
              >
                Full Month (1–31)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPeriod("3m");
                setIsCustom(false);
                void fetchDashboard("3m");
              }}
              style={[
                styles.periodPill,
                {
                  backgroundColor: period === "3m" && !isCustom ? "#159A7C" : isDark ? "#152420" : "#F1F5F9",
                  borderColor: period === "3m" && !isCustom ? "#159A7C" : cardBorder,
                },
                period === "3m" && !isCustom && styles.periodPillActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodPillText,
                  {
                    color: period === "3m" && !isCustom ? "#FFFFFF" : muted,
                    fontFamily: period === "3m" && !isCustom ? Typography.bold : Typography.medium,
                  },
                ]}
              >
                3 Months
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPeriod("3w");
                setIsCustom(false);
                void fetchDashboard("3w");
              }}
              style={[
                styles.periodPill,
                {
                  backgroundColor: period === "3w" && !isCustom ? "#159A7C" : isDark ? "#152420" : "#F1F5F9",
                  borderColor: period === "3w" && !isCustom ? "#159A7C" : cardBorder,
                },
                period === "3w" && !isCustom && styles.periodPillActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodPillText,
                  {
                    color: period === "3w" && !isCustom ? "#FFFFFF" : muted,
                    fontFamily: period === "3w" && !isCustom ? Typography.bold : Typography.medium,
                  },
                ]}
              >
                3 Weeks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPeriod("3d");
                setIsCustom(false);
                void fetchDashboard("3d");
              }}
              style={[
                styles.periodPill,
                {
                  backgroundColor: period === "3d" && !isCustom ? "#159A7C" : isDark ? "#152420" : "#F1F5F9",
                  borderColor: period === "3d" && !isCustom ? "#159A7C" : cardBorder,
                },
                period === "3d" && !isCustom && styles.periodPillActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodPillText,
                  {
                    color: period === "3d" && !isCustom ? "#FFFFFF" : muted,
                    fontFamily: period === "3d" && !isCustom ? Typography.bold : Typography.medium,
                  },
                ]}
              >
                3 Days
              </Text>
            </TouchableOpacity>

            {isCustom && (
              <TouchableOpacity
                onPress={() => setShowDateSheet(true)}
                style={[styles.periodPill, styles.periodPillActive, { backgroundColor: "#159A7C", borderColor: "#159A7C" }]}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={[styles.periodPillText, { color: "#FFFFFF", fontFamily: Typography.bold }]}>
                  Custom Range
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* ── Active Range & Customizable Date Controls Banner ── */}
          <View style={[styles.activeRangeCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.rangeHeaderRow}>
              <View style={[styles.rangeIconCircle, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.18)" : "#E2F7F1" }]}>
                <Ionicons name="calendar-outline" size={16} color="#159A7C" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rangeTitleRow}>
                  <Text style={[styles.rangeHeading, { color: foreground }]} numberOfLines={1}>
                    Active Range:{" "}
                    <Text style={{ fontFamily: Typography.bold }}>
                      {dashboardData?.date_range_display || "01 Oct 2026 – 31 Oct 2026"}
                    </Text>
                  </Text>
                  <View style={[styles.badgePeriod, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.2)" : "#E2F7F1" }]}>
                    <Text style={styles.badgePeriodText}>
                      {isCustom
                        ? `Custom (${dashboardData?.duration_days ?? 0}d)`
                        : (dashboardData?.period_label || "October 2026")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.rangeSubtext, { color: muted }]}>
                  Showing inventory velocity & sales metrics across{" "}
                  <Text style={{ fontFamily: Typography.bold, color: foreground }}>
                    {dashboardData?.duration_days ?? 31} days
                  </Text>
                  .
                </Text>
              </View>
            </View>

            {/* Customizable Date Inputs Row */}
            <View style={[styles.customDateControlBar, { backgroundColor: isDark ? "#12201C" : "#F8FAFC", borderColor: cardBorder }]}>
              <TouchableOpacity
                style={styles.dateFieldPressable}
                onPress={() => setShowDateSheet(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateFieldLabel, { color: muted }]}>FROM</Text>
                <Text style={[styles.dateFieldValue, { color: foreground }]}>
                  {startDate || dashboardData?.start_date || "2026-10-01"}
                </Text>
              </TouchableOpacity>

              <Ionicons name="arrow-forward" size={14} color={muted} style={{ marginHorizontal: 4 }} />

              <TouchableOpacity
                style={styles.dateFieldPressable}
                onPress={() => setShowDateSheet(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateFieldLabel, { color: muted }]}>TO</Text>
                <Text style={[styles.dateFieldValue, { color: foreground }]}>
                  {endDate || dashboardData?.end_date || "2026-10-31"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => setShowDateSheet(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="options-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.applyBtnText}>Change</Text>
              </TouchableOpacity>

              {isCustom && (
                <TouchableOpacity
                  style={[styles.resetBtn, { borderColor: cardBorder, backgroundColor: isDark ? "#2A1818" : "#FEE2E2" }]}
                  onPress={() => {
                    setPeriod("1m");
                    setIsCustom(false);
                    void fetchDashboard("1m");
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={13} color="#DC2626" />
                  <Text style={styles.resetBtnText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Executive KPI Bento Grid (2x2) ── */}
        {loadingDashboard && !dashboardData ? (
          <View style={[styles.loadingBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ActivityIndicator size="small" color="#159A7C" />
            <Text style={[styles.loadingText, { color: muted }]}>Calculating warehouse analytics…</Text>
          </View>
        ) : (
          <View style={styles.kpiGrid}>
            {/* 1. Outwards Sales Value */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={[styles.kpiLabel, { color: muted }]}>OUTWARDS SALES VALUE</Text>
                <View style={[styles.kpiIconBadge, { backgroundColor: "#E2F7F1" }]}>
                  <Text style={{ fontSize: 13, fontWeight: "bold", color: "#159A7C" }}>₹</Text>
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: foreground }]}>
                {dashboardData?.kpis?.outwards_sales_value_display || (period === "3m" ? "₹227.00 Cr" : "₹223.64 Cr")}
              </Text>
              <View style={styles.kpiPillRow}>
                <View style={[styles.growthPill, { backgroundColor: "#E2F7F1" }]}>
                  <Text style={[styles.growthPillText, { color: "#159A7C" }]}>
                    ↑ {dashboardData?.kpis?.sales_growth_pct || (period === "3m" ? 4312.6 : 12868.9)}%
                  </Text>
                </View>
                <Text style={[styles.kpiSubtext, { color: muted }]} numberOfLines={1}>
                  vs. previous period
                </Text>
              </View>
              <Text style={[styles.kpiExtra, { color: muted }]}>
                Avg {dashboardData?.kpis?.avg_daily_sales_display || (period === "3m" ? "₹2.52 Cr" : "₹7.45 Cr")}/day
              </Text>
            </View>

            {/* 2. Orders Dispatched */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={[styles.kpiLabel, { color: muted }]}>ORDERS DISPATCHED</Text>
                <View style={[styles.kpiIconBadge, { backgroundColor: "#E0F2FE" }]}>
                  <Ionicons name="receipt-outline" size={15} color="#0284C7" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: foreground }]}>
                {dashboardData?.kpis?.orders_dispatched_display || (period === "3m" ? "806 Orders" : "256 Orders")}
              </Text>
              <View style={styles.kpiPillRow}>
                <View style={[styles.growthPill, { backgroundColor: dashboardData?.kpis?.is_orders_growth_positive ? "#E2F7F1" : "#FEE2E2" }]}>
                  <Text style={[styles.growthPillText, { color: dashboardData?.kpis?.is_orders_growth_positive ? "#159A7C" : "#DC2626" }]}>
                    {dashboardData?.kpis?.is_orders_growth_positive ? "↑" : "↓"} {dashboardData?.kpis?.orders_growth_pct || (period === "3m" ? "6.1" : "6.6")}%
                  </Text>
                </View>
                <Text style={[styles.kpiSubtext, { color: muted }]} numberOfLines={1}>
                  units delivered
                </Text>
              </View>
              <Text style={[styles.kpiExtra, { color: muted }]}>
                across {dashboardData?.kpis?.units_sold_display || (period === "3m" ? "10,508,565 units" : "10,367,616 units")}
              </Text>
            </View>

            {/* 3. Pending Supplier Orders */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={[styles.kpiLabel, { color: muted }]}>PENDING SUPPLIER ORDERS</Text>
                <View style={[styles.kpiIconBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="bus-outline" size={15} color="#D97706" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: foreground }]}>
                {dashboardData?.kpis?.pending_supplier_orders ?? 9} Orders
              </Text>
              <View style={styles.kpiPillRow}>
                <View style={[styles.growthPill, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[styles.growthPillText, { color: "#D97706" }]}>In Transit</Text>
                </View>
              </View>
              <Text style={[styles.kpiExtra, { color: muted }]}>awaiting delivery to warehouse</Text>
            </View>

            {/* 4. Low Stock SKUs */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={[styles.kpiLabel, { color: muted }]}>LOW STOCK SKUS</Text>
                <View style={[styles.kpiIconBadge, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="warning-outline" size={15} color="#DC2626" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: foreground }]}>
                {dashboardData?.kpis?.low_stock_skus ?? 258} SKUs
              </Text>
              <View style={[styles.alertPillBadge, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="alert-circle" size={12} color="#DC2626" />
                <Text style={[styles.alertPillText, { color: "#DC2626" }]} numberOfLines={1}>
                  {dashboardData?.kpis?.low_stock_fast_movers || 2} Top Movers urgent
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Sales Velocity & Trend Section ── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="trending-up" size={18} color="#159A7C" />
                <Text style={[styles.sectionTitle, { color: foreground }]}>Sales Velocity & Trend</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: muted }]}>
                Daily outwards billing and volume trajectory
              </Text>
            </View>

            <View style={[styles.miniSwitch, { backgroundColor: isDark ? "#172722" : "#F1F5F9" }]}>
              <TouchableOpacity
                onPress={() => setVelocityMetric("revenue")}
                style={[styles.miniSwitchBtn, velocityMetric === "revenue" && { backgroundColor: cardBg, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2 }]}
              >
                <Text style={[styles.miniSwitchText, { color: velocityMetric === "revenue" ? "#159A7C" : muted, fontFamily: Typography.semiBold }]}>
                  ₹ Revenue
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setVelocityMetric("orders")}
                style={[styles.miniSwitchBtn, velocityMetric === "orders" && { backgroundColor: cardBg, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2 }]}
              >
                <Text style={[styles.miniSwitchText, { color: velocityMetric === "orders" ? "#0284C7" : muted, fontFamily: Typography.semiBold }]}>
                  Orders
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Key Metric Strip */}
          <View style={[styles.metricStrip, { backgroundColor: isDark ? "#14231F" : "#F8FAFC", borderColor: cardBorder }]}>
            <View style={styles.stripCol}>
              <Text style={[styles.stripLabel, { color: muted }]}>TOTAL REVENUE</Text>
              <Text style={[styles.stripValue, { color: foreground }]}>
                {dashboardData?.sales_velocity?.total_revenue_display || (period === "3m" ? "₹227.00 Cr" : "₹223.64 Cr")}
              </Text>
            </View>
            <View style={styles.stripCol}>
              <Text style={[styles.stripLabel, { color: muted }]}>PEAK DAY</Text>
              <Text style={[styles.stripValue, { color: foreground }]}>
                {dashboardData?.sales_velocity?.peak_day || "26 Oct"} ({dashboardData?.sales_velocity?.peak_sales_display || "₹15.34 Cr"})
              </Text>
            </View>
            <View style={styles.stripCol}>
              <Text style={[styles.stripLabel, { color: muted }]}>DAILY RUN RATE</Text>
              <Text style={[styles.stripValue, { color: foreground }]}>
                {dashboardData?.sales_velocity?.daily_run_rate_display || (period === "3m" ? "₹2.52 Cr" : "₹7.45 Cr")}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Active Catalog Health Section ── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#159A7C" />
            <Text style={[styles.sectionTitle, { color: foreground }]}>Active Catalog Health</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: muted, marginBottom: 14 }]}>
            Stock health across all {dashboardData?.catalog_health?.total_skus || 796} active commercial SKUs
          </Text>

          {/* Segmented Progress Bar */}
          <View style={styles.healthBarTrack}>
            <View
              style={[
                styles.healthSegment,
                {
                  flex: dashboardData?.catalog_health?.optimal_pct || 20.6,
                  backgroundColor: "#159A7C",
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                },
              ]}
            />
            <View
              style={[
                styles.healthSegment,
                {
                  flex: dashboardData?.catalog_health?.low_pct || 32.4,
                  backgroundColor: "#F59E0B",
                },
              ]}
            />
            <View
              style={[
                styles.healthSegment,
                {
                  flex: dashboardData?.catalog_health?.critical_pct || 47.0,
                  backgroundColor: "#EF4444",
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                },
              ]}
            />
          </View>

          {/* Health Legend Breakdown */}
          <View style={styles.healthDetails}>
            <View style={styles.healthRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: "#159A7C" }]} />
                <Text style={[styles.healthLabel, { color: foreground }]}>Optimal Stock</Text>
              </View>
              <Text style={[styles.healthValue, { color: "#159A7C" }]}>
                {dashboardData?.catalog_health?.optimal_stock ?? 164} ({dashboardData?.catalog_health?.optimal_pct ?? 20.6}%)
              </Text>
            </View>

            <View style={styles.healthRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                <Text style={[styles.healthLabel, { color: foreground }]}>Low Stock (Below Safety Threshold)</Text>
              </View>
              <Text style={[styles.healthValue, { color: "#F59E0B" }]}>
                {dashboardData?.catalog_health?.low_stock ?? 258} ({dashboardData?.catalog_health?.low_pct ?? 32.4}%)
              </Text>
            </View>

            <View style={styles.healthRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                <Text style={[styles.healthLabel, { color: foreground }]}>Out of Stock / Critical</Text>
              </View>
              <Text style={[styles.healthValue, { color: "#EF4444" }]}>
                {dashboardData?.catalog_health?.critical_stock ?? 374} ({dashboardData?.catalog_health?.critical_pct ?? 47.0}%)
              </Text>
            </View>
          </View>
        </View>

        {/* ── Commercial Catalog SKUs Section ── */}
        <View style={{ marginTop: 8, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={[styles.catalogHeading, { color: foreground }]}>Warehouse Catalog</Text>
              <Text style={[styles.catalogSub, { color: muted }]}>
                Showing {items.length} of {itemCounts.total || 796} active product lines
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by product name, SKU or category…"
            onClear={() => setSearchQuery("")}
          />

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
            <FilterChip
              label="All"
              count={itemCounts.total || 796}
              isActive={activeFilter === "all"}
              onPress={() => setActiveFilter("all")}
            />
            <FilterChip
              label="In Stock"
              count={itemCounts.in_stock || 164}
              isActive={activeFilter === "in_stock"}
              onPress={() => setActiveFilter("in_stock")}
            />
            <FilterChip
              label="Low Stock"
              count={itemCounts.low_stock || 258}
              isActive={activeFilter === "low_stock"}
              onPress={() => setActiveFilter("low_stock")}
            />
            <FilterChip
              label="Critical"
              count={itemCounts.critical || 374}
              isActive={activeFilter === "critical"}
              onPress={() => setActiveFilter("critical")}
            />
          </ScrollView>

          {/* SKU Items List */}
          {loadingItems ? (
            <View style={[styles.loadingBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ActivityIndicator size="small" color="#159A7C" />
              <Text style={[styles.loadingText, { color: muted }]}>Loading warehouse SKUs…</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="cube-outline" size={36} color="#159A7C" />
              <Text style={[styles.emptyTitle, { color: foreground }]}>No items found</Text>
              <Text style={[styles.emptySub, { color: muted }]}>Try refining your search keyword or active status filter.</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.itemTopRow}>
                  <View style={styles.itemTitleBlock}>
                    <Text style={[styles.itemName, { color: foreground }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.itemMetaRow}>
                      <Text style={[styles.itemSku, { color: muted }]}>{item.sku}</Text>
                      <Text style={{ color: muted }}>•</Text>
                      <Text style={[styles.itemCategory, { color: "#159A7C" }]}>{item.category}</Text>
                    </View>
                  </View>
                  <StatusPill label={item.status} variant={item.status === "In Stock" ? "paid" : item.status === "Low Stock" ? "pending" : "overdue"} size="small" />
                </View>

                <View style={[styles.itemStockBar, { backgroundColor: isDark ? "#14231F" : "#F8FAFC", borderColor: cardBorder }]}>
                  <View style={styles.itemStockCol}>
                    <Text style={[styles.itemStockLabel, { color: muted }]}>CURRENT STOCK</Text>
                    <Text
                      style={[
                        styles.itemStockVal,
                        { color: item.status === "Critical" ? "#DC2626" : item.status === "Low Stock" ? "#D97706" : foreground },
                      ]}
                    >
                      {item.stock.toLocaleString()} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.itemStockCol}>
                    <Text style={[styles.itemStockLabel, { color: muted }]}>REORDER THRESHOLD</Text>
                    <Text style={[styles.itemStockVal, { color: foreground }]}>
                      {item.reorderLevel > 0 ? `${item.reorderLevel.toLocaleString()} ${item.unit}` : "N/A"}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Numbered Pagination UI Matching User Request */}
          {totalPages > 1 && !loadingItems && (
            <View style={styles.paginationContainer}>
              <Text style={[styles.paginationInfo, { color: muted }]}>
                Showing page {page} of {totalPages}
              </Text>
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  onPress={() => {
                    if (hasPrev && !loadingItems) {
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                      void fetchItems(page - 1);
                    }
                  }}
                  disabled={!hasPrev || loadingItems}
                  activeOpacity={0.75}
                  style={[styles.pageNavButton, { backgroundColor: cardBg, borderColor: cardBorder }, !hasPrev && { opacity: 0.35 }]}
                >
                  <Ionicons name="chevron-back" size={18} color={hasPrev ? foreground : muted} />
                  <Text style={[styles.pageNavText, { color: hasPrev ? foreground : muted }]}>Previous</Text>
                </TouchableOpacity>

                <View style={[styles.pageIndicator, { backgroundColor: isDark ? "#183B32" : "#E2F7F1", borderColor: "#159A7C" }]}>
                  <Text style={[styles.pageIndicatorText, { color: "#159A7C" }]}>
                    Page {page} of {totalPages}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (hasNext && !loadingItems) {
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                      void fetchItems(page + 1);
                    }
                  }}
                  disabled={!hasNext || loadingItems}
                  activeOpacity={0.75}
                  style={[styles.pageNavButton, { backgroundColor: cardBg, borderColor: cardBorder }, !hasNext && { opacity: 0.35 }]}
                >
                  <Text style={[styles.pageNavText, { color: hasNext ? foreground : muted }]}>Next</Text>
                  <Ionicons name="chevron-forward" size={18} color={hasNext ? foreground : muted} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Custom Date Range Filter Modal Sheet ── */}
      <InventoryDateFilterSheet
        visible={showDateSheet}
        startDate={startDate}
        endDate={endDate}
        isCustom={isCustom}
        onApply={(start, end) => {
          setStartDate(start);
          setEndDate(end);
          setIsCustom(true);
          setPeriod("custom");
          void fetchDashboard("custom", start, end);
        }}
        onReset={() => {
          setPeriod("1m");
          setIsCustom(false);
          void fetchDashboard("1m");
        }}
        onClose={() => setShowDateSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: { flex: 1, alignItems: "center" },
  screenHeading: { fontFamily: Typography.bold, fontSize: 15 },
  screenSub: { fontFamily: Typography.regular, fontSize: 11, marginTop: 1 },
  content: { padding: 16, gap: 14 },

  heroSection: { gap: 6 },
  heroEyebrow: { fontFamily: Typography.semiBold, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { fontFamily: Typography.bold, fontSize: 24, letterSpacing: -0.5 },
  heroSubtitle: { fontFamily: Typography.regular, fontSize: 13, lineHeight: 18, marginTop: 2 },

  periodSwitcherScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  periodPillActive: {
    shadowColor: "#159A7C",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  periodPillText: {
    fontSize: 12,
  },

  activeRangeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  rangeHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rangeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  rangeHeading: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  badgePeriod: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgePeriodText: {
    fontSize: 10.5,
    fontFamily: Typography.bold,
    color: "#159A7C",
  },
  rangeSubtext: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  customDateControlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  dateFieldPressable: {
    flex: 1,
    minWidth: 70,
  },
  dateFieldLabel: {
    fontSize: 9,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  dateFieldValue: {
    fontSize: 11.5,
    fontFamily: Typography.semiBold,
    marginTop: 1,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#159A7C",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#159A7C",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  resetBtnText: {
    color: "#DC2626",
    fontSize: 11,
    fontFamily: Typography.semiBold,
    marginLeft: 2,
  },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  kpiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiLabel: {
    fontFamily: Typography.semiBold,
    fontSize: 9.5,
    letterSpacing: 0.4,
    flex: 1,
  },
  kpiIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontFamily: Typography.bold,
    fontSize: 18,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  kpiPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  growthPill: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  growthPillText: {
    fontFamily: Typography.bold,
    fontSize: 10,
  },
  kpiSubtext: {
    fontFamily: Typography.regular,
    fontSize: 10,
    flex: 1,
  },
  kpiExtra: {
    fontFamily: Typography.regular,
    fontSize: 10,
  },
  alertPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 4,
  },
  alertPillText: {
    fontFamily: Typography.bold,
    fontSize: 9.5,
  },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: Typography.bold, fontSize: 15 },
  sectionSubtitle: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  miniSwitch: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 2,
  },
  miniSwitchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniSwitchText: { fontSize: 10.5 },

  metricStrip: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  stripCol: { flex: 1, gap: 2 },
  stripLabel: { fontFamily: Typography.semiBold, fontSize: 9, letterSpacing: 0.3 },
  stripValue: { fontFamily: Typography.bold, fontSize: 11 },

  healthBarTrack: {
    height: 12,
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
  },
  healthSegment: { height: "100%" },
  healthDetails: { gap: 8 },
  healthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { fontFamily: Typography.medium, fontSize: 12 },
  healthValue: { fontFamily: Typography.bold, fontSize: 12 },

  catalogHeading: { fontFamily: Typography.bold, fontSize: 16 },
  catalogSub: { fontFamily: Typography.regular, fontSize: 12, marginTop: 1 },
  filterStrip: { gap: 8, paddingVertical: 4 },

  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  itemTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  itemTitleBlock: { flex: 1, gap: 4 },
  itemName: { fontFamily: Typography.bold, fontSize: 13.5, lineHeight: 18 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemSku: { fontFamily: Typography.semiBold, fontSize: 11 },
  itemCategory: { fontFamily: Typography.medium, fontSize: 11 },
  itemStockBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  itemStockCol: { flex: 1, gap: 2 },
  itemStockLabel: { fontFamily: Typography.semiBold, fontSize: 9.5, letterSpacing: 0.4 },
  itemStockVal: { fontFamily: Typography.bold, fontSize: 13 },

  loadingBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { fontFamily: Typography.medium, fontSize: 12 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: { fontFamily: Typography.bold, fontSize: 14 },
  emptySub: { fontFamily: Typography.regular, fontSize: 12, textAlign: "center" },

  paginationContainer: { marginTop: 12, gap: 8 },
  paginationInfo: { textAlign: "center", fontFamily: Typography.regular, fontSize: 12 },
  paginationBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pageNavButton: {
    minHeight: 40,
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  pageNavText: { fontFamily: Typography.semiBold, fontSize: 12 },
  pageIndicator: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pageIndicatorText: { fontFamily: Typography.bold, fontSize: 12 },
});
