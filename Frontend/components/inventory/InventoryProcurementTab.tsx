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
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
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

  const [trackedOrders, setTrackedOrders] = useState<TrackedPO[]>([]);
  const [tallyOrders, setTallyOrders] = useState<TallyPO[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(initialSection !== "planner");
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (initialSection !== "planner") {
      fetchOrders();
    }
  }, [initialSection, fetchOrders]);

  const onRefresh = () => {
    if (initialSection === "planner") return;
    setRefreshing(true);
    fetchOrders();
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
      refreshControl={
        initialSection !== "planner" ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {initialSection === "planner"
              ? "PO Planner"
              : initialSection === "tally"
              ? "Tally Purchase Orders"
              : initialSection === "stages"
              ? "Pipeline Stages"
              : "Tracked Shipments"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {initialSection === "planner"
              ? "Category demand forecast & reorder generator"
              : initialSection === "tally"
              ? `${tallyOrders.length} synced Tally purchase orders`
              : initialSection === "stages"
              ? `${stages.length} workflow milestones & transit lead times`
              : `${trackedOrders.length} tracked shipments & stage progress`}
          </Text>
        </View>
        {initialSection !== "planner" && (
          <TouchableOpacity
            onPress={onRefresh}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Active Section */}
      {initialSection === "planner" ? (
        <POPlannerSection />
      ) : loading && !refreshing ? (
        <SkeletonCardList count={4} height={106} />
      ) : initialSection === "tally" ? (
        <TallyPOsSection orders={tallyOrders} onRefresh={fetchOrders} />
      ) : initialSection === "stages" ? (
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

