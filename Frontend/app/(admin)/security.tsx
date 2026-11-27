import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes, Radius, Shadows } from "@/constants/theme";
import { MetricCard } from "@/components/employee/MetricCard";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";

interface DeviceItem {
  id: string;
  username: string;
  role: string;
  model: string;
  appVersion: string;
  lastPing: string;
  status: "Active" | "Not Linked";
  totalCalls: number;
}

function formatLastSeen(ts?: string | null): string {
  if (!ts) return "Never synced";
  try {
    const d = new Date(ts);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  } catch {
    return "Synced";
  }
}

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = (user?.role || "").toLowerCase().includes("admin");

  const fetchDevices = useCallback(async (isPull?: boolean) => {
    const pull = Boolean(isPull);
    if (!pull) setLoading(true);
    try {
      const res = await api.get("/admin/users/", { params: { page_size: 100 } });
      const rawUsers = res.data?.results || res.data || [];
      const mapped: DeviceItem[] = (Array.isArray(rawUsers) ? rawUsers : []).map((u: any) => {
        const hasDevice = Boolean(u.device_id || u.device_model || u.consent_given || (u.total_call_logs || 0) > 0);
        return {
          id: String(u.id),
          username: u.username || `User #${u.id}`,
          role: u.role || "employee",
          model: u.device_model || (hasDevice ? "Android Device" : "No device linked"),
          appVersion: u.app_version ? `v${String(u.app_version).replace(/^v/i, "")}` : "N/A",
          lastPing: formatLastSeen(u.last_call_timestamp),
          status: hasDevice ? "Active" : "Not Linked",
          totalCalls: Number(u.total_call_logs) || 0,
        };
      });
      // Sort Active devices first, then by call count
      mapped.sort((a, b) => {
        if (a.status !== b.status) return a.status === "Active" ? -1 : 1;
        return b.totalCalls - a.totalCalls;
      });
      setDevices(mapped);
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices(false);
  }, [fetchDevices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDevices(true);
  }, [fetchDevices]);

  const { linkedCount, healthPct } = useMemo(() => {
    const total = devices.length;
    const linked = devices.filter((d) => d.status === "Active").length;
    const pct = total > 0 ? Math.round((linked / total) * 100) : 0;
    return { linkedCount: linked, healthPct: `${pct}%` };
  }, [devices]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? "#192D25" : "#FFFFFF",
              borderColor: isDark ? "#2D493F" : "#D8E0DC",
            },
          ]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(isAdmin ? "/(admin)/users" : "/(employee)"))}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={isDark ? "#F2F8F5" : "#101513"} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.screenHeading, { color: colors.textPrimary }]}>
            Team Devices
          </Text>
          <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
            Linked devices & access security
          </Text>
        </View>

        <SubAppHomeButton size={38} isAdmin={true} />
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <SkeletonCardList count={5} height={74} />
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Linked Devices"
                  value={String(linkedCount)}
                  subValue={`of ${devices.length} team`}
                  icon="shield-checkmark-outline"
                  isHighlight
                />
                <MetricCard
                  label="Sync Health"
                  value={healthPct}
                  subValue="devices linked"
                  icon="hardware-chip-outline"
                />
              </View>
            </View>
          }
        renderItem={({ item }) => {
          const isBound = item.status === "Active";

          return (
            <View
              style={[
                styles.deviceCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarBox,
                  {
                    backgroundColor: isBound
                      ? isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.12)"
                      : isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(16, 21, 19, 0.05)",
                  },
                ]}
              >
                <Ionicons
                  name={isBound ? "phone-portrait" : "alert-circle-outline"}
                  size={18}
                  color={isBound ? (isDark ? "#35D6A0" : "#00A879") : colors.textMuted}
                />
              </View>

              <View style={styles.deviceInfo}>
                <Text style={[styles.deviceName, { color: colors.textPrimary }]} numberOfLines={1}>{item.username}</Text>
                <Text style={[styles.deviceSub, { color: colors.textSecondary }]}>
                  {item.model} • {item.appVersion} • {item.lastPing}
                </Text>
              </View>

              <View
                style={[
                  styles.devicePill,
                  { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(16, 21, 19, 0.05)" },
                ]}
              >
                <View
                  style={[
                    styles.deviceDot,
                    { backgroundColor: isBound ? (isDark ? "#35D6A0" : "#00A879") : colors.textMuted },
                  ]}
                />
                <Text style={[styles.deviceText, { color: colors.textSecondary }]}>{item.status}</Text>
              </View>
            </View>
          );
        }}
      />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
  },
  screenHeading: {
    fontFamily: Typography.bold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  screenSub: {
    fontFamily: Typography.medium,
    fontSize: 12,
    marginTop: 1,
  },
  topBarRightPlaceholder: {
    width: 38,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerBlock: {
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
    ...Shadows.card,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    fontFamily: Typography.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  deviceSub: {
    fontFamily: Typography.medium,
    fontSize: 13,
  },
  devicePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    gap: 6,
  },
  deviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deviceText: {
    fontFamily: Typography.medium,
    fontSize: 12,
  },
});
