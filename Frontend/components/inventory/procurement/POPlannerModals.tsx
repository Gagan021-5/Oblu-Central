import React, { useState, useEffect } from "react";
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
import { Typography, Radius, Shadows } from "@/constants/theme";
import AppLineChart from "@/components/charts/AppLineChart";
import api from "@/services/api";
import { POPlannerProduct, DailySaleRow } from "./types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MathModalProps {
  visible: boolean;
  product: POPlannerProduct | null;
  onClose: () => void;
}

export function POPlannerMathModal({ visible, product, onClose }: MathModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  if (!product) return null;

  const s = product.calc_steps || {};
  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  // Sample 90-day graph points cleanly for LineChart (every ~15 days so labels don't collide)
  const gData = product.graph_data || [];
  const step = Math.max(1, Math.floor(gData.length / 6));
  const sampled = gData.filter((_, i) => i % step === 0 || i === gData.length - 1);
  const chartLabels = sampled.map((pt) => `D${pt.day}`);
  const stockSeries = sampled.map((pt) => pt.stock || 0);
  const bufferSeries = sampled.map((pt) => pt.buffer_line || 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: cardBg, borderBottomColor: border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.modalEyebrow, { color: "#00A879" }]}>ORDER CALCULATION</Text>
            <Text style={[styles.modalTitle, { color: fg }]} numberOfLines={2}>
              {product.name}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: border }]}>
            <Ionicons name="close" size={20} color={fg} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {s.note ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={{ color: muted, fontStyle: "italic" }}>{s.note}</Text>
            </View>
          ) : (
            <>
              {/* Active POs in Transit */}
              {product.tracking_details && product.tracking_details.length > 0 && (
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, marginBottom: 12 }]}>
                  <Text style={[styles.sectionHeading, { color: fg }]}>
                    Active Purchase Orders In Transit
                  </Text>
                  {product.tracking_details.map((po, idx) => (
                    <View
                      key={idx}
                      style={[styles.rowItem, { borderTopColor: border, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 13 }}>
                          {po.po_number} · {po.incoming_qty} {product.unit}
                        </Text>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          Stage: {po.stage || "—"} ({po.days_in_stage ?? "—"}d)
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: Typography.bold, color: "#0369A1", fontSize: 12 }}>
                          ETA: {po.eta || "TBD"}
                        </Text>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          {po.remaining_days !== null ? `${po.remaining_days}d left` : "—"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Step Cards Grid */}
              <View style={styles.stepGrid}>
                <StepCard
                  label="CURRENT STOCK"
                  value={`${Math.round(s.current_stock ?? 0)} ${product.unit}`}
                  note="Live inventory stock"
                  accent="#0EA5E9"
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
                <StepCard
                  label="AVG DAILY SALES"
                  value={`${s.avg_daily ?? 0}/day`}
                  note={
                    product.is_new_product && product.landing_date
                      ? `Since ${product.landing_date}`
                      : "Tally sales since Apr 2025"
                  }
                  accent="#0EA5E9"
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
                <StepCard
                  label="MONTHLY GROWTH"
                  value={`${s.monthly_growth_rate_pct ?? 0}% / mo`}
                  note="20% 1Y YoY + 80% Last 3M"
                  accent="#6366F1"
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
                <StepCard
                  label="LEAD TIME"
                  value={`${s.delivery_days ?? 30} days`}
                  note="Expected order delivery window"
                  accent="#6366F1"
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
                <StepCard
                  label="STOCK AT ARRIVAL"
                  value={`${Math.round(s.stock_at_arrival ?? 0)} ${product.unit}`}
                  note="Projected stock when new order lands"
                  accent="#8B5CF6"
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
                <StepCard
                  label="3M DEMAND (+20% BUFFER)"
                  value={`${s.demand_3m_after ?? 0}`}
                  note={s.demand_source || ""}
                  accent={(s.shortfall || 0) > 0 ? "#F59E0B" : "#10B981"}
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
                <StepCard
                  label="SHORTFALL"
                  value={`${s.shortfall ?? 0}`}
                  note="3M buffered demand minus arrival stock"
                  accent={(s.shortfall || 0) > 0 ? "#EF4444" : "#10B981"}
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
                <StepCard
                  label="REORDER POINT"
                  value={(s.reorder_point_days ?? 0) <= 0 ? "ORDER NOW" : `In ${s.reorder_point_days}d`}
                  note={`Runway (${s.runway_days}d) − Lead Time (${s.delivery_days}d)`}
                  accent={(s.reorder_point_days ?? 0) <= 0 ? "#EF4444" : "#10B981"}
                  cardBg={cardBg}
                  border={border}
                  fg={fg}
                  muted={muted}
                />
              </View>

              {s.moq_note && (
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: "#F59E0B", marginTop: 10 }]}>
                  <Text style={{ fontFamily: Typography.bold, color: "#D97706", fontSize: 13 }}>
                    MOQ Applied: Rounded shortfall ({s.shortfall}) up to MOQ {s.moq}
                  </Text>
                </View>
              )}

              {/* 90-Day Trajectory Chart */}
              {sampled.length >= 2 && (
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, marginTop: 12 }]}>
                  <Text style={[styles.sectionHeading, { color: fg }]}>
                    Next 90-Day Stock Trajectory
                  </Text>
                  <Text style={{ color: muted, fontSize: 11, marginBottom: 8 }}>
                    Green: Projected Stock Level · Amber: 3M Buffered Demand Trigger
                  </Text>
                  <AppLineChart
                    data={{
                      labels: chartLabels,
                      datasets: [
                        { data: stockSeries, color: () => "#00A879", strokeWidth: 2.5 },
                        { data: bufferSeries, color: () => "#F59E0B", strokeWidth: 1.5 },
                      ],
                    }}
                    width={SCREEN_WIDTH - 64}
                    height={190}
                    chartConfig={{
                      backgroundColor: cardBg,
                      backgroundGradientFrom: cardBg,
                      backgroundGradientTo: cardBg,
                      decimalPlaces: 0,
                      color: () => "#00A879",
                      labelColor: () => muted,
                    }}
                    bezier
                    fromZero
                    style={{ borderRadius: Radius.md }}
                  />
                </View>
              )}

              {/* Conclusion */}
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: "#00A879", marginTop: 12 }]}>
                {(s.shortfall || 0) === 0 ? (
                  <Text style={{ color: fg, fontSize: 13, lineHeight: 19 }}>
                    <Text style={{ fontFamily: Typography.bold, color: "#10B981" }}>No order needed. </Text>
                    Stock on arrival ({Math.round(s.stock_at_arrival ?? 0)}) covers the 3-month buffered demand ({s.demand_3m_after}).
                    {s.reorder_point_days > 0 ? ` Reorder in ${s.reorder_point_days} days.` : ""}
                  </Text>
                ) : (
                  <Text style={{ color: fg, fontSize: 13, lineHeight: 19 }}>
                    <Text style={{ fontFamily: Typography.bold, color: "#EF4444" }}>
                      Order {s.order_final} {product.unit}.{" "}
                    </Text>
                    Shortfall of {s.shortfall} units vs 3-month buffered demand ({s.demand_3m_after}).
                    {s.order_now ? " Stock runs out before new batch arrives — order immediately." : ""}
                    {s.order_lasts_months ? ` Order should last ~${s.order_lasts_months} months from arrival.` : ""}
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function StepCard({
  label,
  value,
  note,
  accent,
  cardBg,
  border,
  fg,
  muted,
}: {
  label: string;
  value: string;
  note: string;
  accent: string;
  cardBg: string;
  border: string;
  fg: string;
  muted: string;
}) {
  return (
    <View
      style={[
        styles.stepBox,
        { backgroundColor: cardBg, borderColor: border, borderLeftColor: accent, borderLeftWidth: 3 },
      ]}
    >
      <Text style={{ fontSize: 9.5, fontFamily: Typography.bold, color: muted }}>{label}</Text>
      <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg, marginVertical: 2 }}>{value}</Text>
      <Text style={{ fontSize: 10.5, color: muted }} numberOfLines={2}>{note}</Text>
    </View>
  );
}

