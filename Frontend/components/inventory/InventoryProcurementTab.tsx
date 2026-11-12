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
  const { colors, isDark } = useTheme();

  const [mode, setMode] = useState<"planner" | "tally" | "tracked" | "stages">(initialSection);
  const [trackedOrders, setTrackedOrders] = useState<TrackedPO[]>([]);
  const [tallyOrders, setTallyOrders] = useState<TallyPO[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (initialSection) {
      setMode(initialSection);
    }
  }, [initialSection]);

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
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.title, { color: foreground }]}>
            {mode === "planner"
              ? "PO Planner"
              : mode === "tally"
              ? "Tally Purchase Orders"
              : mode === "stages"
              ? "Pipeline Stages"
              : "Tracked Shipments"}
          </Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            {mode === "planner"
              ? "Category-based demand forecast & reorder generator"
              : mode === "tally"
              ? "Synced Tally purchase orders & shipment tracking activation"
              : mode === "stages"
              ? "Manage workflow milestones & estimated transit lead times"
              : "Live inbound shipments, stage logs & arrived quantities"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.iconBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <Ionicons name="refresh" size={16} color="#00A879" />
        </TouchableOpacity>
      </View>

      {/* Segmented 4-Way Procurement Switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScroll}
      >
        <TouchableOpacity
          onPress={() => setMode("planner")}
          style={[
            styles.tabPill,
            mode === "planner" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="clipboard-outline"
            size={13}
            color={mode === "planner" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: mode === "planner" ? "#FFFFFF" : muted,
                fontFamily: mode === "planner" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            PO Planner
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode("tally")}
          style={[
            styles.tabPill,
            mode === "tally" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="receipt-outline"
            size={13}
            color={mode === "tally" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: mode === "tally" ? "#FFFFFF" : muted,
                fontFamily: mode === "tally" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Tally POs ({tallyOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode("tracked")}
          style={[
            styles.tabPill,
            mode === "tracked" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="bus-outline"
            size={13}
            color={mode === "tracked" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: mode === "tracked" ? "#FFFFFF" : muted,
                fontFamily: mode === "tracked" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Tracked Shipments ({trackedOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode("stages")}
          style={[
            styles.tabPill,
            mode === "stages" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="git-network-outline"
            size={13}
            color={mode === "stages" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: mode === "stages" ? "#FFFFFF" : muted,
                fontFamily: mode === "stages" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Pipeline Stages ({stages.length})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Content */}
      {mode === "planner" ? (
        <POPlannerSection />
      ) : loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#00A879" />
          <Text style={[styles.loadingText, { color: muted }]}>Loading procurement orders...</Text>
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
  tabScroll: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 14,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  tabPillText: { fontSize: 12 },
  centerBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { fontSize: 13, fontFamily: Typography.medium },
});
