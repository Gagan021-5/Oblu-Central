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
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";
import { CategoryOption, POPlannerProduct, POPlannerSummary } from "./types";
import {
  POPlannerMathModal,
  POPlannerSalesModal,
  POPlannerTopCustomersModal,
  POPlannerHistoryModal,
} from "./POPlannerModals";

export function POPlannerSection() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [pickedCat, setPickedCat] = useState<CategoryOption | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [hideDead, setHideDead] = useState(false);

  const [products, setProducts] = useState<POPlannerProduct[] | null>(null);
  const [summary, setSummary] = useState<POPlannerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "urgent" | "warn" | "ok" | "dead">("all");

  // Drilldown Modals
  const [mathProduct, setMathProduct] = useState<POPlannerProduct | null>(null);
  const [salesProduct, setSalesProduct] = useState<POPlannerProduct | null>(null);
  const [topCustTarget, setTopCustTarget] = useState<{ id: number; name: string } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{
    title: string;
    name: string;
    unit: string;
    rows: any[];
  } | null>(null);

  const fetchPlanner = useCallback(async (catId: number | null, hideDeadFlag: boolean) => {
    try {
      setLoading(true);
      const params: any = { hide_dead: hideDeadFlag ? "1" : "0" };
      if (catId) params.category_id = catId;
      const res = await api.get("/inventory/po-planner/", { params });
      if (res.data?.status === "success") {
        setCategories(res.data.categories || []);
        setSelectedCategoryId(res.data.selected_category_id || null);
        setSelectedCategoryName(res.data.selected_category_name || null);
        setProducts(res.data.products ?? null);
        setSummary(res.data.summary ?? null);
      }
    } catch (err: any) {
      Alert.alert("PO Planner Error", err?.response?.data?.message || err?.message || "Failed to load PO analysis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanner(null, false);
  }, [fetchPlanner]);

  const handleLoadCategory = () => {
    if (!pickedCat) {
      Alert.alert("Select Category", "Please choose a product category first.");
      return;
    }
    fetchPlanner(pickedCat.id, hideDead);
  };

  const handleSwitchCategory = (cat: CategoryOption) => {
    setPickedCat(cat);
    setPickerVisible(false);
    if (selectedCategoryId !== null) {
      fetchPlanner(cat.id, hideDead);
    }
  };

  const handleToggleHideDead = () => {
    const next = !hideDead;
    setHideDead(next);
    if (selectedCategoryId) {
      fetchPlanner(selectedCategoryId, next);
    }
  };

  const handleToggleNewProduct = async (itemId: number) => {
    try {
      setTogglingId(itemId);
      const res = await api.post(`/inventory/po-planner/toggle-new-product/${itemId}/`);
      if (res.data?.status === "success" && selectedCategoryId) {
        await fetchPlanner(selectedCategoryId, hideDead);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not update new product flag.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleExportCSV = async () => {
    if (!products || products.length === 0) return;
    const headers = [
      "Product",
      "Unit",
      "Stock",
      "Avg/day",
      "Growth 1Y",
      "Growth 3M",
      "M+1",
      "M+2",
      "M+3",
      "Dead?",
      "Order Qty",
      "Runway Months",
    ];
    const rows = products.map((p) => [
      `"${(p.name || "").replace(/"/g, "'")}"`,
      `"${p.unit || ""}"`,
      Math.round(p.current_stock),
      p.avg_daily,
      p.growth_1y ?? "N/A",
      p.growth_3m ?? "N/A",
      p.pred_m1 ?? "-",
      p.pred_m2 ?? "-",
      p.pred_m3 ?? "-",
      p.is_dead ? "Yes" : "No",
      p.order_final,
      p.months_of_stock ?? "N/A",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    try {
      await Share.share({
        title: `PO Planner - ${selectedCategoryName || "Category"}.csv`,
        message: csv,
      });
    } catch {
      // cancelled
    }
  };

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const cardBorder = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";

  const filteredCats = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase().trim())
  );

  // Category Selector View (when no category is loaded yet, exact match to web!)
  if (products === null) {
    return (
      <View style={{ paddingVertical: 12 }}>
        <View style={[styles.generatorCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.generatorIconWrap}>
            <Ionicons name="cube" size={34} color="#00A879" />
          </View>
          <Text style={[styles.generatorTitle, { color: fg }]}>Purchase Order Generator</Text>
          <Text style={[styles.generatorSub, { color: muted }]}>
            Select a product category to load the purchase order analysis.
          </Text>

          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            style={[
              styles.selectBox,
              {
                backgroundColor: isDark ? "#0A1310" : "#F8FAFC",
                borderColor: cardBorder,
              },
            ]}
          >
            <Text style={{ color: pickedCat ? fg : muted, fontFamily: Typography.medium, flex: 1 }}>
              {pickedCat ? `${pickedCat.name} (${pickedCat.item_count})` : "— Select a category —"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLoadCategory}
            disabled={loading || !pickedCat}
            style={[
              styles.loadBtn,
              { opacity: loading || !pickedCat ? 0.55 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loadBtnText}>Load Products</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <CategoryPickerModal
          visible={pickerVisible}
          categories={filteredCats}
          search={catSearch}
          onChangeSearch={setCatSearch}
          onSelect={handleSwitchCategory}
          onClose={() => setPickerVisible(false)}
          insets={insets}
        />
      </View>
    );
  }

  const visibleProducts = (products || []).filter((p) => {
    if (urgencyFilter !== "all" && p.order_urgency !== urgencyFilter) return false;
    if (prodSearch.trim()) {
      const q = prodSearch.toLowerCase().trim();
      return p.name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <View style={{ gap: 12 }}>
      {/* Header Controls */}
      <View style={[styles.controlCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            style={[styles.catSwitchBtn, { borderColor: cardBorder, backgroundColor: isDark ? "#0A1310" : "#F8FAFC" }]}
          >
            <Ionicons name="layers-outline" size={15} color="#00A879" />
            <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 13, flex: 1 }} numberOfLines={1}>
              {selectedCategoryName || "Category"}
            </Text>
            <Ionicons name="chevron-down" size={15} color={muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportCSV}
            style={[styles.csvBtn, { backgroundColor: "#10B981" }]}
          >
            <Ionicons name="download-outline" size={15} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 12 }}>CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <View style={[styles.searchInputWrap, { flex: 1, borderColor: cardBorder, backgroundColor: isDark ? "#0A1310" : "#F8FAFC" }]}>
            <Ionicons name="search" size={15} color={muted} />
            <TextInput
              placeholder="Search products in category..."
              placeholderTextColor={muted}
              value={prodSearch}
              onChangeText={setProdSearch}
              style={{ flex: 1, color: fg, fontSize: 12.5, paddingVertical: 6 }}
            />
            {prodSearch.length > 0 && (
              <TouchableOpacity onPress={() => setProdSearch("")}>
                <Ionicons name="close-circle" size={16} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={handleToggleHideDead}
            style={[
              styles.deadToggleBtn,
              {
                borderColor: hideDead ? "#EF4444" : cardBorder,
                backgroundColor: hideDead ? "rgba(239,68,68,0.12)" : cardBg,
              },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: hideDead ? "#EF4444" : fg }}>
              {hideDead ? "Show Dead" : "Hide Dead"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Strip */}
      {summary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <SummaryChip label="TOTAL" value={summary.total_products} color={fg} bg={cardBg} border={cardBorder} muted={muted} active={urgencyFilter === "all"} onPress={() => setUrgencyFilter("all")} />
          <SummaryChip label="URGENT" value={summary.urgent_count} color="#EF4444" bg={cardBg} border={cardBorder} muted={muted} active={urgencyFilter === "urgent"} onPress={() => setUrgencyFilter(urgencyFilter === "urgent" ? "all" : "urgent")} />
          <SummaryChip label="NEED ORDER" value={summary.warn_count} color="#F59E0B" bg={cardBg} border={cardBorder} muted={muted} active={urgencyFilter === "warn"} onPress={() => setUrgencyFilter(urgencyFilter === "warn" ? "all" : "warn")} />
          <SummaryChip label="DEAD STOCK" value={summary.dead_count} color="#8B5CF6" bg={cardBg} border={cardBorder} muted={muted} active={urgencyFilter === "dead"} onPress={() => setUrgencyFilter(urgencyFilter === "dead" ? "all" : "dead")} />
          <SummaryChip label="OVERSTOCK" value={summary.overstocked_count} color="#6366F1" bg={cardBg} border={cardBorder} muted={muted} />
          <SummaryChip label="SUFFICIENT" value={summary.ok_count} color="#10B981" bg={cardBg} border={cardBorder} muted={muted} active={urgencyFilter === "ok"} onPress={() => setUrgencyFilter(urgencyFilter === "ok" ? "all" : "ok")} />
        </ScrollView>
      )}

      {loading ? (
        <View style={{ padding: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color="#00A879" />
          <Text style={{ color: muted, fontSize: 13 }}>Running PO demand & forecasting simulation...</Text>
        </View>
      ) : visibleProducts.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="cube-outline" size={34} color={muted} />
          <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 15 }}>No Products Found</Text>
          <Text style={{ color: muted, fontSize: 12, textAlign: "center" }}>
            Try another urgency filter, search term, or switch category.
          </Text>
        </View>
      ) : (
        visibleProducts.map((p) => {
          const urgencyColor =
            p.order_urgency === "urgent"
              ? "#EF4444"
              : p.order_urgency === "warn"
              ? "#F59E0B"
              : p.order_urgency === "dead"
              ? "#94A3B8"
              : "#10B981";

          return (
            <View
              key={p.id}
              style={[
                styles.productCard,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  borderLeftWidth: 4,
                  borderLeftColor: urgencyColor,
                  opacity: p.is_dead ? 0.78 : 1,
                },
              ]}
            >
              {/* Product Top Row */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prodTitle, { color: fg }]}>{p.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {!!p.unit && (
                      <View style={[styles.unitBadge, { backgroundColor: isDark ? "#1E332D" : "#F1F5F9" }]}>
                        <Text style={{ fontSize: 10, color: muted, fontFamily: Typography.bold }}>{p.unit}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      disabled={togglingId === p.id}
                      onPress={() => handleToggleNewProduct(p.id)}
                      style={[
                        styles.newProdBtn,
                        {
                          backgroundColor: p.is_new_product ? "rgba(16,185,129,0.12)" : "rgba(139,92,246,0.1)",
                          borderColor: p.is_new_product ? "#86EFAC" : "#C4B5FD",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: Typography.bold,
                          color: p.is_new_product ? "#10B981" : "#7C3AED",
                        }}
                      >
                        {togglingId === p.id
                          ? "Updating..."
                          : p.is_new_product
                          ? "New Product: ON"
                          : "New Product: OFF"}
                      </Text>
                    </TouchableOpacity>
                    <View
                      style={[
                        styles.statusTag,
                        { backgroundColor: p.is_dead ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)" },
                      ]}
                    >
                      <Text style={{ fontSize: 10, fontFamily: Typography.bold, color: p.is_dead ? "#EF4444" : "#10B981" }}>
                        {p.is_dead ? "Dead Stock (90d+)" : "Active"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 18, fontFamily: Typography.bold, color: fg }}>
                    {Math.round(p.current_stock)}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: muted }}>
                    avg {p.avg_daily}/day
                  </Text>
                  <Text style={{ fontSize: 9.5, color: p.is_new_product && p.landing_date ? "#10B981" : "#6366F1" }}>
                    {p.is_new_product && p.landing_date ? `Since ${p.landing_date}` : "(Tally Apr-25)"}
                  </Text>
                </View>
              </View>

              {/* Growth & Forecast Strip */}
              <View style={[styles.metricsGrid, { backgroundColor: isDark ? "#0A1310" : "#F8FAFC", borderColor: cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: muted }]}>GROWTH (1Y / 3M)</Text>
                  <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: fg }}>
                    1Y: {p.growth_1y !== null ? `${p.growth_1y >= 0 ? "+" : ""}${p.growth_1y}%` : "N/A"}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: fg }}>
                    3M: {p.growth_3m !== null ? `${p.growth_3m >= 0 ? "+" : ""}${p.growth_3m}%` : "N/A"}
                  </Text>
                  {p.monthly_growth_rate_pct !== 0 && (
                    <Text style={{ fontSize: 10, color: muted }}>Blended {p.monthly_growth_rate_pct}%/mo</Text>
                  )}
                </View>
                <View style={[styles.vDivider, { backgroundColor: cardBorder }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: muted }]}>3M FORECAST</Text>
                  {p.pred_m1 !== null ? (
                    <>
                      <Text style={{ fontSize: 11.5, color: fg }}>
                        M+1: <Text style={{ fontFamily: Typography.bold, color: "#6366F1" }}>{p.pred_m1}</Text>
                      </Text>
                      <Text style={{ fontSize: 11.5, color: fg }}>
                        M+2: <Text style={{ fontFamily: Typography.bold, color: "#6366F1" }}>{p.pred_m2}</Text>
                      </Text>
                      <Text style={{ fontSize: 11.5, color: fg }}>
                        M+3: <Text style={{ fontFamily: Typography.bold, color: "#6366F1" }}>{p.pred_m3}</Text>
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 11, color: muted, fontStyle: "italic" }}>
                      {p.is_dead ? "Dead stock" : "No data"}
                    </Text>
                  )}
                </View>
                <View style={[styles.vDivider, { backgroundColor: cardBorder }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: muted }]}>RUNWAY</Text>
                  {p.months_of_stock !== null ? (
                    <>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: Typography.bold,
                          color:
                            p.months_of_stock >= 3
                              ? "#10B981"
                              : p.months_of_stock >= 1
                              ? "#F59E0B"
                              : "#EF4444",
                        }}
                      >
                        {p.months_of_stock} mo
                      </Text>
                      <Text style={{ fontSize: 10, color: muted }}>
                        {p.is_overstocked ? "Overstocked (9m+)" : p.months_of_stock >= 3 ? "Comfortable" : p.months_of_stock >= 1 ? "Getting low" : "Very low"}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 11, color: muted }}>No sales</Text>
                  )}
                </View>
              </View>

              {/* PO & GST Purchase Summary */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: muted }]}>LAST PO VOUCHER</Text>
                  {p.latest_po_date ? (
                    <>
                      <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: "#6366F1" }}>
                        {Math.round(p.latest_po_qty || 0)} {p.unit} · {p.latest_po_date}
                      </Text>
                      {p.po_rows.length > 1 && (
                        <TouchableOpacity
                          onPress={() =>
                            setHistoryTarget({
                              title: "PURCHASE ORDER HISTORY",
                              name: p.name,
                              unit: p.unit,
                              rows: p.po_rows,
                            })
                          }
                        >
                          <Text style={{ fontSize: 11, color: "#00A879", fontFamily: Typography.bold }}>
                            All {p.po_rows.length} POs →
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <Text style={{ fontSize: 11, color: muted, fontStyle: "italic" }}>No PO found</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: muted }]}>LAST GST RECEIPT</Text>
                  {p.latest_gst_date ? (
                    <>
                      <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: "#0369A1" }}>
                        {Math.round(p.latest_gst_qty || 0)} {p.unit} · {p.latest_gst_date}
                      </Text>
                      {p.gst_rows.length > 1 && (
                        <TouchableOpacity
                          onPress={() =>
                            setHistoryTarget({
                              title: "GST PURCHASE HISTORY",
                              name: p.name,
                              unit: p.unit,
                              rows: p.gst_rows,
                            })
                          }
                        >
                          <Text style={{ fontSize: 11, color: "#00A879", fontFamily: Typography.bold }}>
                            All {p.gst_rows.length} receipts →
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <Text style={{ fontSize: 11, color: muted, fontStyle: "italic" }}>No GST purchase</Text>
                  )}
                </View>
              </View>

              {/* In Transit Table */}
              {p.tracking_details && p.tracking_details.length > 0 && (
                <View style={[styles.transitBox, { borderColor: cardBorder, backgroundColor: isDark ? "#0C1924" : "#EFF6FF" }]}>
                  <Text style={{ fontSize: 10.5, fontFamily: Typography.bold, color: "#1D4ED8", marginBottom: 4 }}>
                    IN TRANSIT SHIPMENTS ({p.tracking_details.length})
                  </Text>
                  {p.tracking_details.map((td, idx) => (
                    <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11.5, color: fg }}>
                        {td.po_number}: <Text style={{ fontFamily: Typography.bold }}>{Math.round(td.incoming_qty)}</Text> ({td.stage || "—"})
                      </Text>
                      <Text style={{ fontSize: 11.5, color: "#1D4ED8", fontFamily: Typography.bold }}>
                        {td.eta || "TBD"} {td.remaining_days !== null ? `(${td.remaining_days}d)` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Order Recommendation Banner */}
              <View style={[styles.recBox, { borderColor: cardBorder }]}>
                {p.order_urgency === "dead" ? (
                  <Text style={{ fontSize: 12.5, color: muted, fontStyle: "italic" }}>
                    No order — dead stock
                  </Text>
                ) : p.order_final === 0 ? (
                  <Text style={{ fontSize: 12.5, fontFamily: Typography.bold, color: "#10B981" }}>
                    Stock sufficient · Runway {p.runway_months ? `${p.runway_months} mo` : "6+ mo"}
                  </Text>
                ) : (
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: urgencyColor }}>
                      Order {p.order_final} {p.unit}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: muted, marginTop: 2 }}>
                      {p.order_urgency === "urgent" ? "Order NOW — stock critical" : "Order soon — runway ending"}
                      {p.order_lasts_months ? ` · Lasts ~${p.order_lasts_months} mo` : ""}
                      {p.moq_note ? ` · MOQ applied (${p.moq_note})` : ""}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons Row */}
              <View style={styles.actionsRow}>
                {p.order_urgency !== "dead" && (
                  <TouchableOpacity
                    onPress={() => setMathProduct(p)}
                    style={[styles.actionBtn, { borderColor: cardBorder }]}
                  >
                    <Ionicons name="calculator-outline" size={14} color="#00A879" />
                    <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: "#00A879" }}>
                      Show Working
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setSalesProduct(p)}
                  style={[styles.actionBtn, { borderColor: cardBorder }]}
                >
                  <Ionicons name="bar-chart-outline" size={14} color="#3B82F6" />
                  <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: "#3B82F6" }}>
                    Sales History
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTopCustTarget({ id: p.id, name: p.name })}
                  style={[styles.actionBtn, { borderColor: cardBorder }]}
                >
                  <Ionicons name="people-outline" size={14} color="#8B5CF6" />
                  <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: "#8B5CF6" }}>
                    Top 5
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Modals */}
      <CategoryPickerModal
        visible={pickerVisible}
        categories={filteredCats}
        search={catSearch}
        onChangeSearch={setCatSearch}
        onSelect={handleSwitchCategory}
        onClose={() => setPickerVisible(false)}
        insets={insets}
      />
      <POPlannerMathModal
        visible={!!mathProduct}
        product={mathProduct}
        onClose={() => setMathProduct(null)}
      />
      <POPlannerSalesModal
        visible={!!salesProduct}
        product={salesProduct}
        onClose={() => setSalesProduct(null)}
      />
      <POPlannerTopCustomersModal
        visible={!!topCustTarget}
        itemId={topCustTarget?.id ?? null}
        itemName={topCustTarget?.name ?? ""}
        onClose={() => setTopCustTarget(null)}
      />
      <POPlannerHistoryModal
        visible={!!historyTarget}
        title={historyTarget?.title ?? ""}
        productName={historyTarget?.name ?? ""}
        unit={historyTarget?.unit ?? ""}
        rows={historyTarget?.rows ?? []}
        onClose={() => setHistoryTarget(null)}
      />
    </View>
  );
}

