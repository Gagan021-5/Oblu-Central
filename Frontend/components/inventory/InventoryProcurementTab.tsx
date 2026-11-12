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
import { Typography, Radius } from "@/constants/theme";
import api from "@/services/api";
import { TrackedPO, TallyPO, PipelineStage } from "./procurement/types";
import { POPlannerSection } from "./procurement/POPlannerSection";
import { TallyPOsSection } from "./procurement/TallyPOsSection";
import { TrackedShipmentsSection } from "./procurement/TrackedShipmentsSection";
import { PipelineStagesSection } from "./procurement/PipelineStagesSection";

interface InventoryProcurementTabProps {
  initialSection?: "planner" | "tally" | "tracked" | "stages";
}

export function InventoryProcurementTab({
  initialSection = "tracked",
}: InventoryProcurementTabProps) {
  const { colors } = useTheme();
  const mode = initialSection;

  const [trackedOrders, setTrackedOrders] = useState<TrackedPO[]>([]);
  const [tallyOrders, setTallyOrders] = useState<TallyPO[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(initialSection !== "planner");
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (mode === "planner") {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get("/inventory/purchase-orders/");
      if (res.data?.status === "success") {
        setTrackedOrders(res.data.tracked_orders || []);
        setTallyOrders(res.data.tally_orders || []);
        setStages(res.data.stages || []);
      }
    } catch (err: any) {
      console.warn("[InventoryProcurementTab] Error:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {mode === "planner"
              ? "PO Planner"
              : mode === "tally"
              ? "Tally Purchase Orders"
              : mode === "stages"
              ? "Pipeline Stages"
              : "Tracked Shipments"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {mode === "planner"
              ? "Category-based demand forecast & reorder generator"
              : mode === "tally"
              ? "Synced Tally purchase orders & shipment tracking activation"
              : mode === "stages"
              ? "Manage workflow milestones & estimated transit lead times"
              : "Live inbound shipments, stage logs & arrived quantities"}
          </Text>
        </View>
        {mode !== "planner" && (
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {mode === "planner" ? (
        <POPlannerSection />
      ) : loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading procurement orders...
          </Text>
        </View>
      ) : mode === "tally" ? (
        <TallyPOsSection orders={tallyOrders} onRefresh={fetchOrders} />
      ) : mode === "stages" ? (
        <PipelineStagesSection stages={stages} onRefresh={fetchOrders} />
      ) : (
        <TrackedShipmentsSection orders={trackedOrders} onRefresh={fetchOrders} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontFamily: Typography.bold },
  subtitle: { fontSize: 12, marginTop: 2, fontFamily: Typography.regular },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { fontSize: 13, fontFamily: Typography.medium },
});
