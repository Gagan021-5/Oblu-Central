/**
 * Oblu Employee Device Status Screen
 * High-performance, flicker-free connection hub with dedicated Light and Dark/Black theme modes.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { useAppForeground } from "@/hooks/useAppState";
import {
  syncCallLogs,
  getLastSyncTime,
} from "@/services/callLogSync";
import { registerBackgroundSync } from "@/services/backgroundSync";
import { Ionicons } from "@expo/vector-icons";
import { Shadows, Typography, FontSizes, Spacing, Radius } from "@/constants/theme";
import { FloatingTabBar } from "@/components/employee/FloatingTabBar";
import { addCustomerRemarkApi, scheduleCustomerFollowUpApi } from "@/services/customerService";
import { createLeadApi } from "@/services/leadService";
import { scheduleFollowUpNotifications } from "@/services/followUpNotificationService";
import { mockEmployee } from "@/data/mockEmployee";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";
import { hasTeamHierarchy } from "@/services/permissionService";

const themeModes: Array<{ key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "light", label: "Light", icon: "sunny-outline" },
  { key: "dark", label: "Dark", icon: "moon-outline" },
  { key: "system", label: "System", icon: "phone-portrait-outline" },
];

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { user, permissionProfile, logout } = useAuth();
  const canViewTeamCalls = hasTeamHierarchy(user, permissionProfile);
  const { colors, isDark, mode, setMode } = useTheme();

  const avatarInitials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : mockEmployee.avatarInitials;

  const [lastSync, setLastSync] = useState<string | null>(null);
  const [permissionActive, setPermissionActive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  // Quick Action Modal states for full navigation parity with Employee Workspace
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [remarkModalVisible, setRemarkModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [leadModalVisible, setLeadModalVisible] = useState(false);

  const handleSyncCallsFromModal = async () => {
    await performSync();
    await refreshStats();
  };

  const handleSaveRemark = async (text: string) => {
    try {
      await addCustomerRemarkApi("1", text);
    } catch {
      // Ignored
    }
  };

  const handleScheduleFollowUp = async (data: any) => {
    try {
      await scheduleCustomerFollowUpApi("1", data);
      await scheduleFollowUpNotifications({
        customerName: "Orion Systems",
        customerId: "cust-001",
        followUpDate: data.date,
        followUpTime: data.time,
        purpose: data.purpose,
        notes: data.notes,
      });
    } catch {
      // Ignored
    }
  };

  const handleCreateLead = async (data: any) => {
    try {
      const created = await createLeadApi(data);
      router.push(`/(employee)/leads/${created.id}` as any);
    } catch {
      // Ignored
    }
  };

  const syncInProgress = useRef(false);

  // Strictly read-only permission check — NEVER pops modal dialog to avoid background/foreground loop
  const checkPermissionReadOnly = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      setPermissionActive(true);
      return true;
    }
    try {
      const isGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
      );
      setPermissionActive(isGranted);
      return isGranted;
    } catch {
      setPermissionActive(false);
      return false;
    }
  }, []);

  // Refresh display stats
  const refreshStats = useCallback(async () => {
    try {
      const syncTime = await getLastSyncTime();
      setLastSync(syncTime);
    } catch {
      // Ignore
    }
  }, []);

  // Quiet sync handler with zero render-loop churn
  const performSync = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      await syncCallLogs();
    } catch {
      // Quiet background failure handling
    } finally {
      syncInProgress.current = false;
      const syncTime = await getLastSyncTime();
      setLastSync(syncTime);
    }
  }, []);

  // Initial load & continuous real-time background sync (Runs cleanly once on mount)
  useEffect(() => {
    let intervalId: any = null;

    (async () => {
      const granted = await checkPermissionReadOnly();
      await refreshStats();
      registerBackgroundSync().catch(() => {});
      if (granted) {
        await performSync();
      }

      // Continuous 30-second live background synchronization interval
      intervalId = setInterval(() => {
        performSync();
      }, 30000);
    })();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkPermissionReadOnly, refreshStats, performSync]);

  // Sync quietly when returning from background — only if permissions already granted
  useAppForeground(() => {
    checkPermissionReadOnly().then((granted) => {
      if (granted) performSync();
    });
  });

  const onPullRefresh = async () => {
    setRefreshing(true);
    const granted = await checkPermissionReadOnly();
    if (granted) await performSync();
    await refreshStats();
    setRefreshing(false);
  };

  const handleManualSync = async () => {
    if (syncingNow) return;
    setSyncingNow(true);
    const granted = await checkPermissionReadOnly();
    if (granted) {
      await performSync();
      Alert.alert("Sync Complete", "Call logs are synchronized with your Oblu dashboard.");
    } else {
      Alert.alert("Permission Required", "Please grant call log permission first.");
    }
    setSyncingNow(false);
  };

  // User-initiated permission request (triggered ONLY on manual button click)
  const handlePermissionRequest = async () => {
    if (Platform.OS !== "android") return;
    try {
      const audioPerm =
        Number(Platform.Version) >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const statuses = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        audioPerm,
      ]);

      const callLogGranted =
        statuses[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] ===
        PermissionsAndroid.RESULTS.GRANTED;

      setPermissionActive(callLogGranted);
      if (callLogGranted) {
        await performSync();
      } else {
        Alert.alert(
          "Permission Required",
          "Call log access is needed to record business activities. Please enable 'Call logs' for Oblu in App Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch {
      Linking.openSettings();
    }
  };

  const topPadding = Math.max(insets.top, 20);

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPadding + 14,
            paddingBottom: insets.bottom + 104,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
      {/* Header */}
      <View style={styles.topRow}>
        <View style={styles.userHeaderLeft}>
          <TouchableOpacity
            style={[
              styles.backNavBtn,
              {
                backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
                borderColor: isDark ? "#294039" : "#D8E0DC",
              },
            ]}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                const isAdmin = (user?.role || "").toLowerCase().includes("admin");
                router.replace(isAdmin ? "/(admin)/users" : "/(employee)");
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={isDark ? "#F1F7F4" : "#101513"}
            />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text
              style={[styles.greetingTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              Hello, {user?.username ?? "Team Member"}
            </Text>
            <View style={styles.appStatusPill}>
              <View style={[styles.statusDotLive, { backgroundColor: colors.emerald }]} />
              <Text style={[styles.greetingSubtitle, { color: colors.primary }]}>
                Oblu Sync Active
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <SubAppHomeButton size={38} />
          {/* Top Right Appearance / Theme Mode Toggle */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
            onPress={() => setMode(isDark ? "light" : "dark")}
            activeOpacity={0.75}
            accessibilityLabel="Toggle Dark / Light Theme"
          >
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={isDark ? "#35D6A0" : "#00A879"}
            />
          </TouchableOpacity>

          {/* Profile Avatar Button (Navigates to profile where employee details and sign out are located) */}
          <TouchableOpacity
            style={[
              styles.avatarButton,
              {
                backgroundColor: isDark ? "#1B2B25" : "#00A879",
                borderColor: isDark ? "#35D6A0" : "rgba(0, 168, 121, 0.3)",
              },
            ]}
            onPress={() => router.push("/(employee)/profile" as any)}
            activeOpacity={0.8}
            accessibilityLabel="View Profile"
          >
            <Text
              style={[
                styles.avatarText,
                { color: isDark ? "#35D6A0" : "#FFFFFF" },
              ]}
            >
              {avatarInitials}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {canViewTeamCalls && (
        <TouchableOpacity
          onPress={() => router.push("/(admin)/call-logs" as any)}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 14,
            borderRadius: 16,
            backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#EBF7F3",
            borderWidth: 1,
            borderColor: isDark ? "rgba(53, 214, 160, 0.35)" : "rgba(0, 168, 121, 0.28)",
            marginBottom: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: "#159A7C",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="people-outline" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Typography.bold, fontSize: 14, color: colors.textPrimary }}>
                Team Call Logs & Recordings
              </Text>
              <Text style={{ fontFamily: Typography.regular, fontSize: 12, color: colors.textSecondary }}>
                View calls & recordings for your downline team
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#159A7C" />
        </TouchableOpacity>
      )}

      {/* Primary Connection Status Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
          Shadows.cardElevated,
        ]}
      >
        <View style={styles.statusIconContainer}>
          <View
            style={[
              styles.statusIconBg,
              {
                backgroundColor: permissionActive
                  ? colors.emeraldLight
                  : colors.amberLight,
              },
            ]}
          >
            <Ionicons
              name={permissionActive ? "shield-checkmark" : "warning-outline"}
              size={34}
              color={permissionActive ? colors.emerald : colors.amber}
            />
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: permissionActive
                ? colors.emeraldLight
                : colors.amberLight,
            },
          ]}
        >
          <View
            style={[
              styles.greenDot,
              {
                backgroundColor: permissionActive ? colors.emerald : colors.amber,
              },
            ]}
          />
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: permissionActive ? colors.emerald : colors.amber,
              },
            ]}
          >
            {permissionActive ? "CONNECTED & ACTIVE" : "PERMISSION REQUIRED"}
          </Text>
        </View>

        <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
          Activity Sync
        </Text>
        <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>
          {permissionActive
            ? "Your device is connected to the team workspace. New call logs are automatically captured and synced to the CRM."
            : "Call log permission is required on this device to track business calls and sync with your team."}
        </Text>

        {/* Sync Now Button */}
        <TouchableOpacity
          style={[
            styles.syncNowButton,
            {
              backgroundColor: colors.mintTintedSurface,
              borderColor: colors.primaryBorder,
            },
          ]}
          onPress={handleManualSync}
          disabled={syncingNow}
          activeOpacity={0.75}
        >
          {syncingNow ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
              <Text style={[styles.syncNowText, { color: colors.primary }]}>
                Sync Activity Now
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Status Diagnostics Card ──────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          DEVICE & CONNECTION STATUS
        </Text>
      </View>

      <View
        style={[
          styles.detailsCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
          Shadows.card,
        ]}
      >
        {/* Sync Status Row */}
        <View style={styles.detailRow}>
          <View
            style={[
              styles.detailIconBg,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Ionicons name="sync-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
              Sync Channel
            </Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {refreshing ? "Refreshing..." : "Active (Background)"}
            </Text>
          </View>
          <View
            style={[
              styles.statusTag,
              { backgroundColor: colors.emeraldLight },
            ]}
          >
            <Text style={[styles.statusTagText, { color: colors.emerald }]}>
              Online
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

        {/* Last Sync Time Row */}
        <View style={styles.detailRow}>
          <View
            style={[
              styles.detailIconBg,
              { backgroundColor: colors.cyanLight },
            ]}
          >
            <Ionicons name="time-outline" size={18} color={colors.cyan} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
              Last Synchronized
            </Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {lastSync || "Just now"}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

        {/* Permission Row */}
        <TouchableOpacity
          style={styles.detailRow}
          onPress={handlePermissionRequest}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.detailIconBg,
              {
                backgroundColor: permissionActive
                  ? colors.emeraldLight
                  : colors.amberLight,
              },
            ]}
          >
            <Ionicons
              name={
                permissionActive
                  ? "checkmark-circle-outline"
                  : "alert-circle-outline"
              }
              size={18}
              color={permissionActive ? colors.emerald : colors.amber}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
              Call Log Permission
            </Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
              {permissionActive ? "Permission Granted" : "Permission Required"}
            </Text>
          </View>
          <View
            style={[
              styles.statusTag,
              {
                backgroundColor: permissionActive
                  ? colors.emeraldLight
                  : colors.amberLight,
              },
            ]}
          >
            <Text
              style={[
                styles.statusTagText,
                { color: permissionActive ? colors.emerald : colors.amber },
              ]}
            >
              {permissionActive ? "Granted" : "Tap to Grant"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {/* Persistent Floating Bottom Navigation Dock */}
      <FloatingTabBar />

      
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  userHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  backNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  greetingTitle: {
    fontFamily: Typography.bold,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  greetingSubtitle: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  heroCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xxl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  statusIconContainer: {
    marginBottom: 12,
  },
  statusIconBg: {
    width: 66,
    height: 66,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginBottom: 12,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontFamily: Typography.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: Typography.heading,
    fontSize: 21,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroDescription: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  syncNowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  syncNowText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
    letterSpacing: 0.2,
  },
  sectionHeader: {
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.micro,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  themeCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 10,
    marginBottom: Spacing.xl,
  },
  themeRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  themeBtnText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.caption,
  },
  detailsCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIconBg: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  detailLabel: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.micro,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.bodySmall,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  statusTagText: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.caption,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  infoText: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    textAlign: "center",
    lineHeight: 16,
    flex: 1,
  },
});