function SummaryChip({
  label,
  value,
  color,
  bg,
  border,
  muted,
  active,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
  muted: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.summaryChip,
        { backgroundColor: bg, borderColor: active ? "#00A879" : border, borderWidth: active ? 1.5 : 1 },
      ]}
    >
      <Text style={{ fontSize: 9.5, fontFamily: Typography.bold, color: muted }}>{label}</Text>
      <Text style={{ fontSize: 18, fontFamily: Typography.bold, color, marginTop: 2 }}>{value}</Text>
    </TouchableOpacity>
  );
}

function CategoryPickerModal({
  visible,
  categories,
  search,
  onChangeSearch,
  onSelect,
  onClose,
  insets,
}: {
  visible: boolean;
  categories: CategoryOption[];
  search: string;
  onChangeSearch: (t: string) => void;
  onSelect: (c: CategoryOption) => void;
  onClose: () => void;
  insets: any;
}) {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
            backgroundColor: cardBg,
            borderBottomWidth: 1,
            borderBottomColor: border,
          }}
        >
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg }}>Select Category</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={fg} />
          </TouchableOpacity>
        </View>
        <View style={{ padding: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: cardBg,
              borderColor: border,
              borderWidth: 1,
              borderRadius: Radius.md,
              paddingHorizontal: 12,
              height: 42,
              gap: 8,
            }}
          >
            <Ionicons name="search" size={16} color={muted} />
            <TextInput
              placeholder="Filter categories..."
              placeholderTextColor={muted}
              value={search}
              onChangeText={onChangeSearch}
              style={{ flex: 1, color: fg, fontSize: 13 }}
            />
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 8 }}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => onSelect(c)}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: cardBg,
                borderColor: border,
                borderWidth: 1,
                borderRadius: Radius.md,
                padding: 14,
              }}
            >
              <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 14 }}>{c.name}</Text>
              <Text style={{ fontSize: 12, color: "#00A879", fontFamily: Typography.bold }}>
                {c.item_count} items
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  generatorCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: "center",
    ...Shadows.card,
  },
  generatorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(0,168,121,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  generatorTitle: { fontSize: 20, fontFamily: Typography.bold, textAlign: "center" },
  generatorSub: { fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 20, lineHeight: 19 },
  selectBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  loadBtn: {
    width: "100%",
    backgroundColor: "#6366F1",
    borderRadius: Radius.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadBtnText: { color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 15 },
  controlCard: { borderWidth: 1, borderRadius: Radius.md, padding: 12, ...Shadows.card },
  catSwitchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  csvBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
  },
  deadToggleBtn: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  summaryChip: {
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 96,
    ...Shadows.card,
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  productCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  prodTitle: { fontSize: 14.5, fontFamily: Typography.bold, lineHeight: 19 },
  unitBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  newProdBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  metricsGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  miniLabel: { fontSize: 9, fontFamily: Typography.bold, letterSpacing: 0.4, marginBottom: 3 },
  vDivider: { width: 1 },
  transitBox: { borderWidth: 1, borderRadius: Radius.sm, padding: 10, marginTop: 10 },
  recBox: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
