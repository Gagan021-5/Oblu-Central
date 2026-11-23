import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeInDown,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes } from "@/constants/theme";
import { employeeTheme } from "@/constants/employeeTheme";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterChip } from "@/components/ui/FilterChip";
import { FloatingTabBar } from "@/components/employee/FloatingTabBar";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";
import { hapticMedium, triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import {
  fetchHRMSDashboardApi,
  fetchHRMSEmployeesApi,
  handleLeaveActionApi,
  punchAttendanceApi,
  HRMSDashboardData,
  EmployeeDirectoryItem,
} from "@/services/hrmsService";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface HeroAttendanceCardProps {
  hasPunchedIn: boolean;
  punchInTime: string | null;
  onPunch: () => void;
  onApplyLeave: () => void;
  isPunching: boolean;
  isDark: boolean;
}

const HeroAttendanceCard: React.FC<HeroAttendanceCardProps> = ({
  hasPunchedIn,
  punchInTime,
  onPunch,
  onApplyLeave,
  isPunching,
}) => {
  const { t, isDark } = useEmployeeTheme();
  const pulseOpacity = useSharedValue(1);
  const buttonScale = useSharedValue(1);
  const progressRatio = useSharedValue(0);

  useEffect(() => {
    if (hasPunchedIn) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 850, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 850, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      const now = new Date();
      const currentH = now.getHours() + now.getMinutes() / 60;
      const ratio = Math.max(0.18, Math.min((currentH - 9.5) / 9.0, 1.0));
      progressRatio.value = withSpring(ratio, { damping: 18, stiffness: 140 });
    } else {
      pulseOpacity.value = 1;
      progressRatio.value = withTiming(0, { duration: 350 });
    }
  }, [hasPunchedIn, progressRatio, pulseOpacity]);

  const pulseDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progressRatio.value * 100)}%`,
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 16, stiffness: 300 });
  };
  const handlePressOut = () => {
    buttonScale.value = withSpring(1.0, { damping: 18, stiffness: 280 });
  };
  const handlePunchPress = () => {
    hapticMedium();
    onPunch();
  };

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const workdayPct = Math.round((hasPunchedIn ? Math.max(0.18, Math.min(((new Date().getHours() + new Date().getMinutes() / 60) - 9.5) / 9.0, 1.0)) : 0) * 100);

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify().damping(18)}
      style={[
        styles.heroTrackerCard,
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderTopColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.98)",
          shadowColor: isDark ? "#000000" : "#0D2B20",
        },
      ]}
    >
      {/* Top Status & Shift Header */}
      <View style={styles.trackerHeader}>
        <View style={styles.trackerStatusRow}>
          <Animated.View
            style={[
              styles.livePulseDot,
              { backgroundColor: hasPunchedIn ? (isDark ? "#10B981" : "#00A879") : (isDark ? "#64748B" : "#8FA09A") },
              hasPunchedIn ? pulseDotStyle : null,
            ]}
          />
          <Text
            style={[
              styles.trackerStatusText,
              { color: hasPunchedIn ? (isDark ? "#10B981" : "#00A879") : (t.textSecondary) },
            ]}
          >
            {hasPunchedIn ? "LIVE SHIFT TRACKER • PUNCHED IN" : "ATTENDANCE TERMINAL • READY"}
          </Text>
        </View>

        <View
          style={[
            styles.shiftBadge,
            { backgroundColor: isDark ? "#1A1E2B" : "#F7F9F8" },
          ]}
        >
          <Text style={[styles.shiftBadgeText, { color: t.textSecondary }]}>
            09:30 – 18:30 (9h Shift)
          </Text>
        </View>
      </View>

      {/* Main Info Row: Check-in Time & Action Buttons */}
      <View style={styles.trackerBodyRow}>
        <View style={styles.timeInfoBlock}>
          <Text style={[styles.timeLabel, { color: t.textSecondary }]}>
            {hasPunchedIn ? "Check-in Timestamp" : "Daily Check-in Status"}
          </Text>
          <Text style={[styles.timeValue, { color: t.text }]}>
            {hasPunchedIn ? (punchInTime || "Today 09:30 AM") : "Not Checked In Today"}
          </Text>
        </View>

        {/* Primary Action Button (Punch In / Punch Out) */}
        <AnimatedPressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePunchPress}
          disabled={isPunching}
          style={[
            styles.punchHeroBtn,
            {
              backgroundColor: hasPunchedIn
                ? isDark ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2"
                : isDark ? "rgba(16, 185, 129, 0.18)" : "#D1FAE5",
              borderColor: hasPunchedIn ? "#EF4444" : (isDark ? "#10B981" : "#00A879"),
            },
            buttonAnimStyle,
          ]}
        >
          {isPunching ? (
            <ActivityIndicator size="small" color={hasPunchedIn ? "#EF4444" : "#10B981"} />
          ) : (
            <>
              <Ionicons
                name={hasPunchedIn ? "log-out" : "log-in"}
                size={16}
                color={hasPunchedIn ? "#EF4444" : (isDark ? "#10B981" : "#00A879")}
              />
              <Text
                style={[
                  styles.punchHeroBtnText,
                  { color: hasPunchedIn ? "#EF4444" : (isDark ? "#10B981" : "#00A879") },
                ]}
              >
                {hasPunchedIn ? "Punch Out" : "Punch In"}
              </Text>
            </>
          )}
        </AnimatedPressable>
      </View>

      {/* Workday Completion Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressTitle, { color: t.textSecondary }]}>
            Workday Completion
          </Text>
          <Text style={[styles.progressPct, { color: hasPunchedIn ? (isDark ? "#10B981" : "#00A879") : (isDark ? "#64748B" : "#8FA09A") }]}>
            {hasPunchedIn ? `${workdayPct}% Elapsed` : "0% (Shift Standby)"}
          </Text>
        </View>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E4ECE8" },
          ]}
        >
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: hasPunchedIn
                  ? isDark ? "#10B981" : "#00A879"
                  : isDark ? "#294039" : "#C5D1CB",
              },
              progressBarStyle,
            ]}
          />
        </View>
      </View>

      {/* Biometric Verification Badge */}
      <View
        style={[
          styles.terminalFooterBanner,
          {
            backgroundColor: isDark ? "#1A1E2B" : "#F7F9F8",
            borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#E8EFEB",
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Ionicons name="shield-checkmark" size={15} color={isDark ? "#10B981" : "#00A879"} />
          <Text style={[styles.terminalFooterText, { color: t.textSecondary }]} numberOfLines={1}>
            Biometric cloud terminal synchronized
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            triggerSelectionHaptic();
            onApplyLeave();
          }}
          style={styles.applyLeaveLink}
        >
          <Text style={[styles.applyLeaveText, { color: isDark ? "#10B981" : "#00A879" }]}>
            Apply Leave
          </Text>
          <Ionicons name="chevron-forward" size={13} color={isDark ? "#10B981" : "#00A879"} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

interface LeaveBalanceItemProps {
  label: string;
  total: number;
  used: number;
  color: string;
  isDark: boolean;
  index: number;
  onPress: () => void;
}

const LeaveBalanceItem: React.FC<LeaveBalanceItemProps> = ({
  label,
  total,
  used,
  color,
  index,
  onPress,
}) => {
  const { t, isDark } = useEmployeeTheme();
  const available = Math.max(total - used, 0);
  const ratio = total > 0 ? available / total : 0;
  const fillAnim = useSharedValue(0);
  const cardScale = useSharedValue(1);

  useEffect(() => {
    fillAnim.value = withTiming(ratio, {
      duration: 800 + index * 100,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillAnim, index, ratio]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(fillAnim.value * 100)}%`,
  }));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handlePressIn = () => {
    cardScale.value = withSpring(0.96, { damping: 16, stiffness: 300 });
  };
  const handlePressOut = () => {
    cardScale.value = withSpring(1.0, { damping: 18, stiffness: 280 });
  };
  const handlePress = () => {
    triggerSelectionHaptic();
    onPress();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(18).stiffness(240)}
      style={[styles.leaveCol, animStyle]}
    >
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.leaveItemCard,
          {
            backgroundColor: t.surface,
            borderColor: t.border,
            borderTopColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.98)",
            shadowColor: isDark ? "#000000" : "#0D2B20",
          },
        ]}
      >
        <Text style={[styles.leaveItemLabel, { color: t.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.leaveNumbersRow}>
          <Text style={[styles.leaveAvailableNum, { color: t.text }]}>
            {available}
          </Text>
          <Text style={[styles.leaveTotalSuffix, { color: isDark ? "#64748B" : "#8FA09A" }]}>
            / {total}d
          </Text>
        </View>

        {/* Mini Balance Fill Bar */}
        <View
          style={[
            styles.leaveMiniTrack,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E8EFEB" },
          ]}
        >
          <Animated.View
            style={[
              styles.leaveMiniBar,
              { backgroundColor: color },
              fillStyle,
            ]}
          />
        </View>

        <Text style={[styles.leaveUsedSubtext, { color: isDark ? "#64748B" : "#8FA09A" }]}>
          {used}d used • {available}d left
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
};

export default function HRMSScreen() {
  const insets = useSafeAreaInsets();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [hrmsData, setHrmsData] = useState<HRMSDashboardData | null>(null);
  const [hrmsEmployees, setHrmsEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [actionLeaveId, setActionLeaveId] = useState<number | null>(null);
  const [activeHRModal, setActiveHRModal] = useState<string | null>(null);

  const isAdmin = (user?.role || "").toLowerCase().includes("admin");

  const loadData = useCallback(async () => {
    try {
      const [dash, emps] = await Promise.all([
        fetchHRMSDashboardApi(),
        fetchHRMSEmployeesApi(),
      ]);
      setHrmsData(dash);
      setHrmsEmployees(emps);
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const onPunchAttendance = async () => {
    if (isPunching) return;
    setIsPunching(true);
    try {
      const res = await punchAttendanceApi();
      if (res && (res as any)?.status === "success" || (res as any)?.success) {
        await loadData();
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsPunching(false);
    }
  };

  const onLeaveAction = async (leaveId: number, action: "approve" | "reject") => {
    setActionLeaveId(leaveId);
    try {
      const res = await handleLeaveActionApi(leaveId, action);
      if (res && (res as any)?.status === "success" || (res as any)?.success) {
        await loadData();
      }
    } catch {
      // Graceful fallback
    } finally {
      setActionLeaveId(null);
    }
  };

  const filteredStaff = useMemo(() => {
    let list = [...hrmsEmployees];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employee_code.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
      );
    }
    if (selectedDept !== "all") {
      list = list.filter(
        (e) => e.department.toLowerCase() === selectedDept.toLowerCase()
      );
    }
    return list;
  }, [hrmsEmployees, searchQuery, selectedDept]);

  const stats = useMemo(() => {
    return {
      workforce: hrmsData?.stats?.total_employees ?? hrmsEmployees.length ?? 2,
      presentToday: hrmsData?.stats?.present_today ?? 0,
      absentToday: hrmsData?.stats?.absent_today ?? 2,
      pendingLeaves: hrmsData?.stats?.pending_leaves ?? 0,
      departments: hrmsData?.stats?.total_departments ?? 0,
    };
  }, [hrmsData, hrmsEmployees]);

  return (
    <View style={[styles.container, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      {/* ── Top Workspace Bar with Back Button ── */}
      <View style={[styles.topBar, { borderBottomColor: t.border }]}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
              borderTopColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
              shadowColor: isDark ? "#000000" : "#0D2B20",
              shadowOpacity: isDark ? 0.35 : 0.08,
            },
          ]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(isAdmin ? "/(admin)/users" : "/(employee)"))}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={t.text} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.screenHeading, { color: t.text }]}>
            HRMS Operations
          </Text>
          <Text style={[styles.screenSub, { color: t.textSecondary }]}>
            Workforce Management, Attendance & Leave Approvals
          </Text>
        </View>

        <SubAppHomeButton size={38} />
      </View>

      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
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
            {/* ── 4 Outward 3D Metric Boxes ── */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                {/* WORKFORCE */}
                <View
                  style={[
                    styles.outwardBox,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.border,
                      borderTopColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
                      borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: t.textSecondary }]}>
                    WORKFORCE
                  </Text>
                  <Text style={[styles.metricValue, { color: t.text }]}>
                    {stats.workforce}
                  </Text>
                  <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                    Active employees
                  </Text>
                </View>

                {/* PRESENT TODAY */}
                <View
                  style={[
                    styles.outwardBox,
                    {
                      backgroundColor: t.surface,
                      borderColor: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(16, 185, 129, 0.20)",
                      borderTopColor: isDark ? "rgba(16, 185, 129, 0.50)" : "rgba(255, 255, 255, 0.98)",
                      borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                    PRESENT TODAY
                  </Text>
                  <Text style={[styles.metricValue, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                    {stats.presentToday}
                  </Text>
                  <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                    {stats.absentToday} on leave / absent
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                {/* PENDING LEAVES */}
                <View
                  style={[
                    styles.outwardBox,
                    {
                      backgroundColor: t.surface,
                      borderColor: stats.pendingLeaves > 0
                        ? isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(217, 119, 6, 0.25)"
                        : t.border,
                      borderTopColor: stats.pendingLeaves > 0
                        ? isDark ? "rgba(245, 158, 11, 0.55)" : "rgba(255, 255, 255, 0.98)"
                        : isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
                      borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                    PENDING LEAVES
                  </Text>
                  <Text style={[styles.metricValue, { color: t.text }]}>
                    {stats.pendingLeaves}
                  </Text>
                  <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                    Approvals required
                  </Text>
                </View>

                {/* DEPARTMENTS */}
                <View
                  style={[
                    styles.outwardBox,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.border,
                      borderTopColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
                      borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: t.textSecondary }]}>
                    DEPARTMENTS
                  </Text>
                  <Text style={[styles.metricValue, { color: t.text }]}>
                    {stats.departments}
                  </Text>
                  <Text style={[styles.metricSub, { color: t.textSecondary }]}>
                    Corporate units
                  </Text>
                </View>
              </View>
            </View>

            {/* ── HR Operations Toolkit & Policies ── */}
            <View style={styles.toolkitSection}>
              <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>
                HR OPERATIONS TOOLKIT & POLICIES
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.toolkitScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.border,
                      borderTopColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                  onPress={() => setActiveHRModal("holidays")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={16} color="#35D6A0" />
                  <Text style={[styles.toolChipText, { color: t.text }]}>
                    Company Holidays
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    {
                      backgroundColor: t.surface,
                      borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(217, 119, 6, 0.12)",
                      borderTopColor: isDark ? "rgba(245, 158, 11, 0.45)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                  onPress={() => setActiveHRModal("policies")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="time-outline" size={16} color="#F59E0B" />
                  <Text style={[styles.toolChipText, { color: t.text }]}>
                    Shift Policies
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    {
                      backgroundColor: t.surface,
                      borderColor: isDark ? "rgba(99, 102, 241, 0.25)" : "rgba(99, 102, 241, 0.12)",
                      borderTopColor: isDark ? "rgba(99, 102, 241, 0.45)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                  onPress={() => setActiveHRModal("leave_bank")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="briefcase-outline" size={16} color="#6366F1" />
                  <Text style={[styles.toolChipText, { color: t.text }]}>
                    Leave Balances
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    {
                      backgroundColor: t.surface,
                      borderColor: isDark ? "rgba(236, 72, 153, 0.25)" : "rgba(219, 39, 119, 0.12)",
                      borderTopColor: isDark ? "rgba(236, 72, 153, 0.45)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                  onPress={() => setActiveHRModal("hiring")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-add-outline" size={16} color="#EC4899" />
                  <Text style={[styles.toolChipText, { color: t.text }]}>
                    Hiring Pipeline
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    {
                      backgroundColor: t.surface,
                      borderColor: isDark ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.12)",
                      borderTopColor: isDark ? "rgba(16, 185, 129, 0.45)" : "rgba(255, 255, 255, 0.98)",
                      shadowColor: isDark ? "#000000" : "#0D2B20",
                    },
                  ]}
                  onPress={() => setActiveHRModal("biometric")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="finger-print-outline" size={16} color="#10B981" />
                  <Text style={[styles.toolChipText, { color: t.text }]}>
                    Biometric Kiosk
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* ── Live Shift Hero Attendance Card ── */}
            <HeroAttendanceCard
              hasPunchedIn={hrmsData?.user_punch?.has_punched_in ?? false}
              punchInTime={hrmsData?.user_punch?.punch_in_time ?? null}
              onPunch={onPunchAttendance}
              onApplyLeave={() => setActiveHRModal("leave_bank")}
              isPunching={isPunching}
              isDark={isDark}
            />

            {/* ── Leave Balances Section with Counting Progress Rings/Bars ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: t.text }]}>
                Leave Balances & Bank
              </Text>
              <TouchableOpacity
                onPress={() => setActiveHRModal("leave_bank")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: isDark ? "#10B981" : "#00A879" }}>
                  Policy Details
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.leaveGrid}>
              <LeaveBalanceItem
                label="Annual Leave"
                total={18}
                used={4}
                color={isDark ? "#10B981" : "#00A879"}
                isDark={isDark}
                index={0}
                onPress={() => setActiveHRModal("leave_bank")}
              />
              <LeaveBalanceItem
                label="Casual Leave"
                total={7}
                used={2}
                color={isDark ? "#38BDF8" : "#0284C7"}
                isDark={isDark}
                index={1}
                onPress={() => setActiveHRModal("leave_bank")}
              />
              <LeaveBalanceItem
                label="Sick Leave"
                total={7}
                used={1}
                color={isDark ? "#F59E0B" : "#D97706"}
                isDark={isDark}
                index={2}
                onPress={() => setActiveHRModal("leave_bank")}
              />
            </View>

            {/* ── Pending Leave Applications Section ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: t.text }]}>
                Pending Leave Applications ({hrmsData?.pending_leaves?.length ?? 0})
              </Text>
              <View
                style={[
                  styles.actionBadge,
                  {
                    backgroundColor: isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.10)",
                  },
                ]}
              >
                <Text style={[styles.actionBadgeText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                  Action Required
                </Text>
              </View>
            </View>

            {hrmsData?.pending_leaves && hrmsData.pending_leaves.length > 0 ? (
              <View style={{ gap: 10, marginBottom: 16 }}>
                {hrmsData.pending_leaves.map((leave) => (
                  <View
                    key={leave.id}
                    style={[
                      styles.leaveCard,
                      {
                        backgroundColor: t.surface,
                        borderColor: t.border,
                        borderTopColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
                        borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                        shadowColor: isDark ? "#000000" : "#0D2B20",
                      },
                    ]}
                  >
                    <View style={styles.leaveHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.leaveEmpName, { color: t.text }]}>
                          {leave.employee_name} ({leave.employee_code})
                        </Text>
                        <Text style={[styles.leaveSub, { color: t.textSecondary }]}>
                          {leave.leave_type} • {((leave as any)?.days_count ?? (leave as any)?.days ?? 1)} day(s) • {leave.start_date} to {leave.end_date}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.pendingPill,
                          {
                            backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                          },
                        ]}
                      >
                        <Text style={[styles.pendingPillText, { color: "#D97706" }]}>
                          Pending
                        </Text>
                      </View>
                    </View>

                    {leave.reason ? (
                      <Text style={[styles.leaveReason, { color: t.textSecondary }]}>
                        "{leave.reason}"
                      </Text>
                    ) : null}

                    <View style={styles.leaveActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.leaveActionBtn,
                          {
                            backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5",
                            borderColor: "#10B981",
                          },
                        ]}
                        onPress={() => onLeaveAction(leave.id, "approve")}
                        disabled={actionLeaveId === leave.id}
                        activeOpacity={0.8}
                      >
                        {actionLeaveId === leave.id ? (
                          <ActivityIndicator size="small" color="#10B981" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                            <Text style={[styles.leaveActionBtnText, { color: "#10B981" }]}>
                              Approve
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.leaveActionBtn,
                          {
                            backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                            borderColor: "#EF4444",
                          },
                        ]}
                        onPress={() => onLeaveAction(leave.id, "reject")}
                        disabled={actionLeaveId === leave.id}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle" size={15} color="#EF4444" />
                        <Text style={[styles.leaveActionBtnText, { color: "#EF4444" }]}>
                          Reject
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={[
                  styles.emptyLeaveBox,
                  {
                    backgroundColor: t.surface,
                    borderColor: t.border,
                  },
                ]}
              >
                <Ionicons name="checkmark-done-circle-outline" size={32} color={isDark ? "#35D6A0" : "#00A879"} />
                <Text style={[styles.emptyLeaveTitle, { color: t.text }]}>
                  All Leave Requests Reviewed
                </Text>
                <Text style={[styles.emptyLeaveSub, { color: t.textSecondary }]}>
                  No pending employee leave requests in queue
                </Text>
              </View>
            )}

            {/* ── Staff Directory Header & Filters ── */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: t.text }]}>
                Staff Directory ({filteredStaff.length})
              </Text>
            </View>

            <View style={styles.searchWrapper}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholders={[
                  'Search "employee name"',
                  'Search "employee code"',
                  'Search "department"',
                  'Search "designation"',
                ]}
                intervalMs={2000}
                onClear={() => setSearchQuery("")}
              />
            </View>

            <View style={styles.chipsRow}>
              <FilterChip
                label="All Staff"
                count={hrmsEmployees.length}
                isActive={selectedDept === "all"}
                onPress={() => setSelectedDept("all")}
              />
              <FilterChip
                label="Sales"
                isActive={selectedDept === "sales"}
                onPress={() => setSelectedDept("sales")}
              />
              <FilterChip
                label="Warehouse"
                isActive={selectedDept === "warehouse"}
                onPress={() => setSelectedDept("warehouse")}
              />
              <FilterChip
                label="HR"
                isActive={selectedDept === "hr"}
                onPress={() => setSelectedDept("hr")}
              />
              <FilterChip
                label="Operations"
                isActive={selectedDept === "operations"}
                onPress={() => setSelectedDept("operations")}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const initials = (item.name || "Staff")
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <View
              style={[
                styles.staffCard,
                {
                  backgroundColor: t.surface,
                  borderColor: t.border,
                  borderTopColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
                  borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
                  shadowColor: isDark ? "#000000" : "#0D2B20",
                },
              ]}
            >
              <View
                style={[
                  styles.avatarBox,
                  {
                    backgroundColor: isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.10)",
                  },
                ]}
              >
                <Text style={[styles.avatarText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                  {initials}
                </Text>
              </View>

              <View style={styles.staffInfo}>
                <Text style={[styles.staffName, { color: t.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.staffSub, { color: t.textSecondary }]} numberOfLines={1}>
                  {item.employee_code} • {item.designation || "Executive"} • {item.department}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: ((item as any)?.is_active !== false)
                      ? isDark ? "rgba(53, 214, 160, 0.14)" : "#DDF4EA"
                      : isDark ? "rgba(239, 68, 68, 0.14)" : "#FEE2E2",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: ((item as any)?.is_active !== false) ? (isDark ? "#35D6A0" : "#00A879") : "#EF4444" },
                  ]}
                >
                  {((item as any)?.is_active !== false) ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* ── Floating Dock Navigation Bar ── */}
      <FloatingTabBar />

      {/* ── HR Toolkit Info Modal ── */}
      {activeHRModal && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveHRModal(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActiveHRModal(null)}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: t.surface,
                  borderColor: isDark ? "rgba(53, 214, 160, 0.35)" : "#D8E0DC",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: t.text }]}>
                  {activeHRModal === "holidays" && "Company Holidays 2026"}
                  {activeHRModal === "policies" && "Official Shift Policies"}
                  {activeHRModal === "leave_bank" && "Leave Allocation Rules"}
                  {activeHRModal === "hiring" && "Hiring & Recruitment Pipeline"}
                  {activeHRModal === "biometric" && "Biometric Attendance Terminal"}
                </Text>
                <TouchableOpacity onPress={() => setActiveHRModal(null)}>
                  <Ionicons name="close-circle" size={24} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalBody, { color: t.textSecondary }]}>
                {activeHRModal === "holidays" &&
                  "Oblu Healthcare Gazetted Holidays: Republic Day, Holi, Independence Day, Gandhi Jayanti, Diwali, and Christmas. All corporate branches are closed on these gazetted dates."}
                {activeHRModal === "policies" &&
                  "Standard shift hours: 9:30 AM to 6:30 PM. 15-minute grace period applies up to 9:45 AM. 3 late arrivals in a calendar month result in half-day deduction as per HR handbook."}
                {activeHRModal === "leave_bank" &&
                  "Annual Leave: 18 days/year. Casual Leave: 7 days. Sick Leave: 7 days. All leave requests require prior HR / Manager digital approval via this app."}
                {activeHRModal === "hiring" &&
                  "Active Openings: Dental Sales Specialist (2), Logistics Associate (1), Field Service Representative (1). Resumes can be submitted through the internal HR portal."}
                {activeHRModal === "biometric" &&
                  "Biometric terminal hardware synchronization active. Device telemetry logs check-in coordinates and timestamps directly to the central cloud server."}
              </Text>

              <TouchableOpacity
                style={[
                  styles.modalCloseBtn,
                  { backgroundColor: isDark ? "rgba(53, 214, 160, 0.16)" : "#DDF4EA" },
                ]}
                onPress={() => setActiveHRModal(null)}
              >
                <Text style={{ color: isDark ? "#35D6A0" : "#00A879", fontFamily: Typography.bold, fontSize: 13 }}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
    zIndex: 2,
  },
  topBarCenter: {
    flex: 1,
    marginLeft: 12,
  },
  screenHeading: {
    fontSize: 18,
    fontFamily: Typography.bold,
    letterSpacing: -0.3,
  },
  screenSub: {
    fontSize: 11,
    fontFamily: Typography.medium,
    marginTop: 1,
  },
  topBarRightPlaceholder: {
    width: 38,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerBlock: {
    marginBottom: 8,
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  outwardBox: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.48,
    shadowRadius: 14,
    elevation: 6,
    zIndex: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 26,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  toolkitSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  toolkitScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 2,
  },
  toolChipText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  terminalCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.48,
    shadowRadius: 14,
    elevation: 6,
    zIndex: 2,
    marginBottom: 16,
  },
  terminalTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  terminalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  terminalTitle: {
    fontSize: 15,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
  },
  terminalSub: {
    fontSize: 12,
    fontFamily: Typography.medium,
    marginTop: 2,
  },
  punchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  punchBtnText: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  terminalInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  terminalInfoText: {
    fontSize: 11,
    fontFamily: Typography.medium,
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  actionBadgeText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  leaveCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 2,
    marginBottom: 10,
  },
  leaveHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  leaveEmpName: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  leaveSub: {
    fontSize: 11,
    fontFamily: Typography.medium,
    marginTop: 2,
  },
  pendingPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pendingPillText: {
    fontSize: 10,
    fontFamily: Typography.bold,
  },
  leaveReason: {
    fontSize: 12,
    fontFamily: Typography.medium,
    fontStyle: "italic",
    marginVertical: 8,
  },
  leaveActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  leaveActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  leaveActionBtnText: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  emptyLeaveBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  emptyLeaveTitle: {
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  emptyLeaveSub: {
    fontSize: 11,
    fontFamily: Typography.medium,
  },
  searchWrapper: {
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 2,
    marginBottom: 10,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 14,
    fontFamily: Typography.bold,
    marginBottom: 2,
  },
  staffSub: {
    fontSize: 11,
    fontFamily: Typography.medium,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: Typography.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.70)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: Typography.bold,
    flex: 1,
  },
  modalBody: {
    fontSize: 13,
    fontFamily: Typography.medium,
    lineHeight: 18,
  },
  modalCloseBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  heroTrackerCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  trackerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  trackerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  trackerStatusText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.bold,
    letterSpacing: 0.6,
  },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shiftBadgeText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.medium,
  },
  trackerBodyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  timeInfoBlock: {
    flex: 1,
    marginRight: 10,
  },
  timeLabel: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
    marginBottom: 3,
  },
  timeValue: {
    fontSize: FontSizes.body,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
  },
  punchHeroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  punchHeroBtnText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.bold,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.medium,
  },
  progressPct: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.bold,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  terminalFooterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  terminalFooterText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
  },
  applyLeaveLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  applyLeaveText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.bold,
  },
  leaveGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  leaveCol: {
    flex: 1,
  },
  leaveItemCard: {
    borderRadius: 16,
    borderWidth: 1.2,
    padding: 12,
    minHeight: 106,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  leaveItemLabel: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
  leaveNumbersRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    marginVertical: 4,
  },
  leaveAvailableNum: {
    fontSize: 20,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
  },
  leaveTotalSuffix: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.medium,
  },
  leaveMiniTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginVertical: 4,
  },
  leaveMiniBar: {
    height: "100%",
    borderRadius: 2,
  },
  leaveUsedSubtext: {
    fontSize: 9,
    fontFamily: Typography.regular,
  },
});
