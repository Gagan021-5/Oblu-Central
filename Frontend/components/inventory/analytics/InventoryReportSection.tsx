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
  const { colors, isDark } = useTheme();

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

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  return (
    <View style={{ gap: 12 }}>
      {/* Search + Controls */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, gap: 10 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: fg }}>Inventory Report</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowGuide(!showGuide)}
              style={[styles.smallBtn, { borderColor: border, backgroundColor: bg }]}
            >
              <Ionicons name="help-circle-outline" size={14} color="#6366F1" />
              <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: "#6366F1" }}>
                {showGuide ? "Hide Guide" : "Guide"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleExportCSV}
              style={[styles.smallBtn, { borderColor: "#0F172A", backgroundColor: "#0F172A" }]}
            >
              <Ionicons name="download-outline" size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: "#FFFFFF" }}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[styles.searchRow, { flex: 1, backgroundColor: bg, borderColor: border }]}>
            <Ionicons name="search" size={16} color={muted} />
            <TextInput
              placeholder="Search product name..."
              placeholderTextColor={muted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleApply}
              style={{ flex: 1, color: fg, fontSize: 13 }}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearch("");
                  fetchReport("", selectedCatId, lowOnly);
                }}
              >
                <Ionicons name="close-circle" size={16} color={muted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={handleToggleLow}
            style={[
              styles.smallBtn,
              {
                borderColor: lowOnly ? "#EF4444" : border,
                backgroundColor: lowOnly ? "rgba(239,68,68,0.12)" : bg,
                paddingHorizontal: 12,
              },
            ]}
          >
            <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: lowOnly ? "#EF4444" : fg }}>
              {lowOnly ? "Low Stock Only ✓" : "Low Stock Only"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Instructions Guide (mirrors inventory_report.html instructions) */}
      {showGuide && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: "#3B82F6", borderLeftWidth: 4, gap: 6 }]}>
          <Text style={{ fontSize: 13.5, fontFamily: Typography.bold, color: "#3B82F6" }}>
            How to Read This Report
          </Text>
          <Text style={{ fontSize: 11.5, color: muted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: fg }}>Min Qty (Closing): </Text>
            Lowest predicted closing stock over next 3 months via linear trend.
          </Text>
          <Text style={{ fontSize: 11.5, color: muted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: fg }}>Linear Regression Outwards: </Text>
            Predicted 3-month demand + 10% safety buffer. Rows below this threshold highlight red.
          </Text>
          <Text style={{ fontSize: 11.5, color: muted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: fg }}>Avg / Last 3 Avg: </Text>
            Historical all-month vs recent 3-month average outwards usage.
          </Text>
          <Text style={{ fontSize: 11.5, color: muted, lineHeight: 17 }}>
            <Text style={{ fontFamily: Typography.bold, color: fg }}>Min Qty (GPT) &amp; Nitin Est.: </Text>
            AI &amp; manual safety stock benchmarks. Tap any product name for prediction charts.
          </Text>
        </View>
      )}

      {/* KPI Strip */}
      {summary && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>TOTAL SKUS</Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg }}>{summary.total_skus}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>UNITS</Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg }}>
              {summary.total_units.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: "#EF4444" }]}>LOW STOCK</Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: "#EF4444" }}>
              {summary.low_stock_count}
            </Text>
          </View>
        </View>
      )}

      {/* Category Quick-Jump Index Pills */}
      {categoriesIndex.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleSelectCat(null)}
            style={[
              styles.catPill,
              {
                borderColor: selectedCatId === null ? "#00A879" : border,
                backgroundColor: selectedCatId === null ? "#00A879" : cardBg,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: Typography.bold,
                color: selectedCatId === null ? "#FFF" : fg,
              }}
            >
              All Categories ({categoriesIndex.length})
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
                    borderColor: active ? "#00A879" : border,
                    backgroundColor: active ? "#00A879" : cardBg,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: active ? "#FFF" : fg }}>
                  {c.name} ({c.total_items})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={{ padding: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color="#00A879" />
          <Text style={{ color: muted, fontSize: 13 }}>Loading full threshold report...</Text>
        </View>
      ) : categories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Ionicons name="document-text-outline" size={38} color={muted} />
          <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: fg }}>No Report Rows Found</Text>
        </View>
      ) : (
        categories.map((cat) => (
          <View key={cat.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
              <Text style={{ fontSize: 14.5, fontFamily: Typography.bold, color: fg }}>{cat.name}</Text>
              <Text style={{ fontSize: 11.5, color: muted }}>
                {cat.item_count} items ·{" "}
                <Text style={{ color: cat.low_count > 0 ? "#EF4444" : "#10B981", fontFamily: Typography.bold }}>
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
                    backgroundColor: item.is_low_stock
                      ? isDark
                        ? "rgba(239,68,68,0.12)"
                        : "#FEF2F2"
                      : cardBg,
                    borderColor: item.is_low_stock ? "#EF4444" : border,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      fontFamily: Typography.bold,
                      color: item.is_low_stock ? "#EF4444" : "#3B82F6",
                    }}
                  >
                    {item.name}
                  </Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: item.is_low_stock ? "#EF4444" : fg }}>
                      Qty: {item.quantity}
                    </Text>
                    {item.is_low_stock && (
                      <Text style={{ fontSize: 9.5, fontFamily: Typography.bold, color: "#EF4444" }}>
                        BELOW LR THRESHOLD
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <MetricCell label="LR OUTWARDS" value={item.min_quantity_outwards} highlight="#0284C7" fg={fg} muted={muted} />
                  <MetricCell label="NITIN EST." value={item.min_quantity_nitin} fg={fg} muted={muted} />
                  <MetricCell label="MIN CLOSING" value={item.min_quantity_closing} fg={fg} muted={muted} />
                  <MetricCell label="MIN GPT" value={item.min_quantity_gpt} fg={fg} muted={muted} />
                  <MetricCell label="HIST. AVG" value={item.min_quantity_average} fg={fg} muted={muted} />
                  <MetricCell label="LAST 3 AVG" value={item.min_quantity_average_three} fg={fg} muted={muted} />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 8,
                    paddingTop: 6,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: muted }}>
                    Entries: <Text style={{ fontFamily: Typography.bold, color: fg }}>{item.total_historical_entries}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: muted }}>
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
  fg,
  muted,
}: {
  label: string;
  value: number | null;
  highlight?: string;
  fg: string;
  muted: string;
}) {
  return (
    <View style={{ width: "31%" }}>
      <Text style={{ fontSize: 9, fontFamily: Typography.bold, color: highlight || muted }}>{label}</Text>
      <Text style={{ fontSize: 12.5, fontFamily: Typography.bold, color: highlight || fg, marginTop: 1 }}>
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
