import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterChip } from "@/components/ui/FilterChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { InventoryDateFilterSheet } from "@/components/ui/InventoryDateFilterSheet";
import AppLineChart from "@/components/charts/AppLineChart";
import api from "@/services/api";

import { ProductDetailModal } from "./ProductDetailModal";
import { AddProductModal } from "./AddProductModal";
import { InventoryCategoriesTab } from "./InventoryCategoriesTab";
import { InventoryLowStockTab } from "./InventoryLowStockTab";
import { InventoryDeadStockTab } from "./InventoryDeadStockTab";
import { InventoryProcurementTab } from "./InventoryProcurementTab";
import { InventoryAnalyticsTab } from "./InventoryAnalyticsTab";
import { InventoryNavDrawer } from "./InventoryNavDrawer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type InventoryNavTab =
  | "overview"
  | "catalog"
  | "categories"
  | "low_stock"
  | "dead_stock"
  | "procurement"
  | "po_planner"
  | "po_tally"
  | "po_tracking"
  | "po_stages"
  | "analytics"
  | "analytics_contribution"
  | "analytics_category"
  | "analytics_comparison"
  | "analytics_report";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  unit: string;
  reorderLevel: number;
  status: "In Stock" | "Low Stock" | "Critical" | "Dead Stock";
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
    dead_stock?: number;
  };
  top_categories?: any[];
  top_products?: any[];
  top_customers?: {
    rank: number;
    name: string;
    initials: string;
    sales_value: number;
    sales_value_display: string;
    units_purchased: string;
    order_count: number;
    percent: number;
  }[];
  pending_supplier_orders?: {
    id: number;
    po_number: string;
    voucher_number: string;
    date: string;
    party_name: string;
    party_initials: string;
    stage_name: string;
    eta: string;
    status: string;
  }[];
}

