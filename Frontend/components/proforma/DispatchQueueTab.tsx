import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import {
  DispatchQueueItem,
  fetchDispatchQueueApi,
} from "@/services/proformaService";

interface DispatchQueueTabProps {
  queueType: "all" | "accounts" | "warehouse";
  searchQuery?: string;
  onOpenDispatchDetail: (invoiceId: number) => void;
}

export function DispatchQueueTab({
  queueType,
  searchQuery = "",
  onOpenDispatchDetail,
}: DispatchQueueTabProps) {
  const { colors, isDark } = useTheme();

  const [items, setItems] = useState<DispatchQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const bg = isDark ? "#0C0E15" : "#FFFFFF";
  const cardBg = isDark ? "#12151E" : "#F8FAFC";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0";
  const foreground = isDark ? "#F8FAFC" : "#101513";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const activeColor = "#10B981";

  const loadData = useCallback(async (isPull = false) => {
    if (!isPull) setLoading(true);
    try {
      const data = await fetchDispatchQueueApi({
        type: queueType,
        search: searchQuery,
      });
      setItems(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queueType, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "packing_approved":
      case "completed":
        return "#10B981";
      case "waiting_for_packing":
        return "#3B82F6";
      case "packed_awaiting_approval":
        return "#F59E0B";
      case "packing_rejected":
        return "#EF4444";
      default:
        return "#8B5CF6";
    }
  };

  const renderItem = ({ item }: { item: DispatchQueueItem }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => {
          if (item.invoice_id) {
            triggerLightHaptic();
            onOpenDispatchDetail(item.invoice_id);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.invoiceNum, { color: activeColor }]}>{item.invoice_number}</Text>
              <Text style={[styles.customerName, { color: foreground }]} numberOfLines={1}>
                {item.customer_name}
              </Text>
            </View>
            <Text style={[styles.createdText, { color: muted }]}>
              {item.shipment_method} • {item.created_at}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status_display}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={[styles.infoRow, { backgroundColor: isDark ? "#161B26" : "#F1F5F9" }]}>
          <View style={styles.infoCol}>
            <Ionicons name="camera-outline" size={14} color={muted} />
            <Text style={[styles.infoText, { color: foreground }]}>
              {item.photos_count} packing photos
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Ionicons name="cube-outline" size={14} color={muted} />
            <Text style={[styles.infoText, { color: foreground }]}>{item.items_count} SKU items</Text>
          </View>
          <View style={styles.infoCol}>
            <Ionicons name="time-outline" size={14} color={muted} />
            <Text style={[styles.infoText, { color: activeColor }]}>{item.time_in_stage}</Text>
          </View>
        </View>

        {/* Action Prompt */}
        <View style={styles.actionPromptRow}>
          <Text style={[styles.actionPromptText, { color: activeColor }]}>
            {queueType === "warehouse" ? "Tap to Capture Packing Photos & Docket" : "Tap to Inspect & Approve Packing"}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={activeColor} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={activeColor} />
      ) : (
        <FlatList
          data={items}
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
              <Ionicons name="airplane-outline" size={38} color={muted} />
              <Text style={[styles.emptyTitle, { color: foreground }]}>No Active Dispatches</Text>
              <Text style={[styles.emptySub, { color: muted }]}>
                {queueType === "warehouse"
                  ? "No packages currently waiting for warehouse packing."
                  : "All proforma shipments are currently up to date."}
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
    marginBottom: 10,
  },
  invoiceNum: {
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  customerName: {
    fontSize: 14,
    fontFamily: Typography.bold,
    flex: 1,
  },
  createdText: {
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 10,
    marginVertical: 4,
  },
  infoCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    fontFamily: Typography.medium,
  },
  actionPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 4,
  },
  actionPromptText: {
    fontSize: 11,
    fontFamily: Typography.bold,
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
