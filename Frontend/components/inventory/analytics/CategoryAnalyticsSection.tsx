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
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import AppLineChart from "@/components/charts/AppLineChart";
import api from "@/services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CategoryOption {
  id: number;
  name: string;
  item_count: number;
}

interface CatProduct {
  id: number;
  name: string;
  unit: string;
  category: string;
  current_stock: number;
  is_dead: boolean;
  growth_3m: number | null;
  avg_daily: number;
  recent_qty: number;
}

interface ProductIntelDetail {
  item: { id: number; name: string; category: string; unit: string; quantity: number };
  avg_daily: number;
  is_dead: boolean;
  growth: {
    g1m: number | null;
    g3m: number | null;
    g6m: number | null;
    g1y: number | null;
    r1m: number; p1m: number;
    r3m: number; p3m: number;
    r6m: number; p6m: number;
    r1y: number; p1y: number;
  };
  monthly_sales: { month: string; qty: number }[];
  daily_sales: { date: string; qty: number }[];
  summary: {
    total_customers_ever: number;
    active_customers_recent: number;
    churned_count: number;
    declining_count: number;
    rising_count: number;
  };
  top_customers: {
    name: string;
    alltime_qty: number;
    recent_qty: number;
    prior_qty: number;
    monthly_trend: { month: string; qty: number }[];
  }[];
  churned: {
    name: string;
    prior_qty: number;
    alltime_qty: number;
    last_purchase: string;
    days_since: number | null;
    status: string;
  }[];
  declining: {
    name: string;
    recent_qty: number;
    prior_qty: number;
    drop_pct: number;
    severity: string;
  }[];
  rising: {
    name: string;
    recent_qty: number;
    prior_qty: number;
    rise_pct: number | null;
    is_new: boolean;
    type: string;
  }[];
}

