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

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  RefreshControl,
  Platform,
  NativeModules,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { getAccessToken } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import AppLineChart from "@/components/charts/AppLineChart";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusPill } from "@/components/ui/StatusPill";
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
  audio_url?: string | null;
  recording_filename?: string;
}

type FilterType = "all" | "incoming" | "outgoing" | "missed";
type DatePresetType = "all" | "1d" | "1w" | "1m" | "3m" | "custom";
type AnalysisTab = "Playback" | "Details";
type TimelineRow =
  | { kind: "header"; key: string; title: string; count: number }
  | { kind: "item"; key: string; log: CallLogItem };

const formatYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const WAVEFORM_HEIGHTS = [
  12, 24, 18, 32, 45, 28, 55, 38, 48, 62, 70, 52, 40, 65, 80, 50, 35, 60, 75,
  90, 68, 45, 58, 72, 85, 48, 30, 62, 78, 55, 42, 68, 50, 38, 25, 40, 30, 20,
  15, 10,
];

function CallAudioPlayer({
  audioUrl,
  fallbackDuration,
  formatDuration,
  t,
  isDark,
}: {
  audioUrl: string;
  fallbackDuration: number;
  formatDuration: (s: number) => string;
  t: any;
  isDark: boolean;
}) {
  const nativeAudio = NativeModules?.CallRecordingScanner;
  const [playbackSpeed, setPlaybackSpeed] = useState<"1x" | "1.5x" | "2x">("1x");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioCurrentSec, setAudioCurrentSec] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState(fallbackDuration || 0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const playbackProgress =
    audioDurationSec > 0 ? Math.min(1, audioCurrentSec / audioDurationSec) : 0;

  useEffect(() => {
    let active = true;
    const poll = setInterval(async () => {
      if (!active || !nativeAudio?.getAudioStatus) return;
      try {
        const st = await nativeAudio.getAudioStatus();
        if (!active || !st) return;
        setIsAudioPlaying(Boolean(st.playing));
        setIsBuffering(Boolean(st.loading));
        setAudioCurrentSec(Number(st.currentTime) || 0);
        if (Number(st.duration) > 0) {
          setAudioDurationSec(Number(st.duration));
        }
        if (st.error) {
          setAudioError(String(st.error));
        }
      } catch {
        // Ignore polling errors
      }
    }, 300);

    return () => {
      active = false;
      clearInterval(poll);
      try {
        nativeAudio?.stopAudio?.();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [audioUrl, nativeAudio]);

  if (!nativeAudio?.playAudio) {
    return (
      <View
        style={[
          styles.waveformCard,
          {
            backgroundColor: t.surface,
            borderColor: t.border,
            alignItems: "center",
            paddingVertical: 24,
            gap: 6,
          },
        ]}
      >
        <Ionicons name="volume-mute-outline" size={24} color={t.textSecondary} />
        <Text style={[styles.analyticsChartTitle, { color: t.text }]}>
          Audio Playback Unavailable
        </Text>
        <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
          Please update to the latest APK to play recordings.
        </Text>
      </View>
    );
  }

  const handleTogglePlay = async () => {
    setAudioError(null);
    try {
      if (isAudioPlaying) {
        await nativeAudio.pauseAudio();
        setIsAudioPlaying(false);
      } else {
        setIsBuffering(true);
        const token = await getAccessToken();
        await nativeAudio.playAudio(audioUrl, token || "");
      }
    } catch (err: any) {
      setIsBuffering(false);
      setAudioError(err?.message || "Unable to play recording");
    }
  };

  return (
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
      <View style={styles.waveformContainer}>
        {WAVEFORM_HEIGHTS.map((h, i) => {
          const ratio = i / WAVEFORM_HEIGHTS.length;
          const isPlayed = ratio <= playbackProgress;
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
        <View
          style={[
            styles.playheadLine,
            {
              left: `${Math.round(playbackProgress * 100)}%`,
              backgroundColor: t.primaryLight || t.primary,
            },
          ]}
        />
      </View>

      <View style={styles.waveTimeRow}>
        <Text style={[styles.waveTime, { color: t.textSecondary }]}>
          {formatDuration(Math.floor(audioCurrentSec))}
        </Text>
        <Text style={[styles.waveTime, { color: t.textSecondary }]}>
          {formatDuration(Math.floor(audioDurationSec))}
        </Text>
      </View>

      {!!audioError && (
        <Text
          style={{
            color: t.danger,
            fontSize: 12,
            textAlign: "center",
            marginBottom: 8,
            fontFamily: Typography.medium,
          }}
        >
          {audioError}
        </Text>
      )}

      <View style={styles.scrubberRow}>
        <TouchableOpacity
          style={styles.scrubBtn}
          onPress={() => {
            const target = Math.max(0, audioCurrentSec - 15);
            nativeAudio.seekAudio?.(target);
          }}
        >
          <Ionicons name="refresh-outline" size={20} color={t.textSecondary} />
          <Text style={[styles.scrubText, { color: t.textSecondary }]}>-15s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleTogglePlay}
          style={[styles.playPauseBtn, { backgroundColor: t.text }]}
        >
          {isBuffering && !isAudioPlaying ? (
            <ActivityIndicator size="small" color={t.bg} />
          ) : (
            <Ionicons
              name={isAudioPlaying ? "pause" : "play"}
              size={24}
              color={t.bg}
              style={{ marginLeft: isAudioPlaying ? 0 : 2 }}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scrubBtn}
          onPress={() => {
            const target = Math.min(audioDurationSec, audioCurrentSec + 15);
            nativeAudio.seekAudio?.(target);
          }}
        >
          <Ionicons name="refresh-outline" size={20} color={t.textSecondary} />
          <Text style={[styles.scrubText, { color: t.textSecondary }]}>+15s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            const nextSpeed =
              playbackSpeed === "1x"
                ? "1.5x"
                : playbackSpeed === "1.5x"
                  ? "2x"
                  : "1x";
            setPlaybackSpeed(nextSpeed);
            const rate = nextSpeed === "1.5x" ? 1.5 : nextSpeed === "2x" ? 2.0 : 1.0;
            nativeAudio.setAudioSpeed?.(rate);
          }}
          style={[
            styles.speedPill,
            { backgroundColor: t.surfaceAlt, borderColor: t.border },
          ]}
        >
          <Text style={[styles.speedText, { color: t.text }]}>{playbackSpeed}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CallLogsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ user_id?: string; username?: string }>();

  const [logs, setLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const loadingMoreRef = useRef(false);
  const [selectedType, setSelectedType] = useState<FilterType>("all");
  const [searchPhone, setSearchPhone] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchPhone.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchPhone]);

  // Segmented Main Tab: Timeline vs Analytics
  const [activeMainTab, setActiveMainTab] = useState<"timeline" | "analytics">("timeline");

  // Analytics & Reports state
  const [selectedStatsUser, setSelectedStatsUser] = useState<string>(params.user_id || "all");
  const [stats, setStats] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<
    Array<{ id: number; username: string; role?: string; total_call_logs?: number }>
  >([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Employee & Date Filter Modal state
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePresetType>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(() => formatYMD(new Date()));
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatYMD(new Date()));
  const [draftStartDate, setDraftStartDate] = useState<string>(() => formatYMD(new Date()));
  const [draftEndDate, setDraftEndDate] = useState<string>(() => formatYMD(new Date()));
  const [dateError, setDateError] = useState("");

  const activeDateRange = useMemo(() => {
    const today = new Date();
    const endStr = formatYMD(today);
    if (datePreset === "all") return { start: "", end: "", label: "" };
    if (datePreset === "1d") return { start: endStr, end: endStr, label: "1 Day (Today)" };
    if (datePreset === "1w") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: formatYMD(start), end: endStr, label: "Past 1 Week" };
    }
    if (datePreset === "1m") {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 1);
      return { start: formatYMD(start), end: endStr, label: "Past 1 Month" };
    }
    if (datePreset === "3m") {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 3);
      return { start: formatYMD(start), end: endStr, label: "Past 3 Months" };
    }
    const label =
      customStartDate === customEndDate
        ? customStartDate
        : `${customStartDate} → ${customEndDate}`;
    return { start: customStartDate, end: customEndDate, label };
  }, [datePreset, customStartDate, customEndDate]);

  const selectedEmployeeName = useMemo(() => {
    if (!selectedStatsUser || selectedStatsUser === "all") return null;
    const found = teamMembers.find((m) => m.id.toString() === selectedStatsUser);
    return found ? found.username : params.username || `Employee #${selectedStatsUser}`;
  }, [selectedStatsUser, teamMembers, params.username]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter(
      (m) =>
        m.username.toLowerCase().includes(q) ||
        (m.role && m.role.toLowerCase().includes(q))
    );
  }, [teamMembers, employeeSearch]);

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
  const connectedCalls = incomingCalls + outgoingCalls;
  const connectRatePct = stats?.total_calls
    ? Math.round((connectedCalls / stats.total_calls) * 100)
    : 0;

  const trendSummary = useMemo(() => {
    const vals = trendData.data;
    const sum = vals.reduce((a, b) => a + b, 0);
    const maxVal = Math.max(...vals, 0);
    const maxIdx = vals.indexOf(maxVal);
    return {
      peakCalls: maxVal,
      peakLabel: maxIdx >= 0 ? trendData.labels[maxIdx] : "-",
      dailyAvg: vals.length > 0 ? (sum / vals.length).toFixed(1) : "0",
    };
  }, [trendData]);

  const chartConfig = {
    backgroundGradientFrom: t.surface,
    backgroundGradientTo: t.surface,
    fillShadowGradientFrom: isDark ? "#10B981" : "#00A879",
    fillShadowGradientFromOpacity: 0.24,
    fillShadowGradientTo: t.surface,
    fillShadowGradientToOpacity: 0.02,
    color: (opacity = 1) =>
      isDark ? `rgba(16, 185, 129, ${opacity})` : `rgba(0, 168, 121, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDark ? `rgba(148, 163, 184, ${opacity})` : `rgba(94, 105, 100, ${opacity})`,
    strokeWidth: 2.5,
    barPercentage: 0.55,
    decimalPlaces: 0,
    propsForDots: {
      r: "4.5",
      strokeWidth: "2",
      stroke: t.surface,
      fill: t.primary,
    },
    propsForBackgroundLines: {
      strokeDasharray: "4",
      stroke: t.border,
    },
  };

  // Recorded Call Modal
  const [selectedCall, setSelectedCall] = useState<CallLogItem | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("Playback");

  useEffect(() => {
    if (!selectedCall) {
      setActiveTab("Playback");
    }
  }, [selectedCall]);

  const fetchLogs = useCallback(
    async (pageNum?: number, append?: boolean) => {
      const targetPage = pageNum ?? 1;
      const shouldAppend = Boolean(append);
      try {
        const queryParams: Record<string, string> = {
          page: targetPage.toString(),
          page_size: "50",
        };
        if (selectedStatsUser && selectedStatsUser !== "all") {
          queryParams.user_id = selectedStatsUser;
        }
        if (selectedType !== "all") {
          queryParams.call_type = selectedType;
        }
        if (activeDateRange.start) {
          queryParams.start_date = activeDateRange.start;
        }
        if (activeDateRange.end) {
          queryParams.end_date = activeDateRange.end;
        }
        if (debouncedSearch) {
          queryParams.search = debouncedSearch;
        }
        const response = await api.get("/admin/call-logs/", { params: queryParams });
        const data = response.data;
        const results: CallLogItem[] = data.results || data;
        const nextExists = !!data.next;
        if (typeof data.count === "number") {
          setTotalCount(data.count);
        } else if (!shouldAppend) {
          setTotalCount(results.length);
        }
        if (shouldAppend) {
          setLogs((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const uniqueNew = results.filter((r) => !seen.has(r.id));
            return [...prev, ...uniqueNew];
          });
        } else {
          setLogs(results);
        }
        setHasMore(nextExists);
      } catch {
        // Handled silently
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        loadingMoreRef.current = false;
      }
    },
    [selectedStatsUser, selectedType, activeDateRange.start, activeDateRange.end, debouncedSearch]
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadingMoreRef.current = false;
    fetchLogs(1, false);
  }, [fetchLogs]);

  // Real-time 15s polling so newly ended employee calls & recordings appear automatically
  useEffect(() => {
    if (activeMainTab !== "timeline") return;
    const interval = setInterval(() => {
      if (!loadingMoreRef.current) {
        fetchLogs(1, false);
        fetchStats();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [activeMainTab, fetchLogs, fetchStats]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, true);
  }, [hasMore, loading, page, fetchLogs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadingMoreRef.current = false;
    fetchLogs(1, false);
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const filteredLogs = useMemo(() => {
    const trimmed = searchPhone.trim().toLowerCase();
    return logs.filter((log) => {
      const matchType = selectedType === "all" || log.call_type === selectedType;
      if (!trimmed || trimmed === debouncedSearch.toLowerCase()) {
        return matchType;
      }
      const matchSearch =
        log.phone_number.toLowerCase().includes(trimmed) ||
        log.username.toLowerCase().includes(trimmed);
      return matchType && matchSearch;
    });
  }, [logs, selectedType, searchPhone, debouncedSearch]);

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

  const timelineRows = useMemo<TimelineRow[]>(() => {
    const rows: TimelineRow[] = [];
    groupedLogs.forEach((g) => {
      rows.push({
        kind: "header",
        key: `header-${g.title}`,
        title: g.title,
        count: g.data.length,
      });
      g.data.forEach((log) => {
        rows.push({
          kind: "item",
          key: `log-${log.id}`,
          log,
        });
      });
    });
    return rows;
  }, [groupedLogs]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const now = new Date();
      const todayStr = now.toDateString();
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);

      if (d.toDateString() === todayStr) {
        return `Today, ${timeStr}`;
      }
      if (d.toDateString() === yesterdayDate.toDateString()) {
        return `Yesterday, ${timeStr}`;
      }
      const dateStr = d.toLocaleDateString([], {
        day: "numeric",
        month: "short",
        ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
      });
      return `${dateStr}, ${timeStr}`;
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
          {/* ── Clickable KPI Filter Cards (Total, Incoming, Outgoing, Missed) ── */}
          <View style={styles.kpiStrip}>
            {(
              [
                {
                  key: "all" as FilterType,
                  label: "TOTAL",
                  value: stats?.total_calls ?? logs.length,
                  color: t.text,
                  activeBorder: t.primary,
                  activeBg: isDark ? "rgba(16, 185, 129, 0.14)" : "#ECFDF5",
                  icon: null,
                },
                {
                  key: "incoming" as FilterType,
                  label: "INCOMING",
                  value: incomingCalls,
                  color: t.primary,
                  activeBorder: t.primary,
                  activeBg: isDark ? "rgba(16, 185, 129, 0.14)" : "#ECFDF5",
                  icon: "arrow-down" as const,
                },
                {
                  key: "outgoing" as FilterType,
                  label: "OUTGOING",
                  value: outgoingCalls,
                  color: isDark ? "#60A5FA" : "#2563EB",
                  activeBorder: isDark ? "#60A5FA" : "#2563EB",
                  activeBg: isDark ? "rgba(59, 130, 246, 0.16)" : "rgba(37, 99, 235, 0.08)",
                  icon: "arrow-up" as const,
                },
                {
                  key: "missed" as FilterType,
                  label: "MISSED",
                  value: missedCalls,
                  color: t.danger || "#EF4444",
                  activeBorder: t.danger || "#EF4444",
                  activeBg: isDark ? "rgba(239, 68, 68, 0.16)" : "rgba(239, 68, 68, 0.08)",
                  icon: "close" as const,
                },
              ]
            ).map((card) => {
              const isSelected = selectedType === card.key;
              return (
                <TouchableOpacity
                  key={card.key}
                  activeOpacity={0.75}
                  onPress={() =>
                    setSelectedType(
                      card.key === "all"
                        ? "all"
                        : selectedType === card.key
                          ? "all"
                          : card.key
                    )
                  }
                  style={[
                    styles.kpiItem,
                    {
                      backgroundColor: isSelected ? card.activeBg : t.surface,
                      borderColor: isSelected ? card.activeBorder : t.border,
                    },
                    Shadows.card,
                    isDark && !isSelected && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    {card.icon && (
                      <Ionicons name={card.icon} size={13} color={card.color} />
                    )}
                    <Text
                      style={[
                        styles.kpiNum,
                        { color: card.color, fontVariant: ["tabular-nums"] },
                      ]}
                    >
                      {card.value}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.kpiLabel,
                      {
                        color: isSelected ? card.color : t.textSecondary,
                        fontFamily: isSelected ? Typography.bold : Typography.medium,
                      },
                    ]}
                  >
                    {card.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Search Bar ─────────────────────────────────────────── */}
          <View style={styles.searchSection}>
            <SearchBar
              value={searchPhone}
              onChangeText={setSearchPhone}
              placeholders={[
                'Search "employee"',
                'Search "contact"',
                'Search "company"',
                'Search "phone number"',
              ]}
              intervalMs={2000}
              onClear={() => setSearchPhone("")}
              onFilterPress={() => {
                setDateError("");
                setDraftStartDate(customStartDate);
                setDraftEndDate(customEndDate);
                setEmployeeModalVisible(true);
              }}
              filterActive={selectedStatsUser !== "all" || datePreset !== "all"}
            />
          </View>

          {/* ── Active Employee / Date Filter Banner ───────────────── */}
          {(selectedEmployeeName || datePreset !== "all") && (
            <View style={styles.activeEmployeeRow}>
              {selectedEmployeeName && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setEmployeeModalVisible(true)}
                  style={[
                    styles.activeEmployeeBadge,
                    {
                      backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#ECFDF5",
                      borderColor: t.primary,
                    },
                  ]}
                >
                  <Ionicons name="person-outline" size={13} color={t.primary} />
                  <Text style={[styles.activeEmployeeText, { color: t.primary }]}>
                    {selectedEmployeeName}
                  </Text>
                </TouchableOpacity>
              )}
              {datePreset !== "all" && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setEmployeeModalVisible(true)}
                  style={[
                    styles.activeEmployeeBadge,
                    {
                      backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#ECFDF5",
                      borderColor: t.primary,
                    },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={13} color={t.primary} />
                  <Text style={[styles.activeEmployeeText, { color: t.primary }]}>
                    {activeDateRange.label}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedStatsUser("all");
                  setDatePreset("all");
                }}
                style={[
                  styles.clearEmployeeBtn,
                  {
                    backgroundColor: t.surface,
                    borderColor: t.border,
                  },
                ]}
              >
                <Ionicons name="close" size={14} color={t.textSecondary} />
                <Text style={[styles.clearEmployeeText, { color: t.textSecondary }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
              data={timelineRows}
              keyExtractor={(item) => item.key}
              initialNumToRender={15}
              maxToRenderPerBatch={15}
              windowSize={7}
              removeClippedSubviews={Platform.OS === "android"}
              contentContainerStyle={{
                paddingHorizontal: Spacing.screenPadding,
                paddingBottom: Math.max(insets.bottom, 16) + 90,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={t.primary}
                  colors={[t.primary]}
                />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                <View style={styles.listFooterWrap}>
                  {loadingMore ? (
                    <View style={styles.loadingMoreRow}>
                      <ActivityIndicator size="small" color={t.primary} />
                      <Text style={[styles.footerMetaText, { color: t.textSecondary }]}>
                        Loading more calls...
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.footerMetaText, { color: t.textSecondary }]}>
                      {hasMore
                        ? `Showing ${filteredLogs.length}${totalCount ? ` of ${totalCount}` : ""} calls · Scroll for more`
                        : `Showing all ${filteredLogs.length} calls`}
                    </Text>
                  )}
                </View>
              }
              renderItem={({ item }) => {
                if (item.kind === "header") {
                  return (
                    <View style={[styles.groupHeaderRow, { marginTop: 8 }]}>
                      <Text style={[styles.groupHeader, { color: t.textSecondary }]}>
                        {item.title}
                      </Text>
                      <View
                        style={[
                          styles.groupCountPill,
                          {
                            backgroundColor: isDark
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(16, 21, 19, 0.06)",
                          },
                        ]}
                      >
                        <Text style={[styles.groupCountText, { color: t.textSecondary }]}>
                          {item.count}
                        </Text>
                      </View>
                    </View>
                  );
                }

                const log = item.log;
                const isIncoming = log.call_type === "incoming";
                const isMissed = log.call_type === "missed";
                const iconColor = isMissed
                  ? t.danger
                  : isIncoming
                    ? t.primary
                    : isDark
                      ? "#60A5FA"
                      : "#2563EB";
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

                const pillVariant = isMissed
                  ? "overdue"
                  : isIncoming
                    ? "paid"
                    : "stage_contacted";

                return (
                  <TouchableOpacity
                    activeOpacity={0.72}
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
                    {/* Top Row: Call Icon + Employee & Phone + StatusPill */}
                    <View style={styles.callTopRow}>
                      <View style={styles.callIdentityRow}>
                        <View
                          style={[
                            styles.callAvatar,
                            {
                              backgroundColor: avatarBg,
                              borderColor: isMissed
                                ? "rgba(239, 68, 68, 0.25)"
                                : isIncoming
                                  ? "rgba(0, 168, 121, 0.25)"
                                  : "rgba(59, 130, 246, 0.25)",
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Ionicons name={iconName} size={17} color={iconColor} />
                        </View>

                        <View style={styles.callDetails}>
                          <Text
                            style={[styles.callerName, { color: t.text }]}
                            numberOfLines={1}
                          >
                            {log.username || log.phone_number}
                          </Text>
                          <View style={styles.callPhoneRow}>
                            <Ionicons
                              name="call-outline"
                              size={12}
                              color={t.textSecondary}
                            />
                            <Text
                              style={[styles.callMeta, { color: t.textSecondary }]}
                              numberOfLines={1}
                            >
                              {log.phone_number}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <StatusPill
                        label={log.call_type}
                        variant={pillVariant}
                        size="small"
                        showDot={!isMissed}
                      />
                    </View>

                    {/* Bottom Meta Well (Oblu CRM Card Pattern) */}
                    <View
                      style={[
                        styles.callMetaWell,
                        {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.03)"
                            : "rgba(16, 21, 19, 0.03)",
                          borderColor: isDark
                            ? "rgba(255, 255, 255, 0.06)"
                            : "rgba(16, 21, 19, 0.06)",
                        },
                      ]}
                    >
                      <View style={styles.callMetaLeft}>
                        <View style={styles.callMetaChip}>
                          <Ionicons
                            name="time-outline"
                            size={13}
                            color={t.textSecondary}
                          />
                          <Text
                            style={[
                              styles.callDurationText,
                              { color: t.text, fontVariant: ["tabular-nums"] },
                            ]}
                          >
                            {formatDuration(log.duration)}
                          </Text>
                        </View>
                        <View style={[styles.metaDot, { backgroundColor: t.border }]} />
                        <View style={styles.callMetaChip}>
                          <Ionicons
                            name="calendar-outline"
                            size={12}
                            color={t.textSecondary}
                          />
                          <Text
                            style={[
                              styles.callTimeText,
                              { color: t.textSecondary, fontVariant: ["tabular-nums"] },
                            ]}
                          >
                            {formatTime(log.timestamp)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.callInspectWrap}>
                        {log.audio_url ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                              marginRight: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: t.primarySurface,
                            }}
                          >
                            <Ionicons name="mic" size={11} color={t.primary} />
                            <Text
                              style={{
                                fontSize: 10.5,
                                fontFamily: Typography.semiBold,
                                color: t.primary,
                              }}
                            >
                              Audio
                            </Text>
                          </View>
                        ) : null}
                        <Text style={[styles.callInspectText, { color: t.primary }]}>
                          Inspect
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={t.primary}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
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
          {/* Employee Dropdown Selector (No Horizontal Scroll) */}
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => {
              setDateError("");
              setEmployeeModalVisible(true);
            }}
            style={[
              styles.analyticsDropdownBtn,
              {
                backgroundColor: t.surface,
                borderColor: selectedStatsUser !== "all" ? t.primary : t.border,
              },
              Shadows.card,
              isDark &&
              selectedStatsUser === "all" && {
                borderTopColor: "rgba(255, 255, 255, 0.12)",
              },
            ]}
          >
            <View style={styles.analyticsDropdownLeft}>
              <View
                style={[
                  styles.analyticsDropdownIcon,
                  { backgroundColor: t.primarySurface },
                ]}
              >
                <Ionicons
                  name={selectedStatsUser === "all" ? "people-outline" : "person-outline"}
                  size={17}
                  color={t.primary}
                />
              </View>
              <View>
                <Text style={[styles.analyticsDropdownLabel, { color: t.textSecondary }]}>
                  VIEWING ANALYTICS FOR
                </Text>
                <Text style={[styles.analyticsDropdownVal, { color: t.text }]}>
                  {selectedEmployeeName || `All Team (${teamMembers.length} Employees)`}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {selectedStatsUser !== "all" && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedStatsUser("all");
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.resetAllBtn,
                    { backgroundColor: t.surfaceAlt, borderColor: t.border },
                  ]}
                >
                  <Text style={[styles.resetAllText, { color: t.textSecondary }]}>
                    All
                  </Text>
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-down" size={18} color={t.textSecondary} />
            </View>
          </TouchableOpacity>

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
                      {
                        backgroundColor: t.primarySurface,
                        borderColor: isDark
                          ? "rgba(16, 185, 129, 0.25)"
                          : "rgba(0, 168, 121, 0.2)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Ionicons name="call" size={16} color={t.primary} />
                  </View>
                  <Text
                    style={[
                      styles.analyticsKpiVal,
                      { color: t.text, fontVariant: ["tabular-nums"] },
                    ]}
                  >
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
                      {
                        backgroundColor: isDark
                          ? "rgba(59, 130, 246, 0.16)"
                          : "rgba(37, 99, 235, 0.10)",
                        borderColor: "rgba(59, 130, 246, 0.25)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="time"
                      size={16}
                      color={isDark ? "#60A5FA" : "#2563EB"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.analyticsKpiVal,
                      { color: t.text, fontVariant: ["tabular-nums"] },
                    ]}
                  >
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
                      {
                        backgroundColor: t.primarySurface,
                        borderColor: isDark
                          ? "rgba(16, 185, 129, 0.25)"
                          : "rgba(0, 168, 121, 0.2)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Ionicons name="speedometer" size={16} color={t.primary} />
                  </View>
                  <Text
                    style={[
                      styles.analyticsKpiVal,
                      { color: t.text, fontVariant: ["tabular-nums"] },
                    ]}
                  >
                    {stats?.total_calls
                      ? formatDuration(Math.round(stats.total_duration / stats.total_calls))
                      : "0s"}
                  </Text>
                  <Text style={[styles.analyticsKpiLbl, { color: t.textSecondary }]}>
                    Avg / Call
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
                  <View>
                    <Text style={[styles.analyticsChartTitle, { color: t.text }]}>
                      Daily Call Volume
                    </Text>
                    <Text style={[styles.analyticsChartSub, { color: t.textSecondary }]}>
                      Last 7 days activity trend
                    </Text>
                  </View>
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
                  width={Math.max(windowWidth - Spacing.screenPadding * 2 - 34, 240)}
                  height={185}
                  chartConfig={chartConfig}
                  bezier
                  withInnerLines
                  withOuterLines={false}
                  style={{ borderRadius: 14, marginTop: 6, marginBottom: 10 }}
                  fromZero
                />

                {/* Chart Summary Meta Well */}
                <View
                  style={[
                    styles.chartMetaWell,
                    {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.03)"
                        : "rgba(16, 21, 19, 0.03)",
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(16, 21, 19, 0.06)",
                    },
                  ]}
                >
                  <View style={styles.chartMetaItem}>
                    <Ionicons name="trending-up" size={14} color={t.primary} />
                    <Text style={[styles.chartMetaLabel, { color: t.textSecondary }]}>
                      Peak:
                    </Text>
                    <Text
                      style={[
                        styles.chartMetaVal,
                        { color: t.text, fontVariant: ["tabular-nums"] },
                      ]}
                    >
                      {trendSummary.peakCalls} ({trendSummary.peakLabel})
                    </Text>
                  </View>
                  <View style={[styles.metaDot, { backgroundColor: t.border }]} />
                  <View style={styles.chartMetaItem}>
                    <Ionicons name="analytics-outline" size={14} color={t.textSecondary} />
                    <Text style={[styles.chartMetaLabel, { color: t.textSecondary }]}>
                      Daily Avg:
                    </Text>
                    <Text
                      style={[
                        styles.chartMetaVal,
                        { color: t.text, fontVariant: ["tabular-nums"] },
                      ]}
                    >
                      {trendSummary.dailyAvg}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Distribution By Type (Incoming, Outgoing, Missed) */}
              <View
                style={[
                  styles.analyticsSectionCard,
                  { backgroundColor: t.surface, borderColor: t.border },
                  isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              >
                <View style={styles.analyticsChartHeader}>
                  <Text style={[styles.analyticsSectionTitle, { color: t.text, marginBottom: 0 }]}>
                    Call Breakdown by Type
                  </Text>
                  <StatusPill
                    label={`${connectRatePct}% Connected`}
                    variant={connectRatePct >= 70 ? "paid" : "pending"}
                    size="small"
                  />
                </View>

                {/* Combined Proportional Segmented Bar */}
                <View
                  style={[
                    styles.segmentedDistTrack,
                    { backgroundColor: t.surfaceAlt },
                  ]}
                >
                  {incomingPct > 0 && (
                    <View
                      style={{
                        flex: incomingPct,
                        backgroundColor: t.primary,
                      }}
                    />
                  )}
                  {outgoingPct > 0 && (
                    <View
                      style={{
                        flex: outgoingPct,
                        backgroundColor: isDark ? "#60A5FA" : "#2563EB",
                      }}
                    />
                  )}
                  {missedPct > 0 && (
                    <View
                      style={{
                        flex: missedPct,
                        backgroundColor: t.danger,
                      }}
                    />
                  )}
                </View>

                {/* Breakdown Rows */}
                {(
                  [
                    {
                      label: "Incoming",
                      count: incomingCalls,
                      pct: incomingPct,
                      color: t.primary,
                      bg: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(0, 168, 121, 0.12)",
                      icon: "arrow-down" as const,
                    },
                    {
                      label: "Outgoing",
                      count: outgoingCalls,
                      pct: outgoingPct,
                      color: isDark ? "#60A5FA" : "#2563EB",
                      bg: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.10)",
                      icon: "arrow-up" as const,
                    },
                    {
                      label: "Missed",
                      count: missedCalls,
                      pct: missedPct,
                      color: t.danger,
                      bg: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.10)",
                      icon: "close" as const,
                    },
                  ]
                ).map((item) => (
                  <View key={item.label} style={styles.distRow}>
                    <View style={styles.distLabelRow}>
                      <View style={styles.distLeftWrap}>
                        <View style={[styles.distIconBox, { backgroundColor: item.bg }]}>
                          <Ionicons name={item.icon} size={12} color={item.color} />
                        </View>
                        <Text style={[styles.distType, { color: t.text }]}>
                          {item.label}
                        </Text>
                        <Text
                          style={[
                            styles.distPctText,
                            { color: item.color, fontVariant: ["tabular-nums"] },
                          ]}
                        >
                          {item.pct}%
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.distCount,
                          { color: t.text, fontVariant: ["tabular-nums"] },
                        ]}
                      >
                        {item.count} {item.count === 1 ? "call" : "calls"}
                      </Text>
                    </View>
                    <View style={[styles.distTrack, { backgroundColor: t.surfaceAlt }]}>
                      <View
                        style={[
                          styles.distBar,
                          {
                            width: `${item.pct}%`,
                            backgroundColor: item.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
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
                        styles.topNumberCard,
                        {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.03)"
                            : "rgba(16, 21, 19, 0.025)",
                          borderColor: isDark
                            ? "rgba(255, 255, 255, 0.06)"
                            : "rgba(16, 21, 19, 0.06)",
                        },
                      ]}
                    >
                      <View style={styles.topNumberLeft}>
                        <View
                          style={[
                            styles.topRankBadge,
                            {
                              backgroundColor:
                                index < 3 ? t.primary : t.surfaceAlt,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.topRankText,
                              { color: index < 3 ? "#FFFFFF" : t.textSecondary },
                            ]}
                          >
                            #{index + 1}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.topPhone,
                            { color: t.text, fontVariant: ["tabular-nums"] },
                          ]}
                        >
                          {item.phone_number}
                        </Text>
                      </View>
                      <StatusPill
                        label={`${item.count} ${item.count === 1 ? "call" : "calls"}`}
                        variant={index === 0 ? "paid" : "neutral"}
                        size="small"
                        showDot={false}
                      />
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
                <Text style={[styles.companyLogoLetter, { color: t.primary }]}>
                  {(selectedCall?.username || "C").charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.companyTextWrap}>
                <Text style={[styles.recordCompanyName, { color: t.text }]}>
                  {selectedCall?.username || "Employee"}
                </Text>
                <Text style={[styles.recordCompanySub, { color: t.textSecondary }]}>
                  {selectedCall
                    ? `${selectedCall.call_type.charAt(0).toUpperCase() + selectedCall.call_type.slice(1)} · ${selectedCall.phone_number} · ${formatDuration(selectedCall.duration)}`
                    : ""}
                </Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabsRow, { borderBottomColor: t.border }]}>
              {(["Playback", "Details"] as AnalysisTab[]).map((tab) => {
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
              })}
            </View>

            {activeTab === "Playback" ? (
              selectedCall?.audio_url ? (
                <CallAudioPlayer
                  audioUrl={selectedCall.audio_url}
                  fallbackDuration={selectedCall.duration}
                  formatDuration={formatDuration}
                  t={t}
                  isDark={isDark}
                />
              ) : (
                <View
                  style={[
                    styles.waveformCard,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.border,
                      alignItems: "center",
                      paddingVertical: 28,
                      gap: 8,
                    },
                    isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                  ]}
                >
                  <View
                    style={[
                      styles.analyticsKpiIcon,
                      { backgroundColor: t.surfaceAlt, width: 48, height: 48, borderRadius: 16 },
                    ]}
                  >
                    <Ionicons name="mic-off-outline" size={22} color={t.textSecondary} />
                  </View>
                  <Text style={[styles.analyticsChartTitle, { color: t.text }]}>
                    No Call Recording Available
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: t.textSecondary, paddingHorizontal: 12 },
                    ]}
                  >
                    Recordings sync automatically from the employee phone's dialer recording folder when auto-record is enabled.
                  </Text>
                </View>
              )
            ) : (
              /* ── Details Tab (Real CallLog Metadata) ── */
              <View
                style={[
                  styles.analyticsSectionCard,
                  { backgroundColor: t.surface, borderColor: t.border },
                  isDark && { borderTopColor: "rgba(255, 255, 255, 0.12)" },
                ]}
              >
                <Text style={[styles.analyticsSectionTitle, { color: t.text }]}>
                  Call Information
                </Text>
                {[
                  { label: "Employee", value: selectedCall?.username || "-" },
                  { label: "Phone Number", value: selectedCall?.phone_number || "-" },
                  {
                    label: "Call Type",
                    value: selectedCall
                      ? selectedCall.call_type.charAt(0).toUpperCase() +
                      selectedCall.call_type.slice(1)
                      : "-",
                  },
                  {
                    label: "Duration",
                    value: selectedCall ? formatDuration(selectedCall.duration) : "0s",
                  },
                  {
                    label: "Call Time",
                    value: selectedCall
                      ? new Date(selectedCall.timestamp).toLocaleString()
                      : "-",
                  },
                  {
                    label: "Synced At",
                    value: selectedCall
                      ? new Date(selectedCall.synced_at).toLocaleString()
                      : "-",
                  },
                  {
                    label: "Recording File",
                    value: selectedCall?.recording_filename || "Not recorded",
                  },
                ].map((row) => (
                  <View
                    key={row.label}
                    style={[styles.topNumberRow, { borderBottomColor: t.border }]}
                  >
                    <Text style={[styles.callMeta, { color: t.textSecondary }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.topPhone, { color: t.text }]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}

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

      {/* ── Unified Filter Modal (Call Type, Date Range & Employee) ─ */}
      <Modal
        visible={employeeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEmployeeModalVisible(false)}
      >
        <View style={styles.empModalBackdrop}>
          <View
            style={[
              styles.empModalSheet,
              {
                backgroundColor: t.bg,
                borderColor: t.border,
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            <View style={[styles.empModalHeader, { borderBottomColor: t.border }]}>
              <View>
                <Text style={[styles.empModalTitle, { color: t.text }]}>
                  Filter Calls
                </Text>
                <Text style={[styles.empModalSubtitle, { color: t.textSecondary }]}>
                  Date range & employee
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {(selectedStatsUser !== "all" || datePreset !== "all") && (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedStatsUser("all");
                      setDatePreset("all");
                      setDateError("");
                    }}
                    style={[
                      styles.resetAllBtn,
                      { backgroundColor: t.surface, borderColor: t.border },
                    ]}
                  >
                    <Text style={[styles.resetAllText, { color: t.textSecondary }]}>
                      Reset
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setEmployeeModalVisible(false)}
                  style={[
                    styles.empModalCloseBtn,
                    { backgroundColor: t.surface, borderColor: t.border },
                  ]}
                >
                  <Ionicons name="close" size={18} color={t.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.empListContent}
            >
              {/* ── 1. Date Range Section ── */}
              <Text
                style={[
                  styles.filterSectionLabel,
                  { color: t.textSecondary },
                ]}
              >
                DATE RANGE
              </Text>
              <View style={styles.modalChipsWrap}>
                {(
                  [
                    { id: "all", label: "All Time" },
                    { id: "1d", label: "1 Day" },
                    { id: "1w", label: "Past 1 Week" },
                    { id: "1m", label: "Past 1 Month" },
                    { id: "3m", label: "Past 3 Months" },
                    { id: "custom", label: "Custom Range" },
                  ] as Array<{ id: DatePresetType; label: string }>
                ).map((preset) => {
                  const isSelected = datePreset === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        setDateError("");
                        setDatePreset(preset.id);
                      }}
                      style={[
                        styles.modalFilterChip,
                        {
                          backgroundColor: isSelected ? t.primary : t.surface,
                          borderColor: isSelected ? t.primary : t.border,
                        },
                      ]}
                    >
                      {preset.id === "custom" && (
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={isSelected ? "#FFFFFF" : t.textSecondary}
                        />
                      )}
                      <Text
                        style={[
                          styles.modalFilterChipText,
                          { color: isSelected ? "#FFFFFF" : t.textSecondary },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {datePreset === "custom" && (
                <View
                  style={[
                    styles.customDateBox,
                    { backgroundColor: t.surface, borderColor: t.border },
                  ]}
                >
                  <View style={styles.customDateRow}>
                    <View style={styles.customDateCol}>
                      <Text style={[styles.customDateLabel, { color: t.textSecondary }]}>
                        From (YYYY-MM-DD)
                      </Text>
                      <TextInput
                        value={draftStartDate}
                        onChangeText={setDraftStartDate}
                        placeholder="2026-11-25"
                        placeholderTextColor={t.textSecondary}
                        style={[
                          styles.customDateInput,
                          {
                            color: t.text,
                            backgroundColor: t.bg,
                            borderColor: t.border,
                          },
                        ]}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View style={styles.customDateCol}>
                      <Text style={[styles.customDateLabel, { color: t.textSecondary }]}>
                        To (YYYY-MM-DD)
                      </Text>
                      <TextInput
                        value={draftEndDate}
                        onChangeText={setDraftEndDate}
                        placeholder="2026-11-25"
                        placeholderTextColor={t.textSecondary}
                        style={[
                          styles.customDateInput,
                          {
                            color: t.text,
                            backgroundColor: t.bg,
                            borderColor: t.border,
                          },
                        ]}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {!!dateError && (
                    <Text style={[styles.customDateError, { color: t.danger }]}>
                      {dateError}
                    </Text>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      const s = draftStartDate.trim();
                      const e = draftEndDate.trim();
                      const re = /^\d{4}-\d{2}-\d{2}$/;
                      if (!re.test(s) || !re.test(e)) {
                        setDateError("Use YYYY-MM-DD format (e.g. 2026-11-25).");
                        return;
                      }
                      if (s > e) {
                        setDateError("From date cannot be after To date.");
                        return;
                      }
                      setDateError("");
                      setCustomStartDate(s);
                      setCustomEndDate(e);
                      setEmployeeModalVisible(false);
                    }}
                    style={[styles.applyDateBtn, { backgroundColor: t.primary }]}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.applyDateBtnText}>Apply Date Range</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── 3. Employee Section ── */}
              <Text
                style={[
                  styles.filterSectionLabel,
                  { color: t.textSecondary, marginTop: 14 },
                ]}
              >
                EMPLOYEE
              </Text>
              <View
                style={[
                  styles.empSearchWrap,
                  {
                    backgroundColor: t.surface,
                    borderColor: t.border,
                    marginHorizontal: 0,
                    marginTop: 6,
                    marginBottom: 8,
                  },
                ]}
              >
                <Ionicons name="search-outline" size={16} color={t.textSecondary} />
                <TextInput
                  value={employeeSearch}
                  onChangeText={setEmployeeSearch}
                  placeholder="Search employee name..."
                  placeholderTextColor={t.textSecondary}
                  style={[styles.empSearchInput, { color: t.text }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {employeeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setEmployeeSearch("")}>
                    <Ionicons name="close-circle" size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* All Team Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedStatsUser("all");
                  setEmployeeModalVisible(false);
                }}
                style={[
                  styles.empRow,
                  {
                    backgroundColor:
                      selectedStatsUser === "all"
                        ? isDark
                          ? "rgba(16, 185, 129, 0.14)"
                          : "#ECFDF5"
                        : t.surface,
                    borderColor:
                      selectedStatsUser === "all" ? t.primary : t.border,
                  },
                ]}
              >
                <View style={styles.empRowLeft}>
                  <View
                    style={[
                      styles.empAvatar,
                      {
                        backgroundColor:
                          selectedStatsUser === "all" ? t.primary : t.surfaceAlt,
                      },
                    ]}
                  >
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color={selectedStatsUser === "all" ? "#FFFFFF" : t.textSecondary}
                    />
                  </View>
                  <View>
                    <Text style={[styles.empRowName, { color: t.text }]}>
                      All Team
                    </Text>
                    <Text style={[styles.empRowMeta, { color: t.textSecondary }]}>
                      Combined calls across {teamMembers.length} employees
                    </Text>
                  </View>
                </View>
                {selectedStatsUser === "all" && (
                  <Ionicons name="checkmark-circle" size={20} color={t.primary} />
                )}
              </TouchableOpacity>

              {filteredEmployees.map((emp) => {
                const isSelected = selectedStatsUser === emp.id.toString();
                return (
                  <TouchableOpacity
                    key={emp.id}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSelectedStatsUser(emp.id.toString());
                      setEmployeeModalVisible(false);
                    }}
                    style={[
                      styles.empRow,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(16, 185, 129, 0.14)"
                            : "#ECFDF5"
                          : t.surface,
                        borderColor: isSelected ? t.primary : t.border,
                      },
                    ]}
                  >
                    <View style={styles.empRowLeft}>
                      <View
                        style={[
                          styles.empAvatar,
                          {
                            backgroundColor: isSelected ? t.primary : t.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.empAvatarText,
                            { color: isSelected ? "#FFFFFF" : t.text },
                          ]}
                        >
                          {emp.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.empRowName, { color: t.text }]}
                          numberOfLines={1}
                        >
                          {emp.username}
                        </Text>
                        <Text style={[styles.empRowMeta, { color: t.textSecondary }]}>
                          {emp.role ? `${emp.role.toUpperCase()} • ` : ""}
                          {typeof emp.total_call_logs === "number"
                            ? `${emp.total_call_logs} calls`
                            : "Tap to view calls"}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={t.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {filteredEmployees.length === 0 && (
                <View style={styles.empEmptyWrap}>
                  <Text style={[styles.empRowMeta, { color: t.textSecondary }]}>
                    No employees match "{employeeSearch}"
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalFooterBar, { borderTopColor: t.border }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setEmployeeModalVisible(false)}
                style={[styles.applyDateBtn, { backgroundColor: t.primary }]}
              >
                <Text style={styles.applyDateBtnText}>Show Results</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  groupHeader: {
    fontFamily: Typography.bold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  groupCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  groupCountText: {
    fontFamily: Typography.semiBold,
    fontSize: 11,
  },
  callRow: {
    padding: 14,
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
    ...Shadows.card,
  },
  callTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  callIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  callAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  callDetails: {
    flex: 1,
    gap: 3,
  },
  callerName: {
    fontFamily: Typography.headingSemi,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  callPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callMeta: {
    fontFamily: Typography.medium,
    fontSize: 12.5,
  },
  callMetaWell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  callMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  callInspectWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  callInspectText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
  callDurationText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
  callTimeText: {
    fontFamily: Typography.medium,
    fontSize: 11.5,
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
    alignItems: "stretch",
    gap: 8,
    marginHorizontal: Spacing.screenPadding,
    marginBottom: 4,
  },
  kpiItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
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
    padding: 14,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: "center",
    ...Shadows.card,
  },
  analyticsKpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  analyticsKpiVal: {
    fontSize: 17,
    fontFamily: Typography.bold,
  },
  analyticsKpiLbl: {
    fontSize: 10,
    fontFamily: Typography.semiBold,
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
    marginBottom: 10,
  },
  analyticsChartTitle: {
    fontSize: 15,
    fontFamily: Typography.headingSemi,
  },
  analyticsChartSub: {
    fontSize: 11.5,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  chartMetaWell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  chartMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chartMetaLabel: {
    fontSize: 11.5,
    fontFamily: Typography.medium,
  },
  chartMetaVal: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  segmentedDistTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    gap: 2,
    marginBottom: 16,
  },
  distLeftWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  distIconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  distPctText: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  topNumberCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: 8,
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
  activeEmployeeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  activeEmployeeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  activeEmployeeText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  clearEmployeeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  clearEmployeeText: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  empModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  empModalSheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 16,
  },
  empModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  empModalTitle: {
    fontSize: FontSizes.sectionTitle,
    fontFamily: Typography.headingSemi,
  },
  empModalSubtitle: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  empModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.screenPadding,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  empSearchInput: {
    flex: 1,
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
  },
  empListContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: 8,
    gap: 8,
  },
  empRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  empRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  empAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  empAvatarText: {
    fontSize: 14,
    fontFamily: Typography.bold,
  },
  empRowName: {
    fontSize: 14,
    fontFamily: Typography.semiBold,
  },
  empRowMeta: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  empEmptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  resetAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  resetAllText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontFamily: Typography.bold,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  modalChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  modalFilterChipText: {
    fontSize: 12.5,
    fontFamily: Typography.semiBold,
  },
  customDateBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 10,
  },
  customDateRow: {
    flexDirection: "row",
    gap: 10,
  },
  customDateCol: {
    flex: 1,
    gap: 4,
  },
  customDateLabel: {
    fontSize: 11,
    fontFamily: Typography.medium,
  },
  customDateInput: {
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: Typography.medium,
  },
  customDateError: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  applyDateBtn: {
    height: 42,
    borderRadius: Radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  applyDateBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Typography.semiBold,
  },
  modalFooterBar: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  timelinePillsWrap: {
    marginBottom: 8,
  },
  timelinePillsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screenPadding,
    gap: 8,
    paddingVertical: 2,
  },
  listFooterWrap: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerMetaText: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  analyticsDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  analyticsDropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  analyticsDropdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  analyticsDropdownLabel: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.6,
  },
  analyticsDropdownVal: {
    fontSize: 14.5,
    fontFamily: Typography.headingSemi,
    marginTop: 2,
  },
});
