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
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
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
  const { colors } = useTheme();
  if (!product) return null;

  const s = product.calc_steps || {};
  const gData = product.graph_data || [];
  const step = Math.max(1, Math.floor(gData.length / 6));
  const sampled = gData.filter((_, i) => i % step === 0 || i === gData.length - 1);
  const chartLabels = sampled.map((pt) => `D${pt.day}`);
  const stockSeries = sampled.map((pt) => pt.stock || 0);
  const bufferSeries = sampled.map((pt) => pt.buffer_line || 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.modalEyebrow, { color: colors.primary }]}>ORDER CALCULATION</Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {product.name}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.cardBorder }]}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {s.note ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>{s.note}</Text>
            </View>
          ) : (
            <>
              {product.tracking_details && product.tracking_details.length > 0 && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 12 }]}>
                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                    Active Purchase Orders In Transit
                  </Text>
                  {product.tracking_details.map((po, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.rowItem,
                        { borderTopColor: colors.cardBorder, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, fontSize: 13 }}>
                          {po.po_number} · {po.incoming_qty} {product.unit}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                          Stage: {po.stage || "—"} ({po.days_in_stage ?? "—"}d)
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: Typography.bold, color: colors.primary, fontSize: 12 }}>
                          ETA: {po.eta || "TBD"}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                          {po.remaining_days !== null ? `${po.remaining_days}d left` : "—"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.stepGrid}>
                <StepCard
                  label="CURRENT STOCK"
                  value={`${Math.round(s.current_stock ?? 0)} ${product.unit}`}
                  note="Live inventory stock"
                  accent={colors.primary}
                />
                <StepCard
                  label="AVG DAILY SALES"
                  value={`${s.avg_daily ?? 0}/day`}
                  note={
                    product.is_new_product && product.landing_date
                      ? `Since ${product.landing_date}`
                      : "Tally sales since Apr 2025"
                  }
                  accent={colors.primary}
                />
                <StepCard
                  label="MONTHLY GROWTH"
                  value={`${s.monthly_growth_rate_pct ?? 0}% / mo`}
                  note="20% 1Y YoY + 80% Last 3M"
                  accent={colors.primary}
                />
                <StepCard
                  label="LEAD TIME"
                  value={`${s.delivery_days ?? 30} days`}
                  note="Expected order delivery window"
                  accent={colors.primary}
                />
                <StepCard
                  label="STOCK AT ARRIVAL"
                  value={`${Math.round(s.stock_at_arrival ?? 0)} ${product.unit}`}
                  note="Projected stock when new order lands"
                  accent={colors.primary}
                />
                <StepCard
                  label="3M DEMAND (+20%)"
                  value={`${s.demand_3m_after ?? 0}`}
                  note={s.demand_source || ""}
                  accent={(s.shortfall || 0) > 0 ? colors.warning : colors.success}
                />
                <StepCard
                  label="SHORTFALL"
                  value={`${s.shortfall ?? 0}`}
                  note="3M buffered demand minus arrival stock"
                  accent={(s.shortfall || 0) > 0 ? colors.error : colors.success}
                />
                <StepCard
                  label="REORDER POINT"
                  value={(s.reorder_point_days ?? 0) <= 0 ? "ORDER NOW" : `In ${s.reorder_point_days}d`}
                  note={`Runway (${s.runway_days}d) − Lead Time (${s.delivery_days}d)`}
                  accent={(s.reorder_point_days ?? 0) <= 0 ? colors.error : colors.success}
                />
              </View>

              {s.moq_note && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.warning, marginTop: 10 }]}>
                  <Text style={{ fontFamily: Typography.bold, color: colors.warning, fontSize: 13 }}>
                    MOQ Applied: Rounded shortfall ({s.shortfall}) up to MOQ {s.moq}
                  </Text>
                </View>
              )}

              {sampled.length >= 2 && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 }]}>
                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                    Next 90-Day Stock Trajectory
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
                    Mint: Projected Stock Level · Amber: 3M Buffered Demand Trigger
                  </Text>
                  <AppLineChart
                    data={{
                      labels: chartLabels,
                      datasets: [
                        { data: stockSeries, color: () => colors.primary, strokeWidth: 2.5 },
                        { data: bufferSeries, color: () => colors.warning, strokeWidth: 1.5 },
                      ],
                    }}
                    width={SCREEN_WIDTH - 64}
                    height={190}
                    chartConfig={{
                      backgroundColor: colors.card,
                      backgroundGradientFrom: colors.card,
                      backgroundGradientTo: colors.card,
                      decimalPlaces: 0,
                      color: () => colors.primary,
                      labelColor: () => colors.textMuted,
                    }}
                    bezier
                    fromZero
                    style={{ borderRadius: Radius.md }}
                  />
                </View>
              )}

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primaryBorder, marginTop: 12 }]}>
                {(s.shortfall || 0) === 0 ? (
                  <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19 }}>
                    <Text style={{ fontFamily: Typography.bold, color: colors.success }}>No order needed. </Text>
                    Stock on arrival ({Math.round(s.stock_at_arrival ?? 0)}) covers the 3-month buffered demand ({s.demand_3m_after}).
                    {s.reorder_point_days > 0 ? ` Reorder in ${s.reorder_point_days} days.` : ""}
                  </Text>
                ) : (
                  <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19 }}>
                    <Text style={{ fontFamily: Typography.bold, color: colors.error }}>
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
}: {
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.stepBox,
        { backgroundColor: colors.card, borderColor: colors.cardBorder, borderLeftColor: accent, borderLeftWidth: 3 },
      ]}
    >
      <Text style={{ fontSize: 9.5, fontFamily: Typography.bold, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary, marginVertical: 2 }}>{value}</Text>
      <Text style={{ fontSize: 10.5, color: colors.textMuted }} numberOfLines={2}>{note}</Text>
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
  const { colors } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    setSelectedMonth(null);
  }, [product, visible]);

  if (!product) return null;

  const monthly = product.monthly_sales || [];
  const dailyMap = product.daily_sales || {};
  const recentMonthly = monthly.slice(-6);
  const dailyRows: DailySaleRow[] = selectedMonth ? dailyMap[selectedMonth] || [] : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalEyebrow, { color: colors.primary }]}>
              {selectedMonth ? `DAILY SALES · ${selectedMonth}` : "MONTHLY SALES HISTORY"}
            </Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {product.name}
            </Text>
          </View>
          {selectedMonth && (
            <TouchableOpacity
              onPress={() => setSelectedMonth(null)}
              style={[styles.backBtn, { borderColor: colors.cardBorder }]}
            >
              <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontFamily: Typography.bold, fontSize: 12 }}>Months</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.cardBorder, marginLeft: 8 }]}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {selectedMonth ? (
            <View style={{ gap: 8 }}>
              {dailyRows.length === 0 ? (
                <Text style={{ color: colors.textMuted, textAlign: "center", padding: 30 }}>No daily entries.</Text>
              ) : (
                dailyRows.map((row, idx) => {
                  const included = row.status === "Included";
                  return (
                    <View
                      key={idx}
                      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 12 }]}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, fontSize: 13 }}>
                            {row.party}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{row.date}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontFamily: Typography.bold, color: colors.primary, fontSize: 14 }}>
                            {row.qty} {product.unit}
                          </Text>
                          <View
                            style={[
                              styles.pill,
                              { backgroundColor: included ? colors.successBg : colors.errorBg },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: Typography.bold,
                                color: included ? colors.success : colors.error,
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
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 12 }]}>
                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Monthly Trend</Text>
                  <AppLineChart
                    data={{
                      labels: recentMonthly.map((m) => m.month.slice(2)),
                      datasets: [{ data: recentMonthly.map((m) => m.qty), color: () => colors.primary, strokeWidth: 2 }],
                    }}
                    width={SCREEN_WIDTH - 64}
                    height={165}
                    chartConfig={{
                      backgroundColor: colors.card,
                      backgroundGradientFrom: colors.card,
                      backgroundGradientTo: colors.card,
                      decimalPlaces: 0,
                      color: () => colors.primary,
                      labelColor: () => colors.textMuted,
                    }}
                    fromZero
                    bezier
                    style={{ borderRadius: Radius.md }}
                  />
                </View>
              )}

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginBottom: 8 }]}>
                  Monthly Breakdown (Tap for Daily Audit)
                </Text>
                {monthly.length === 0 ? (
                  <Text style={{ color: colors.textMuted, paddingVertical: 16 }}>No sales data found.</Text>
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
                          { borderTopColor: colors.cardBorder, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0 },
                        ]}
                      >
                        <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>{m.month}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontFamily: Typography.bold, color: colors.primary }}>
                            {m.qty} {product.unit}
                          </Text>
                          {hasDaily && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
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
  const { colors } = useTheme();
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalEyebrow, { color: colors.primary }]}>TOP 5 CUSTOMERS</Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {itemName}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.cardBorder }]}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {loading ? (
            <SkeletonCardList count={4} height={86} />
          ) : customers.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 40 }}>
              No customer purchase history found.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {customers.map((c, idx) => (
                <View key={idx} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, fontSize: 14, flex: 1, marginRight: 8 }}>
                      #{idx + 1} {c.name}
                    </Text>
                    <Text style={{ fontFamily: Typography.bold, color: colors.primary, fontSize: 14 }}>
                      {c.total_qty.toLocaleString()} qty
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {c.monthly.map((m) => (
                      <View
                        key={m.month}
                        style={{
                          backgroundColor: colors.secondarySurface,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          {m.month}: <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>{m.qty}</Text>
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
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalEyebrow, { color: colors.primary }]}>{title}</Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {productName}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.cardBorder }]}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}>
          {rows.map((r, i) => (
            <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>{r.date || "—"}</Text>
                <Text style={{ fontFamily: Typography.bold, color: colors.primary }}>
                  {r.qty} {unit}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
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