interface SalesModalProps {
  visible: boolean;
  product: POPlannerProduct | null;
  onClose: () => void;
}

export function POPlannerSalesModal({ visible, product, onClose }: SalesModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMonth(null);
  }, [product, visible]);

  if (!product) return null;

  const monthly = product.monthly_sales || [];
  const dailyMap = product.daily_sales || {};
  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  const recentMonthly = monthly.slice(-6);
  const dailyRows: DailySaleRow[] = selectedMonth ? dailyMap[selectedMonth] || [] : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: cardBg, borderBottomColor: border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalEyebrow, { color: "#00A879" }]}>
              {selectedMonth ? `DAILY SALES · ${selectedMonth}` : "MONTHLY SALES HISTORY"}
            </Text>
            <Text style={[styles.modalTitle, { color: fg }]} numberOfLines={1}>
              {product.name}
            </Text>
          </View>
          {selectedMonth ? (
            <TouchableOpacity
              onPress={() => setSelectedMonth(null)}
              style={[styles.backBtn, { borderColor: border }]}
            >
              <Ionicons name="arrow-back" size={16} color={fg} />
              <Text style={{ color: fg, fontFamily: Typography.bold, fontSize: 12 }}>Months</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: border, marginLeft: 8 }]}>
            <Ionicons name="close" size={20} color={fg} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {selectedMonth ? (
            <View style={{ gap: 8 }}>
              {dailyRows.length === 0 ? (
                <Text style={{ color: muted, textAlign: "center", padding: 30 }}>No daily entries.</Text>
              ) : (
                dailyRows.map((row, idx) => {
                  const included = row.status === "Included";
                  return (
                    <View
                      key={idx}
                      style={[styles.card, { backgroundColor: cardBg, borderColor: border, padding: 12 }]}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 13 }}>
                            {row.party}
                          </Text>
                          <Text style={{ color: muted, fontSize: 11 }}>{row.date}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontFamily: Typography.bold, color: "#00A879", fontSize: 14 }}>
                            {row.qty} {product.unit}
                          </Text>
                          <View
                            style={[
                              styles.pill,
                              { backgroundColor: included ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: Typography.bold,
                                color: included ? "#10B981" : "#EF4444",
                              }}
                            >
                              {row.status}
                              {row.reason ? ` (${row.reason})` : ""}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <>
              {recentMonthly.length >= 2 && (
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, marginBottom: 12 }]}>
                  <Text style={[styles.sectionHeading, { color: fg }]}>Monthly Trend</Text>
                  <AppLineChart
                    data={{
                      labels: recentMonthly.map((m) => m.month.slice(2)),
                      datasets: [{ data: recentMonthly.map((m) => m.qty), color: () => "#00A879", strokeWidth: 2 }],
                    }}
                    width={SCREEN_WIDTH - 64}
                    height={165}
                    chartConfig={{
                      backgroundColor: cardBg,
                      backgroundGradientFrom: cardBg,
                      backgroundGradientTo: cardBg,
                      decimalPlaces: 0,
                      color: () => "#00A879",
                      labelColor: () => muted,
                    }}
                    fromZero
                    bezier
                    style={{ borderRadius: Radius.md }}
                  />
                </View>
              )}

              <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.sectionHeading, { color: fg, marginBottom: 8 }]}>
                  Monthly Breakdown (Tap for Daily Audit)
                </Text>
                {monthly.length === 0 ? (
                  <Text style={{ color: muted, paddingVertical: 16 }}>No sales data found.</Text>
                ) : (
                  [...monthly].reverse().map((m, idx) => {
                    const hasDaily = (dailyMap[m.month] || []).length > 0;
                    return (
                      <TouchableOpacity
                        key={m.month}
                        disabled={!hasDaily}
                        onPress={() => hasDaily && setSelectedMonth(m.month)}
                        style={[
                          styles.rowItem,
                          { borderTopColor: border, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0 },
                        ]}
                      >
                        <Text style={{ fontFamily: Typography.bold, color: fg }}>{m.month}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontFamily: Typography.bold, color: "#00A879" }}>
                            {m.qty} {product.unit}
                          </Text>
                          {hasDaily && <Ionicons name="chevron-forward" size={16} color={muted} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface TopCustomersModalProps {
  visible: boolean;
  itemId: number | null;
  itemName: string;
  onClose: () => void;
}

export function POPlannerTopCustomersModal({
  visible,
  itemId,
  itemName,
  onClose,
}: TopCustomersModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [customers, setCustomers] = useState<{ name: string; total_qty: number; monthly: { month: string; qty: number }[] }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && itemId) {
      setLoading(true);
      api
        .get("/inventory/po-planner/top-customers/", { params: { item_id: itemId } })
        .then((res) => setCustomers(res.data?.customers || []))
        .catch(() => setCustomers([]))
        .finally(() => setLoading(false));
    }
  }, [visible, itemId]);

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: cardBg, borderBottomColor: border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalEyebrow, { color: "#00A879" }]}>TOP 5 CUSTOMERS</Text>
            <Text style={[styles.modalTitle, { color: fg }]} numberOfLines={1}>
              {itemName}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: border }]}>
            <Ionicons name="close" size={20} color={fg} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {loading ? (
            <ActivityIndicator size="large" color="#00A879" style={{ marginTop: 40 }} />
          ) : customers.length === 0 ? (
            <Text style={{ color: muted, textAlign: "center", marginTop: 40 }}>
              No customer purchase history found.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {customers.map((c, idx) => (
                <View key={idx} style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 14, flex: 1, marginRight: 8 }}>
                      #{idx + 1} {c.name}
                    </Text>
                    <Text style={{ fontFamily: Typography.bold, color: "#00A879", fontSize: 14 }}>
                      {c.total_qty.toLocaleString()} qty
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {c.monthly.map((m) => (
                      <View
                        key={m.month}
                        style={{
                          backgroundColor: isDark ? "#1E332D" : "#F1F5F9",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: muted }}>
                          {m.month}: <Text style={{ fontFamily: Typography.bold, color: fg }}>{m.qty}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface VoucherHistoryModalProps {
  visible: boolean;
  title: string;
  productName: string;
  unit: string;
  rows: { date: string | null; qty: number; voucher_number: string; party: string }[];
  onClose: () => void;
}

export function POPlannerHistoryModal({
  visible,
  title,
  productName,
  unit,
  rows,
  onClose,
}: VoucherHistoryModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: bg, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: cardBg, borderBottomColor: border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalEyebrow, { color: "#00A879" }]}>{title}</Text>
            <Text style={[styles.modalTitle, { color: fg }]} numberOfLines={1}>
              {productName}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: border }]}>
            <Ionicons name="close" size={20} color={fg} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}>
          {rows.map((r, i) => (
            <View key={i} style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: Typography.bold, color: fg }}>{r.date || "—"}</Text>
                <Text style={{ fontFamily: Typography.bold, color: "#00A879" }}>
                  {r.qty} {unit}
                </Text>
              </View>
              <Text style={{ color: muted, fontSize: 12, marginTop: 4 }}>
                {r.voucher_number ? `Voucher: ${r.voucher_number} · ` : ""}
                {r.party || "—"}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalEyebrow: { fontSize: 10, fontFamily: Typography.bold, letterSpacing: 0.7 },
  modalTitle: { fontSize: 16, fontFamily: Typography.bold, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  sectionHeading: { fontSize: 14, fontFamily: Typography.bold, marginBottom: 6 },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  stepGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stepBox: {
    width: "48.3%",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
});
