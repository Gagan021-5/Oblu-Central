import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";
import { TallyPO } from "./types";
import { TrackedPODetailModal } from "./TrackedShipmentsSection";

interface TallyPOsSectionProps {
  orders: TallyPO[];
  onRefresh: () => void;
}

export function TallyPOsSection({ orders, onRefresh }: TallyPOsSectionProps) {
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState("");
  const [startingId, setStartingId] = useState<number | null>(null);
  const [openTrackingId, setOpenTrackingId] = useState<number | null>(null);

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const cardBorder = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";

  const filtered = orders.filter((tpo) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      tpo.voucher_number.toLowerCase().includes(q) ||
      tpo.party_name.toLowerCase().includes(q) ||
      tpo.items.some((it) => it.name.toLowerCase().includes(q))
    );
  });

  const handleStartTracking = async (tpo: TallyPO) => {
    if (tpo.is_tracked && tpo.tracking_id) {
      setOpenTrackingId(tpo.tracking_id);
      return;
    }
    try {
      setStartingId(tpo.id);
      const res = await api.post(`/inventory/tally-po/${tpo.id}/start-tracking/`);
      if (res.data?.status === "success" && res.data.tracked_order?.id) {
        onRefresh();
        setOpenTrackingId(res.data.tracked_order.id);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || err?.message || "Could not start PO tracking.");
    } finally {
      setStartingId(null);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.searchBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <Ionicons name="search" size={16} color={muted} />
        <TextInput
          placeholder="Search voucher no, supplier, or item..."
          placeholderTextColor={muted}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, color: fg, fontSize: 13 }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={muted} />
          </TouchableOpacity>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Ionicons name="receipt-outline" size={38} color={muted} />
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg }}>No Tally Purchase Orders</Text>
          <Text style={{ fontSize: 12, color: muted, textAlign: "center" }}>
            No matching synced Tally purchase orders found.
          </Text>
        </View>
      ) : (
        filtered.map((tpo) => (
          <View
            key={tpo.id}
            style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.voucherBadge, { backgroundColor: isDark ? "#1E332D" : "#F1F5F9" }]}>
                    <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: fg }}>
                      {tpo.voucher_number}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: muted }}>{tpo.date}</Text>
                </View>
                <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: "#6366F1", marginTop: 6 }}>
                  {tpo.party_name}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: "#00A879" }}>
                {tpo.total_value_display}
              </Text>
            </View>

            {/* Inventory Items List */}
            {tpo.items.length > 0 && (
              <View style={{ gap: 5, marginTop: 10 }}>
                {tpo.items.map((it) => (
                  <View
                    key={it.id}
                    style={[
                      styles.itemPill,
                      {
                        backgroundColor: isDark ? "#0A1310" : "#F0F4FF",
                        borderColor: isDark ? "#1E332D" : "#E0E7FF",
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, color: isDark ? "#E2E8F0" : "#312E81", flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: "#6366F1" }}>
                      x {it.quantity}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Tracking Action Row */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: cardBorder,
              }}
            >
              <Text style={{ fontSize: 11, color: muted }}>
                {tpo.item_count} line item{tpo.item_count === 1 ? "" : "s"} · {tpo.total_quantity.toLocaleString()} units
              </Text>

              <TouchableOpacity
                disabled={startingId === tpo.id}
                onPress={() => handleStartTracking(tpo)}
                style={[
                  styles.actionBtn,
                  tpo.is_tracked
                    ? { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }
                    : { backgroundColor: "#6366F1" },
                ]}
              >
                {startingId === tpo.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={tpo.is_tracked ? "eye-outline" : "add"}
                      size={14}
                      color={tpo.is_tracked ? fg : "#FFFFFF"}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: Typography.bold,
                        color: tpo.is_tracked ? fg : "#FFFFFF",
                      }}
                    >
                      {tpo.is_tracked ? "View Tracking" : "Start Tracking"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <TrackedPODetailModal
        visible={openTrackingId !== null}
        poId={openTrackingId}
        onClose={() => setOpenTrackingId(null)}
        onUpdated={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  voucherBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemPill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
});
