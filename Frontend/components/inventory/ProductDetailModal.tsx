import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes, Radius, Shadows } from "@/constants/theme";
import { StatusPill } from "@/components/ui/StatusPill";
import { SkeletonCardList, SkeletonBlock } from "@/components/ui/SkeletonCard";
import AppLineChart from "@/components/charts/AppLineChart";
import api from "@/services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ProductDetailModalProps {
  visible: boolean;
  itemId: string | null;
  initialTab?: "forecast" | "trends" | "ledger";
  onClose: () => void;
}

interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  category: { id: number | null; name: string };
  stock: number;
  unit: string;
  reorder_threshold: number;
  expected_delivery_days: number;
  minimum_order_quantity: number;
  landing_date: string | null;
  status: "In Stock" | "Low Stock" | "Critical" | "Dead Stock";
  is_active_mover: boolean;
  recent_30d_units_sold: number;
  recent_30d_revenue_display: string;
}

interface ForecastData {
  min_stock_trend: number;
  min_stock_demand: number;
  min_stock_demand_buffered: number;
  safety_buffer_pct: number;
  future_predictions: { month: string; trend_closing: number; demand_outwards: number }[];
  monthly_history: { month: string; inwards_qty: number; outwards_qty: number; closing_qty: number }[];
}

interface TrendsData {
  days_returned?: number;
  labels: string[];
  outwards: number[];
  closing: number[];
  inwards: number[];
  total_outwards: number;
  total_inwards: number;
  avg_daily_velocity: number;
}

interface LedgerEntry {
  id: number;
  voucher_number: string;
  voucher_type: string;
  date_display: string;
  party_name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount_display: string;
}

