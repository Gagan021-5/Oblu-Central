import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";

interface TrackedItem {
  id: number;
  item_name: string;
  ordered_quantity: number;
  arrived_quantity: number;
}

interface StageLog {
  stage_name: string;
  status: string;
  notes?: string;
  timestamp: string | null;
}

interface TrackedPO {
  id: number;
  voucher_number: string;
  party_name: string;
  order_date: string;
  expected_delivery: string;
  total_ordered: number;
  total_arrived: number;
  completion_pct: number;
  items: TrackedItem[];
  stage_history: StageLog[];
}

interface TallyPO {
  id: number;
  voucher_number: string;
  party_name: string;
  date: string;
  total_value: number;
  total_value_display: string;
  total_quantity: number;
  item_count: number;
}

export function InventoryProcurementTab() {
  const { colors, isDark } = useTheme();

  const [mode, setMode] = useState<"tracked" | "tally">("tracked");
  const [trackedOrders, setTrackedOrders] = useState<TrackedPO[]>([]);
  const [tallyOrders, setTallyOrders] = useState<TallyPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/inventory/purchase-orders/");
      if (res.data?.status === "success") {
        setTrackedOrders(res.data.tracked_orders || []);
        setTallyOrders(res.data.tally_orders || []);
      }
    } catch (err: any) {
      console.warn("[InventoryProcurementTab] Error:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

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
          <Text style={[styles.title, { color: foreground }]}>Procurement & PO Tracking</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            Inbound shipments, fulfillment pipeline, and supplier orders
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <Ionicons name="refresh" size={16} color="#00A879" />
        </TouchableOpacity>
      </View>

      {/* Segmented Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setMode("tracked")}
          style={[
            styles.tabItem,
            mode === "tracked" && { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" },
          ]}
        >
          <Ionicons
            name="cube-outline"
            size={14}
            color={mode === "tracked" ? "#00A879" : muted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: mode === "tracked" ? foreground : muted,
                fontFamily: mode === "tracked" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Tracked Shipments ({trackedOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode("tally")}
          style={[
            styles.tabItem,
            mode === "tally" && { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" },
          ]}
        >
          <Ionicons
            name="receipt-outline"
            size={14}
            color={mode === "tally" ? "#00A879" : muted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: mode === "tally" ? foreground : muted,
                fontFamily: mode === "tally" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Tally Orders ({tallyOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#00A879" />
          <Text style={[styles.loadingText, { color: muted }]}>Loading procurement orders...</Text>
        </View>
      ) : mode === "tracked" ? (
        trackedOrders.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="boat-outline" size={38} color={muted} />
            <Text style={[styles.emptyTitle, { color: foreground }]}>No Tracked Shipments</Text>
            <Text style={[styles.emptySub, { color: muted }]}>
              There are no active purchase orders currently tracked in the pipeline.
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {trackedOrders.map((po) => {
              const isExpanded = expandedId === po.id;
              const isComplete = po.completion_pct >= 100;
              return (
                <View
                  key={po.id}
                  style={[styles.poCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                >
                  <TouchableOpacity
                    onPress={() => setExpandedId(isExpanded ? null : po.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.poNumber, { color: foreground }]}>
                          {po.voucher_number}
                        </Text>
                        <Text style={[styles.supplierText, { color: muted }]}>
                          {po.party_name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.pctBadge,
                          {
                            backgroundColor: isComplete
                              ? "rgba(16,185,129,0.12)"
                              : "rgba(0,168,121,0.12)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pctBadgeText,
                            { color: isComplete ? "#10B981" : "#00A879" },
                          ]}
                        >
                          {po.completion_pct}% Arrived
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.progressTrack, { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(po.completion_pct, 100)}%`,
                            backgroundColor: isComplete ? "#10B981" : "#00A879",
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={[styles.metaText, { color: muted }]}>
                        Ordered: {po.order_date}
                      </Text>
                      <Text style={[styles.metaText, { color: muted }]}>
                        ETA: {po.expected_delivery}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expandable items and stage logs */}
                  {isExpanded && (
                    <View style={[styles.expandedContent, { borderTopColor: cardBorder }]}>
                      {/* Stage logs */}
                      {po.stage_history.length > 0 && (
                        <View style={styles.sectionBlock}>
                          <Text style={[styles.blockTitle, { color: foreground }]}>Workflow Stages</Text>
                          {po.stage_history.map((stage, idx) => (
                            <View key={idx} style={styles.stageItem}>
                              <Ionicons name="checkmark-circle" size={16} color="#00A879" />
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={[styles.stageName, { color: foreground }]}>
                                  {stage.stage_name}
                                </Text>
                                {stage.timestamp && (
                                  <Text style={[styles.stageTime, { color: muted }]}>
                                    {stage.timestamp}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Items table */}
                      <View style={styles.sectionBlock}>
                        <Text style={[styles.blockTitle, { color: foreground }]}>Arriving Items</Text>
                        {po.items.map((it) => (
                          <View key={it.id} style={styles.itemRow}>
                            <Text style={[styles.itemName, { color: foreground }]} numberOfLines={1}>
                              {it.item_name}
                            </Text>
                            <Text style={[styles.itemQty, { color: muted }]}>
                              {it.arrived_quantity} / {it.ordered_quantity} pcs
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )
      ) : (
        /* Tally Purchase Orders */
        tallyOrders.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="receipt-outline" size={38} color={muted} />
            <Text style={[styles.emptyTitle, { color: foreground }]}>No Tally Orders</Text>
            <Text style={[styles.emptySub, { color: muted }]}>
              No synced Tally purchase orders found in the database.
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {tallyOrders.map((tpo) => (
              <View
                key={tpo.id}
                style={[styles.tallyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.poNumber, { color: foreground }]}>
                      {tpo.voucher_number}
                    </Text>
                    <Text style={[styles.supplierText, { color: muted }]}>{tpo.party_name}</Text>
                  </View>
                  <Text style={[styles.poAmount, { color: "#00A879" }]}>
                    {tpo.total_value_display}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, { color: muted }]}>Date: {tpo.date}</Text>
                  <Text style={[styles.metaText, { color: muted }]}>
                    {tpo.item_count} items ({tpo.total_quantity.toLocaleString()} units)
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )
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
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: 14,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 8,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 12,
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
  poCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  poNumber: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  supplierText: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  pctBadgeText: {
    fontSize: 9.5,
    fontFamily: Typography.bold,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 11,
    fontFamily: Typography.regular,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  sectionBlock: {
    gap: 6,
  },
  blockTitle: {
    fontSize: 12,
    fontFamily: Typography.bold,
    marginBottom: 4,
  },
  stageItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  stageName: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  stageTime: {
    fontSize: 10,
    fontFamily: Typography.regular,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  itemName: {
    fontSize: 12,
    fontFamily: Typography.regular,
    flex: 1,
    marginRight: 8,
  },
  itemQty: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  tallyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  poAmount: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
});
