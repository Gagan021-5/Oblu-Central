import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import {
  ProformaCatalogItem,
  fetchProformaCatalogApi,
} from "@/services/proformaService";

interface ProformaCatalogTabProps {
  searchQuery?: string;
}

export function ProformaCatalogTab({ searchQuery = "" }: ProformaCatalogTabProps) {
  const { colors, isDark } = useTheme();

  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [products, setProducts] = useState<ProformaCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<Record<number, boolean>>({});

  const bg = isDark ? "#0C0E15" : "#FFFFFF";
  const cardBg = isDark ? "#12151E" : "#F8FAFC";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0";
  const foreground = isDark ? "#F8FAFC" : "#101513";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const activeColor = "#10B981";

  const loadData = useCallback(async (isPull = false) => {
    if (!isPull) setLoading(true);
    try {
      const res = await fetchProformaCatalogApi({
        category_id: selectedCategory !== "all" ? selectedCategory : undefined,
        search: searchQuery,
      });
      setCategories(res.categories);
      setProducts(res.products);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleTier = (productId: number) => {
    triggerLightHaptic();
    setExpandedTiers((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const renderProduct = ({ item }: { item: ProformaCatalogItem }) => {
    const isExpanded = Boolean(expandedTiers[item.id]);
    const hasTiers = Boolean(item.tiers && item.tiers.length > 0);

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.productName, { color: foreground }]}>{item.name}</Text>
            <Text style={[styles.skuText, { color: muted }]}>
              {item.category} • SKU: {item.sku || "N/A"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.priceText, { color: activeColor }]}>₹{Math.round(item.base_price).toLocaleString("en-IN")}</Text>
            <Text style={[styles.gstText, { color: muted }]}>+{item.gst_percentage}% GST</Text>
          </View>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={[styles.stockBadge, { backgroundColor: item.stock > 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)" }]}>
            <View style={[styles.stockDot, { backgroundColor: item.stock > 0 ? "#10B981" : "#EF4444" }]} />
            <Text style={[styles.stockText, { color: item.stock > 0 ? "#10B981" : "#EF4444" }]}>
              {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
            </Text>
          </View>

          {hasTiers && (
            <TouchableOpacity onPress={() => toggleTier(item.id)} style={styles.tierToggleBtn}>
              <Text style={[styles.tierToggleText, { color: activeColor }]}>
                {isExpanded ? "Hide Tiers" : `Volume Tiers (${item.tiers?.length})`}
              </Text>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={activeColor}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Volume Tiers Breakdown */}
        {hasTiers && isExpanded && (
          <View style={[styles.tierTable, { backgroundColor: isDark ? "#161B26" : "#F1F5F9" }]}>
            <View style={styles.tierTableHeader}>
              <Text style={[styles.tierHeaderCell, { color: muted }]}>MIN QTY</Text>
              <Text style={[styles.tierHeaderCell, { color: muted }]}>DISCOUNT</Text>
              <Text style={[styles.tierHeaderCell, { color: muted, textAlign: "right" }]}>UNIT PRICE</Text>
            </View>
            {item.tiers?.map((t, idx) => (
              <View key={idx} style={[styles.tierRow, { borderTopColor: border }]}>
                <Text style={[styles.tierCell, { color: foreground }]}>{t.min_qty}+ units</Text>
                <Text style={[styles.tierCell, { color: "#F59E0B" }]}>{t.discount_pct}% off</Text>
                <Text style={[styles.tierCell, { color: activeColor, textAlign: "right" }]}>
                  ₹{Math.round(t.unit_price).toLocaleString("en-IN")}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Category Horizontal Filter Rail */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === "all" && { backgroundColor: activeColor },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setSelectedCategory("all");
            }}
          >
            <Text
              style={[
                styles.categoryText,
                { color: selectedCategory === "all" ? "#06281E" : muted },
              ]}
            >
              All Categories
            </Text>
          </TouchableOpacity>

          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.categoryPill,
                selectedCategory === String(c.id) && { backgroundColor: activeColor },
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                setSelectedCategory(String(c.id));
              }}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: selectedCategory === String(c.id) ? "#06281E" : muted },
                ]}
              >
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={activeColor} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData(true);
              }}
              tintColor={activeColor}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="pricetags-outline" size={38} color={muted} />
              <Text style={[styles.emptyTitle, { color: foreground }]}>No Products Found</Text>
              <Text style={[styles.emptySub, { color: muted }]}>
                {searchQuery
                  ? `No catalog items matching "${searchQuery}".`
                  : "No products configured with proforma pricing in this category."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  categoryBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.08)",
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  categoryText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productName: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  skuText: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  priceText: {
    fontSize: 15,
    fontFamily: Typography.bold,
  },
  gstText: {
    fontSize: 10,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
  },
  tierToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tierToggleText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  tierTable: {
    marginTop: 10,
    borderRadius: 8,
    padding: 8,
  },
  tierTableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  tierHeaderCell: {
    fontSize: 9,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
    flex: 1,
  },
  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1,
  },
  tierCell: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
    flex: 1,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Typography.bold,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: Typography.regular,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
