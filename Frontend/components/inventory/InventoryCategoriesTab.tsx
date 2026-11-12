import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { SearchBar } from "@/components/ui/SearchBar";
import api from "@/services/api";

interface CategoryData {
  id: number;
  name: string;
  sku_count: number;
  total_units: number;
  optimal_stock: number;
  low_stock: number;
  critical_stock: number;
  dead_stock: number;
}

interface InventoryCategoriesTabProps {
  onSelectCategory: (categoryName: string) => void;
}

export function InventoryCategoriesTab({ onSelectCategory }: InventoryCategoriesTabProps) {
  const { colors, isDark } = useTheme();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/inventory/categories/");
      if (res.data?.status === "success" && Array.isArray(res.data.categories)) {
        setCategories(res.data.categories);
      }
    } catch (err: any) {
      console.warn("[InventoryCategoriesTab] Error:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const totalSKUs = categories.reduce((sum, c) => sum + (c.sku_count || 0), 0);
  const totalUnits = categories.reduce((sum, c) => sum + (c.total_units || 0), 0);

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const cardBorder = isDark ? "#1E332D" : "#E2E8F0";
  const foreground = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Info */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: foreground }]}>Category Breakdown</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            {categories.length} item categories cataloged
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <Ionicons name="refresh" size={16} color="#00A879" />
        </TouchableOpacity>
      </View>

      {/* KPI Summary Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: muted }]}>TOTAL CATEGORIES</Text>
          <Text style={[styles.kpiValue, { color: foreground }]}>{categories.length}</Text>
          <Text style={[styles.kpiSub, { color: "#00A879" }]}>Active taxonomy</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: muted }]}>CATALOG SKUS</Text>
          <Text style={[styles.kpiValue, { color: foreground }]}>{totalSKUs.toLocaleString()}</Text>
          <Text style={[styles.kpiSub, { color: muted }]}>Unique product lines</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: muted }]}>STORED UNITS</Text>
          <Text style={[styles.kpiValue, { color: foreground }]}>{totalUnits.toLocaleString()}</Text>
          <Text style={[styles.kpiSub, { color: muted }]}>Physical count</Text>
        </View>
      </View>

      {/* Search Bar */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholders={[
          'Search "category name"',
          'Search "stock group"',
          'Search "SKU alerts"',
        ]}
        intervalMs={2000}
        onClear={() => setSearch("")}
      />

      {/* Content */}
      {loading && !refreshing ? (
        <SkeletonCardList count={4} height={96} />
      ) : filteredCategories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="folder-open-outline" size={36} color={muted} />
          <Text style={[styles.emptyTitle, { color: foreground }]}>No Categories Found</Text>
          <Text style={[styles.emptySub, { color: muted }]}>
            {search ? "No categories match your search filter." : "No categories configured in inventory."}
          </Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {filteredCategories.map((cat) => {
            const total = cat.sku_count || 1;
            const optPct = Math.round((cat.optimal_stock / total) * 100);
            const lowPct = Math.round((cat.low_stock / total) * 100);
            const critPct = Math.round((cat.critical_stock / total) * 100);
            const deadPct = Math.max(0, 100 - optPct - lowPct - critPct);

            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => onSelectCategory(cat.name)}
                style={[styles.categoryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.catTitleLeft}>
                    <View style={[styles.catIcon, { backgroundColor: isDark ? "rgba(0,168,121,0.15)" : "#DDF4EA" }]}>
                      <Ionicons name="pricetag" size={18} color="#00A879" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catName, { color: foreground }]} numberOfLines={1}>
                        {cat.name}
                      </Text>
                      <Text style={[styles.catMeta, { color: muted }]}>
                        {cat.sku_count} SKUs · {cat.total_units.toLocaleString()} Units
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionPill}>
                    <Text style={styles.actionPillText}>View SKUs</Text>
                    <Ionicons name="chevron-forward" size={14} color="#00A879" />
                  </View>
                </View>

                {/* Health Bar */}
                <View style={styles.healthBar}>
                  {optPct > 0 && <View style={[styles.healthSeg, { flex: optPct, backgroundColor: "#10B981" }]} />}
                  {lowPct > 0 && <View style={[styles.healthSeg, { flex: lowPct, backgroundColor: "#F59E0B" }]} />}
                  {critPct > 0 && <View style={[styles.healthSeg, { flex: critPct, backgroundColor: "#EF4444" }]} />}
                  {deadPct > 0 && <View style={[styles.healthSeg, { flex: deadPct, backgroundColor: "#6B7280" }]} />}
                </View>

                {/* Legend Chips */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                    <Text style={[styles.legendText, { color: muted }]}>
                      {cat.optimal_stock} Healthy
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={[styles.legendText, { color: muted }]}>
                      {cat.low_stock} Low
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                    <Text style={[styles.legendText, { color: muted }]}>
                      {cat.critical_stock} Out
                    </Text>
                  </View>
                  {cat.dead_stock > 0 && (
                    <View style={styles.legendItem}>
                      <View style={[styles.dot, { backgroundColor: "#6B7280" }]} />
                      <Text style={[styles.legendText, { color: muted }]}>
                        {cat.dead_stock} Dead
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: Typography.bold,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    ...Shadows.card,
  },
  kpiLabel: {
    fontSize: 9,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: Typography.bold,
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 9.5,
    fontFamily: Typography.medium,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Typography.regular,
  },
  centerBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Typography.medium,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: Typography.regular,
    textAlign: "center",
  },
  cardList: {
    gap: 12,
  },
  categoryCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  catMeta: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,168,121,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  actionPillText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
    color: "#00A879",
  },
  healthBar: {
    height: 6,
    borderRadius: 3,
    flexDirection: "row",
    overflow: "hidden",
    marginVertical: 12,
  },
  healthSeg: {
    height: "100%",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10.5,
    fontFamily: Typography.medium,
  },
});
