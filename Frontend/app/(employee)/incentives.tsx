import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import api from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes } from "@/constants/theme";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

interface MilestoneUnlockBarProps {
  payable: number;
  potential: number;
  totalSales: number;
  isDark: boolean;
}

const MilestoneUnlockBar: React.FC<MilestoneUnlockBarProps> = ({
  payable,
  potential,
  totalSales,
}) => {
  const { t, isDark } = useEmployeeTheme();
  const pct =
    potential > 0
      ? Math.min(Math.round((payable / potential) * 100), 100)
      : totalSales > 0
      ? 50
      : 0;
  const remaining = Math.max(potential - payable, 0);
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    progressAnim.value = withSpring(pct / 100, { damping: 18, stiffness: 120 });
  }, [pct, progressAnim]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progressAnim.value * 100)}%`,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify().damping(18)}
      style={[
        styles.milestoneCard,
        {
          backgroundColor: t.surface,
          borderColor: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(0, 168, 121, 0.22)",
          borderTopColor: isDark ? "rgba(16, 185, 129, 0.45)" : "rgba(255, 255, 255, 0.98)",
          shadowColor: isDark ? "#000000" : "#0D2B20",
        },
      ]}
    >
      <View style={styles.milestoneHeader}>
        <View style={styles.milestoneTagRow}>
          <Ionicons name="flame" size={16} color={isDark ? "#10B981" : "#00A879"} />
          <Text style={[styles.milestoneTag, { color: isDark ? "#10B981" : "#00A879" }]}>
            MILESTONE UNLOCK SLAB
          </Text>
        </View>
        <View
          style={[
            styles.pctPill,
            { backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#DDF4EA" },
          ]}
        >
          <Text style={[styles.pctPillText, { color: isDark ? "#10B981" : "#00A879" }]}>
            {pct}% Unlocked
          </Text>
        </View>
      </View>

      {/* Progress Track with Glowing Tip */}
      <View
        style={[
          styles.milestoneTrack,
          { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E4ECE8" },
        ]}
      >
        <Animated.View
          style={[
            styles.milestoneFill,
            { backgroundColor: isDark ? "#10B981" : "#00A879" },
            fillStyle,
          ]}
        >
          <View style={styles.glowingTip} />
        </Animated.View>
      </View>

      {/* Motivating Micro-Copy */}
      <View style={styles.milestoneFooterRow}>
        <Text style={[styles.milestoneMotivText, { color: t.text }]} numberOfLines={1}>
          {remaining > 0
            ? `₹${remaining.toLocaleString("en-IN", { maximumFractionDigits: 0 })} more to unlock 100% potential payout`
            : "All eligible customer-paid incentives unlocked!"}
        </Text>
        <Text style={[styles.milestoneSub, { color: t.textSecondary }]}>
          {pct >= 80 ? "Top Performer Tier" : "Active Earning Cycle"}
        </Text>
      </View>
    </Animated.View>
  );
};

interface TactileSummaryCardProps {
  index: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: string;
  sub: string;
  isDark: boolean;
  valueColor?: string;
}

const TactileSummaryCard: React.FC<TactileSummaryCardProps> = ({
  index,
  label,
  icon,
  color,
  value,
  sub,
  valueColor,
}) => {
  const { t, isDark } = useEmployeeTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 16, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1.0, { damping: 18, stiffness: 280 });
  };
  const handlePress = () => {
    triggerLightHaptic();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).springify().damping(18)}
      style={[styles.summaryCardWrapper, animStyle]}
    >
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.summaryCard,
          {
            backgroundColor: t.surface,
            borderColor: t.border,
            borderLeftColor: color,
            borderLeftWidth: 4,
            borderTopColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.98)",
            shadowColor: isDark ? "#000000" : "#0D2B20",
          },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardHeaderLabel, { color }]}>{label}</Text>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.cardMainValue, { color: valueColor || (t.text) }]}>
          {value}
        </Text>
        <Text style={[styles.cardSubText, { color: t.textSecondary }]}>{sub}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
};

export default function IncentivesScreen() {
  const insets = useSafeAreaInsets();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
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
  const card = { backgroundColor: t.surface, borderColor: t.border };

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
        <SubAppHomeButton size={38} />
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

      {/* Swiggy-Style Milestone Unlock Bar */}
      <MilestoneUnlockBar
        payable={payableVal}
        potential={potentialVal}
        totalSales={totalSalesVal}
        isDark={isDark}
      />

      {/* 4-Card Tactile Summary Grid */}
      <View style={styles.summaryGrid}>
        <TactileSummaryCard
          index={0}
          label="READY TO RECEIVE"
          icon="wallet-outline"
          color={isDark ? "#10B981" : "#159A7C"}
          value={`₹${payableVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Payable from customer-paid invoices"
          isDark={isDark}
          valueColor={isDark ? "#10B981" : "#159A7C"}
        />
        <TactileSummaryCard
          index={1}
          label="TOTAL POTENTIAL"
          icon="trending-up-outline"
          color="#0EA5E9"
          value={`₹${potentialVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Gross calculated incentive volume"
          isDark={isDark}
        />
        <TactileSummaryCard
          index={2}
          label="PENDING INVOICES"
          icon="time-outline"
          color="#E34B59"
          value={`₹${pendingVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Awaiting customer payments"
          isDark={isDark}
          valueColor="#E34B59"
        />
        <TactileSummaryCard
          index={3}
          label="TOTAL SALES"
          icon="receipt-outline"
          color="#F59E0B"
          value={`₹${totalSalesVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Gross monthly tax invoices"
          isDark={isDark}
        />
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
  summaryCardWrapper: { width: "48%" },
  summaryCard: { width: "100%", borderWidth: 1.2, borderRadius: 16, padding: 12, minHeight: 104, justifyContent: "space-between", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHeaderLabel: { fontFamily: Typography.bold, fontSize: 9.5, letterSpacing: 0.5 },
  cardMainValue: { fontFamily: Typography.heading, fontSize: 18, marginVertical: 4 },
  cardSubText: { fontFamily: Typography.regular, fontSize: 10, lineHeight: 14 },
  milestoneCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 14,
    marginBottom: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  milestoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  milestoneTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  milestoneTag: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.6,
  },
  pctPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pctPillText: {
    fontSize: 10,
    fontFamily: Typography.bold,
  },
  milestoneTrack: {
    height: 7,
    borderRadius: 3.5,
    overflow: "hidden",
    position: "relative",
    marginBottom: 10,
  },
  milestoneFill: {
    height: "100%",
    borderRadius: 3.5,
    position: "relative",
  },
  glowingTip: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  milestoneFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  milestoneMotivText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.semiBold,
    flex: 1,
    marginRight: 6,
  },
  milestoneSub: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
  },
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