export function CategoryAnalyticsSection() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedCatName, setSelectedCatName] = useState<string | null>(null);
  const [products, setProducts] = useState<CatProduct[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [prodSearch, setProdSearch] = useState("");

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ProductIntelDetail | null>(null);
  const [chartTab, setChartTab] = useState<"monthly" | "daily">("monthly");
  const [custTab, setCustTab] = useState<"top" | "churned" | "declining" | "rising">("top");

  const fetchCategory = useCallback(async (catId?: number) => {
    try {
      setLoading(true);
      const res = await api.get("/inventory/analytics/category/", {
        params: catId ? { category_id: catId } : {},
      });
      if (res.data?.status === "success") {
        setCategories(res.data.categories || []);
        setSelectedCatId(res.data.selected_category_id || null);
        setSelectedCatName(res.data.selected_category_name || null);
        setProducts(res.data.products ?? null);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load category analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  const openProductDetail = async (p: CatProduct) => {
    setDetailModalOpen(true);
    setChartTab("monthly");
    setCustTab("top");
    try {
      setDetailLoading(true);
      const res = await api.get(`/inventory/analytics/product/${p.id}/`);
      if (res.data?.status === "success") {
        setDetail(res.data);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load product intelligence.");
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredCats = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase().trim())
  );

  const visibleProducts = (products || []).filter((p) =>
    !prodSearch.trim() ? true : p.name.toLowerCase().includes(prodSearch.toLowerCase().trim())
  );

  const rawSeries = detail
    ? chartTab === "monthly"
      ? detail.monthly_sales.slice(-12)
      : detail.daily_sales.slice(-30)
    : [];
  const step = Math.max(1, Math.floor(rawSeries.length / 6));
  const chartPoints = rawSeries.filter((_, i) => i % step === 0 || i === rawSeries.length - 1);
  const chartLabels = chartPoints.map((pt: any) =>
    chartTab === "monthly" ? pt.month.slice(2) : pt.date.slice(5)
  );
  const chartValues = chartPoints.map((pt: any) => pt.qty || 0);

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, gap: 10 }]}>
        <Text style={{ fontSize: 13.5, fontFamily: Typography.bold, color: colors.textPrimary }}>
          Category Product Intelligence
        </Text>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          Choose a category to inspect 3-month product growth and customer retention breakdown.
        </Text>

        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          style={[styles.selectRow, { backgroundColor: colors.secondarySurface, borderColor: colors.cardBorder }]}
        >
          <Ionicons name="grid-outline" size={16} color={colors.primary} />
          <Text style={{ flex: 1, color: selectedCatName ? colors.textPrimary : colors.textMuted, fontFamily: Typography.bold, fontSize: 13 }}>
            {selectedCatName ? selectedCatName : "— Select category —"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {products !== null && (
          <View style={[styles.searchRow, { backgroundColor: colors.secondarySurface, borderColor: colors.cardBorder }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              placeholder="Filter products in category..."
              placeholderTextColor={colors.textMuted}
              value={prodSearch}
              onChangeText={setProdSearch}
              style={{ flex: 1, color: colors.textPrimary, fontSize: 13 }}
            />
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ padding: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Loading category analytics...</Text>
        </View>
      ) : products === null ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="bar-chart-outline" size={38} color={colors.primary} />
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>Select a Category</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
            Choose a category above to load product growth rates and customer intelligence.
          </Text>
        </View>
      ) : visibleProducts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="cube-outline" size={34} color={colors.textMuted} />
          <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: colors.textPrimary }}>No Products Found</Text>
        </View>
      ) : (
        visibleProducts.map((p) => {
          let badgeText = "—";
          let badgeBg = colors.warningBg;
          let badgeColor = colors.warning;
          if (p.is_dead) {
            badgeText = "DEAD";
            badgeBg = colors.secondarySurface;
            badgeColor = colors.textMuted;
          } else if (p.growth_3m !== null) {
            if (p.growth_3m >= 20) {
              badgeText = `▲ ${p.growth_3m}%`;
              badgeBg = colors.successBg;
              badgeColor = colors.success;
            } else if (p.growth_3m <= -10) {
              badgeText = `▼ ${Math.abs(p.growth_3m)}%`;
              badgeBg = colors.errorBg;
              badgeColor = colors.error;
            } else {
              badgeText = `${p.growth_3m}%`;
            }
          }

          return (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.8}
              onPress={() => openProductDetail(p)}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: p.is_dead ? 0.74 : 1 },
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, fontFamily: Typography.bold, color: colors.textPrimary }}>
                  {p.name}
                </Text>
                <View style={{ backgroundColor: badgeBg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.pill }}>
                  <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: badgeColor }}>{badgeText}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Stock: <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>{p.current_stock} {p.unit}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Avg/day: <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>{p.avg_daily}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  90d Sold: <Text style={{ fontFamily: Typography.bold, color: colors.primary }}>{p.recent_qty}</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {/* Category Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>Select Category</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 12 }}>
            <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Search category..."
                placeholderTextColor={colors.textMuted}
                value={catSearch}
                onChangeText={setCatSearch}
                style={{ flex: 1, color: colors.textPrimary, fontSize: 13 }}
              />
            </View>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 8 }}>
            {filteredCats.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  setPickerVisible(false);
                  fetchCategory(c.id);
                }}
                style={[styles.card, { backgroundColor: colors.card, borderColor: c.id === selectedCatId ? colors.primary : colors.cardBorder, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
              >
                <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>{c.name}</Text>
                <Text style={{ fontFamily: Typography.bold, color: colors.primary, fontSize: 12 }}>
                  {c.item_count} products
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Product Intelligence Detail Modal */}
      <Modal visible={detailModalOpen} animationType="slide" onRequestClose={() => setDetailModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 10, fontFamily: Typography.bold, color: colors.primary }}>
                PRODUCT INTELLIGENCE · {detail?.item.category || ""}
              </Text>
              <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: colors.textPrimary }} numberOfLines={1}>
                {detail?.item.name || "Loading..."}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setDetailModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {detailLoading || !detail ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 14 }}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                    Stock: <Text style={{ fontFamily: Typography.bold }}>{detail.item.quantity} {detail.item.unit}</Text> · Avg Daily:{" "}
                    <Text style={{ fontFamily: Typography.bold }}>{detail.avg_daily}</Text>
                  </Text>
                  {detail.is_dead && (
                    <View style={{ backgroundColor: colors.warningBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill }}>
                      <Text style={{ fontSize: 10.5, fontFamily: Typography.bold, color: colors.warning }}>
                        No sales in 90d
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <GrowthMiniCard label="1 MONTH" pct={detail.growth.g1m} sub={`${detail.growth.r1m} vs ${detail.growth.p1m}`} />
                <GrowthMiniCard label="3 MONTHS" pct={detail.growth.g3m} sub={`${detail.growth.r3m} vs ${detail.growth.p3m}`} />
                <GrowthMiniCard label="6 MONTHS" pct={detail.growth.g6m} sub={`${detail.growth.r6m} vs ${detail.growth.p6m}`} />
                <GrowthMiniCard label="1 YEAR" pct={detail.growth.g1y} sub={`${detail.growth.r1y} vs ${detail.growth.p1y}`} />
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 10 }]}>Customer Summary</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <StatMini label="Total" value={detail.summary.total_customers_ever} color={colors.textPrimary} />
                  <StatMini label="Active 90d" value={detail.summary.active_customers_recent} color={colors.success} />
                  <StatMini label="Churned" value={detail.summary.churned_count} color={colors.error} />
                  <StatMini label="Declining" value={detail.summary.declining_count} color={colors.warning} />
                  <StatMini label="Rising" value={detail.summary.rising_count} color={colors.primary} />
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Sales History</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(["monthly", "daily"] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setChartTab(t)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: Radius.pill,
                          backgroundColor: chartTab === t ? colors.primary : colors.secondarySurface,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: chartTab === t ? "#FFF" : colors.textMuted }}>
                          {t === "monthly" ? "Monthly" : "Daily 90d"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {chartPoints.length >= 2 ? (
                  <AppLineChart
                    data={{
                      labels: chartLabels,
                      datasets: [{ data: chartValues, color: () => colors.primary, strokeWidth: 2 }],
                    }}
                    width={SCREEN_WIDTH - 64}
                    height={175}
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
                ) : (
                  <Text style={{ color: colors.textMuted, fontSize: 12, paddingVertical: 16 }}>
                    Not enough chart points for this view.
                  </Text>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 10 }]}>Customer Intelligence</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                  {[
                    { id: "top" as const, label: `Top (${detail.top_customers.length})` },
                    { id: "churned" as const, label: `Churned (${detail.summary.churned_count})` },
                    { id: "declining" as const, label: `Declining (${detail.summary.declining_count})` },
                    { id: "rising" as const, label: `Rising/New (${detail.summary.rising_count})` },
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setCustTab(tab.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: Radius.pill,
                        borderWidth: 1,
                        borderColor: custTab === tab.id ? colors.primary : colors.cardBorder,
                        backgroundColor: custTab === tab.id ? colors.primary : colors.secondarySurface,
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: custTab === tab.id ? "#FFF" : colors.textMuted }}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {custTab === "top" && (
                  detail.top_customers.length === 0 ? (
                    <Text style={{ color: colors.textMuted, paddingVertical: 12 }}>No customers found.</Text>
                  ) : (
                    detail.top_customers.map((c, idx) => {
                      const maxMonth = Math.max(1, ...c.monthly_trend.map((m) => m.qty));
                      return (
                        <View
                          key={idx}
                          style={{ paddingVertical: 10, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.cardBorder }}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, flex: 1, marginRight: 8 }}>
                              #{idx + 1} {c.name}
                            </Text>
                            <Text style={{ fontFamily: Typography.bold, color: colors.primary }}>
                              {c.alltime_qty} total
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                            <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                              90d: {c.recent_qty} · Prior: {c.prior_qty}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 22 }}>
                              {c.monthly_trend.map((m, mi) => (
                                <View
                                  key={mi}
                                  style={{
                                    width: 5,
                                    height: Math.max(2, (m.qty / maxMonth) * 20),
                                    backgroundColor: mi >= 9 ? colors.brightMint : colors.primary,
                                    borderRadius: 1,
                                  }}
                                />
                              ))}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )
                )}

                {custTab === "churned" && (
                  detail.churned.length === 0 ? (
                    <Text style={{ color: colors.success, paddingVertical: 12 }}>No churned customers — all still buying.</Text>
                  ) : (
                    detail.churned.map((c, idx) => (
                      <View
                        key={idx}
                        style={{ paddingVertical: 10, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.cardBorder }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, flex: 1, marginRight: 8 }}>{c.name}</Text>
                          <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.error }}>{c.status}</Text>
                        </View>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>
                          All-time: {c.alltime_qty} · Last: {c.last_purchase} ({c.days_since ?? "—"}d ago)
                        </Text>
                      </View>
                    ))
                  )
                )}

                {custTab === "declining" && (
                  detail.declining.length === 0 ? (
                    <Text style={{ color: colors.success, paddingVertical: 12 }}>No customers with &gt;50% drop in buying.</Text>
                  ) : (
                    detail.declining.map((c, idx) => (
                      <View
                        key={idx}
                        style={{ paddingVertical: 10, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.cardBorder }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, flex: 1, marginRight: 8 }}>{c.name}</Text>
                          <Text style={{ fontFamily: Typography.bold, color: colors.error }}>▼ {c.drop_pct}% ({c.severity})</Text>
                        </View>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>
                          Last 90d: {c.recent_qty} vs Prior 90d: {c.prior_qty}
                        </Text>
                      </View>
                    ))
                  )
                )}

                {custTab === "rising" && (
                  detail.rising.length === 0 ? (
                    <Text style={{ color: colors.textMuted, paddingVertical: 12 }}>No significantly rising customers in last 90d.</Text>
                  ) : (
                    detail.rising.map((c, idx) => (
                      <View
                        key={idx}
                        style={{ paddingVertical: 10, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.cardBorder }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, flex: 1, marginRight: 8 }}>{c.name}</Text>
                          <Text style={{ fontFamily: Typography.bold, color: colors.success }}>
                            {c.rise_pct !== null ? `▲ ${c.rise_pct}%` : "New"} ({c.type})
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>
                          Last 90d: {c.recent_qty} vs Prior 90d: {c.prior_qty}
                        </Text>
                      </View>
                    ))
                  )
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

function GrowthMiniCard({
  label,
  pct,
  sub,
}: {
  label: string;
  pct: number | null;
  sub: string;
}) {
  const { colors } = useTheme();
  const color = pct === null ? colors.textMuted : pct >= 0 ? colors.success : colors.error;
  return (
    <View style={{ width: "48%", backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: Radius.md, padding: 12 }}>
      <Text style={{ fontSize: 10, fontFamily: Typography.bold, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 20, fontFamily: Typography.bold, color, marginVertical: 2 }}>
        {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct}%`}
      </Text>
      <Text style={{ fontSize: 11, color: colors.textMuted }}>{sub}</Text>
    </View>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 17, fontFamily: Typography.bold, color }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.md, padding: 14, ...Shadows.card },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    height: 40,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 14.5, fontFamily: Typography.bold },
});