export function InventoryMainScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const scrollRef = useRef<any>(null);

  // Active feature tab navigation
  const [currentTab, setCurrentTab] = useState<InventoryNavTab>("overview");
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Overview / Dashboard state
  const [period, setPeriod] = useState<"3d" | "3w" | "1m" | "3m" | "custom">("1m");
  const [startDate, setStartDate] = useState("2026-10-01");
  const [endDate, setEndDate] = useState("2026-10-31");
  const [isCustom, setIsCustom] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [velocityMetric, setVelocityMetric] = useState<"revenue" | "orders">("revenue");

  // Catalog items state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("");
  const [categoriesList, setCategoriesList] = useState<{ id: number; name: string }[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemCounts, setItemCounts] = useState({
    total: 0,
    in_stock: 0,
    low_stock: 0,
    critical: 0,
    dead_stock: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedModalTab, setSelectedModalTab] = useState<"forecast" | "trends" | "ledger">("forecast");
  const [showAddModal, setShowAddModal] = useState(false);

  const isAdmin =
    (user?.role || "").toLowerCase().includes("admin") ||
    (user?.email || "").toLowerCase().includes("abhijay");

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

  // Fetch categories for catalog filter chips
  const fetchCategoriesList = useCallback(async () => {
    try {
      const res = await api.get("/inventory/categories/");
      if (res.data?.status === "success" && Array.isArray(res.data.categories)) {
        setCategoriesList(
          res.data.categories.map((c: any) => ({
            id: c.id,
            name: c.name,
          }))
        );
      }
    } catch {
      // Non-critical
    }
  }, []);

  // Fetch catalog items from backend
  const fetchItems = useCallback(
    async (
      pageNum = 1,
      search = searchQuery,
      filter = activeFilter,
      category = selectedCategoryFilter
    ) => {
      try {
        setLoadingItems(true);
        const res = await api.get("/inventory/items/", {
          params: {
            page: pageNum,
            page_size: 25,
            q: search.trim(),
            status: filter,
            category: category ? category : undefined,
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
    },
    [searchQuery, activeFilter, selectedCategoryFilter]
  );

  // Initial load
  useEffect(() => {
    void fetchDashboard("1m");
    void fetchCategoriesList();
  }, [fetchDashboard, fetchCategoriesList]);

  // Fetch items on search, filter, or category change
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchItems(1, searchQuery, activeFilter, selectedCategoryFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter, selectedCategoryFilter, fetchItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      isCustom ? fetchDashboard("custom", startDate, endDate) : fetchDashboard(period),
      fetchItems(page, searchQuery, activeFilter, selectedCategoryFilter),
      fetchCategoriesList(),
    ]);
    setRefreshing(false);
  }, [isCustom, startDate, endDate, period, page, searchQuery, activeFilter, selectedCategoryFilter, fetchDashboard, fetchItems, fetchCategoriesList]);

  const handleOpenProduct = (itemId: string, tab: "forecast" | "trends" | "ledger" = "forecast") => {
    setSelectedProductId(itemId);
    setSelectedModalTab(tab);
    setDetailModalVisible(true);
  };

  const handleSelectCategoryFromTab = (categoryName: string) => {
    setSelectedCategoryFilter(categoryName);
    setCurrentTab("catalog");
  };

  // Colors
  const foreground = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const cardBg = isDark ? "#111B18" : "#FFFFFF";
  const cardBorder = isDark ? "#1E2F29" : "#E2E8F0";

  // Velocity chart series
  const velocityLabels = useMemo(() => {
    if (!dashboardData?.sales_velocity?.trend_labels) return ["1", "5", "10", "15", "20", "25", "30"];
    const labels = dashboardData.sales_velocity.trend_labels;
    return labels.map((l: string, i: number) => {
      if (labels.length > 15) {
        return i % 5 === 0 ? l.replace(" 2026", "").replace(" 2025", "") : "";
      }
      return i % 2 === 0 ? l.replace(" 2026", "").replace(" 2025", "") : "";
    });
  }, [dashboardData?.sales_velocity?.trend_labels]);

  const velocityValues = useMemo(() => {
    if (velocityMetric === "orders") {
      const vals = dashboardData?.sales_velocity?.trend_orders || [0];
      return vals.length > 0 ? vals : [0];
    }
    const vals = dashboardData?.sales_velocity?.trend_values || [0];
    return vals.length > 0 ? vals : [0];
  }, [dashboardData?.sales_velocity, velocityMetric]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* ── Top Workspace Header ── */}
      <View style={[styles.topBar, { borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(isAdmin ? "/(admin)/users" : "/(employee)")
          }
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={foreground} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.screenHeading, { color: foreground }]}>
            {currentTab === "overview"
              ? "Dashboard"
              : currentTab === "catalog"
              ? "Product Catalog"
              : currentTab === "categories"
              ? "Categories"
              : currentTab === "low_stock"
              ? "Low Stock Alerts"
              : currentTab === "dead_stock"
              ? "Dead Stock Audit"
              : currentTab === "po_planner"
              ? "PO Planner"
              : currentTab === "po_tally"
              ? "Tally Purchase Orders"
              : currentTab === "po_tracking"
              ? "Tracked Shipments"
              : currentTab === "po_stages"
              ? "Pipeline Stages"
              : currentTab === "procurement"
              ? "Purchase Orders"
              : currentTab === "analytics_contribution"
              ? "Sales Contribution"
              : currentTab === "analytics_category"
              ? "Category Analytics"
              : currentTab === "analytics_comparison"
              ? "Sales Comparison"
              : currentTab === "analytics_report"
              ? "Inventory Report"
              : "Analytics & BI"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void onRefresh()}
          style={[styles.backBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#00A879" />
        </TouchableOpacity>
      </View>

      {/* ── Tab Content Views ── */}
      {currentTab === "overview" && (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: 110 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => setDrawerVisible(true)}
                style={[styles.sidebarTogglePill, { borderColor: cardBorder, backgroundColor: cardBg }]}
                activeOpacity={0.8}
              >
                <Ionicons name="grid-outline" size={13} color="#00A879" style={{ marginRight: 6 }} />
                <Text style={[styles.heroEyebrow, { color: "#00A879" }]}>Home / Inventory</Text>
                <Ionicons name="chevron-down" size={12} color="#00A879" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.heroTitle, { color: foreground }]}>Inventory</Text>

            {/* Period Switcher */}
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
                    backgroundColor: period === "1m" && !isCustom ? "#00A879" : isDark ? "#152420" : "#F1F5F9",
                    borderColor: period === "1m" && !isCustom ? "#00A879" : cardBorder,
                  },
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
                    backgroundColor: period === "3m" && !isCustom ? "#00A879" : isDark ? "#152420" : "#F1F5F9",
                    borderColor: period === "3m" && !isCustom ? "#00A879" : cardBorder,
                  },
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
                    backgroundColor: period === "3w" && !isCustom ? "#00A879" : isDark ? "#152420" : "#F1F5F9",
                    borderColor: period === "3w" && !isCustom ? "#00A879" : cardBorder,
                  },
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
                    backgroundColor: period === "3d" && !isCustom ? "#00A879" : isDark ? "#152420" : "#F1F5F9",
                    borderColor: period === "3d" && !isCustom ? "#00A879" : cardBorder,
                  },
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
                  style={[styles.periodPill, { backgroundColor: "#00A879", borderColor: "#00A879" }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={[styles.periodPillText, { color: "#FFFFFF", fontFamily: Typography.bold }]}>
                    Custom Range
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Active Range Banner */}
            <View style={[styles.activeRangeCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.rangeHeaderRow}>
                <View style={[styles.rangeIconCircle, { backgroundColor: isDark ? "rgba(0,168,121,0.18)" : "#E2F7F1" }]}>
                  <Ionicons name="calendar-outline" size={16} color="#00A879" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rangeHeading, { color: foreground }]}>
                    Active:{" "}
                    <Text style={{ fontFamily: Typography.bold }}>
                      {dashboardData?.date_range_display || "01 Oct 2026 – 31 Oct 2026"}
                    </Text>
                  </Text>
                  <Text style={[styles.rangeSubtext, { color: muted }]}>
                    Velocity & metrics across {dashboardData?.duration_days ?? 31} days
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowDateSheet(true)}
                  style={[styles.filterActionBtn, { borderColor: cardBorder }]}
                >
                  <Ionicons name="filter-outline" size={14} color="#00A879" />
                  <Text style={[styles.filterActionText, { color: "#00A879" }]}>Dates</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 4 Hero KPI Cards */}
          {loadingDashboard && !dashboardData ? (
            <View style={[styles.loadingBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ActivityIndicator size="small" color="#00A879" />
              <Text style={[styles.loadingText, { color: muted }]}>Fetching live metrics…</Text>
            </View>
          ) : (
            <View style={styles.kpiGrid}>
              {/* 1. Outwards Sales Value */}
              <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.kpiHeader}>
                  <Text style={[styles.kpiLabel, { color: muted }]}>OUTWARDS SALES VALUE</Text>
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? "#12201C" : "#E2F7F1" }]}>
                    <Ionicons name="cash-outline" size={14} color="#00A879" />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: foreground }]}>
                  {dashboardData?.kpis.outwards_sales_value_display || "₹0"}
                </Text>
                <View style={styles.kpiFooter}>
                  <View
                    style={[
                      styles.growthPill,
                      {
                        backgroundColor: dashboardData?.kpis.is_sales_growth_positive
                          ? "rgba(16,185,129,0.12)"
                          : "rgba(239,68,68,0.12)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={dashboardData?.kpis.is_sales_growth_positive ? "arrow-up" : "arrow-down"}
                      size={11}
                      color={dashboardData?.kpis.is_sales_growth_positive ? "#059669" : "#DC2626"}
                    />
                    <Text
                      style={[
                        styles.growthPillText,
                        {
                          color: dashboardData?.kpis.is_sales_growth_positive ? "#059669" : "#DC2626",
                        },
                      ]}
                    >
                      {dashboardData?.kpis.sales_growth_pct || 0}%
                    </Text>
                  </View>
                  <Text style={[styles.kpiSubtext, { color: muted }]}>
                    vs. previous period • Avg {dashboardData?.kpis.avg_daily_sales_display || "₹0"}/day
                  </Text>
                </View>
              </View>

              {/* 2. Orders Dispatched */}
              <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.kpiHeader}>
                  <Text style={[styles.kpiLabel, { color: muted }]}>ORDERS DISPATCHED</Text>
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? "#1A2234" : "#EFF6FF" }]}>
                    <Ionicons name="receipt-outline" size={14} color="#3B82F6" />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: foreground }]}>
                  {dashboardData?.kpis.orders_dispatched_display || "0 Orders"}
                </Text>
                <View style={styles.kpiFooter}>
                  <View
                    style={[
                      styles.growthPill,
                      {
                        backgroundColor: dashboardData?.kpis.is_orders_growth_positive
                          ? "rgba(16,185,129,0.12)"
                          : "rgba(239,68,68,0.12)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={dashboardData?.kpis.is_orders_growth_positive ? "arrow-up" : "arrow-down"}
                      size={11}
                      color={dashboardData?.kpis.is_orders_growth_positive ? "#059669" : "#DC2626"}
                    />
                    <Text
                      style={[
                        styles.growthPillText,
                        {
                          color: dashboardData?.kpis.is_orders_growth_positive ? "#059669" : "#DC2626",
                        },
                      ]}
                    >
                      {dashboardData?.kpis.orders_growth_pct || 0}%
                    </Text>
                  </View>
                  <Text style={[styles.kpiSubtext, { color: muted }]}>
                    across {dashboardData?.kpis.units_sold_display || "0 units"} in {dashboardData?.period_label || "period"}
                  </Text>
                </View>
              </View>

              {/* 3. Pending Supplier Orders */}
              <TouchableOpacity
                onPress={() => setCurrentTab("procurement")}
                style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                activeOpacity={0.8}
              >
                <View style={styles.kpiHeader}>
                  <Text style={[styles.kpiLabel, { color: muted }]}>PENDING SUPPLIER ORDERS</Text>
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? "#2A2215" : "rgba(245, 158, 11, 0.15)" }]}>
                    <Ionicons name="bus-outline" size={14} color="#F59E0B" />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: foreground }]}>
                  {dashboardData?.kpis.pending_supplier_orders ?? 0} Orders
                </Text>
                <View style={styles.kpiFooter}>
                  <View style={[styles.growthPill, { backgroundColor: isDark ? "#1E293B" : "rgba(148, 163, 184, 0.18)" }]}>
                    <Ionicons name="time-outline" size={11} color={isDark ? "#94A3B8" : "#475569"} />
                    <Text style={[styles.growthPillText, { color: isDark ? "#94A3B8" : "#475569" }]}>In Transit</Text>
                  </View>
                  <Text style={[styles.kpiSubtext, { color: muted }]}>awaiting delivery to warehouse</Text>
                </View>
              </TouchableOpacity>

              {/* 4. Low Stock SKUs */}
              <TouchableOpacity
                onPress={() => setCurrentTab("low_stock")}
                style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                activeOpacity={0.8}
              >
                <View style={styles.kpiHeader}>
                  <Text style={[styles.kpiLabel, { color: "#EF4444" }]}>LOW STOCK SKUS</Text>
                  <View style={[styles.iconCircle, { backgroundColor: "rgba(244, 63, 94, 0.12)" }]}>
                    <Ionicons name="warning-outline" size={14} color="#F43F5E" />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: "#EF4444" }]}>
                  {dashboardData?.kpis.low_stock_skus ?? 0} SKUs
                </Text>
                <View style={styles.kpiFooter}>
                  {(dashboardData?.kpis.low_stock_fast_movers || 0) > 0 ? (
                    <View style={[styles.growthPill, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                      <Ionicons name="notifications" size={11} color="#DC2626" />
                      <Text style={[styles.growthPillText, { color: "#DC2626" }]}>
                        {dashboardData?.kpis.low_stock_fast_movers} Top Movers
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.growthPill, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                      <Ionicons name="checkmark-circle" size={11} color="#059669" />
                      <Text style={[styles.growthPillText, { color: "#059669" }]}>Healthy</Text>
                    </View>
                  )}
                  <Text style={[styles.kpiSubtext, { color: muted }]}>
                    {(dashboardData?.kpis.low_stock_fast_movers || 0) > 0
                      ? "require urgent reordering"
                      : "active demand in stock"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Sales Velocity Chart Card */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: foreground }]}>Daily Sales Velocity</Text>
                <Text style={[styles.sectionSubtitle, { color: muted }]}>
                  Total: {dashboardData?.sales_velocity?.total_revenue_display || "₹0"}
                </Text>
              </View>
              <View style={[styles.miniSwitch, { backgroundColor: isDark ? "#12201C" : "#F1F5F9" }]}>
                <TouchableOpacity
                  onPress={() => setVelocityMetric("revenue")}
                  style={[
                    styles.miniSwitchBtn,
                    velocityMetric === "revenue" && { backgroundColor: "#00A879" },
                  ]}
                >
                  <Text
                    style={[
                      styles.miniSwitchText,
                      { color: velocityMetric === "revenue" ? "#FFFFFF" : muted },
                    ]}
                  >
                    Revenue
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setVelocityMetric("orders")}
                  style={[
                    styles.miniSwitchBtn,
                    velocityMetric === "orders" && { backgroundColor: "#00A879" },
                  ]}
                >
                  <Text
                    style={[
                      styles.miniSwitchText,
                      { color: velocityMetric === "orders" ? "#FFFFFF" : muted },
                    ]}
                  >
                    Orders
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {velocityValues.length > 0 && (
              <AppLineChart
                data={{
                  labels: velocityLabels,
                  datasets: [
                    {
                      data: velocityValues,
                      color: () => "#00A879",
                      strokeWidth: 2.5,
                    },
                  ],
                }}
                width={SCREEN_WIDTH - 64}
                height={180}
                chartConfig={{
                  backgroundColor: cardBg,
                  backgroundGradientFrom: cardBg,
                  backgroundGradientTo: cardBg,
                  decimalPlaces: 0,
                  color: () => "#00A879",
                  labelColor: () => muted,
                  propsForDots: {
                    r: "3",
                    strokeWidth: "1",
                    stroke: "#00A879",
                  },
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: Radius.md }}
              />
            )}
          </View>

          {/* Catalog Health Distribution */}
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: foreground }]}>Catalog Health Breakdown</Text>
            <Text style={[styles.sectionSubtitle, { color: muted, marginBottom: 12 }]}>
              {dashboardData?.catalog_health?.total_skus || 0} active tracked product lines
            </Text>

            <View style={styles.healthBarTrack}>
              <View
                style={[
                  styles.healthSegment,
                  {
                    flex: Math.max(dashboardData?.catalog_health?.optimal_pct || 1, 1),
                    backgroundColor: "#10B981",
                  },
                ]}
              />
              <View
                style={[
                  styles.healthSegment,
                  {
                    flex: Math.max(dashboardData?.catalog_health?.low_pct || 1, 1),
                    backgroundColor: "#F59E0B",
                  },
                ]}
              />
              <View
                style={[
                  styles.healthSegment,
                  {
                    flex: Math.max(dashboardData?.catalog_health?.critical_pct || 1, 1),
                    backgroundColor: "#EF4444",
                  },
                ]}
              />
            </View>

            <View style={styles.healthDetails}>
              <View style={styles.healthRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                  <Text style={[styles.healthLabel, { color: foreground }]}>Optimal Health</Text>
                </View>
                <Text style={[styles.healthValue, { color: foreground }]}>
                  {dashboardData?.catalog_health?.optimal_stock || 0} SKUs (
                  {dashboardData?.catalog_health?.optimal_pct || 0}%)
                </Text>
              </View>

              <View style={styles.healthRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                  <Text style={[styles.healthLabel, { color: foreground }]}>Low Stock</Text>
                </View>
                <Text style={[styles.healthValue, { color: foreground }]}>
                  {dashboardData?.catalog_health?.low_stock || 0} SKUs ({dashboardData?.catalog_health?.low_pct || 0}%)
                </Text>
              </View>

              <View style={styles.healthRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                  <Text style={[styles.healthLabel, { color: foreground }]}>Critical Stockout</Text>
                </View>
                <Text style={[styles.healthValue, { color: foreground }]}>
                  {dashboardData?.catalog_health?.critical_stock || 0} SKUs (
                  {dashboardData?.catalog_health?.critical_pct || 0}%)
                </Text>
              </View>
            </View>
          </View>

          {/* Top Moving Products */}
          {dashboardData?.top_products && dashboardData.top_products.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: foreground }]}>Top Moving Products</Text>
                  <Text style={[styles.sectionSubtitle, { color: muted }]}>
                    Fastest moving inventory by sales value
                  </Text>
                </View>
              </View>
              <View style={{ gap: 10 }}>
                {dashboardData.top_products.map((p: any) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleOpenProduct(String(p.id))}
                    style={[styles.topProdRow, { borderColor: cardBorder }]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.topProdRank}>
                      <Text style={[styles.topProdRankText, { color: "#00A879" }]}>#{p.rank}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.topProdName, { color: foreground }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[styles.topProdCat, { color: muted }]}>
                        {p.category} · {p.units_sold} units
                      </Text>
                    </View>
                    <Text style={[styles.topProdVal, { color: foreground }]}>
                      {p.sales_value_display}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Top Customers by Value (from verified Tax Invoices) */}
          {dashboardData?.top_customers && dashboardData.top_customers.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.sectionTitle, { color: foreground }]}>Top Customers by Value</Text>
                  <Text style={[styles.sectionSubtitle, { color: muted }]}>
                    Largest purchasing partners from verified Tax Invoices
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push((isAdmin ? "/(admin)/customers" : "/(employee)/customers") as never)}
                  style={styles.apiLinkRow}
                >
                  <Text style={[styles.apiLinkText, { color: "#00A879" }]}>Customer API</Text>
                  <Ionicons name="chevron-forward" size={14} color="#00A879" />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {dashboardData.top_customers.map((c) => (
                  <View key={c.rank} style={[styles.customerItemCard, { borderColor: cardBorder }]}>
                    <View style={styles.customerAvatarCircle}>
                      <Text style={styles.customerAvatarInitials}>{c.initials}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[styles.customerItemName, { color: foreground }]} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={[styles.customerItemSub, { color: muted }]}>
                        {c.order_count} Tax Invoice{c.order_count > 1 ? "s" : ""} · {c.units_purchased} units
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.customerItemVal, { color: foreground }]}>{c.sales_value_display}</Text>
                      <Text style={[styles.customerItemPct, { color: muted }]}>{c.percent}% of top 5</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Pending Supplier Orders (Awaiting Warehouse Delivery) */}
          {dashboardData?.pending_supplier_orders && dashboardData.pending_supplier_orders.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.sectionTitle, { color: foreground }]}>Pending Supplier Orders</Text>
                  <Text style={[styles.sectionSubtitle, { color: muted }]}>
                    Purchase orders placed with vendors awaiting warehouse delivery
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCurrentTab("procurement")}
                  style={styles.apiLinkRow}
                >
                  <Text style={[styles.apiLinkText, { color: "#00A879" }]}>All Orders</Text>
                  <Ionicons name="chevron-forward" size={14} color="#00A879" />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {dashboardData.pending_supplier_orders.map((po) => (
                  <View key={po.id} style={[styles.supplierOrderCard, { borderColor: cardBorder }]}>
                    <View style={styles.supplierOrderHeader}>
                      <View>
                        <Text style={[styles.supplierPoRef, { color: foreground }]}>{po.po_number}</Text>
                        <Text style={[styles.supplierPoDate, { color: muted }]}>{po.date}</Text>
                      </View>
                      <View style={styles.onTrackPill}>
                        <Text style={styles.onTrackPillText}>On Track</Text>
                      </View>
                    </View>

                    <View style={[styles.supplierOrderDetails, { backgroundColor: isDark ? "#0A1310" : "#F8FAFC", borderColor: cardBorder }]}>
                      <View style={styles.supplierPartyRow}>
                        <View style={styles.supplierInitialsBadge}>
                          <Text style={styles.supplierInitialsText}>{po.party_initials}</Text>
                        </View>
                        <Text style={[styles.supplierPartyName, { color: foreground }]} numberOfLines={1}>
                          {po.party_name}
                        </Text>
                      </View>

                      <View style={styles.supplierStageRow}>
                        <Text style={[styles.supplierMetaLabel, { color: muted }]}>STAGE: <Text style={{ color: foreground, fontFamily: Typography.bold }}>{po.stage_name}</Text></Text>
                        <Text style={[styles.supplierMetaLabel, { color: muted }]}>ETA: <Text style={{ color: foreground, fontFamily: Typography.bold }}>{po.eta}</Text></Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── CATALOG TAB ── */}
      {currentTab === "catalog" && (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: 110 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Breadcrumb / Sidebar Toggle */}
          <View style={{ marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={[styles.sidebarTogglePill, { borderColor: cardBorder, backgroundColor: cardBg, alignSelf: "flex-start" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={13} color="#00A879" style={{ marginRight: 6 }} />
              <Text style={[styles.heroEyebrow, { color: "#00A879" }]}>Home / Inventory</Text>
              <Ionicons name="chevron-down" size={12} color="#00A879" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Header Action Banner */}
          <View style={styles.catalogTopBar}>
            <View>
              <Text style={[styles.catalogHeading, { color: foreground }]}>Product Catalog</Text>
              <Text style={[styles.catalogSub, { color: muted }]}>
                {itemCounts.total} Active SKUs
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              style={styles.addBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Product</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Summary Cards (Matching Web Screenshot) */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.kpiLabel, { color: muted }]}>CATALOG VOLUME</Text>
              <Text style={[styles.kpiValue, { color: foreground }]}>{itemCounts.total}</Text>
              <Text style={[styles.kpiSubtext, { color: "#00A879" }]}>Active unique SKUs</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.kpiLabel, { color: muted }]}>OPTIMAL HEALTH</Text>
              <Text style={[styles.kpiValue, { color: "#10B981" }]}>{itemCounts.in_stock}</Text>
              <Text style={[styles.kpiSubtext, { color: muted }]}>Healthy inventory</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.kpiLabel, { color: "#F59E0B" }]}>LOW STOCK</Text>
              <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>{itemCounts.low_stock}</Text>
              <Text style={[styles.kpiSubtext, { color: muted }]}>Below safety level</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.kpiLabel, { color: "#EF4444" }]}>CRITICAL</Text>
              <Text style={[styles.kpiValue, { color: "#EF4444" }]}>{itemCounts.critical}</Text>
              <Text style={[styles.kpiSubtext, { color: muted }]}>Depleted stock</Text>
            </View>
          </View>

          {/* Category Chips Scroll */}
          {categoriesList.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsScroll}>
              <TouchableOpacity
                onPress={() => setSelectedCategoryFilter("")}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: selectedCategoryFilter === "" ? "#00A879" : cardBg,
                    borderColor: selectedCategoryFilter === "" ? "#00A879" : cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.catChipText,
                    { color: selectedCategoryFilter === "" ? "#FFFFFF" : foreground },
                  ]}
                >
                  All Products
                </Text>
              </TouchableOpacity>

              {categoriesList.map((cat) => {
                const isSelected = selectedCategoryFilter === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryFilter(isSelected ? "" : cat.name)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: isSelected ? "#00A879" : cardBg,
                        borderColor: isSelected ? "#00A879" : cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        { color: isSelected ? "#FFFFFF" : foreground },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by SKU, product name..."
            onClear={() => setSearchQuery("")}
          />

          {/* Status Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
            <FilterChip
              label="All Items"
              count={itemCounts.total}
              isActive={activeFilter === "all"}
              onPress={() => setActiveFilter("all")}
            />
            <FilterChip
              label="In Stock"
              count={itemCounts.in_stock}
              isActive={activeFilter === "in_stock"}
              onPress={() => setActiveFilter("in_stock")}
            />
            <FilterChip
              label="Low Stock"
              count={itemCounts.low_stock}
              isActive={activeFilter === "low_stock"}
              onPress={() => setActiveFilter("low_stock")}
            />
            <FilterChip
              label="Critical"
              count={itemCounts.critical}
              isActive={activeFilter === "critical"}
              onPress={() => setActiveFilter("critical")}
            />
            <FilterChip
              label="Dead Stock"
              count={itemCounts.dead_stock}
              isActive={activeFilter === "dead_stock"}
              onPress={() => setActiveFilter("dead_stock")}
            />
          </ScrollView>

          {/* SKU Items List */}
          {loadingItems ? (
            <View style={[styles.loadingBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ActivityIndicator size="small" color="#00A879" />
              <Text style={[styles.loadingText, { color: muted }]}>Loading warehouse SKUs…</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="cube-outline" size={36} color="#00A879" />
              <Text style={[styles.emptyTitle, { color: foreground }]}>No items found</Text>
              <Text style={[styles.emptySub, { color: muted }]}>
                Try refining your search keyword or selected category.
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleOpenProduct(item.id, "forecast")}
                style={[styles.itemCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                activeOpacity={0.8}
              >
                <View style={styles.itemTopRow}>
                  <View style={styles.itemTitleBlock}>
                    <Text style={[styles.itemName, { color: foreground }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.itemMetaRow}>
                      <Text style={[styles.itemSku, { color: muted }]}>{item.sku}</Text>
                      <Text style={{ color: muted }}>•</Text>
                      <Text style={[styles.itemCategory, { color: "#00A879" }]}>{item.category}</Text>
                    </View>
                  </View>
                  <StatusPill
                    label={item.status}
                    variant={
                      item.status === "In Stock"
                        ? "paid"
                        : item.status === "Low Stock"
                        ? "pending"
                        : item.status === "Dead Stock"
                        ? "neutral"
                        : "overdue"
                    }
                    size="small"
                  />
                </View>

                {/* Stock Level Bar */}
                <View
                  style={[
                    styles.itemStockBar,
                    { backgroundColor: isDark ? "#14231F" : "#F8FAFC", borderColor: cardBorder },
                  ]}
                >
                  <View style={styles.itemStockCol}>
                    <Text style={[styles.itemStockLabel, { color: muted }]}>CURRENT STOCK</Text>
                    <Text
                      style={[
                        styles.itemStockVal,
                        {
                          color:
                            item.status === "Critical"
                              ? "#DC2626"
                              : item.status === "Low Stock"
                              ? "#D97706"
                              : item.status === "Dead Stock"
                              ? "#6B7280"
                              : foreground,
                        },
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

                {/* Quick Actions (Matching Web Reference) */}
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleOpenProduct(item.id, "forecast")}
                    style={[styles.quickActionBtn, { borderColor: cardBorder }]}
                  >
                    <Ionicons name="analytics-outline" size={13} color="#00A879" />
                    <Text style={[styles.quickActionText, { color: "#00A879" }]}>Forecast</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenProduct(item.id, "trends")}
                    style={[styles.quickActionBtn, { borderColor: cardBorder }]}
                  >
                    <Ionicons name="trending-up-outline" size={13} color="#3B82F6" />
                    <Text style={[styles.quickActionText, { color: "#3B82F6" }]}>Trends</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenProduct(item.id, "ledger")}
                    style={[styles.quickActionBtn, { borderColor: cardBorder }]}
                  >
                    <Ionicons name="receipt-outline" size={13} color="#8B5CF6" />
                    <Text style={[styles.quickActionText, { color: "#8B5CF6" }]}>Ledger</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Numbered Pagination */}
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
                  style={[
                    styles.pageNavButton,
                    { backgroundColor: cardBg, borderColor: cardBorder },
                    !hasPrev && { opacity: 0.35 },
                  ]}
                >
                  <Ionicons name="chevron-back" size={18} color={hasPrev ? foreground : muted} />
                  <Text style={[styles.pageNavText, { color: hasPrev ? foreground : muted }]}>Previous</Text>
                </TouchableOpacity>

                <View
                  style={[
                    styles.pageIndicator,
                    { backgroundColor: isDark ? "#183B32" : "#E2F7F1", borderColor: "#00A879" },
                  ]}
                >
                  <Text style={[styles.pageIndicatorText, { color: "#00A879" }]}>
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
                  style={[
                    styles.pageNavButton,
                    { backgroundColor: cardBg, borderColor: cardBorder },
                    !hasNext && { opacity: 0.35 },
                  ]}
                >
                  <Text style={[styles.pageNavText, { color: hasNext ? foreground : muted }]}>Next</Text>
                  <Ionicons name="chevron-forward" size={18} color={hasNext ? foreground : muted} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── CATEGORIES TAB ── */}
      {currentTab === "categories" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={[styles.sidebarTogglePill, { borderColor: cardBorder, backgroundColor: cardBg, alignSelf: "flex-start" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={13} color="#00A879" style={{ marginRight: 6 }} />
              <Text style={[styles.heroEyebrow, { color: "#00A879" }]}>Home / Inventory</Text>
              <Ionicons name="chevron-down" size={12} color="#00A879" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <InventoryCategoriesTab onSelectCategory={handleSelectCategoryFromTab} />
        </View>
      )}

      {/* ── LOW STOCK TAB ── */}
      {currentTab === "low_stock" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={[styles.sidebarTogglePill, { borderColor: cardBorder, backgroundColor: cardBg, alignSelf: "flex-start" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={13} color="#00A879" style={{ marginRight: 6 }} />
              <Text style={[styles.heroEyebrow, { color: "#00A879" }]}>Home / Inventory</Text>
              <Ionicons name="chevron-down" size={12} color="#00A879" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <InventoryLowStockTab onOpenProduct={handleOpenProduct} />
        </View>
      )}

      {/* ── DEAD STOCK TAB ── */}
      {currentTab === "dead_stock" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={[styles.sidebarTogglePill, { borderColor: cardBorder, backgroundColor: cardBg, alignSelf: "flex-start" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={13} color="#00A879" style={{ marginRight: 6 }} />
              <Text style={[styles.heroEyebrow, { color: "#00A879" }]}>Home / Inventory</Text>
              <Ionicons name="chevron-down" size={12} color="#00A879" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <InventoryDeadStockTab onOpenProduct={handleOpenProduct} />
        </View>
      )}

      {/* ── PROCUREMENT & PO SUB-TABS ── */}
      {(currentTab === "procurement" ||
        currentTab === "po_planner" ||
        currentTab === "po_tally" ||
        currentTab === "po_tracking" ||
        currentTab === "po_stages") && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={[styles.sidebarTogglePill, { borderColor: cardBorder, backgroundColor: cardBg, alignSelf: "flex-start" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={13} color="#00A879" style={{ marginRight: 6 }} />
              <Text style={[styles.heroEyebrow, { color: "#00A879" }]}>Home / Inventory</Text>
              <Ionicons name="chevron-down" size={12} color="#00A879" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <InventoryProcurementTab
            key={currentTab}
            initialSection={
              currentTab === "po_planner"
                ? "planner"
                : currentTab === "po_tally"
                ? "tally"
                : currentTab === "po_stages"
                ? "stages"
                : "tracked"
            }
          />
        </View>
      )}

      {/* ── INTELLIGENCE & REPORTS SUB-TABS ── */}
      {(currentTab === "analytics" ||
        currentTab === "analytics_contribution" ||
        currentTab === "analytics_category" ||
        currentTab === "analytics_comparison" ||
        currentTab === "analytics_report") && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={[styles.sidebarTogglePill, { borderColor: cardBorder, backgroundColor: cardBg, alignSelf: "flex-start" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="grid-outline" size={13} color="#00A879" style={{ marginRight: 6 }} />
              <Text style={[styles.heroEyebrow, { color: "#00A879" }]}>Home / Inventory</Text>
              <Ionicons name="chevron-down" size={12} color="#00A879" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <InventoryAnalyticsTab
            key={currentTab}
            initialSection={
              currentTab === "analytics_category"
                ? "category"
                : currentTab === "analytics_comparison"
                ? "comparison"
                : currentTab === "analytics_report"
                ? "report"
                : "contribution"
            }
          />
        </View>
      )}

      {/* ── Product Quick Action & Detail Modal ── */}
      <ProductDetailModal
        visible={detailModalVisible}
        itemId={selectedProductId}
        initialTab={selectedModalTab}
        onClose={() => setDetailModalVisible(false)}
      />

      {/* ── Add Product Modal ── */}
      <AddProductModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProductCreated={() => {
          void fetchItems(1);
          void fetchDashboard();
        }}
      />

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

      {/* ── Left Sidebar Navigation Drawer (Matching Web Sidebar) ── */}
      <InventoryNavDrawer
        visible={drawerVisible}
        activeTab={currentTab}
        catalogCount={itemCounts.total || 793}
        lowStockCount={itemCounts.low_stock}
        deadStockCount={itemCounts.dead_stock}
        onClose={() => setDrawerVisible(false)}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenAddProduct={() => setShowAddModal(true)}
        onSearchSubmit={(q) => {
          setSearchQuery(q);
          setCurrentTab("catalog");
        }}
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
  periodPillText: {
    fontSize: 12,
  },
  activeRangeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
  },
  rangeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rangeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeHeading: {
    fontSize: 12.5,
    fontFamily: Typography.medium,
  },
  rangeSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  filterActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  filterActionText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    ...Shadows.card,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiLabel: {
    fontFamily: Typography.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontFamily: Typography.bold,
    fontSize: 20,
    marginVertical: 2,
  },
  kpiFooter: {
    gap: 4,
    marginTop: 2,
  },
  growthPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
  },
  growthPillText: {
    fontFamily: Typography.bold,
    fontSize: 10,
  },
  kpiSubtext: {
    fontFamily: Typography.regular,
    fontSize: 10,
    lineHeight: 13,
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
  catalogTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catalogHeading: { fontFamily: Typography.bold, fontSize: 18 },
  catalogSub: { fontFamily: Typography.regular, fontSize: 12, marginTop: 1 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00A879",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    gap: 4,
    ...Shadows.card,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  catChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
  },
  filterStrip: { gap: 8, paddingVertical: 4 },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    ...Shadows.card,
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
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
  },
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

  sidebarTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  topProdRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  topProdRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,168,121,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  topProdRankText: {
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  topProdName: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  topProdCat: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  topProdVal: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  apiLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  apiLinkText: {
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  customerItemCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  customerAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#00A879",
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarInitials: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  customerItemName: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  customerItemSub: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  customerItemVal: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  customerItemPct: {
    fontFamily: Typography.medium,
    fontSize: 10.5,
    marginTop: 2,
  },
  supplierOrderCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  supplierOrderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  supplierPoRef: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  supplierPoDate: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 1,
  },
  onTrackPill: {
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  onTrackPillText: {
    color: "#10B981",
    fontFamily: Typography.bold,
    fontSize: 10,
  },
  supplierOrderDetails: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  supplierPartyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supplierInitialsBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,168,121,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  supplierInitialsText: {
    color: "#00A879",
    fontFamily: Typography.bold,
    fontSize: 10,
  },
  supplierPartyName: {
    fontFamily: Typography.bold,
    fontSize: 12,
    flex: 1,
  },
  supplierStageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  supplierMetaLabel: {
    fontSize: 10.5,
    fontFamily: Typography.regular,
  },
});
