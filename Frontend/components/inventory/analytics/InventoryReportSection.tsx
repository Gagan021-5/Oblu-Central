import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";

interface ReportItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  is_low_stock: boolean;
  min_quantity_nitin: number | null;
  min_quantity_closing: number | null;
  min_quantity_outwards: number | null;
  min_quantity_gpt: number | null;
  min_quantity_average: number | null;
  min_quantity_average_three: number | null;
  total_historical_entries: number;
  expected_delivery: string | null;
  expected_quantity: number | null;
}

interface ReportCategory {
  id: number;
  name: string;
  item_count: number;
  low_count: number;
  items: ReportItem[];
}

interface CategoryIndexItem {
  id: number;
  name: string;
  total_items: number;
  low_stock_items: number;
}

interface InventoryReportSectionProps {
  onOpenProduct?: (itemId: string, tab?: "forecast" | "trends" | "ledger") => void;
}

export function InventoryReportSection({ onOpenProduct }: InventoryReportSectionProps) {
  const { colors } = useTheme();

  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    total_skus: number;
    total_units: number;
    low_stock_count: number;
    healthy_count: number;
  } | null>(null);
  const [categoriesIndex, setCategoriesIndex] = useState<CategoryIndexItem[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);

  const fetchReport = useCallback(async (q: string, catId: number | null, lowFlag: boolean) => {
    try {
      setLoading(true);
      const params: any = { low_only: lowFlag ? "1" : "0" };
      if (q.trim()) params.search = q.trim();
      if (catId) params.category_id = catId;
      const res = await api.get("/inventory/analytics/report/", { params });
      if (res.data?.status === "success") {
        setSummary(res.data.summary || null);
        setCategoriesIndex(res.data.categories_index || []);
        setCategories(res.data.categories || []);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load inventory report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport("", null, false);
  }, [fetchReport]);

  const handleApply = () => {
    fetchReport(search, selectedCatId, lowOnly);
  };

  const handleSelectCat = (catId: number | null) => {
    setSelectedCatId(catId);
    fetchReport(search, catId, lowOnly);
  };

  const handleToggleLow = () => {
    const next = !lowOnly;
    setLowOnly(next);
    fetchReport(search, selectedCatId, next);
  };

  const handleExportCSV = async () => {
    const headers = [
      "Category",
      "Product Name",
      "Quantity",
      "Nitin Est",
      "Min Qty (Closing)",
      "LR Outwards",
      "Min Qty (GPT)",
      "Min Qty (Average)",
      "Min Qty (Last 3 Avg)",
      "Entries",
      "Expected Delivery",
      "Expected Qty",
    ];
    const rows: string[] = [headers.join(",")];
    categories.forEach((cat) => {
      cat.items.forEach((it) => {
        rows.push(
          [
            `"${cat.name.replace(/"/g, "'")}"`,
            `"${it.name.replace(/"/g, "'")}"`,
            it.quantity,
            it.min_quantity_nitin ?? "-",
            it.min_quantity_closing ?? "-",
            it.min_quantity_outwards ?? "-",
            it.min_quantity_gpt ?? "-",
            it.min_quantity_average ?? "-",
            it.min_quantity_average_three ?? "-",
            it.total_historical_entries,
            `"${it.expected_delivery ?? "-"}"`,
            it.expected_quantity ?? "-",
          ].join(",")
        );
      });
    });
    try {
      await Share.share({
        title: "Inventory Report.csv",
        message: rows.join("\n"),
      });
    } catch {
      // cancelled
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, gap: 10 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: colors.textPrimary }}>Threshold & Prediction Report</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowGuide(!showGuide)}
              style={[styles.smallBtn, { borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
            >
              <Ionicons name="help-circle-outline" size={14} color={colors.primary} />
              <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.primary }}>
                {showGuide ? "Hide Guide" : "Guide"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleExportCSV}
              style={[styles.smallBtn, { borderColor: colors.primary, backgroundColor: colors.primary }]}
            >
              <Ionicons name="download-outline" size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: "#FFFFFF" }}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[styles.searchRow, { flex: 1, backgroundColor: colors.secondarySurface, borderColor: colors.cardBorder }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              placeholder="Search product name..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleApply}
              style={{ flex: 1, color: colors.textPrimary, fontSize: 13 }}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearch("");
                  fetchReport("", selectedCatId, lowOnly);
                }}
              >
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={handleToggleLow}
            style={[
              styles.smallBtn,
              {
                borderColor: lowOnly ? colors.error : colors.cardBorder,
                backgroundColor: lowOnly ? colors.errorBg : colors.secondarySurface,
                paddingHorizontal: 12,
              },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: lowOnly ? colors.error : colors.textPrimary }}>
              {lowOnly ? "Low Stock Only ✓" : "Low Stock Only"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showGuide && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary, borderLeftWidth: 4, gap: 6 }]}>
          <Text style={{ fontSize: 13.5, fontFamily: Typography.bold, color: colors.primary }}>
            How to Read This Report
          </Text>
          <Text style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>Min Qty (Closing): </Text>
            Lowest predicted closing stock over next 3 months via linear trend.
          </Text>
          <Text style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>Linear Regression Outwards: </Text>
            Predicted 3-month demand + 10% safety buffer. Rows below this highlight red.
          </Text>
          <Text style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>Avg / Last 3 Avg: </Text>
            Historical all-month vs recent 3-month average outwards usage.
          </Text>
          <Text style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>Min Qty (GPT) &amp; Nitin Est.: </Text>
            AI &amp; manual benchmarks. Tap any product card for its prediction chart.
          </Text>
        </View>
      )}

      {summary && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>TOTAL SKUS</Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>{summary.total_skus}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>UNITS</Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>
              {summary.total_units.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.label, { color: colors.error }]}>LOW STOCK</Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.error }}>
              {summary.low_stock_count}
            </Text>
          </View>
        </View>
      )}

      {categoriesIndex.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleSelectCat(null)}
            style={[
              styles.catPill,
              {
                borderColor: selectedCatId === null ? colors.primary : colors.cardBorder,
                backgroundColor: selectedCatId === null ? colors.primary : colors.card,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: Typography.bold,
                color: selectedCatId === null ? "#FFF" : colors.textPrimary,
              }}
            >
              All ({categoriesIndex.length})
            </Text>
          </TouchableOpacity>
          {categoriesIndex.map((c) => {
            const active = selectedCatId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => handleSelectCat(c.id)}
                style={[
                  styles.catPill,
                  {
                    borderColor: active ? colors.primary : colors.cardBorder,
                    backgroundColor: active ? colors.primary : colors.card,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: active ? "#FFF" : colors.textPrimary }}>
                  {c.name} ({c.total_items})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={{ padding: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Loading full threshold report...</Text>
        </View>
      ) : categories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="document-text-outline" size={38} color={colors.textMuted} />
          <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: colors.textPrimary }}>No Report Rows Found</Text>
        </View>
      ) : (
        categories.map((cat) => (
          <View key={cat.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
              <Text style={{ fontSize: 14.5, fontFamily: Typography.bold, color: colors.textPrimary }}>{cat.name}</Text>
              <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                {cat.item_count} items ·{" "}
                <Text style={{ color: cat.low_count > 0 ? colors.error : colors.success, fontFamily: Typography.bold }}>
                  {cat.low_count} low
                </Text>
              </Text>
            </View>

            {cat.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => onOpenProduct?.(String(item.id), "forecast")}
                style={[
                  styles.card,
                  {
                    backgroundColor: item.is_low_stock ? colors.errorBg : colors.card,
                    borderColor: item.is_low_stock ? colors.error : colors.cardBorder,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      fontFamily: Typography.bold,
                      color: item.is_low_stock ? colors.error : colors.textPrimary,
                    }}
                  >
                    {item.name}
                  </Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: item.is_low_stock ? colors.error : colors.textPrimary }}>
                      Qty: {item.quantity}
                    </Text>
                    {item.is_low_stock && (
                      <Text style={{ fontSize: 9.5, fontFamily: Typography.bold, color: colors.error }}>
                        BELOW LR THRESHOLD
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <MetricCell label="LR OUTWARDS" value={item.min_quantity_outwards} highlight={colors.primary} />
                  <MetricCell label="NITIN EST." value={item.min_quantity_nitin} />
                  <MetricCell label="MIN CLOSING" value={item.min_quantity_closing} />
                  <MetricCell label="MIN GPT" value={item.min_quantity_gpt} />
                  <MetricCell label="HIST. AVG" value={item.min_quantity_average} />
                  <MetricCell label="LAST 3 AVG" value={item.min_quantity_average_three} />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 8,
                    paddingTop: 6,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    Entries: <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary }}>{item.total_historical_entries}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    Exp: {item.expected_delivery || "—"} ({item.expected_quantity ?? "—"})
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function MetricCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null;
  highlight?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ width: "31%" }}>
      <Text style={{ fontSize: 9, fontFamily: Typography.bold, color: highlight || colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 12.5, fontFamily: Typography.bold, color: highlight || colors.textPrimary, marginTop: 1 }}>
        {value !== null && value !== undefined ? value : "-"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.md, padding: 14, ...Shadows.card },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  label: { fontSize: 9.5, fontFamily: Typography.bold, marginBottom: 2 },
  kpiCard: { flex: 1, borderWidth: 1, borderRadius: Radius.md, padding: 10, ...Shadows.card },
  catPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
});
