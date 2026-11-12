import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography } from "@/constants/theme";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";

type IncentiveRow = {
  id: string;
  date: string;
  customer: string;
  voucher: string;
  product: string;
  quantity: string | number;
  amount: string | number;
  paid: boolean;
  has_incentive: boolean;
};

type ProductTotal = {
  name: string;
  quantity: string | number;
  rate: string | number;
  potential: string | number;
  payable: string | number;
};

type IncentiveSummary = {
  potential: string | number;
  payable: string | number;
  pending: string | number;
  total_sales: string | number;
};

export default function IncentivesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [reportMonth, setReportMonth] = useState(() => new Date());
  const monthKey = `${reportMonth.getFullYear()}-${String(reportMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = reportMonth.toLocaleString("default", { month: "long", year: "numeric" });

  const [rows, setRows] = useState<IncentiveRow[]>([]);
  const [products, setProducts] = useState<ProductTotal[]>([]);
  const [summary, setSummary] = useState<IncentiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/customers/workspace/my-incentives/", {
        params: { month_picker: monthKey },
      });
      const data = res?.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
      setSummary(data.summary || null);
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 403
          ? "Incentive data is not available for this account."
          : "Could not load incentives. Check your connection and retry."
      );
      setRows([]);
      setProducts([]);
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeMonth = (delta: number) => {
    setReportMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const foreground = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";
  const card = { backgroundColor: isDark ? "#111B18" : "#FFFFFF", borderColor: isDark ? "#263A32" : "#E4EAF0" };

  const potentialVal = Number(summary?.potential || 0);
  const payableVal = Number(summary?.payable || 0);
  const pendingVal = Number(summary?.pending || 0);
  const totalSalesVal = Number(summary?.total_sales || 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 110 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      {/* Top Header */}
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.back, card]}>
          <Ionicons name="arrow-back" size={20} color={foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>OBLU INCENTIVE ENGINE</Text>
          <Text style={[styles.title, { color: foreground }]}>My Incentives</Text>
        </View>
      </View>

      {/* Month Navigator */}
      <View style={[styles.monthNav, card]}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={foreground} />
        </TouchableOpacity>
        <View style={styles.monthCenter}>
          <Ionicons name="calendar-outline" size={16} color="#159A7C" />
          <Text style={[styles.monthText, { color: foreground }]}>{monthLabel}</Text>
        </View>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={foreground} />
        </TouchableOpacity>
      </View>

      {error ? (
        <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={[styles.notice, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}>
          <Text style={{ color: foreground, fontFamily: Typography.regular }}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}

      {/* 4-Card Summary Grid (Matching asm_incentive_monthly.html) */}
      <View style={styles.summaryGrid}>
        {/* Card 1: Net Payable Incentive */}
        <View style={[styles.summaryCard, card, { borderLeftColor: "#159A7C", borderLeftWidth: 4 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardHeaderLabel, { color: "#159A7C" }]}>READY TO RECEIVE</Text>
            <Ionicons name="wallet-outline" size={18} color="#159A7C" />
          </View>
          <Text style={[styles.cardMainValue, { color: "#159A7C" }]}>
            ₹{payableVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.cardSubText, { color: muted }]}>Payable from customer-paid invoices</Text>
        </View>

        {/* Card 2: Current Potential */}
        <View style={[styles.summaryCard, card, { borderLeftColor: "#0EA5E9", borderLeftWidth: 4 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardHeaderLabel, { color: "#0EA5E9" }]}>TOTAL POTENTIAL</Text>
            <Ionicons name="trending-up-outline" size={18} color="#0EA5E9" />
          </View>
          <Text style={[styles.cardMainValue, { color: foreground }]}>
            ₹{potentialVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.cardSubText, { color: muted }]}>Gross calculated incentive volume</Text>
        </View>

        {/* Card 3: Pending Payout */}
        <View style={[styles.summaryCard, card, { borderLeftColor: "#E34B59", borderLeftWidth: 4 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardHeaderLabel, { color: "#E34B59" }]}>PENDING INVOICES</Text>
            <Ionicons name="time-outline" size={18} color="#E34B59" />
          </View>
          <Text style={[styles.cardMainValue, { color: "#E34B59" }]}>
            ₹{pendingVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.cardSubText, { color: muted }]}>Awaiting customer payments</Text>
        </View>

        {/* Card 4: Total Revenue Sales */}
        <View style={[styles.summaryCard, card, { borderLeftColor: "#F59E0B", borderLeftWidth: 4 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardHeaderLabel, { color: "#F59E0B" }]}>TOTAL SALES</Text>
            <Ionicons name="receipt-outline" size={18} color="#F59E0B" />
          </View>
          <Text style={[styles.cardMainValue, { color: foreground }]}>
            ₹{totalSalesVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.cardSubText, { color: muted }]}>Gross monthly tax invoices</Text>
        </View>
      </View>

      {/* Product Breakdown Section (Matching Table on Web) */}
      {products.length > 0 && (
        <View style={[styles.section, card]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pricetags-outline" size={17} color="#159A7C" />
            <Text style={[styles.sectionTitle, { color: foreground }]}>Incentive by Product</Text>
          </View>
          <View style={styles.productTable}>
            {products.map((p, idx) => (
              <View key={`prod-${idx}`} style={[styles.productTableRow, { borderColor: card.borderColor }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prodName, { color: foreground }]}>{p.name}</Text>
                  <Text style={[styles.prodMeta, { color: muted }]}>
                    Paid Qty: {p.quantity} · Rate: ₹{p.rate}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.prodPayable, { color: "#159A7C" }]}>
                    Payable: ₹{Number(p.payable || 0).toLocaleString("en-IN")}
                  </Text>
                  <Text style={[styles.prodPotential, { color: muted }]}>
                    Potential: ₹{Number(p.potential || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Transaction Log Section */}
      <View style={[styles.section, card]}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="list-outline" size={17} color="#159A7C" />
          <Text style={[styles.sectionTitle, { color: foreground }]}>
            Transaction Log ({rows.length})
          </Text>
        </View>

        {loading ? (
          <SkeletonCardList count={4} height={82} />
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <View key={row.id} style={[styles.trxCard, { borderColor: card.borderColor }]}>
              <View style={styles.trxHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trxCustomer, { color: foreground }]} numberOfLines={1}>
                    {row.customer}
                  </Text>
                  <Text style={[styles.trxDate, { color: muted }]}>
                    {row.date} · Inv #{row.voucher}
                  </Text>
                </View>
                <View style={[styles.paidBadge, { backgroundColor: row.paid ? "rgba(21, 154, 124, 0.12)" : "rgba(227, 75, 89, 0.12)" }]}>
                  <Text style={[styles.paidBadgeText, { color: row.paid ? "#159A7C" : "#E34B59" }]}>
                    {row.paid ? "CUSTOMER PAID" : "UNPAID"}
                  </Text>
                </View>
              </View>

              <View style={[styles.trxBody, { backgroundColor: isDark ? "#0A100E" : "#F8FAF9" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trxProduct, { color: row.has_incentive ? "#159A7C" : "#D97706" }]}>
                    {row.product}
                  </Text>
                  <Text style={[styles.trxQty, { color: muted }]}>Qty: {row.quantity}</Text>
                </View>
                <Text style={[styles.trxAmount, { color: foreground }]}>
                  ₹{Number(row.amount || 0).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={32} color={muted} />
            <Text style={[styles.emptyText, { color: foreground }]}>No incentive transactions for {monthLabel}</Text>
            <Text style={[styles.emptySub, { color: muted }]}>Sales vouchers for this period will appear here once processed.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  back: { borderWidth: 1, width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#20B99A", fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: Typography.heading, fontSize: 24, marginTop: 2 },
  notice: { padding: 12, borderRadius: 12 },
  monthNav: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthArrow: { padding: 8 },
  monthCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthText: { fontFamily: Typography.semiBold, fontSize: 14 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  summaryCard: { width: "48%", borderWidth: 1, borderRadius: 16, padding: 12, minHeight: 100, justifyContent: "space-between" },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHeaderLabel: { fontFamily: Typography.bold, fontSize: 9.5, letterSpacing: 0.5 },
  cardMainValue: { fontFamily: Typography.heading, fontSize: 18, marginVertical: 4 },
  cardSubText: { fontFamily: Typography.regular, fontSize: 10, lineHeight: 14 },
  section: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: Typography.headingSemi, fontSize: 15 },
  productTable: { gap: 8 },
  productTableRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prodName: { fontFamily: Typography.semiBold, fontSize: 13 },
  prodMeta: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  prodPayable: { fontFamily: Typography.bold, fontSize: 12 },
  prodPotential: { fontFamily: Typography.regular, fontSize: 10.5, marginTop: 2 },
  trxCard: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 8 },
  trxHeader: { padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  trxCustomer: { fontFamily: Typography.semiBold, fontSize: 13 },
  trxDate: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  paidBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  paidBadgeText: { fontFamily: Typography.bold, fontSize: 9.5 },
  trxBody: { paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trxProduct: { fontFamily: Typography.semiBold, fontSize: 12 },
  trxQty: { fontFamily: Typography.regular, fontSize: 11, marginTop: 1 },
  trxAmount: { fontFamily: Typography.bold, fontSize: 13 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 6 },
  emptyText: { fontFamily: Typography.semiBold, fontSize: 14 },
  emptySub: { fontFamily: Typography.regular, fontSize: 11, textAlign: "center" },
});