export function ProductDetailModal({ visible, itemId, initialTab, onClose }: ProductDetailModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<"forecast" | "trends" | "ledger">(initialTab || "forecast");
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingTab, setLoadingTab] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const cardBorder = isDark ? "#1E332D" : "#E2E8F0";
  const foreground = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";

  const fetchProductDetail = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/inventory/items/${id}/`);
      if (res.data?.status === "success") {
        setDetail(res.data.item);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load product details.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTabData = useCallback(async (id: string, tab: "forecast" | "trends" | "ledger") => {
    try {
      setLoadingTab(true);
      if (tab === "forecast") {
        const res = await api.get(`/inventory/items/${id}/forecast/`);
        if (res.data?.status === "success") {
          setForecast(res.data);
        }
      } else if (tab === "trends") {
        const res = await api.get(`/inventory/items/${id}/trends/?days=45`);
        if (res.data?.status === "success") {
          setTrends(res.data);
        }
      } else if (tab === "ledger") {
        const res = await api.get(`/inventory/items/${id}/ledger/?limit=30`);
        if (res.data?.status === "success") {
          setLedger(res.data.entries || []);
        }
      }
    } catch (err) {
      console.warn("Failed to load tab data:", tab, err);
    } finally {
      setLoadingTab(false);
    }
  }, []);

  useEffect(() => {
    if (visible && itemId) {
      const targetTab = initialTab || "forecast";
      setActiveTab(targetTab);
      fetchProductDetail(itemId);
      fetchTabData(itemId, targetTab);
    } else {
      setDetail(null);
      setForecast(null);
      setTrends(null);
      setLedger([]);
      setActiveTab("forecast");
    }
  }, [visible, itemId, initialTab, fetchProductDetail, fetchTabData]);

  const handleTabChange = (tab: "forecast" | "trends" | "ledger") => {
    setActiveTab(tab);
    if (itemId) {
      if (tab === "forecast" && !forecast) fetchTabData(itemId, "forecast");
      if (tab === "trends" && !trends) fetchTabData(itemId, "trends");
      if (tab === "ledger" && ledger.length === 0) fetchTabData(itemId, "ledger");
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: cardBorder }]}>
          <TouchableOpacity onPress={onClose} style={[styles.backBtn, { borderColor: cardBorder }]} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: foreground }]} numberOfLines={1}>
              Product Intelligence
            </Text>
            <Text style={[styles.headerSubtitle, { color: muted }]}>
              {detail ? detail.sku : "SKU Overview"}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            <SkeletonBlock height={110} borderRadius={16} />
            <SkeletonBlock height={175} borderRadius={16} />
            <SkeletonCardList count={2} height={76} />
          </View>
        ) : error || !detail ? (
          <View style={styles.centerBox}>
            <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
            <Text style={[styles.errorText, { color: foreground }]}>{error || "Product not found"}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.retryBtn, { backgroundColor: "#159A7C" }]}>
              <Text style={styles.retryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
            {/* Product Card */}
            <View style={[styles.productCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.productTopRow}>
                <View style={styles.avatarBox}>
                  <Ionicons name="cube" size={22} color="#159A7C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.productName, { color: foreground }]}>{detail.name}</Text>
                  <View style={styles.badgeRow}>
                    <Text style={[styles.categoryBadge, { color: "#159A7C", backgroundColor: isDark ? "#142A23" : "#ECFDF5" }]}>
                      {detail.category.name}
                    </Text>
                    <Text style={[styles.skuBadge, { color: muted }]}>{detail.sku}</Text>
                  </View>
                </View>
                <StatusPill
                  label={detail.status}
                  variant={
                    detail.status === "In Stock"
                      ? "paid"
                      : detail.status === "Low Stock"
                      ? "pending"
                      : detail.status === "Dead Stock"
                      ? "neutral"
                      : "overdue"
                  }
                  size="small"
                />
              </View>

              {/* Stats Grid */}
              <View style={[styles.metricsGrid, { borderTopColor: cardBorder }]}>
                <View style={styles.metricCol}>
                  <Text style={[styles.metricLabel, { color: muted }]}>CURRENT STOCK</Text>
                  <Text style={[styles.metricVal, { color: detail.stock <= 0 ? "#DC2626" : foreground }]}>
                    {detail.stock.toLocaleString()} <Text style={styles.metricUnit}>{detail.unit}</Text>
                  </Text>
                </View>
                <View style={styles.metricCol}>
                  <Text style={[styles.metricLabel, { color: muted }]}>REORDER THRESHOLD</Text>
                  <Text style={[styles.metricVal, { color: foreground }]}>
                    {detail.reorder_threshold.toLocaleString()} <Text style={styles.metricUnit}>{detail.unit}</Text>
                  </Text>
                </View>
                <View style={styles.metricCol}>
                  <Text style={[styles.metricLabel, { color: muted }]}>30-DAY SALES</Text>
                  <Text style={[styles.metricVal, { color: "#159A7C" }]}>
                    {detail.recent_30d_units_sold.toLocaleString()} <Text style={styles.metricUnit}>{detail.unit}</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Segmented Quick Action Tabs */}
            <View style={[styles.tabBar, { backgroundColor: isDark ? "#13211D" : "#F1F5F9", borderColor: cardBorder }]}>
              <TouchableOpacity
                onPress={() => handleTabChange("forecast")}
                activeOpacity={0.8}
                style={[
                  styles.tabButton,
                  activeTab === "forecast" && { backgroundColor: isDark ? "#1C352E" : "#FFFFFF", borderColor: cardBorder, ...Shadows.card },
                ]}
              >
                <Ionicons name="sparkles" size={14} color={activeTab === "forecast" ? "#159A7C" : muted} />
                <Text style={[styles.tabButtonText, { color: activeTab === "forecast" ? "#159A7C" : muted, fontFamily: activeTab === "forecast" ? Typography.bold : Typography.medium }]}>
                  Forecast
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleTabChange("trends")}
                activeOpacity={0.8}
                style={[
                  styles.tabButton,
                  activeTab === "trends" && { backgroundColor: isDark ? "#1C352E" : "#FFFFFF", borderColor: cardBorder, ...Shadows.card },
                ]}
              >
                <Ionicons name="trending-up" size={14} color={activeTab === "trends" ? "#159A7C" : muted} />
                <Text style={[styles.tabButtonText, { color: activeTab === "trends" ? "#159A7C" : muted, fontFamily: activeTab === "trends" ? Typography.bold : Typography.medium }]}>
                  Trends
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleTabChange("ledger")}
                activeOpacity={0.8}
                style={[
                  styles.tabButton,
                  activeTab === "ledger" && { backgroundColor: isDark ? "#1C352E" : "#FFFFFF", borderColor: cardBorder, ...Shadows.card },
                ]}
              >
                <Ionicons name="receipt-outline" size={14} color={activeTab === "ledger" ? "#159A7C" : muted} />
                <Text style={[styles.tabButtonText, { color: activeTab === "ledger" ? "#159A7C" : muted, fontFamily: activeTab === "ledger" ? Typography.bold : Typography.medium }]}>
                  Ledger
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB CONTENTS */}
            {loadingTab ? (
              <View style={styles.tabLoadingBox}>
                <ActivityIndicator size="small" color="#159A7C" />
                <Text style={[styles.loadingText, { color: muted, marginTop: 8 }]}>Loading {activeTab} data…</Text>
              </View>
            ) : (
              <>
                {/* 1. FORECAST TAB */}
                {activeTab === "forecast" && forecast && (
                  <View style={styles.tabContentBlock}>
                    {/* Reorder Recommendation Banner */}
                    <View style={[styles.reorderBanner, { backgroundColor: isDark ? "#122A23" : "#ECFDF5", borderColor: "#10B98133" }]}>
                      <View style={styles.bannerIconBox}>
                        <Ionicons name="shield-checkmark" size={24} color="#159A7C" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bannerTitle, { color: foreground }]}>Safety Demand Reorder Level</Text>
                        <Text style={[styles.bannerVal, { color: "#159A7C" }]}>
                          {forecast.min_stock_demand_buffered} {detail.unit}
                        </Text>
                        <Text style={[styles.bannerSub, { color: muted }]}>
                          Calculated from demand regression + {forecast.safety_buffer_pct}% safety buffer
                        </Text>
                      </View>
                    </View>

                    {/* 3-Month Predictions */}
                    {forecast.future_predictions.length > 0 && (
                      <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                        <Text style={[styles.sectionHeading, { color: foreground }]}>3-Month Predictive Outlook</Text>
                        <Text style={[styles.sectionSub, { color: muted }]}>
                          Machine learning projection using historical outwards trends
                        </Text>
                        <View style={styles.predictionRowContainer}>
                          {forecast.future_predictions.map((p, idx) => (
                            <View key={idx} style={[styles.predictionBox, { backgroundColor: isDark ? "#142520" : "#F8FAFC", borderColor: cardBorder }]}>
                              <Text style={[styles.predictionMonth, { color: muted }]}>{p.month}</Text>
                              <Text style={[styles.predictionValue, { color: foreground }]}>
                                {p.demand_outwards} <Text style={styles.predictionUnit}>{detail.unit}</Text>
                              </Text>
                              <Text style={styles.predictionLabel}>Est. Demand</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Monthly History Table */}
                    {forecast.monthly_history.length > 0 && (
                      <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                        <Text style={[styles.sectionHeading, { color: foreground }]}>Monthly Stock Movements</Text>
                        <View style={styles.historyTableHead}>
                          <Text style={[styles.tableHeadCol, { flex: 1.4, color: muted }]}>MONTH</Text>
                          <Text style={[styles.tableHeadCol, { flex: 1, textAlign: "right", color: muted }]}>OUTWARDS</Text>
                          <Text style={[styles.tableHeadCol, { flex: 1, textAlign: "right", color: muted }]}>INWARDS</Text>
                          <Text style={[styles.tableHeadCol, { flex: 1, textAlign: "right", color: muted }]}>CLOSING</Text>
                        </View>
                        {forecast.monthly_history.map((m, idx) => (
                          <View key={idx} style={[styles.historyTableRow, { borderTopColor: cardBorder }]}>
                            <Text style={[styles.tableRowMonth, { flex: 1.4, color: foreground }]}>{m.month}</Text>
                            <Text style={[styles.tableRowVal, { flex: 1, textAlign: "right", color: "#D97706" }]}>{m.outwards_qty}</Text>
                            <Text style={[styles.tableRowVal, { flex: 1, textAlign: "right", color: "#10B981" }]}>{m.inwards_qty}</Text>
                            <Text style={[styles.tableRowVal, { flex: 1, textAlign: "right", color: foreground, fontFamily: Typography.bold }]}>{m.closing_qty}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* 2. TRENDS TAB */}
                {activeTab === "trends" && trends && (
                  <View style={styles.tabContentBlock}>
                    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                      <View style={styles.chartHeader}>
                        <View>
                          <Text style={[styles.sectionHeading, { color: foreground }]}>Daily Stock Velocity</Text>
                          <Text style={[styles.sectionSub, { color: muted }]}>
                            Past {trends.days_returned} days movement history
                          </Text>
                        </View>
                        <View style={styles.velocityPill}>
                          <Text style={styles.velocityPillText}>{trends.avg_daily_velocity} {detail.unit}/day</Text>
                        </View>
                      </View>

                      {/* Chart */}
                      {trends.outwards.length > 1 ? (
                        <View style={styles.chartWrapper}>
                          <AppLineChart
                            data={{
                              labels: trends.labels.filter((_, i) => i % Math.ceil(trends.labels.length / 5) === 0),
                              datasets: [
                                {
                                  data: trends.outwards.length > 0 ? trends.outwards : [0],
                                  color: () => "#159A7C",
                                  strokeWidth: 2.5,
                                },
                              ],
                            }}
                            width={SCREEN_WIDTH - 64}
                            height={180}
                            chartConfig={{
                              backgroundColor: "transparent",
                              backgroundGradientFrom: cardBg,
                              backgroundGradientTo: cardBg,
                              decimalPlaces: 0,
                              color: () => "#159A7C",
                              labelColor: () => muted,
                              propsForDots: { r: "3", strokeWidth: "1", stroke: "#159A7C" },
                            }}
                            bezier
                            style={{ marginVertical: 8, borderRadius: 12 }}
                          />
                        </View>
                      ) : (
                        <Text style={[styles.noChartText, { color: muted }]}>Insufficient data points for chart.</Text>
                      )}

                      <View style={styles.trendsKpiRow}>
                        <View style={styles.trendKpi}>
                          <Text style={[styles.trendKpiLabel, { color: muted }]}>TOTAL DISPATCHED</Text>
                          <Text style={[styles.trendKpiVal, { color: "#D97706" }]}>{trends.total_outwards} {detail.unit}</Text>
                        </View>
                        <View style={styles.trendKpi}>
                          <Text style={[styles.trendKpiLabel, { color: muted }]}>TOTAL RECEIVED</Text>
                          <Text style={[styles.trendKpiVal, { color: "#10B981" }]}>{trends.total_inwards} {detail.unit}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* 3. LEDGER TAB */}
                {activeTab === "ledger" && (
                  <View style={styles.tabContentBlock}>
                    {ledger.length === 0 ? (
                      <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder, alignItems: "center", paddingVertical: 24 }]}>
                        <Ionicons name="receipt-outline" size={36} color={muted} />
                        <Text style={[styles.emptyLedgerText, { color: foreground, marginTop: 8 }]}>No Voucher Transactions</Text>
                        <Text style={[styles.sectionSub, { color: muted }]}>No tax invoices or purchases recorded for this item.</Text>
                      </View>
                    ) : (
                      ledger.map((entry) => (
                        <View key={entry.id} style={[styles.ledgerCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                          <View style={styles.ledgerTopRow}>
                            <View style={styles.ledgerTypePill}>
                              <Text style={styles.ledgerTypeText}>{entry.voucher_type}</Text>
                            </View>
                            <Text style={[styles.ledgerDate, { color: muted }]}>{entry.date_display}</Text>
                          </View>
                          <Text style={[styles.ledgerParty, { color: foreground }]} numberOfLines={1}>
                            {entry.party_name}
                          </Text>
                          <View style={styles.ledgerBottomRow}>
                            <Text style={[styles.ledgerVoucherNo, { color: muted }]}>#{entry.voucher_number}</Text>
                            <View style={styles.ledgerQtyBox}>
                              <Text style={[styles.ledgerQty, { color: entry.voucher_type.toLowerCase().includes("purchase") ? "#10B981" : "#D97706" }]}>
                                {entry.quantity} {entry.unit}
                              </Text>
                              <Text style={[styles.ledgerAmount, { color: foreground }]}>{entry.amount_display}</Text>
                            </View>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBox: { alignItems: "center" },
  headerTitle: { fontFamily: Typography.bold, fontSize: 16 },
  headerSubtitle: { fontFamily: Typography.regular, fontSize: 12, marginTop: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { fontFamily: Typography.medium, fontSize: 13, marginTop: 12 },
  errorText: { fontFamily: Typography.bold, fontSize: 14, textAlign: "center", marginTop: 10 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 16 },
  retryBtnText: { color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 13 },
  content: { padding: 16, gap: 14 },
  productCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 16,
    ...Shadows.card,
  },
  productTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(21, 154, 124, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  productName: { fontFamily: Typography.bold, fontSize: 15, lineHeight: 20 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  categoryBadge: {
    fontFamily: Typography.semiBold,
    fontSize: 10.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  skuBadge: { fontFamily: Typography.medium, fontSize: 11 },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  metricCol: { flex: 1 },
  metricLabel: { fontFamily: Typography.semiBold, fontSize: 9, letterSpacing: 0.3 },
  metricVal: { fontFamily: Typography.bold, fontSize: 14, marginTop: 3 },
  metricUnit: { fontSize: 11, fontFamily: Typography.regular },
  tabBar: {
    flexDirection: "row",
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: Radius.pill,
    gap: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabButtonText: { fontSize: 12 },
  tabLoadingBox: { alignItems: "center", paddingVertical: 32 },
  tabContentBlock: { gap: 12 },
  reorderBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 12,
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(21, 154, 124, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { fontFamily: Typography.bold, fontSize: 12 },
  bannerVal: { fontFamily: Typography.bold, fontSize: 18, marginTop: 1 },
  bannerSub: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 14,
    ...Shadows.card,
  },
  sectionHeading: { fontFamily: Typography.bold, fontSize: 13.5 },
  sectionSub: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2, marginBottom: 12 },
  predictionRowContainer: { flexDirection: "row", gap: 8 },
  predictionBox: {
    flex: 1,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  predictionMonth: { fontFamily: Typography.medium, fontSize: 10 },
  predictionValue: { fontFamily: Typography.bold, fontSize: 15, marginTop: 4 },
  predictionUnit: { fontSize: 11, fontFamily: Typography.regular },
  predictionLabel: { fontFamily: Typography.semiBold, fontSize: 9, color: "#159A7C", marginTop: 2 },
  historyTableHead: { flexDirection: "row", paddingVertical: 6 },
  tableHeadCol: { fontFamily: Typography.bold, fontSize: 9.5, letterSpacing: 0.4 },
  historyTableRow: { flexDirection: "row", paddingVertical: 8, borderTopWidth: 1, alignItems: "center" },
  tableRowMonth: { fontFamily: Typography.medium, fontSize: 11.5 },
  tableRowVal: { fontFamily: Typography.medium, fontSize: 11.5 },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  velocityPill: {
    backgroundColor: "rgba(21, 154, 124, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  velocityPillText: { color: "#159A7C", fontFamily: Typography.bold, fontSize: 11 },
  chartWrapper: { alignItems: "center" },
  noChartText: { fontFamily: Typography.medium, fontSize: 12, paddingVertical: 18, textAlign: "center" },
  trendsKpiRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E2E8F033" },
  trendKpi: { alignItems: "center" },
  trendKpiLabel: { fontFamily: Typography.semiBold, fontSize: 9, letterSpacing: 0.3 },
  trendKpiVal: { fontFamily: Typography.bold, fontSize: 13, marginTop: 2 },
  emptyLedgerText: { fontFamily: Typography.bold, fontSize: 14 },
  ledgerCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    ...Shadows.card,
  },
  ledgerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ledgerTypePill: {
    backgroundColor: "rgba(21, 154, 124, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ledgerTypeText: { color: "#159A7C", fontFamily: Typography.bold, fontSize: 9.5 },
  ledgerDate: { fontFamily: Typography.regular, fontSize: 11 },
  ledgerParty: { fontFamily: Typography.bold, fontSize: 13, marginTop: 6 },
  ledgerBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  ledgerVoucherNo: { fontFamily: Typography.medium, fontSize: 11 },
  ledgerQtyBox: { alignItems: "flex-end" },
  ledgerQty: { fontFamily: Typography.bold, fontSize: 12 },
  ledgerAmount: { fontFamily: Typography.semiBold, fontSize: 11 },
});
