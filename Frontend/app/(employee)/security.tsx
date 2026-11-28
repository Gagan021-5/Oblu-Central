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
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/api";
import { hasTeamHierarchy, isAdminUser } from "@/services/permissionService";
import { Typography, FontSizes, Radius, Shadows } from "@/constants/theme";
import { MetricCard } from "@/components/employee/MetricCard";
import { FloatingTabBar } from "@/components/employee/FloatingTabBar";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";

interface DeviceItem {
  id: string;
  username: string;
  role: string;
  model: string;
  appVersion: string;
  lastPing: string;
  status: "Active" | "Not Linked" | "Deactivated";
}

function formatLastPing(ts?: string | null): string {
  if (!ts) return "Never synced";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "Recently";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
  const { user, permissionProfile } = useAuth();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = isAdminUser(user, permissionProfile);
  const canViewTeam = hasTeamHierarchy(user, permissionProfile);

  const loadDevices = useCallback(async () => {
    try {
      if (canViewTeam) {
        const res = await api.get("/admin/users/", { params: { page_size: 200 } });
        const list = res.data?.results || res.data || [];
        if (Array.isArray(list)) {
          setDevices(
            list.map((u: any) => ({
              id: String(u.id),
              username: u.username,
              role: u.role || "employee",
              model: u.device_model || (u.device_id ? "Android Device" : "No device linked"),
              appVersion: u.app_version || "N/A",
              lastPing: formatLastPing(u.last_call_timestamp),
              status: u.device_id ? "Active" : "Not Linked",
            }))
          );
          return;
        }
      }
      if (user) {
        setDevices([
          {
            id: String(user.id),
            username: user.username,
            role: user.role || "Employee",
            model: "Current Device",
            appVersion: "Active",
            lastPing: "Just now",
            status: "Active",
          },
        ]);
      }
    } catch {
      // keep existing state on transient network failure
    }
  }, [canViewTeam, user]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDevices();
    setRefreshing(false);
  }, [loadDevices]);

  const linkedCount = useMemo(
    () => devices.filter((d) => d.status === "Active").length,
    [devices]
  );
  const syncHealthPct = useMemo(
    () => (devices.length > 0 ? Math.round((linkedCount / devices.length) * 100) : 0),
    [devices.length, linkedCount]
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg, paddingTop: insets.top }]}>
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

        <SubAppHomeButton size={38} />
      </View>

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
                value={`${syncHealthPct}%`}
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

      <FloatingTabBar />
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
