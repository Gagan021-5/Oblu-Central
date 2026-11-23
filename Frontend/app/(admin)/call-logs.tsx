/**
 * Admin — Call History & Recorded Call Screen (NEXUS CRM Graphite Mint Design System)
 * Reproduces the fourth reference screen closely:
 * - Grouped call timeline (Today, Yesterday, Earlier) with all API calls and filters preserved.
 * - Tap any call to inspect the full "Recorded Call" analysis view:
 *   - Audio waveform with playhead and scrubber controls (-15s, Play, +15s, 1x).
 *   - Talk / Listen ratio split bar (You 46% vs Them 54%) with "Good balance" badge.
 *   - Sentiment trajectory chart with acid-lime "Peak interest at 21:14" marker.
 *   - AI insights numbered list.
 *   - "Create follow up task" mint action button.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import AppLineChart from "@/components/charts/AppLineChart";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonCardList, SkeletonBlock } from "@/components/ui/SkeletonCard";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";

interface CallLogItem {
  id: number;
  user: number;
  username: string;
  phone_number: string;
  call_type: "incoming" | "outgoing" | "missed";
  duration: number;
  timestamp: string;
  synced_at: string;
}

type FilterType = "all" | "incoming" | "outgoing" | "missed";
type AnalysisTab = "Analysis" | "Transcript" | "Moments" | "Details";

export default function CallLogsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ user_id?: string; username?: string }>();

  const [logs, setLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<FilterType>("all");
  const [searchPhone, setSearchPhone] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Segmented Main Tab: Timeline vs Analytics
  const [activeMainTab, setActiveMainTab] = useState<"timeline" | "analytics">("timeline");

  // Analytics & Reports state
  const [selectedStatsUser, setSelectedStatsUser] = useState<string>(params.user_id || "all");
  const [stats, setStats] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: number; username: string }>>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const endpoint =
        selectedStatsUser && selectedStatsUser !== "all"
          ? `/admin/stats/${selectedStatsUser}/`
          : "/admin/stats/";
      const [statsRes, membersRes] = await Promise.all([
        api.get(endpoint),
        api.get("/admin/users/"),
      ]);
      setStats(statsRes.data);
      setTeamMembers(membersRes.data.results || membersRes.data);
    } catch {
      // Silently handled
    } finally {
      setStatsLoading(false);
    }
  }, [selectedStatsUser]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

  const incomingCalls = stats?.calls_by_type?.incoming || 0;
  const outgoingCalls = stats?.calls_by_type?.outgoing || 0;
  const missedCalls = stats?.calls_by_type?.missed || 0;
  const totalStatsCalls = stats?.total_calls || (incomingCalls + outgoingCalls + missedCalls) || 1;
  const incomingPct = Math.round((incomingCalls / totalStatsCalls) * 100);
  const outgoingPct = Math.round((outgoingCalls / totalStatsCalls) * 100);
  const missedPct = Math.round((missedCalls / totalStatsCalls) * 100);

  const chartConfig = {
    backgroundGradientFrom: t.surface,
    backgroundGradientTo: t.surface,
    color: (opacity = 1) =>
      isDark ? `rgba(16, 185, 129, ${opacity})` : `rgba(0, 168, 121, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDark ? `rgba(148, 163, 184, ${opacity})` : `rgba(94, 105, 100, ${opacity})`,
    strokeWidth: 2.5,
    barPercentage: 0.55,
    decimalPlaces: 0,
    propsForDots: { r: "4", strokeWidth: "2", stroke: t.primary },
    propsForBackgroundLines: {
      strokeDasharray: "4",
      stroke: t.border,
    },
  };

  // Recorded Call Modal
  const [selectedCall, setSelectedCall] = useState<CallLogItem | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("Analysis");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<"1x" | "1.5x" | "2x">("1x");

  const fetchLogs = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const queryParams: Record<string, string> = { page: pageNum.toString() };
        if (params.user_id) queryParams.user_id = params.user_id;
        const response = await api.get("/admin/call-logs/", { params: queryParams });
        const data = response.data;
        const results = data.results || data;
        const nextExists = !!data.next;
        if (append) {
          setLogs((prev) => [...prev, ...results]);
        } else {
          setLogs(results);
        }
        setHasMore(nextExists);
      } catch {
        // Handled silently
      } finally {
        setLoading(false);
      }
    },
    [params.user_id]
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, true);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchType = selectedType === "all" || log.call_type === selectedType;
      const matchSearch =
        !searchPhone.trim() ||
        log.phone_number.toLowerCase().includes(searchPhone.toLowerCase()) ||
        log.username.toLowerCase().includes(searchPhone.toLowerCase());
      return matchType && matchSearch;
    });
  }, [logs, selectedType, searchPhone]);

  // Group calls by Today, Yesterday, Earlier
  const groupedLogs = useMemo(() => {
    const today = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toDateString();

    const groups: { title: string; data: CallLogItem[] }[] = [
      { title: "Today", data: [] },
      { title: "Yesterday", data: [] },
      { title: "Earlier", data: [] },
    ];

    filteredLogs.forEach((item) => {
      const logDate = new Date(item.timestamp).toDateString();
      if (logDate === today) {
        groups[0].data.push(item);
      } else if (logDate === yesterday) {
        groups[1].data.push(item);
      } else {
        groups[2].data.push(item);
      }
    });

    return groups.filter((g) => g.data.length > 0);
  }, [filteredLogs]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  // Waveform bars simulation
  const waveformHeights = [
    12, 24, 18, 32, 45, 28, 55, 38, 48, 62, 70, 52, 40, 65, 80, 50, 35, 60, 75,
    90, 68, 45, 58, 72, 85, 48, 30, 62, 78, 55, 42, 68, 50, 38, 25, 40, 30, 20,
    15, 10,
  ];

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: t.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(admin)/users"))}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.screenHeading, { color: t.text }]}>
          Calls & Tracking
        </Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: t.surface, borderColor: t.border },
            ]}
            onPress={() => setActiveMainTab(activeMainTab === "timeline" ? "analytics" : "timeline")}
          >
            <Ionicons
              name={activeMainTab === "timeline" ? "bar-chart-outline" : "list-outline"}
              size={18}
              color={t.primary}
            />
          </TouchableOpacity>
          <SubAppHomeButton size={38} isAdmin={true} />
        </View>
      </View>

      {/* ── Segmented Navigation: Timeline vs Analytics & Reports ─ */}
      <View
        style={[
          styles.segmentTrack,
          {
            backgroundColor: t.surfaceAlt,
            borderColor: t.border,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveMainTab("timeline")}
          style={[
            styles.segmentBtn,
            activeMainTab === "timeline"
              ? { backgroundColor: t.primary }
              : { backgroundColor: "transparent" },
          ]}
        >
          <Ionicons
            name="list"
            size={15}
            color={activeMainTab === "timeline" ? "#FFFFFF" : t.textSecondary}
          />
          <Text
            style={[
              styles.segmentText,
              {
                color: activeMainTab === "timeline" ? "#FFFFFF" : t.textSecondary,
                fontFamily: activeMainTab === "timeline" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Call Timeline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveMainTab("analytics")}
          style={[
            styles.segmentBtn,
            activeMainTab === "analytics"
              ? { backgroundColor: t.primary }
              : { backgroundColor: "transparent" },
          ]}
        >
          <Ionicons
            name="pie-chart"
            size={15}
            color={activeMainTab === "analytics" ? "#FFFFFF" : t.textSecondary}
          />
          <Text
            style={[
              styles.segmentText,
              {
                color: activeMainTab === "analytics" ? "#FFFFFF" : t.textSecondary,
                fontFamily: activeMainTab === "analytics" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Analytics & Reports
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── VIEW 1: TIMELINE WITH LIVE KPI STRIP ────────────────── */}
      {activeMainTab === "timeline" ? (
        <>
          {/* ── Live Quick Stats Strip (Incoming, Outgoing, Missed) ── */}
          <View
            style={[
              styles.kpiStrip,
              {
                backgroundColor: t.surface,
                borderColor: t.border,
                borderWidth: 1,
                borderRadius: 20,
              },
              isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
            ]}
          >
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiNum, { color: t.text }]}>
                {stats?.total_calls || logs.length}
              </Text>
              <Text style={[styles.kpiLabel, { color: t.textSecondary }]}>TOTAL</Text>
            </View>

            <View style={[styles.kpiDivider, { backgroundColor: t.border, height: 28 }]} />

            <View style={styles.kpiItem}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="arrow-down" size={13} color={t.primary} />
                <Text style={[styles.kpiNum, { color: t.primary }]}>
                  {incomingCalls}
                </Text>
              </View>
              <Text style={[styles.kpiLabel, { color: t.textSecondary }]}>INCOMING</Text>
            </View>

            <View style={[styles.kpiDivider, { backgroundColor: t.border, height: 28 }]} />

            <View style={styles.kpiItem}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="arrow-up" size={13} color={t.primary} />
                <Text style={[styles.kpiNum, { color: t.primary }]}>
                  {outgoingCalls}
                </Text>
              </View>
              <Text style={[styles.kpiLabel, { color: t.textSecondary }]}>OUTGOING</Text>
            </View>

            <View style={[styles.kpiDivider, { backgroundColor: t.border, height: 28 }]} />

            <View style={styles.kpiItem}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="close" size={14} color={t.danger || "#EF4444"} />
                <Text style={[styles.kpiNum, { color: t.danger || "#EF4444" }]}>
                  {missedCalls}
                </Text>
              </View>
              <Text style={[styles.kpiLabel, { color: t.textSecondary }]}>MISSED</Text>
            </View>
          </View>

          {/* ── Search Bar ─────────────────────────────────────────── */}
          <View style={styles.searchSection}>
            <SearchBar
              value={searchPhone}
              onChangeText={setSearchPhone}
              placeholders={[
                'Search "contact"',
                'Search "company"',
                'Search "phone number"',
              ]}
              intervalMs={2000}
              onClear={() => setSearchPhone("")}
            />
          </View>

          {/* ── Filter Chips ───────────────────────────────────────── */}
          <View style={styles.filterChipsRow}>
            {(["all", "incoming", "outgoing", "missed"] as FilterType[]).map((type) => {
              const isSelected = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.75}
                  onPress={() => setSelectedType(type)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? t.primary : t.surface,
                      borderColor: isSelected ? t.primary : t.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected ? "#FFFFFF" : t.textSecondary,
                        fontFamily: isSelected ? Typography.semiBold : Typography.regular,
                      },
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Call List Timeline ─────────────────────────────────── */}
          {loading ? (
            <SkeletonCardList count={5} height={86} style={{ paddingHorizontal: 16, paddingTop: 6 }} />
          ) : filteredLogs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="call-outline" size={44} color={t.textSecondary} />
              <Text style={[styles.emptyTitle, { color: t.text }]}>
                No Call Logs Found
              </Text>
              <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
                Sync calls or adjust your search filters.
              </Text>
            </View>
          ) : (
            <FlatList
              data={groupedLogs}
              keyExtractor={(item) => item.title}
              contentContainerStyle={{
                paddingHorizontal: Spacing.screenPadding,
                paddingBottom: Math.max(insets.bottom, 16) + 90, // Leave room for floating dock
              }}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              renderItem={({ item: group }) => (
                <View style={styles.groupSection}>
                  <Text style={[styles.groupHeader, { color: t.textSecondary }]}>
                    {group.title}
                  </Text>

                  {group.data.map((log) => {
                    const isIncoming = log.call_type === "incoming";
                    const isMissed = log.call_type === "missed";
                    const iconColor = isMissed
                      ? t.danger
                      : isIncoming
                      ? t.primary
                      : t.textSecondary;
                    const iconName = isMissed
                      ? "close"
                      : isIncoming
                      ? "arrow-down"
                      : "arrow-up";

                    const avatarBg = isMissed
                      ? isDark
                        ? "rgba(239, 68, 68, 0.16)"
                        : "rgba(239, 68, 68, 0.12)"
                      : isIncoming
                      ? isDark
                        ? "rgba(16, 185, 129, 0.16)"
                        : "rgba(0, 168, 121, 0.12)"
                      : isDark
                      ? "rgba(59, 130, 246, 0.16)"
                      : "rgba(59, 130, 246, 0.12)";

                    return (
                      <TouchableOpacity
                        key={log.id}
                        activeOpacity={0.7}
                        onPress={() => setSelectedCall(log)}
                        style={[
                          styles.callRow,
                          {
                            backgroundColor: t.surface,
                            borderColor: t.border,
                          },
                          isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                        ]}
                      >
                        {/* Avatar */}
                        <View
                          style={[
                            styles.callAvatar,
                            { backgroundColor: avatarBg },
                          ]}
                        >
                          <Ionicons name={iconName} size={16} color={iconColor} />
                        </View>

                        {/* Details */}
                        <View style={styles.callDetails}>
                          <Text
                            style={[styles.callerName, { color: t.text }]}
                            numberOfLines={1}
                          >
                            {log.username || log.phone_number}
                          </Text>
                          <Text
                            style={[styles.callMeta, { color: t.textSecondary }]}
                            numberOfLines={1}
                          >
                            {log.phone_number}
                          </Text>
                        </View>

                        {/* Duration & Time Column + Chevron */}
                        <View style={styles.callRight}>
                          <View style={styles.callTimeCol}>
                            <Text
                              style={[styles.callDurationText, { color: t.textSecondary }]}
                            >
                              {formatDuration(log.duration)}
                            </Text>
                            <Text
                              style={[styles.callTimeText, { color: t.textSecondary }]}
                            >
                              {formatTime(log.timestamp)}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={t.textSecondary}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          )}
        </>
      ) : (
        /* ── VIEW 2: FULL ANALYTICS & REPORTS ─────────────────── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Spacing.screenPadding,
            paddingBottom: Math.max(insets.bottom, 16) + 110,
          }}
        >
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
                    selectedStatsUser === "all" ? t.primary : t.surface,
                  borderColor:
                    selectedStatsUser === "all" ? t.primary : t.border,
                },
              ]}
              onPress={() => setSelectedStatsUser("all")}
            >
              <Ionicons
                name="globe-outline"
                size={13}
                color={selectedStatsUser === "all" ? "#FFFFFF" : t.textSecondary}
              />
              <Text
                style={[
                  styles.pillText,
                  {
                    color: selectedStatsUser === "all" ? "#FFFFFF" : t.textSecondary,
                    fontFamily:
                      selectedStatsUser === "all" ? Typography.semiBold : Typography.regular,
                  },
                ]}
              >
                All Team
              </Text>
            </TouchableOpacity>

            {teamMembers.map((m) => {
              const active = selectedStatsUser === m.id.toString();
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.memberPill,
                    {
                      backgroundColor: active ? t.primary : t.surface,
                      borderColor: active ? t.primary : t.border,
                    },
                  ]}
                  onPress={() => setSelectedStatsUser(m.id.toString())}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: active ? "#FFFFFF" : t.textSecondary,
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

          {statsLoading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
              <SkeletonBlock height={94} borderRadius={16} />
              <SkeletonBlock height={210} borderRadius={18} />
              <SkeletonCardList count={3} height={76} />
            </View>
          ) : (
            <>
              {/* 3 KPI Highlight Cards */}
              <View style={styles.analyticsKpiRow}>
                <View
                  style={[
                    styles.analyticsKpiCard,
                    { backgroundColor: t.surface, borderColor: t.border },
                    isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View
                    style={[
                      styles.analyticsKpiIcon,
                      { backgroundColor: t.primarySurface },
                    ]}
                  >
                    <Ionicons name="call" size={16} color={t.primary} />
                  </View>
                  <Text style={[styles.analyticsKpiVal, { color: t.text }]}>
                    {stats?.total_calls || 0}
                  </Text>
                  <Text style={[styles.analyticsKpiLbl, { color: t.textSecondary }]}>
                    Total Calls
                  </Text>
                </View>

                <View
                  style={[
                    styles.analyticsKpiCard,
                    { backgroundColor: t.surface, borderColor: t.border },
                    isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View
                    style={[
                      styles.analyticsKpiIcon,
                      { backgroundColor: t.surfaceAlt },
                    ]}
                  >
                    <Ionicons name="time" size={16} color={t.text} />
                  </View>
                  <Text style={[styles.analyticsKpiVal, { color: t.text }]}>
                    {formatDuration(stats?.total_duration || 0)}
                  </Text>
                  <Text style={[styles.analyticsKpiLbl, { color: t.textSecondary }]}>
                    Talk Time
                  </Text>
                </View>

                <View
                  style={[
                    styles.analyticsKpiCard,
                    { backgroundColor: t.surface, borderColor: t.border },
                    isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View
                    style={[
                      styles.analyticsKpiIcon,
                      { backgroundColor: t.primarySurface },
                    ]}
                  >
                    <Ionicons name="speedometer" size={16} color={t.primary} />
                  </View>
                  <Text style={[styles.analyticsKpiVal, { color: t.text }]}>
                    {stats?.total_calls
                      ? formatDuration(Math.round(stats.total_duration / stats.total_calls))
                      : "0s"}
                  </Text>
                  <Text style={[styles.analyticsKpiLbl, { color: t.textSecondary }]}>
                    Avg/Call
                  </Text>
                </View>
              </View>

              {/* 7-Day Trend Chart */}
              <View
                style={[
                  styles.analyticsChartCard,
                  { backgroundColor: t.surface, borderColor: t.border },
                  isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              >
                <View style={styles.analyticsChartHeader}>
                  <Text style={[styles.analyticsChartTitle, { color: t.text }]}>
                    Daily Call Volume
                  </Text>
                  <View
                    style={[
                      styles.analyticsChartBadge,
                      { backgroundColor: t.primarySurface },
                    ]}
                  >
                    <Text style={[styles.analyticsChartBadgeText, { color: t.primary }]}>
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
                  width={Math.max(windowWidth - 56, 260)}
                  height={180}
                  chartConfig={chartConfig}
                  bezier
                  style={{ borderRadius: 12, marginVertical: 8 }}
                  fromZero
                />
              </View>

              {/* Distribution By Type (Incoming, Outgoing, Missed) */}
              <View
                style={[
                  styles.analyticsSectionCard,
                  { backgroundColor: t.surface, borderColor: t.border },
                  isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              >
                <Text style={[styles.analyticsSectionTitle, { color: t.text }]}>
                  Call Breakdown by Type
                </Text>

                {/* Incoming */}
                <View style={styles.distRow}>
                  <View style={styles.distLabelRow}>
                    <Text style={[styles.distType, { color: t.primary }]}>
                      Incoming ({incomingPct}%)
                    </Text>
                    <Text style={[styles.distCount, { color: t.text }]}>
                      {incomingCalls} calls
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.distTrack,
                      { backgroundColor: t.surfaceAlt },
                    ]}
                  >
                    <View
                      style={[
                        styles.distBar,
                        {
                          width: `${incomingPct}%`,
                          backgroundColor: t.primary,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Outgoing */}
                <View style={styles.distRow}>
                  <View style={styles.distLabelRow}>
                    <Text style={[styles.distType, { color: t.primaryLight || t.primary }]}>
                      Outgoing ({outgoingPct}%)
                    </Text>
                    <Text style={[styles.distCount, { color: t.text }]}>
                      {outgoingCalls} calls
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.distTrack,
                      { backgroundColor: t.surfaceAlt },
                    ]}
                  >
                    <View
                      style={[
                        styles.distBar,
                        {
                          width: `${outgoingPct}%`,
                          backgroundColor: t.primaryLight || t.primary,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Missed */}
                <View style={styles.distRow}>
                  <View style={styles.distLabelRow}>
                    <Text style={[styles.distType, { color: t.danger }]}>
                      Missed ({missedPct}%)
                    </Text>
                    <Text style={[styles.distCount, { color: t.text }]}>
                      {missedCalls} calls
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.distTrack,
                      { backgroundColor: t.surfaceAlt },
                    ]}
                  >
                    <View
                      style={[
                        styles.distBar,
                        {
                          width: `${missedPct}%`,
                          backgroundColor: t.danger,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

              {/* Top Contacted Numbers */}
              <View
                style={[
                  styles.analyticsSectionCard,
                  { backgroundColor: t.surface, borderColor: t.border },
                  isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              >
                <Text style={[styles.analyticsSectionTitle, { color: t.text }]}>
                  Top Contacted Numbers
                </Text>

                {stats?.top_numbers && stats.top_numbers.length > 0 ? (
                  stats.top_numbers.map((item: any, index: number) => (
                    <View
                      key={item.phone_number}
                      style={[
                        styles.topNumberRow,
                        { borderBottomColor: t.border },
                      ]}
                    >
                      <View style={styles.topNumberLeft}>
                        <View
                          style={[
                            styles.topRankBadge,
                            { backgroundColor: t.primarySurface },
                          ]}
                        >
                          <Text style={[styles.topRankText, { color: t.primary }]}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text style={[styles.topPhone, { color: t.text }]}>
                          {item.phone_number}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.topCallsBadge,
                          { backgroundColor: t.surfaceAlt },
                        ]}
                      >
                        <Text style={[styles.topCallsText, { color: t.textSecondary }]}>
                          {item.count} {item.count === 1 ? "call" : "calls"}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: t.textSecondary, fontSize: 13, paddingVertical: 8, fontFamily: Typography.regular }}>
                    No call records available for this selection.
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── 4. Recorded Call Analysis Modal (Screen 4 of Reference) ─ */}
      <Modal
        visible={!!selectedCall}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedCall(null)}
      >
        <View style={[styles.modalScreen, { backgroundColor: t.bg }]}>
          {/* Header */}
          <View
            style={[
              styles.recordedHeader,
              {
                paddingTop: Math.max(insets.top, 14),
                borderBottomColor: t.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setSelectedCall(null)}
              style={styles.navBtn}
            >
              <Ionicons name="arrow-back" size={22} color={t.text} />
            </TouchableOpacity>

            <Text style={[styles.recordedTitle, { color: t.text }]}>
              Recorded Call
            </Text>

            <TouchableOpacity style={styles.navBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color={t.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: Spacing.screenPadding,
              paddingTop: Spacing.md,
              paddingBottom: Math.max(insets.bottom, 24) + 40,
            }}
          >
            {/* Company & Call Identity */}
            <View style={styles.recordCompanyRow}>
              <View
                style={[
                  styles.companyLogo,
                  {
                    backgroundColor: t.primarySurface,
                    borderColor: t.border,
                  },
                ]}
              >
                <Text style={[styles.companyLogoLetter, { color: t.primary }]}>O</Text>
              </View>

              <View style={styles.companyTextWrap}>
                <Text style={[styles.recordCompanyName, { color: t.text }]}>
                  {selectedCall?.username || "Orion Systems"}
                </Text>
                <Text style={[styles.recordCompanySub, { color: t.textSecondary }]}>
                  Discovery Call · May 14, 2025 ·{" "}
                  {selectedCall ? formatDuration(selectedCall.duration) : "28:17"}
                </Text>
              </View>
            </View>

            {/* Analysis Tabs */}
            <View style={[styles.tabsRow, { borderBottomColor: t.border }]}>
              {(["Analysis", "Transcript", "Moments", "Details"] as AnalysisTab[]).map(
                (tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => setActiveTab(tab)}
                      style={[
                        styles.tabBtn,
                        isActive && { borderBottomColor: t.primary, borderBottomWidth: 2 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          {
                            color: isActive ? t.primary : t.textSecondary,
                            fontFamily: isActive ? Typography.semiBold : Typography.regular,
                          },
                        ]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {/* Interactive Audio Waveform */}
            <View
              style={[
                styles.waveformCard,
                {
                  backgroundColor: t.surface,
                  borderColor: t.border,
                },
                isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
              ]}
            >
              {/* Bars */}
              <View style={styles.waveformContainer}>
                {waveformHeights.map((h, i) => {
                  const isPlayed = i < 18;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.waveBar,
                        {
                          height: h,
                          backgroundColor: isPlayed ? t.primary : t.border,
                          opacity: isPlayed ? 1 : 0.45,
                        },
                      ]}
                    />
                  );
                })}
                {/* Active Playhead */}
                <View
                  style={[styles.playheadLine, { left: "45%", backgroundColor: t.primaryLight || t.primary }]}
                />
              </View>

              {/* Timestamps */}
              <View style={styles.waveTimeRow}>
                <Text style={[styles.waveTime, { color: t.textSecondary }]}>00:00</Text>
                <Text style={[styles.waveTime, { color: t.textSecondary }]}>
                  {selectedCall ? formatDuration(selectedCall.duration) : "28:17"}
                </Text>
              </View>

              {/* Scrubber Controls */}
              <View style={styles.scrubberRow}>
                <TouchableOpacity
                  style={styles.scrubBtn}
                  onPress={() => Alert.alert("Rewind", "Rewound 15s")}
                >
                  <Ionicons name="refresh-outline" size={20} color={t.textSecondary} />
                  <Text style={[styles.scrubText, { color: t.textSecondary }]}>15</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsPlaying(!isPlaying)}
                  style={[
                    styles.playPauseBtn,
                    {
                      backgroundColor: t.text,
                    },
                  ]}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={24}
                    color={t.bg}
                    style={{ marginLeft: isPlaying ? 0 : 2 }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.scrubBtn}
                  onPress={() => Alert.alert("Forward", "Forwarded 15s")}
                >
                  <Ionicons name="refresh-outline" size={20} color={t.textSecondary} />
                  <Text style={[styles.scrubText, { color: t.textSecondary }]}>15</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    setPlaybackSpeed(
                      playbackSpeed === "1x"
                        ? "1.5x"
                        : playbackSpeed === "1.5x"
                        ? "2x"
                        : "1x"
                    )
                  }
                  style={[
                    styles.speedPill,
                    { backgroundColor: t.surfaceAlt, borderColor: t.border },
                  ]}
                >
                  <Text style={[styles.speedText, { color: t.text }]}>
                    {playbackSpeed}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Talk / Listen Section */}
            <View style={styles.talkListenSection}>
              <View style={styles.talkHeaderRow}>
                <Text style={[styles.talkTitle, { color: t.text }]}>
                  Talk / Listen
                </Text>
                <View style={styles.balanceBadge}>
                  <View style={[styles.balanceDot, { backgroundColor: t.primary }]} />
                  <Text style={[styles.balanceText, { color: t.textSecondary }]}>
                    Good balance
                  </Text>
                </View>
              </View>

              {/* Progress Split Bar */}
              <View style={styles.talkBarWrap}>
                <View
                  style={[
                    styles.talkBarLeft,
                    { width: "46%", backgroundColor: t.primary },
                  ]}
                />
                <View
                  style={[
                    styles.talkBarRight,
                    { width: "54%", backgroundColor: t.surfaceAlt },
                  ]}
                />
              </View>

              <View style={styles.talkLabelsRow}>
                <Text style={[styles.talkSub, { color: t.textSecondary }]}>
                  You <Text style={{ color: t.text, fontFamily: Typography.bold }}>46%</Text>
                </Text>
                <Text style={[styles.talkSub, { color: t.textSecondary }]}>
                  Them <Text style={{ color: t.text, fontFamily: Typography.bold }}>54%</Text>
                </Text>
              </View>
            </View>

            {/* Sentiment Trajectory Section */}
            <View style={styles.sentimentSection}>
              <View style={styles.sentimentHeaderRow}>
                <Text style={[styles.talkTitle, { color: t.text }]}>
                  Sentiment
                </Text>
                {/* Acid Lime Tooltip */}
                <View
                  style={[
                    styles.peakBadge,
                    { backgroundColor: t.primarySurface },
                  ]}
                >
                  <Text style={[styles.peakText, { color: t.primary }]}>Peak interest at 21:14</Text>
                </View>
              </View>

              <View
                style={[
                  styles.sentimentCard,
                  {
                    backgroundColor: t.surface,
                    borderColor: t.border,
                  },
                  isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              >
                <View style={styles.sentimentYAxis}>
                  <Text style={[styles.sentAxisText, { color: t.textSecondary }]}>Positive</Text>
                  <Text style={[styles.sentAxisText, { color: t.textSecondary }]}>Neutral</Text>
                  <Text style={[styles.sentAxisText, { color: t.textSecondary }]}>Negative</Text>
                </View>

                {/* Trajectory Simulation Curve */}
                <View style={styles.sentimentGraph}>
                  <View style={[styles.sentGridLine, { top: "15%", borderColor: t.border }]} />
                  <View style={[styles.sentGridLine, { top: "50%", borderColor: t.border }]} />
                  <View style={[styles.sentGridLine, { top: "85%", borderColor: t.border }]} />

                  {/* Nodes along the curve */}
                  <View style={[styles.curvePoint, { left: "10%", top: "60%", backgroundColor: t.primary }]} />
                  <View style={[styles.curvePoint, { left: "30%", top: "45%", backgroundColor: t.primary }]} />
                  <View style={[styles.curvePoint, { left: "55%", top: "40%", backgroundColor: t.primary }]} />
                  <View style={[styles.curvePoint, { left: "75%", top: "15%", backgroundColor: t.primary, width: 10, height: 10 }]} />
                  <View style={[styles.curvePoint, { left: "90%", top: "25%", backgroundColor: t.primary }]} />
                </View>
              </View>
              <View style={styles.sentTimeRow}>
                <Text style={[styles.sentTimeLabel, { color: t.textSecondary }]}>0m</Text>
                <Text style={[styles.sentTimeLabel, { color: t.textSecondary }]}>7m</Text>
                <Text style={[styles.sentTimeLabel, { color: t.textSecondary }]}>14m</Text>
                <Text style={[styles.sentTimeLabel, { color: t.textSecondary }]}>21m</Text>
                <Text style={[styles.sentTimeLabel, { color: t.textSecondary }]}>28m</Text>
              </View>
            </View>

            {/* AI Insights Section */}
            <View style={styles.aiInsightsSection}>
              <View style={styles.aiHeaderRow}>
                <View
                  style={[
                    styles.aiSparkIcon,
                    { backgroundColor: t.primarySurface },
                  ]}
                >
                  <Ionicons name="sparkles" size={14} color={t.primary} />
                </View>
                <View>
                  <Text style={[styles.aiTitle, { color: t.text }]}>
                    AI insights
                  </Text>
                  <Text style={[styles.aiSub, { color: t.textSecondary }]}>
                    Generated from call analysis
                  </Text>
                </View>
              </View>

              {/* Numbered Insights */}
              <View style={styles.insightsList}>
                <View
                  style={[
                    styles.insightCard,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.border,
                    },
                    isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View
                    style={[
                      styles.numCircle,
                      { backgroundColor: t.surfaceAlt },
                    ]}
                  >
                    <Text style={[styles.numText, { color: t.text }]}>1</Text>
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={[styles.insightHeading, { color: t.text }]}>
                      Strong interest in Q2 rollout
                    </Text>
                    <Text style={[styles.insightDesc, { color: t.textSecondary }]}>
                      Confirmed budget and internal alignment.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.textSecondary} />
                </View>

                <View
                  style={[
                    styles.insightCard,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.border,
                    },
                    isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View
                    style={[
                      styles.numCircle,
                      { backgroundColor: t.surfaceAlt },
                    ]}
                  >
                    <Text style={[styles.numText, { color: t.text }]}>2</Text>
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={[styles.insightHeading, { color: t.text }]}>
                      Security and data residency are key concerns
                    </Text>
                    <Text style={[styles.insightDesc, { color: t.textSecondary }]}>
                      Send security overview and compliance docs.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.textSecondary} />
                </View>

                <View
                  style={[
                    styles.insightCard,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.border,
                    },
                    isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View
                    style={[
                      styles.numCircle,
                      { backgroundColor: t.surfaceAlt },
                    ]}
                  >
                    <Text style={[styles.numText, { color: t.text }]}>3</Text>
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={[styles.insightHeading, { color: t.text }]}>
                      Next step
                    </Text>
                    <Text style={[styles.insightDesc, { color: t.textSecondary }]}>
                      Send custom proposal by end of week.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.textSecondary} />
                </View>
              </View>
            </View>

            {/* Create Follow-up Task Action */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Alert.alert("Success", "Follow-up task created and synced.");
              }}
              style={[
                styles.createTaskBtn,
                { backgroundColor: t.primary },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              <Text style={styles.createTaskText}>Create follow up task</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  screenHeading: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.screenTitle,
    letterSpacing: -0.2,
  },
  topBarRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchSection: {
    paddingHorizontal: Spacing.screenPadding,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
  },
  filterChipsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screenPadding,
    gap: 8,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.label,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
    textAlign: "center",
  },
  groupSection: {
    marginBottom: 20,
  },
  groupHeader: {
    fontFamily: Typography.bold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
    ...Shadows.card,
  },
  callAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  callDetails: {
    flex: 1,
    gap: 2,
  },
  callerName: {
    fontFamily: Typography.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  callMeta: {
    fontFamily: Typography.medium,
    fontSize: 13,
  },
  callRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callTimeCol: {
    alignItems: "flex-end",
    gap: 2,
  },
  callDurationText: {
    fontFamily: Typography.medium,
    fontSize: 12,
  },
  callTimeText: {
    fontFamily: Typography.medium,
    fontSize: 11,
  },

  // Recorded Call Modal Styles
  modalScreen: {
    flex: 1,
  },
  recordedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  recordedTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.screenTitle,
    letterSpacing: -0.2,
  },
  recordCompanyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  companyLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  companyLogoLetter: {
    fontFamily: Typography.bold,
    fontSize: 18,
    color: "#20E3AD",
  },
  companyTextWrap: {
    flex: 1,
    gap: 2,
  },
  recordCompanyName: {
    fontFamily: Typography.headingSemi,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  recordCompanySub: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.label,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  tabBtn: {
    paddingVertical: 10,
    marginRight: 20,
  },
  tabText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.bodySmall,
  },

  // Waveform
  waveformCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: 24,
    ...Shadows.card,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 80,
    position: "relative",
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  playheadLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
  },
  waveTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 16,
  },
  waveTime: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  scrubberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  scrubBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  scrubText: {
    fontSize: 9,
    fontFamily: Typography.bold,
    marginTop: -4,
  },
  playPauseBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  speedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  speedText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
  },

  // Talk / Listen
  talkListenSection: {
    marginBottom: 24,
  },
  talkHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  talkTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
    letterSpacing: -0.2,
  },
  balanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  balanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  balanceText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.label,
  },
  talkBarWrap: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  talkBarLeft: {
    height: "100%",
  },
  talkBarRight: {
    height: "100%",
  },
  talkLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  talkSub: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.label,
  },

  // Sentiment
  sentimentSection: {
    marginBottom: 24,
  },
  sentimentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  peakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  peakText: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.micro,
    color: "#101513",
  },
  sentimentCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    height: 100,
    ...Shadows.card,
  },
  sentimentYAxis: {
    justifyContent: "space-between",
    paddingRight: 10,
    width: 60,
  },
  sentAxisText: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.micro,
  },
  sentimentGraph: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
  },
  sentGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: "dashed",
  },
  curvePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sentTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 60,
    marginTop: 6,
  },
  sentTimeLabel: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.micro,
  },

  // AI Insights
  aiInsightsSection: {
    marginBottom: 24,
  },
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  aiSparkIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  aiTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
    letterSpacing: -0.2,
  },
  aiSub: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  insightsList: {
    gap: 8,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 12,
    ...Shadows.card,
  },
  numCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  numText: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.caption,
  },
  insightContent: {
    flex: 1,
    gap: 2,
  },
  insightHeading: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  insightDesc: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },

  // Create Follow up task
  createTaskBtn: {
    height: 50,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    ...Shadows.mintButton,
  },
  createTaskText: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.button,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // ── Segmented Switcher & Live KPI Strip ──
  segmentTrack: {
    flexDirection: "row",
    marginHorizontal: Spacing.screenPadding,
    marginBottom: 12,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 999,
  },
  segmentText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
    letterSpacing: 0.2,
  },
  kpiStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginHorizontal: Spacing.screenPadding,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  kpiItem: {
    alignItems: "center",
    flex: 1,
  },
  kpiNum: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  kpiLabel: {
    fontSize: 10,
    fontFamily: Typography.medium,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  kpiDivider: {
    width: 1,
    height: 24,
  },

  // ── Analytics & Reports Sub-Styles ──
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.lg,
    paddingVertical: 4,
  },
  memberPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
  },
  analyticsKpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: Spacing.lg,
  },
  analyticsKpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    ...Shadows.card,
  },
  analyticsKpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  analyticsKpiVal: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  analyticsKpiLbl: {
    fontSize: 10,
    fontFamily: Typography.medium,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  analyticsChartCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 16,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  analyticsChartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  analyticsChartTitle: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  analyticsChartBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  analyticsChartBadgeText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  analyticsSectionCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 16,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  analyticsSectionTitle: {
    fontSize: 14,
    fontFamily: Typography.bold,
    marginBottom: 12,
  },
  distRow: {
    marginBottom: 10,
  },
  distLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  distType: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  distCount: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  distTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  distBar: {
    height: "100%",
    borderRadius: 3,
  },
  topNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topNumberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  topRankText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  topPhone: {
    fontSize: 13,
    fontFamily: Typography.medium,
  },
  topCallsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  topCallsText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
});
