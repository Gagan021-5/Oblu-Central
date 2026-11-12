import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";

interface DayData {
  date: string;
  day: string;
  interactions: number;
  followups: number;
}

interface WeeklyActivityChartProps {
  activity: DayData[];
  loading: boolean;
  unavailable: boolean;
}

export const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({ activity, loading, unavailable }) => {
  const { isDark } = useTheme();
  const weekData = useMemo(() => activity.map((item) => ({
    ...item,
    interactions: Number(item.interactions) || 0,
    followups: Number(item.followups) || 0,
  })), [activity]);
  const [selectedDate, setSelectedDate] = useState("");
  const selectedDay = weekData.find((item) => item.date === selectedDate) || weekData[weekData.length - 1];
  const maxVal = Math.max(1, ...weekData.map((item) => item.interactions));

  return (
    <View style={[styles.container, {
      backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
      borderColor: isDark ? "#294039" : "#D8E0DC",
    }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.title, { color: isDark ? "#F1F7F4" : "#101513" }]}>Weekly Customer Activity</Text>
          <Text style={[styles.subtitle, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Touchpoints & follow-ups across 7 days</Text>
        </View>
        {selectedDay && !loading && !unavailable ? <View style={[styles.tooltipBadge, {
          backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#DDF4EA",
          borderColor: isDark ? "rgba(53, 214, 160, 0.28)" : "rgba(0, 168, 121, 0.25)",
        }]}>
          <Text style={[styles.tooltipText, { color: isDark ? "#35D6A0" : "#00A879" }]} numberOfLines={1}>
            {selectedDay.day}: {selectedDay.interactions} acts Â· {selectedDay.followups} follow-ups
          </Text>
        </View> : null}
      </View>

      {loading ? <SkeletonBlock height={116} borderRadius={14} style={{ marginVertical: 4 }} />
        : unavailable ? <View style={styles.state}><Text style={[styles.stateText, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Activity not fetched. Refresh to try again.</Text></View>
          : weekData.length === 0 || weekData.every((item) => item.interactions === 0 && item.followups === 0)
            ? <View style={styles.state}><Text style={[styles.stateText, { color: isDark ? "#8FA09A" : "#5E6964" }]}>No customer activity recorded for these seven days.</Text></View>
            : <View style={styles.chartArea}>
              {weekData.map((item) => {
                const isSelected = selectedDay?.date === item.date;
                const barHeightPct = (item.interactions / maxVal) * 72;
                return <TouchableOpacity key={item.date} style={styles.colContainer} onPress={() => setSelectedDate(item.date)} activeOpacity={0.7}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      height: Math.max(barHeightPct, 4),
                      backgroundColor: isSelected ? (isDark ? "#B7F34A" : "#101513") : (isDark ? "#35D6A0" : "#00A879"),
                    }]} />
                  </View>
                  <Text style={[styles.dayLabel, {
                    color: isSelected ? (isDark ? "#B7F34A" : "#00A879") : (isDark ? "#65756F" : "#87928D"),
                    fontFamily: isSelected ? Typography.semiBold : Typography.regular,
                  }]}>{item.day}</Text>
                </TouchableOpacity>;
              })}
            </View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: FontSizes.body, fontFamily: Typography.semiBold },
  subtitle: { fontSize: FontSizes.caption, fontFamily: Typography.regular, marginTop: 2 },
  tooltipBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, maxWidth: "52%" },
  tooltipText: { fontSize: FontSizes.micro, fontFamily: Typography.semiBold },
  chartArea: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 90, paddingTop: 8 },
  colContainer: { alignItems: "center", flex: 1 },
  barTrack: { height: 72, width: 20, justifyContent: "flex-end", alignItems: "center" },
  barFill: { width: 12, borderRadius: 6 },
  dayLabel: { fontFamily: Typography.medium, fontSize: FontSizes.micro, marginTop: 6 },
  state: { minHeight: 90, alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { fontFamily: Typography.regular, fontSize: FontSizes.caption, textAlign: "center" },
});
