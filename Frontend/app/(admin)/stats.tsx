/**
 * Admin — Analytics & Statistics Screen (NEXUS CRM Graphite Mint Design System)
 * All API logic and chart trends preserved with dynamic Light & Dark mint styling.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import AppLineChart from "@/components/charts/AppLineChart";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { SkeletonCardList, SkeletonBlock } from "@/components/ui/SkeletonCard";

interface StatsData {
  user_id: number;
  username: string;
  total_calls: number;
  total_duration: number;
  calls_by_type: Record<string, number>;
  top_numbers: Array<{ phone_number: string; count: number }>;
  daily_trend: Array<{ date: string; calls: number; duration: number }>;
}

interface TeamMember {
  id: number;
  username: string;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ user_id?: string; username?: string }>();
  const [selectedUserId, setSelectedUserId] = useState<string>(params.user_id || "all");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const resp = await api.get("/admin/users/");
      setTeamMembers(resp.data.results || resp.data);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const endpoint =
        selectedUserId && selectedUserId !== "all"
          ? `/admin/stats/${selectedUserId}/`
          : "/admin/stats/";
      const response = await api.get(endpoint);
      setStats(response.data);
    } catch {
      Alert.alert("Error", "Failed to fetch analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (params.user_id) setSelectedUserId(params.user_id);
  }, [params.user_id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
    fetchStats();
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const incomingCalls = stats?.calls_by_type?.incoming || 0;
  const outgoingCalls = stats?.calls_by_type?.outgoing || 0;
  const missedCalls = stats?.calls_by_type?.missed || 0;
  const totalCalls = stats?.total_calls || 1;
  const incomingPct = Math.round((incomingCalls / totalCalls) * 100);
  const outgoingPct = Math.round((outgoingCalls / totalCalls) * 100);
  const missedPct = Math.round((missedCalls / totalCalls) * 100);

  const trendData = useMemo(() => {
    const today = new Date();
    const days: string[] = [];
    const callsMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      days.push(key);
      callsMap[key] = 0;
    }
    if (stats?.daily_trend) {
      for (const item of stats.daily_trend) {
        if (item.date) callsMap[item.date] = item.calls || 0;
      }
    }
    return {
      labels: days.map((d) => {
        const p = d.split("-");
        return `${parseInt(p[1], 10)}/${parseInt(p[2], 10)}`;
      }),
      data: days.map((d) => callsMap[d] || 0),
    };
  }, [stats]);

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    color: (opacity = 1) =>
      isDark ? `rgba(53, 214, 160, ${opacity})` : `rgba(0, 168, 121, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDark ? `rgba(143, 160, 154, ${opacity})` : `rgba(94, 105, 100, ${opacity})`,
    strokeWidth: 2.5,
    barPercentage: 0.55,
    decimalPlaces: 0,
    propsForDots: { r: "4", strokeWidth: "2", stroke: colors.primary },
    propsForBackgroundLines: {
      strokeDasharray: "4",
      stroke: isDark ? "rgba(41, 64, 57, 0.6)" : "rgba(216, 224, 220, 0.8)",
    },
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16) + 80,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
            Analytics
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>
            Performance & Trends
          </Text>
        </View>
      </View>

      {/* Member Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsRow}
      >
        <TouchableOpacity
          style={[
            styles.memberPill,
            {
              backgroundColor:
                selectedUserId === "all" ? colors.primary : colors.card,
              borderColor:
                selectedUserId === "all" ? colors.primary : colors.cardBorder,
            },
          ]}
          onPress={() => setSelectedUserId("all")}
        >
          <Ionicons
            name="globe-outline"
            size={13}
            color={selectedUserId === "all" ? "#FFFFFF" : colors.textSecondary}
          />
          <Text
            style={[
              styles.pillText,
              {
                color: selectedUserId === "all" ? "#FFFFFF" : colors.textSecondary,
                fontFamily:
                  selectedUserId === "all" ? Typography.semiBold : Typography.regular,
              },
            ]}
          >
            All Team
          </Text>
        </TouchableOpacity>

        {teamMembers.map((m) => {
          const active = selectedUserId === m.id.toString();
          return (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.memberPill,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.cardBorder,
                },
              ]}
              onPress={() => setSelectedUserId(m.id.toString())}
            >
              <Text
                style={[
                  styles.pillText,
                  {
                    color: active ? "#FFFFFF" : colors.textSecondary,
                    fontFamily: active ? Typography.semiBold : Typography.regular,
                  },
                ]}
              >
                {m.username}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          <SkeletonBlock height={100} borderRadius={16} />
          <SkeletonBlock height={200} borderRadius={18} />
          <SkeletonCardList count={3} height={78} />
        </View>
      ) : (
        <>
          {/* KPI Row */}
          <View style={styles.kpiRow}>
            <View
              style={[
                styles.kpiCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View
                style={[
                  styles.kpiIcon,
                  { backgroundColor: colors.mintTintedSurface },
                ]}
              >
                <Ionicons name="call" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {stats?.total_calls || 0}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
                Total Calls
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View
                style={[
                  styles.kpiIcon,
                  { backgroundColor: colors.secondarySurface },
                ]}
              >
                <Ionicons name="time" size={16} color={colors.textPrimary} />
              </View>
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {formatDuration(stats?.total_duration || 0)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
                Talk Time
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View
                style={[
                  styles.kpiIcon,
                  { backgroundColor: colors.mintTintedSurface },
                ]}
              >
                <Ionicons name="speedometer" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {stats?.total_calls
                  ? formatDuration(Math.round(stats.total_duration / stats.total_calls))
                  : "0s"}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
                Avg/Call
              </Text>
            </View>
          </View>

          {/* Line Chart */}
          <View
            style={[
              styles.chartCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
                Daily Volume
              </Text>
              <View
                style={[
                  styles.chartBadge,
                  { backgroundColor: colors.mintTintedSurface },
                ]}
              >
                <Text style={[styles.chartBadgeText, { color: colors.primary }]}>
                  7 Days
                </Text>
              </View>
            </View>
            <AppLineChart
              data={{
                labels: trendData.labels,
                datasets: [
                  {
                    data:
                      trendData.data.length > 0 && trendData.data.some((v) => v > 0)
                        ? trendData.data
                        : [0, 0, 0, 0, 0, 0, 0],
                  },
                ],
              }}
              width={Math.max(windowWidth - 64, 260)}
              height={180}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              fromZero
            />
          </View>

          {/* Distribution */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Call Distribution
            </Text>
            <View style={styles.distRow}>
              <View style={styles.distCol}>
                <Text style={[styles.distPct, { color: colors.primary }]}>
                  {incomingPct}%
                </Text>
                <Text style={[styles.distLabel, { color: colors.textMuted }]}>
                  Incoming
                </Text>
              </View>
              <View style={styles.distCol}>
                <Text style={[styles.distPct, { color: colors.textPrimary }]}>
                  {outgoingPct}%
                </Text>
                <Text style={[styles.distLabel, { color: colors.textMuted }]}>
                  Outgoing
                </Text>
              </View>
              <View style={styles.distCol}>
                <Text style={[styles.distPct, { color: colors.error }]}>
                  {missedPct}%
                </Text>
                <Text style={[styles.distLabel, { color: colors.textMuted }]}>
                  Missed
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleCol: {
    flex: 1,
  },
  screenTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.screenTitle,
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.label,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  memberPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    gap: 5,
  },
  pillText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.label,
  },
  centered: {
    paddingVertical: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
    ...Shadows.card,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  kpiValue: {
    fontFamily: Typography.headingSemi,
    fontSize: 16,
  },
  kpiLabel: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  chartCard: {
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    ...Shadows.card,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  chartTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
  },
  chartBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  chartBadgeText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.caption,
  },
  chart: {
    borderRadius: Radius.md,
    marginLeft: -16,
  },
  sectionCard: {
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    ...Shadows.card,
  },
  sectionTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
    marginBottom: 12,
  },
  distRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  distCol: {
    alignItems: "center",
    gap: 2,
  },
  distPct: {
    fontFamily: Typography.headingSemi,
    fontSize: 20,
  },
  distLabel: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.label,
  },
});
