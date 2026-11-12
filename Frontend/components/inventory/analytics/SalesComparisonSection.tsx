import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";

interface ComparisonItem {
  name: string;
  previous: number;
  current: number;
  difference: number;
  percent_change: number | null;
  trend: "up" | "down" | "same";
}

interface ComparisonCategory {
  category: string;
  overall_trend: "up" | "down" | "same";
  product_count: number;
  total_current: number;
  total_previous: number;
  total_diff: number;
  items: ComparisonItem[];
}

export function SalesComparisonSection() {
  const { colors, isDark } = useTheme();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [prevRangeLabel, setPrevRangeLabel] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ComparisonCategory[]>([]);
  const [summary, setSummary] = useState<{
    total_current: number;
    total_previous: number;
    total_diff: number;
    overall_pct: number | null;
    categories_count: number;
  } | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const fetchComparison = useCallback(async (f?: string, t?: string, q?: string) => {
    try {
      setLoading(true);
      const params: any = {};
      if (f && t) {
        params.from = f;
        params.to = t;
      }
      if (q) params.search = q;
      const res = await api.get("/inventory/analytics/comparison/", { params });
      if (res.data?.status === "success") {
        setFromDate(res.data.from_date || "");
        setToDate(res.data.to_date || "");
        setPrevRangeLabel(`${res.data.prev_from} to ${res.data.prev_to}`);
        setCategories(res.data.categories || []);
        setSummary(res.data.summary || null);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load sales comparison.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const applyFilter = () => {
    fetchComparison(fromDate.trim(), toDate.trim(), search.trim());
  };

  const applyDaysPreset = (days: number) => {
    const end = toDate ? new Date(toDate) : new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - days);
    const f = start.toISOString().slice(0, 10);
    const t = end.toISOString().slice(0, 10);
    setFromDate(f);
    setToDate(t);
    fetchComparison(f, t, search.trim());
  };

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  return (
    <View style={{ gap: 12 }}>
      {/* Filters Header (mirrors sales_comparison_dashboard.html) */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, gap: 10 }]}>
        <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: fg }}>
          Category-Wise Sales Comparison
        </Text>

        <View style={[styles.searchRow, { backgroundColor: bg, borderColor: border }]}>
          <Ionicons name="search" size={16} color={muted} />
          <TextInput
            placeholder="Search category or product..."
            placeholderTextColor={muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={applyFilter}
            style={{ flex: 1, color: fg, fontSize: 13 }}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                fetchComparison(fromDate, toDate, "");
              }}
            >
              <Ionicons name="close-circle" size={16} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: muted }]}>FROM</Text>
            <TextInput
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={muted}
              style={[styles.dateInput, { color: fg, borderColor: border, backgroundColor: bg }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: muted }]}>TO</Text>
            <TextInput
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={muted}
              style={[styles.dateInput, { color: fg, borderColor: border, backgroundColor: bg }]}
            />
          </View>
          <TouchableOpacity onPress={applyFilter} style={styles.filterBtn}>
            <Text style={{ color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 12.5 }}>Filter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {[30, 60, 90].map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => applyDaysPreset(d)}
              style={[styles.presetBtn, { borderColor: border, backgroundColor: bg }]}
            >
              <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: fg }}>{d} Days</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Overall Summary Strip */}
      {summary && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={{ fontSize: 11, color: muted, marginBottom: 8 }}>
            Comparing vs Previous Window ({prevRangeLabel})
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={[styles.label, { color: muted }]}>PREVIOUS QTY</Text>
              <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: muted }}>
                {summary.total_previous.toLocaleString()}
              </Text>
            </View>
            <View>
              <Text style={[styles.label, { color: muted }]}>CURRENT QTY</Text>
              <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg }}>
                {summary.total_current.toLocaleString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.label, { color: muted }]}>CHANGE (Δ)</Text>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: Typography.bold,
                  color: summary.total_diff >= 0 ? "#10B981" : "#EF4444",
                }}
              >
                {summary.total_diff >= 0 ? "+" : ""}
                {summary.total_diff.toLocaleString()}
                {summary.overall_pct !== null ? ` (${summary.overall_pct}%)` : ""}
              </Text>
            </View>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ padding: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color="#00A879" />
          <Text style={{ color: muted, fontSize: 13 }}>Comparing category and product velocities...</Text>
        </View>
      ) : categories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Ionicons name="swap-horizontal-outline" size={38} color={muted} />
          <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: fg }}>No Comparison Data</Text>
          <Text style={{ fontSize: 12, color: muted, textAlign: "center" }}>
            Try adjusting the date range or search query.
          </Text>
        </View>
      ) : (
        categories.map((cat) => {
          const isOpen = expandedCat === cat.category;
          const trendColor =
            cat.overall_trend === "up" ? "#10B981" : cat.overall_trend === "down" ? "#EF4444" : muted;
          const trendSymbol = cat.overall_trend === "up" ? "▲" : cat.overall_trend === "down" ? "▼" : "▬";

          return (
            <View
              key={cat.category}
              style={[styles.card, { backgroundColor: cardBg, borderColor: border, padding: 0, overflow: "hidden" }]}
            >
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setExpandedCat(isOpen ? null : cat.category)}
                style={{
                  padding: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 8 }}>
                  <Ionicons name={isOpen ? "chevron-down" : "chevron-forward"} size={16} color={fg} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: fg }} numberOfLines={1}>
                      {cat.category}
                    </Text>
                    <Text style={{ fontSize: 11, color: muted }}>
                      {cat.product_count} products · Prev {cat.total_previous} vs Curr {cat.total_current}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: cat.total_diff >= 0 ? "#10B981" : "#EF4444" }}>
                    {cat.total_diff >= 0 ? "+" : ""}{cat.total_diff}
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: trendColor }}>
                    {trendSymbol}
                  </Text>
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={{ borderTopWidth: 1, borderTopColor: border, paddingHorizontal: 14, paddingBottom: 10 }}>
                  {cat.items.map((item, idx) => {
                    const iColor =
                      item.trend === "up" ? "#10B981" : item.trend === "down" ? "#EF4444" : muted;
                    const iSym = item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "▬";
                    return (
                      <View
                        key={idx}
                        style={{
                          paddingVertical: 10,
                          borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                          borderTopColor: border,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Text style={{ flex: 1, fontFamily: Typography.bold, color: fg, fontSize: 13, marginRight: 8 }}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: Typography.bold, color: iColor }}>
                            {iSym} {item.percent_change !== null ? `${item.percent_change}%` : "N/A"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={{ fontSize: 11.5, color: muted }}>Prev: {item.previous}</Text>
                          <Text style={{ fontSize: 11.5, color: fg, fontFamily: Typography.bold }}>Curr: {item.current}</Text>
                          <Text style={{ fontSize: 11.5, color: iColor, fontFamily: Typography.bold }}>
                            Diff: {item.difference >= 0 ? "+" : ""}{item.difference}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })
      )}
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
  filterBtn: {
    backgroundColor: "#6366F1",
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
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
});
