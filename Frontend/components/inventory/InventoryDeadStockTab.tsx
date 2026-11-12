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

interface DeadStockItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  unit: string;
  last_sale_date: string;
  days_inactive: number;
}

interface InventoryDeadStockTabProps {
  onOpenProduct: (itemId: string, tab?: "forecast" | "trends" | "ledger") => void;
}

export function InventoryDeadStockTab({ onOpenProduct }: InventoryDeadStockTabProps) {
  const { colors, isDark } = useTheme();

  const [items, setItems] = useState<DeadStockItem[]>([]);
  const [totalDeadSkus, setTotalDeadSkus] = useState(0);
  const [totalDeadUnits, setTotalDeadUnits] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchDeadStock = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await api.get("/inventory/alerts/dead-stock/", {
        params: { page: pageNum, page_size: 30 },
      });
      if (res.data?.status === "success") {
        setItems(res.data.items || []);
        setTotalDeadSkus(res.data.total_dead_skus || 0);
        setTotalDeadUnits(res.data.total_dead_units || 0);
        setPage(res.data.page || 1);
        setTotalPages(res.data.total_pages || 1);
      }
    } catch (err: any) {
      console.warn("[InventoryDeadStockTab] Error:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDeadStock(1);
  }, [fetchDeadStock]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeadStock(1);
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase().trim()) ||
      item.sku.toLowerCase().includes(search.toLowerCase().trim()) ||
      item.category.toLowerCase().includes(search.toLowerCase().trim())
  );

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
      {/* Title */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: foreground }]}>Dead Stock Audit</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            Zero outwards movement for &gt; 90 days
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <Ionicons name="refresh" size={16} color="#00A879" />
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: "#64748B" }]}>DEAD SKUS</Text>
          <Text style={[styles.kpiValue, { color: foreground }]}>{totalDeadSkus}</Text>
          <Text style={[styles.kpiSub, { color: muted }]}>Non-moving lines</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.kpiLabel, { color: "#64748B" }]}>TIED-UP UNITS</Text>
          <Text style={[styles.kpiValue, { color: foreground }]}>
            {totalDeadUnits.toLocaleString()}
          </Text>
          <Text style={[styles.kpiSub, { color: muted }]}>Stored idle units</Text>
        </View>
      </View>

      {/* Explanatory Banner */}
      <View style={[styles.banner, { backgroundColor: isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9", borderColor: cardBorder }]}>
        <Ionicons name="information-circle-outline" size={20} color={muted} style={{ marginTop: 2 }} />
        <Text style={[styles.bannerText, { color: muted }]}>
          Dead stock items have recorded zero sales for 90+ days. Consider promotions, bundling, or liquidation to unlock warehouse space.
        </Text>
      </View>

      {/* Search Input */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholders={[
          'Search "non-moving SKUs"',
          'Search "product name"',
          'Search "category"',
        ]}
        intervalMs={2000}
        onClear={() => setSearch("")}
      />

      {/* Content */}
      {loading && !refreshing ? (
        <SkeletonCardList count={4} height={98} />
      ) : filteredItems.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="checkmark-done-circle-outline" size={38} color="#10B981" />
          <Text style={[styles.emptyTitle, { color: foreground }]}>No Dead Stock Detected</Text>
          <Text style={[styles.emptySub, { color: muted }]}>
            {search ? "No dead stock items match your search." : "All catalog items show healthy turnover."}
          </Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {filteredItems.map((item) => (
            <View
              key={item.id}
              style={[styles.deadCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
            >
              <View style={styles.deadHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.itemName, { color: foreground }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemMeta, { color: muted }]}>
                    {item.sku} · {item.category}
                  </Text>
                </View>
                <View style={styles.inactivityBadge}>
                  <Ionicons name="time-outline" size={12} color="#64748B" />
                  <Text style={styles.inactivityText}>{item.days_inactive}d idle</Text>
                </View>
              </View>

              <View style={[styles.statsRow, { backgroundColor: isDark ? "#0A1310" : "#F8FAFC", borderColor: cardBorder }]}>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: muted }]}>STORED STOCK</Text>
                  <Text style={[styles.statValue, { color: foreground }]}>
                    {item.stock} {item.unit}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: muted }]}>LAST OUTWARDS</Text>
                  <Text style={[styles.statValue, { color: muted }]}>{item.last_sale_date}</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  onPress={() => onOpenProduct(item.id, "forecast")}
                  style={[styles.actionBtn, { borderColor: cardBorder }]}
                >
                  <Ionicons name="analytics-outline" size={14} color="#00A879" />
                  <Text style={[styles.actionBtnText, { color: "#00A879" }]}>Forecast</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onOpenProduct(item.id, "trends")}
                  style={[styles.actionBtn, { borderColor: cardBorder }]}
                >
                  <Ionicons name="trending-up-outline" size={14} color="#3B82F6" />
                  <Text style={[styles.actionBtnText, { color: "#3B82F6" }]}>Trends</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onOpenProduct(item.id, "ledger")}
                  style={[styles.actionBtn, { borderColor: cardBorder }]}
                >
                  <Ionicons name="receipt-outline" size={14} color="#8B5CF6" />
                  <Text style={[styles.actionBtnText, { color: "#8B5CF6" }]}>Ledger</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <View style={styles.paginationBar}>
          <TouchableOpacity
            disabled={page <= 1}
            onPress={() => fetchDeadStock(page - 1)}
            style={[
              styles.pageBtn,
              { backgroundColor: cardBg, borderColor: cardBorder, opacity: page <= 1 ? 0.4 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={16} color={foreground} />
            <Text style={[styles.pageBtnText, { color: foreground }]}>Previous</Text>
          </TouchableOpacity>

          <Text style={[styles.pageText, { color: muted }]}>
            Page {page} of {totalPages}
          </Text>

          <TouchableOpacity
            disabled={page >= totalPages}
            onPress={() => fetchDeadStock(page + 1)}
            style={[
              styles.pageBtn,
              { backgroundColor: cardBg, borderColor: cardBorder, opacity: page >= totalPages ? 0.4 : 1 },
            ]}
          >
            <Text style={[styles.pageBtnText, { color: foreground }]}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color={foreground} />
          </TouchableOpacity>
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
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    ...Shadows.card,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: Typography.bold,
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 11,
    fontFamily: Typography.medium,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  bannerText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Typography.regular,
    flex: 1,
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
  deadCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  deadHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    fontFamily: Typography.bold,
    lineHeight: 18,
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  inactivityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(100,116,139,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  inactivityText: {
    fontSize: 9.5,
    fontFamily: Typography.bold,
    color: "#64748B",
  },
  statsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  statLabel: {
    fontSize: 8.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
  },
  paginationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  pageBtnText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  pageText: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
});
