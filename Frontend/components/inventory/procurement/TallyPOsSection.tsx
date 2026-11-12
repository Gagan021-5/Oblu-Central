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
import { SearchBar } from "@/components/ui/SearchBar";
import api from "@/services/api";
import { TallyPO } from "./types";
import { TrackedPODetailModal } from "./TrackedShipmentsSection";

interface TallyPOsSectionProps {
  orders: TallyPO[];
  onRefresh: () => void;
}

export function TallyPOsSection({ orders, onRefresh }: TallyPOsSectionProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [startingId, setStartingId] = useState<number | null>(null);
  const [openTrackingId, setOpenTrackingId] = useState<number | null>(null);

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
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholders={[
          'Search "voucher no"',
          'Search "supplier"',
          'Search "order item"',
        ]}
        intervalMs={2000}
        onClear={() => setSearch("")}
      />

      {filtered.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="receipt-outline" size={38} color={colors.textMuted} />
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>No Tally Purchase Orders</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
            No matching synced Tally purchase orders found.
          </Text>
        </View>
      ) : (
        filtered.map((tpo) => (
          <View
            key={tpo.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.voucherBadge, { backgroundColor: colors.secondarySurface }]}>
                    <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: colors.textPrimary }}>
                      {tpo.voucher_number}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: colors.textMuted }}>{tpo.date}</Text>
                </View>
                <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: colors.textPrimary, marginTop: 6 }}>
                  {tpo.party_name}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontFamily: Typography.bold, color: colors.primary }}>
                {tpo.total_value_display}
              </Text>
            </View>

            {tpo.items.length > 0 && (
              <View style={{ gap: 5, marginTop: 10 }}>
                {tpo.items.map((it) => (
                  <View
                    key={it.id}
                    style={[
                      styles.itemPill,
                      {
                        backgroundColor: colors.secondarySurface,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: colors.primary }}>
                      x {it.quantity}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.cardBorder,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {tpo.item_count} line item{tpo.item_count === 1 ? "" : "s"} · {tpo.total_quantity.toLocaleString()} units
              </Text>

              <TouchableOpacity
                disabled={startingId === tpo.id}
                onPress={() => handleStartTracking(tpo)}
                style={[
                  styles.actionBtn,
                  tpo.is_tracked
                    ? { backgroundColor: colors.secondarySurface, borderColor: colors.cardBorder, borderWidth: 1 }
                    : { backgroundColor: colors.primary },
                ]}
              >
                {startingId === tpo.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={tpo.is_tracked ? "eye-outline" : "add"}
                      size={14}
                      color={tpo.is_tracked ? colors.primary : "#FFFFFF"}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: Typography.bold,
                        color: tpo.is_tracked ? colors.textPrimary : "#FFFFFF",
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
