import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { triggerSelectionHaptic } from "@/utils/haptics";

export interface DayData {
  date: string;
  day: string;
  interactions: number;
  followups: number;
}

export interface WeeklyActivityChartProps {
  activity: DayData[];
  loading: boolean;
  unavailable: boolean;
}

interface DayBarColumnProps {
  item: DayData;
  isSelected: boolean;
  maxVal: number;
  index: number;
  isDark: boolean;
  onSelect: (date: string) => void;
}

const DayBarColumn: React.FC<DayBarColumnProps> = React.memo(
  ({ item, isSelected, maxVal, index, isDark, onSelect }) => {
    const scaleAnim = useRef(new Animated.Value(isSelected ? 1.08 : 1.0)).current;
    const heightAnim = useRef(new Animated.Value(0)).current;

    // Staggered height growth on mount
    useEffect(() => {
      const timer = setTimeout(() => {
        Animated.spring(heightAnim, {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: false,
        }).start();
      }, index * 50);
      return () => clearTimeout(timer);
    }, [index, heightAnim]);

    // Spring scale bounce when selected state changes
    useEffect(() => {
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.08 : 1.0,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }, [isSelected, scaleAnim]);

    const targetHeight = Math.max((item.interactions / maxVal) * 72, 6);
    const animatedHeight = heightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [4, targetHeight],
    });

    const handlePress = () => {
      triggerSelectionHaptic();
      onSelect(item.date);
    };

    return (
      <Pressable
        style={styles.colContainer}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${item.day}: ${item.interactions} interactions`}
      >
        <Animated.View
          style={[
            styles.barTrack,
            {
              backgroundColor: isDark ? "#161B26" : "#F8FAFC",
              borderColor: isSelected
                ? isDark ? "rgba(16, 185, 129, 0.4)" : "rgba(0, 168, 121, 0.3)"
                : "transparent",
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.barFill,
              {
                height: animatedHeight,
                backgroundColor: isSelected
                  ? "#10B981"
                  : isDark ? "#1E2536" : "#CBD5E1",
              },
            ]}
          />
        </Animated.View>
        <Text
          style={[
            styles.dayLabel,
            {
              color: isSelected
                ? isDark ? "#10B981" : "#00A879"
                : isDark ? "#64748B" : "#87928D",
              fontFamily: isSelected ? Typography.bold : Typography.medium,
            },
          ]}
        >
          {item.day}
        </Text>
      </Pressable>
    );
  }
);

export const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({
  activity,
  loading,
  unavailable,
}) => {
  const { isDark } = useTheme();

  const weekData = useMemo(
    () =>
      activity.map((item) => ({
        ...item,
        interactions: Number(item.interactions) || 0,
        followups: Number(item.followups) || 0,
      })),
    [activity]
  );

  const [selectedDate, setSelectedDate] = useState<string>("");

  // Default to today or the latest recorded day in weekData
  useEffect(() => {
    if (weekData.length > 0 && !selectedDate) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const foundToday = weekData.find((d) => d.date === todayStr);
      setSelectedDate(foundToday ? foundToday.date : weekData[weekData.length - 1].date);
    }
  }, [weekData, selectedDate]);

  const selectedDay =
    weekData.find((item) => item.date === selectedDate) ||
    weekData[weekData.length - 1];

  const maxVal = Math.max(1, ...weekData.map((item) => item.interactions));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#12151E" : "#FFFFFF",
          borderColor: isDark ? "rgba(255, 255, 255, 0.07)" : "#D8E0DC",
        },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.title, { color: isDark ? "#F8FAFC" : "#101513" }]}>
            Weekly Customer Activity
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "#94A3B8" : "#5E6964" }]}>
            Touchpoints & follow-ups across 7 days
          </Text>
        </View>

        {selectedDay && !loading && !unavailable ? (
          <View
            style={[
              styles.tooltipBadge,
              {
                backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#E6F7F0",
                borderColor: isDark
                  ? "rgba(16, 185, 129, 0.35)"
                  : "rgba(0, 168, 121, 0.25)",
              },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={11}
              color={isDark ? "#34D399" : "#00A879"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.tooltipText,
                { color: isDark ? "#34D399" : "#00A879" },
              ]}
              numberOfLines={1}
            >
              {selectedDay.day}: {selectedDay.interactions} acts • {selectedDay.followups} follow-ups
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <SkeletonBlock height={116} borderRadius={14} style={{ marginVertical: 4 }} />
      ) : unavailable ? (
        <View style={styles.state}>
          <Text
            style={[
              styles.stateText,
              { color: isDark ? "#94A3B8" : "#5E6964" },
            ]}
          >
            Activity not fetched. Refresh to try again.
          </Text>
        </View>
      ) : weekData.length === 0 ||
        weekData.every(
          (item) => item.interactions === 0 && item.followups === 0
        ) ? (
        <View style={styles.state}>
          <Text
            style={[
              styles.stateText,
              { color: isDark ? "#94A3B8" : "#5E6964" },
            ]}
          >
            No customer activity recorded for these seven days.
          </Text>
        </View>
      ) : (
        <View style={styles.chartArea}>
          {weekData.map((item, idx) => {
            const isSelected = selectedDay?.date === item.date;
            return (
              <DayBarColumn
                key={item.date}
                item={item}
                isSelected={isSelected}
                maxVal={maxVal}
                index={idx}
                isDark={isDark}
                onSelect={setSelectedDate}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: FontSizes.body,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  tooltipBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    maxWidth: "54%",
  },
  tooltipText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 98,
    paddingTop: 8,
  },
  colContainer: {
    alignItems: "center",
    flex: 1,
  },
  barTrack: {
    height: 72,
    width: 22,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
  },
  barFill: {
    width: 14,
    borderRadius: 5,
  },
  dayLabel: {
    fontSize: FontSizes.micro,
    marginTop: 6,
  },
  state: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    textAlign: "center",
  },
});
