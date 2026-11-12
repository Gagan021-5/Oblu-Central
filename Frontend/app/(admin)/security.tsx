import React, { useState, useMemo, useCallback } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes, Radius, Shadows } from "@/constants/theme";
import { MetricCard } from "@/components/employee/MetricCard";

interface DeviceItem {
  id: string;
  username: string;
  role: string;
  model: string;
  appVersion: string;
  lastPing: string;
  status: "Active" | "Not Linked" | "Deactivated";
}

const INITIAL_DEVICES: DeviceItem[] = [
  { id: "1", username: "Bhavya_Bhardwaj", role: "Sales Specialist", model: "Vivo V27 5G", appVersion: "v1.4.2", lastPing: "Just now", status: "Active" },
  { id: "2", username: "Gagan_Sharma", role: "Admin", model: "Pixel 8 Pro", appVersion: "v1.4.2", lastPing: "2 mins ago", status: "Active" },
  { id: "3", username: "Anshika_Verma", role: "HR Executive", model: "Samsung Galaxy A53", appVersion: "v1.4.1", lastPing: "10 mins ago", status: "Active" },
  { id: "4", username: "Vivek_Kumar", role: "Warehouse Lead", model: "Redmi Note 12", appVersion: "v1.4.2", lastPing: "1 hour ago", status: "Active" },
  { id: "5", username: "Vikas_Yadav", role: "Logistics", model: "No device linked", appVersion: "N/A", lastPing: "Offline", status: "Not Linked" },
];

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = (user?.role || "").toLowerCase().includes("admin");

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

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

        <View style={styles.topBarRightPlaceholder} />
      </View>

      <FlatList
        data={INITIAL_DEVICES}
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
                value="18"
                subValue="active phones"
                icon="shield-checkmark-outline"
                isHighlight
              />
              <MetricCard
                label="Sync Health"
                value="100%"
                subValue="devices online"
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
