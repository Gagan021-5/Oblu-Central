import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";

interface CategoryStat {
  name: string;
  total_sales: number;
  total_sales_display: string;
  percentage: number;
}

interface ProductStat {
  id: number | null;
  name: string;
  category: string;
  total_sales: number;
  total_sales_display: string;
  units_sold: number;
  percentage: number;
}

interface LedgerRow {
  id: number;
  date_display: string;
  voucher_number: string;
  party_name: string;
  salesperson: string;
  quantity: number;
  amount_display: string;
}

function toIsoDaysAgo(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function SalesContributionSection() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const initialDates = toIsoDaysAgo(90);
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [grandTotalDisplay, setGrandTotalDisplay] = useState("₹0");
  const [topItem, setTopItem] = useState("N/A");
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);

  const [ledgerItem, setLedgerItem] = useState<{ id: number; name: string } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [ledgerTotals, setLedgerTotals] = useState<{ qty: number; amtDisplay: string }>({
    qty: 0,
    amtDisplay: "₹0",
  });

  const barColors = [colors.primary, colors.brightMint, colors.strongGraphite, colors.warning, colors.textSecondary];

  const fetchData = useCallback(async (sDate: string, eDate: string, q: string) => {
    try {
      setLoading(true);
      const res = await api.get("/inventory/analytics/contribution/", {
        params: { start_date: sDate, end_date: eDate, search: q },
      });
      if (res.data?.status === "success") {
        setGrandTotalDisplay(res.data.grand_total_display || "₹0");
        setTopItem(res.data.top_item || "N/A");
        setTotalItemsCount(res.data.total_items_count || 0);
        setCategoryStats(res.data.category_stats || []);
        setProductStats(res.data.product_stats || []);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load sales contribution.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(startDate, endDate, "");
  }, [fetchData]);

  const applyPreset = (days: number) => {
    const d = toIsoDaysAgo(days);
    setStartDate(d.start);
    setEndDate(d.end);
    fetchData(d.start, d.end, search);
    setAppliedSearch(search);
  };

  const handleUpdate = () => {
    setAppliedSearch(search);
    fetchData(startDate, endDate, search);
  };

  const openLedger = async (p: ProductStat) => {
    if (!p.id) {
      Alert.alert("No SKU Link", "This line item is unlinked from a catalog SKU.");
      return;
    }
    setLedgerItem({ id: p.id, name: p.name });
    try {
      setLedgerLoading(true);
      const res = await api.get(`/inventory/analytics/contribution/${p.id}/`, {
        params: { start_date: startDate, end_date: endDate },
      });
      if (res.data?.status === "success") {
        setLedgerRows(res.data.transactions || []);
        setLedgerTotals({
          qty: res.data.total_qty || 0,
          amtDisplay: res.data.total_amt_display || "₹0",
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load sales ledger.");
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, gap: 10 }]}>
        <View style={[styles.searchRow, { backgroundColor: colors.secondarySurface, borderColor: colors.cardBorder }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Search product..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleUpdate}
            style={{ flex: 1, color: colors.textPrimary, fontSize: 13 }}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                setAppliedSearch("");
                fetchData(startDate, endDate, "");
              }}
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>START DATE</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>END DATE</Text>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
            />
          </View>
          <TouchableOpacity onPress={handleUpdate} style={[styles.updateBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 12.5 }}>Apply</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {[30, 90, 180, 365].map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => applyPreset(d)}
              style={[styles.presetBtn, { borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
            >
              <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.textPrimary }}>Last {d}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>REVENUE</Text>
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.primary }} numberOfLines={1}>
            {grandTotalDisplay}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>TOP ITEM</Text>
          <Text style={{ fontSize: 12.5, fontFamily: Typography.bold, color: colors.textPrimary }} numberOfLines={2}>
            {topItem}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>TOTAL ITEMS</Text>
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>{totalItemsCount}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Calculating Tax Invoice sales rankings...</Text>
        </View>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Category Revenue Share</Text>
            <Text style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 10 }}>
              Grand Total: {grandTotalDisplay}
            </Text>
            <View style={{ gap: 10 }}>
              {categoryStats.slice(0, 10).map((cat, idx) => (
                <View key={idx} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, fontFamily: Typography.medium, color: colors.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: colors.textPrimary }}>
                      {cat.total_sales_display} ({cat.percentage}%)
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.secondarySurface, overflow: "hidden" }}>
                    <View
                      style={{
                        height: "100%",
                        width: `${Math.min(cat.percentage, 100)}%`,
                        backgroundColor: barColors[idx % barColors.length],
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Sales Rankings {appliedSearch ? `("${appliedSearch}")` : ""}
              </Text>
              <Text style={{ fontSize: 11, color: colors.primary, fontFamily: Typography.bold }}>
                Tap for Ledger
              </Text>
            </View>

            {productStats.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: "center", paddingVertical: 20 }}>
                No sales records in selected date range.
              </Text>
            ) : (
              productStats.map((p, idx) => (
                <TouchableOpacity
                  key={`${p.id}-${idx}`}
                  activeOpacity={0.75}
                  onPress={() => openLedger(p)}
                  style={{
                    paddingVertical: 11,
                    borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: colors.cardBorder,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, fontSize: 13 }} numberOfLines={2}>
                        #{idx + 1} {p.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        ID: #{p.id ?? "—"} · {p.category} · {p.units_sold.toLocaleString()} units
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontFamily: Typography.bold, color: colors.primary, fontSize: 13 }}>
                        {p.total_sales_display}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: Typography.bold }}>
                        {p.percentage}% share · View →
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      )}

      {/* Sales Ledger Drilldown Modal */}
      <Modal visible={!!ledgerItem} animationType="slide" onRequestClose={() => setLedgerItem(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 10, fontFamily: Typography.bold, color: colors.primary }}>
                SALES LEDGER ({startDate} to {endDate})
              </Text>
              <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: colors.textPrimary }} numberOfLines={1}>
                {ledgerItem?.name}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setLedgerItem(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {ledgerLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 10 }}>
              <View style={[styles.card, { backgroundColor: colors.strongGraphite, borderColor: colors.cardBorder, flexDirection: "row", justifyContent: "space-between" }]}>
                <View>
                  <Text style={{ fontSize: 10, color: "#9FE3CE", fontFamily: Typography.bold }}>TOTAL QTY</Text>
                  <Text style={{ fontSize: 18, fontFamily: Typography.bold, color: "#FFFFFF" }}>
                    {ledgerTotals.qty.toLocaleString()}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 10, color: "#9FE3CE", fontFamily: Typography.bold }}>TOTAL VALUE</Text>
                  <Text style={{ fontSize: 18, fontFamily: Typography.bold, color: colors.brightMint }}>
                    {ledgerTotals.amtDisplay}
                  </Text>
                </View>
              </View>

              {ledgerRows.length === 0 ? (
                <Text style={{ color: colors.textMuted, textAlign: "center", padding: 30 }}>No records found.</Text>
              ) : (
                ledgerRows.map((row) => (
                  <View key={row.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, flex: 1, marginRight: 8 }}>
                        {row.party_name}
                      </Text>
                      <Text style={{ fontFamily: Typography.bold, color: colors.primary }}>
                        {row.amount_display}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
                      <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                        {row.date_display} · #{row.voucher_number} · Qty: {row.quantity}
                      </Text>
                      <View style={{ backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10.5, fontFamily: Typography.bold, color: colors.primary }}>
                          {row.salesperson}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.md, padding: 14, ...Shadows.card },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    height: 40,
  },
  label: { fontSize: 9.5, fontFamily: Typography.bold, marginBottom: 4 },
  dateInput: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12 },
  updateBtn: {
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignSelf: "flex-end",
    height: 35,
  },
  presetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 5,
    alignItems: "center",
  },
  kpiCard: { flex: 1, borderWidth: 1, borderRadius: Radius.md, padding: 10, ...Shadows.card },
  sectionTitle: { fontSize: 15, fontFamily: Typography.bold },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});
