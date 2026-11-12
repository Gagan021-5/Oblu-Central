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
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { SearchBar } from "@/components/ui/SearchBar";
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
  const { colors } = useTheme();

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

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, gap: 10 }]}>
        <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: colors.textPrimary }}>
          Category-Wise Sales Comparison
        </Text>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholders={[
            'Search "category"',
            'Search "product name"',
            'Search "sales trend"',
          ]}
          intervalMs={2000}
          onSubmitEditing={applyFilter}
          onClear={() => {
            setSearch("");
            fetchComparison(fromDate, toDate, "");
          }}
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>FROM</Text>
            <TextInput
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>TO</Text>
            <TextInput
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
            />
          </View>
          <TouchableOpacity onPress={applyFilter} style={[styles.filterBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 12.5 }}>Filter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {[30, 60, 90].map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => applyDaysPreset(d)}
              style={[styles.presetBtn, { borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
            >
              <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.textPrimary }}>{d} Days</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {summary && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
            Comparing vs Previous Window ({prevRangeLabel})
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={[styles.label, { color: colors.textMuted }]}>PREVIOUS QTY</Text>
              <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textMuted }}>
                {summary.total_previous.toLocaleString()}
              </Text>
            </View>
            <View>
              <Text style={[styles.label, { color: colors.textMuted }]}>CURRENT QTY</Text>
              <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>
                {summary.total_current.toLocaleString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>CHANGE (Δ)</Text>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: Typography.bold,
                  color: summary.total_diff >= 0 ? colors.success : colors.error,
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
        <SkeletonCardList count={4} height={102} />
      ) : categories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="swap-horizontal-outline" size={38} color={colors.textMuted} />
          <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: colors.textPrimary }}>No Comparison Data</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
            Try adjusting the date range or search query.
          </Text>
        </View>
      ) : (
        categories.map((cat) => {
          const isOpen = expandedCat === cat.category;
          const trendColor =
            cat.overall_trend === "up" ? colors.success : cat.overall_trend === "down" ? colors.error : colors.textMuted;
          const trendSymbol = cat.overall_trend === "up" ? "▲" : cat.overall_trend === "down" ? "▼" : "▬";

          return (
            <View
              key={cat.category}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 0, overflow: "hidden" }]}
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
                  <Ionicons name={isOpen ? "chevron-down" : "chevron-forward"} size={16} color={colors.textPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: colors.textPrimary }} numberOfLines={1}>
                      {cat.category}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      {cat.product_count} products · Prev {cat.total_previous} vs Curr {cat.total_current}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: cat.total_diff >= 0 ? colors.success : colors.error }}>
                    {cat.total_diff >= 0 ? "+" : ""}{cat.total_diff}
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: trendColor }}>
                    {trendSymbol}
                  </Text>
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingHorizontal: 14, paddingBottom: 10 }}>
                  {cat.items.map((item, idx) => {
                    const iColor =
                      item.trend === "up" ? colors.success : item.trend === "down" ? colors.error : colors.textMuted;
                    const iSym = item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "▬";
                    return (
                      <View
                        key={idx}
                        style={{
                          paddingVertical: 10,
                          borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                          borderTopColor: colors.cardBorder,
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Text style={{ flex: 1, fontFamily: Typography.bold, color: colors.textPrimary, fontSize: 13, marginRight: 8 }}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: Typography.bold, color: iColor }}>
                            {iSym} {item.percent_change !== null ? `${item.percent_change}%` : "N/A"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={{ fontSize: 11.5, color: colors.textMuted }}>Prev: {item.previous}</Text>
                          <Text style={{ fontSize: 11.5, color: colors.textPrimary, fontFamily: Typography.bold }}>Curr: {item.current}</Text>
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
