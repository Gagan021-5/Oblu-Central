import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { triggerLightHaptic } from "@/utils/haptics";

export interface TimelineItemProps {
  time?: string;
  title: string;
  subtitle?: string;
  tag?: string;
  isLast?: boolean;
  type?: "call" | "followup" | "payment" | "demo" | "note";
  onPress?: () => void;
}

const TimelineItemComponent: React.FC<TimelineItemProps> = ({
  time,
  title,
  subtitle,
  tag,
  isLast = false,
  type = "followup",
  onPress,
}) => {
  const { isDark } = useTheme();
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    triggerLightHaptic();
    Animated.spring(pressScale, {
      toValue: 0.98,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 5,
      tension: 280,
      useNativeDriver: true,
    }).start();
  };

  const getIconInfo = () => {
    switch (type) {
      case "call":
        return {
          name: "call-outline" as const,
          color: isDark ? "#10B981" : "#00A879",
          bg: isDark ? "rgba(16, 185, 129, 0.12)" : "#DDF4EA",
          tagBg: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(0, 168, 121, 0.08)",
          tagColor: isDark ? "#34D399" : "#00A879",
        };
      case "payment":
        return {
          name: "card-outline" as const,
          color: isDark ? "#FBBF24" : "#D97706",
          bg: isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(245, 158, 11, 0.10)",
          tagBg: isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(217, 119, 6, 0.08)",
          tagColor: isDark ? "#FCD34D" : "#B45309",
        };
      case "demo":
        return {
          name: "videocam-outline" as const,
          color: isDark ? "#60A5FA" : "#2563EB",
          bg: isDark ? "rgba(59, 130, 246, 0.14)" : "rgba(59, 130, 246, 0.10)",
          tagBg: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.08)",
          tagColor: isDark ? "#93C5FD" : "#1D4ED8",
        };
      case "note":
        return {
          name: "document-text-outline" as const,
          color: isDark ? "#94A3B8" : "#64748B",
          bg: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
          tagBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
          tagColor: isDark ? "#94A3B8" : "#64748B",
        };
      case "followup":
      default:
        return {
          name: "calendar-outline" as const,
          color: isDark ? "#10B981" : "#00A879",
          bg: isDark ? "rgba(16, 185, 129, 0.12)" : "#DDF4EA",
          tagBg: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(0, 168, 121, 0.08)",
          tagColor: isDark ? "#34D399" : "#00A879",
        };
    }
  };

  const icon = getIconInfo();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "none"}
      style={styles.pressableWrapper}
    >
      <Animated.View
        style={[
          styles.container,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        {/* Left indicator with connecting vertical timeline line */}
        <View style={styles.leftColumn}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: icon.bg,
                borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <Ionicons name={icon.name} size={14} color={icon.color} />
          </View>
          {!isLast && (
            <View
              style={[
                styles.verticalLine,
                { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E4ECE8" },
              ]}
            />
          )}
        </View>

        {/* Right Content */}
        <View style={styles.contentColumn}>
          <View style={styles.headerRow}>
            <Text
              style={[
                styles.title,
                { color: isDark ? "#F8FAFC" : "#101513" },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <View style={styles.rightCluster}>
              {time && (
                <Text
                  style={[
                    styles.timeText,
                    { color: isDark ? "#94A3B8" : "#5E6964" },
                  ]}
                >
                  {time}
                </Text>
              )}
              {Boolean(onPress) && (
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={isDark ? "#64748B" : "#94A3B8"}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>

          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                { color: isDark ? "#94A3B8" : "#5E6964" },
              ]}
            >
              {subtitle}
            </Text>
          )}

          {tag && (
            <View
              style={[
                styles.tagBadge,
                {
                  backgroundColor: icon.tagBg,
                  borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "transparent",
                  borderWidth: isDark ? 1 : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: icon.tagColor },
                ]}
              >
                {tag}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
};

export const TimelineItem = React.memo(TimelineItemComponent);

const styles = StyleSheet.create({
  pressableWrapper: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    marginBottom: 4,
  },
  leftColumn: {
    alignItems: "center",
    width: 32,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  verticalLine: {
    width: 1.5,
    flex: 1,
    marginVertical: 4,
  },
  contentColumn: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.semiBold,
    flex: 1,
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  timeText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
  },
  subtitle: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    marginTop: 2,
    lineHeight: 16,
  },
  tagBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  tagText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.medium,
  },
});
