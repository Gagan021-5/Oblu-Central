import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import {
  StockShortageRequestItem,
  fetchStockShortageRequestsApi,
  actionStockShortageRequestApi,
} from "@/services/proformaService";

interface StockRequestsTabProps {
  canApprove: boolean;
  searchQuery?: string;
}

export function StockRequestsTab({ canApprove, searchQuery = "" }: StockRequestsTabProps) {
  const { colors, isDark } = useTheme();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [requests, setRequests] = useState<StockShortageRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const bg = isDark ? "#0C0E15" : "#FFFFFF";
  const cardBg = isDark ? "#12151E" : "#F8FAFC";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0";
  const foreground = isDark ? "#F8FAFC" : "#101513";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const activeColor = "#10B981";

  const loadData = useCallback(async (isPull = false) => {
    if (!isPull) setLoading(true);
    try {
      const data = await fetchStockShortageRequestsApi({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery,
      });
      setRequests(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    triggerLightHaptic();
    Alert.alert(
      action === "approve" ? "Confirm Stock Availability" : "Reject Stock Request",
      `Mark this stock request as ${action === "approve" ? "Confirmed" : "Rejected"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "approve" ? "Confirm" : "Reject",
          style: action === "reject" ? "destructive" : "default",
          onPress: async () => {
            setActionLoadingId(id);
            try {
              const res = await actionStockShortageRequestApi(id, action);
              if (res && res.success) {
                triggerSelectionHaptic();
                loadData(true);
              } else {
                Alert.alert("Error", res?.message || "Failed to update request.");
              }
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Action failed.");
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "#10B981";
      case "rejected":
        return "#EF4444";
      default:
        return "#F59E0B";
    }
  };

  const renderItem = ({ item }: { item: StockShortageRequestItem }) => {
    const isPending = item.status.toLowerCase() === "pending";
    const statusColor = getStatusColor(item.status);

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.docBadge, { color: activeColor }]}>{item.invoice_number}</Text>
              <Text style={[styles.customerName, { color: foreground }]} numberOfLines={1}>
                {item.customer_name}
              </Text>
            </View>
            <Text style={[styles.repText, { color: muted }]}>
              Requested by {item.requested_by} • {item.created_at}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Product & Qty Comparison */}
        <View style={[styles.detailBox, { backgroundColor: isDark ? "#161B26" : "#F1F5F9" }]}>
          <Text style={[styles.productName, { color: foreground }]}>{item.product_name}</Text>
          <Text style={[styles.skuText, { color: muted }]}>SKU: {item.product_sku || "N/A"}</Text>

          <View style={styles.qtyRow}>
            <View style={styles.qtyBox}>
              <Text style={[styles.qtyLabel, { color: muted }]}>Required</Text>
              <Text style={[styles.qtyVal, { color: "#EF4444" }]}>{item.requested_quantity} units</Text>
            </View>
            <View style={styles.qtyBox}>
              <Text style={[styles.qtyLabel, { color: muted }]}>In Warehouse</Text>
              <Text style={[styles.qtyVal, { color: foreground }]}>{item.available_quantity} units</Text>
            </View>
            {Boolean(item.duration) && (
              <View style={styles.qtyBox}>
                <Text style={[styles.qtyLabel, { color: muted }]}>Resolved In</Text>
                <Text style={[styles.qtyVal, { color: activeColor }]}>{item.duration}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Button */}
        {isPending && canApprove && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleAction(item.id, "approve")}
              disabled={actionLoadingId === item.id}
            >
              {actionLoadingId === item.id ? (
                <ActivityIndicator size="small" color="#06281E" />
              ) : (
                <>
                  <Ionicons name="cube" size={16} color="#06281E" />
                  <Text style={styles.approveBtnText}>Confirm Stock Available</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleAction(item.id, "reject")}
              disabled={actionLoadingId === item.id}
            >
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {["all", "pending", "approved", "rejected"].map((st) => (
          <TouchableOpacity
            key={st}
            style={[
              styles.filterPill,
              statusFilter === st && { backgroundColor: activeColor },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setStatusFilter(st);
            }}
          >
            <Text
              style={[
                styles.filterText,
                { color: statusFilter === st ? "#06281E" : muted },
              ]}
            >
              {st.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={activeColor} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
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
              <Ionicons name="cube-outline" size={38} color={muted} />
              <Text style={[styles.emptyTitle, { color: foreground }]}>No Stock Requests</Text>
              <Text style={[styles.emptySub, { color: muted }]}>
                {statusFilter !== "all"
                  ? `No shortage requests matching "${statusFilter}".`
                  : "Warehouse stock is currently sufficient for all active proformas."}
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
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  filterText: {
    fontSize: 11,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
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
    marginBottom: 10,
  },
  docBadge: {
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  customerName: {
    fontSize: 14,
    fontFamily: Typography.bold,
    flex: 1,
  },
  repText: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  detailBox: {
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
  },
  productName: {
    fontSize: 13,
    fontFamily: Typography.semiBold,
  },
  skuText: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
    marginBottom: 8,
  },
  qtyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  qtyBox: {
    alignItems: "flex-start",
  },
  qtyLabel: {
    fontSize: 10,
    fontFamily: Typography.regular,
  },
  qtyVal: {
    fontSize: 13,
    fontFamily: Typography.bold,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: "#10B981",
  },
  approveBtnText: {
    color: "#06281E",
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  rejectBtn: {
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  rejectBtnText: {
    color: "#EF4444",
    fontFamily: Typography.bold,
    fontSize: 12,
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
