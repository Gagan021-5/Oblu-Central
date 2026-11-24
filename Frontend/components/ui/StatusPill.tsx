import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes, Radius } from "@/constants/theme";
import { employeeTheme } from "@/constants/employeeTheme";

export type PillVariant =
  | "paid"
  | "pending"
  | "overdue"
  | "no_payment"
  | "high_intent"
  | "medium_intent"
  | "low_intent"
  | "stage_new"
  | "stage_contacted"
  | "stage_qualified"
  | "stage_proposal"
  | "stage_won"
  | "neutral";

interface StatusPillProps {
  label: string;
  variant?: PillVariant;
  size?: "small" | "medium";
  showDot?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  variant = "neutral",
  size = "medium",
  showDot = true,
}) => {
  const { isDark } = useTheme();
  const t = isDark ? employeeTheme.dark : employeeTheme.light;

  const isPulsing = useMemo(() => {
    const normVariant = (variant || "").toLowerCase();
    const normLabel = (label || "").toLowerCase();
    return (
      normVariant === "overdue" ||
      normVariant === "pending" ||
      normVariant === "high_intent" ||
      normLabel.includes("hot") ||
      normLabel.includes("overdue") ||
      normLabel.includes("pending") ||
      normLabel.includes("live") ||
      normLabel.includes("in progress") ||
      normLabel.includes("high")
    );
  }, [variant, label]);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isPulsing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isPulsing, pulseAnim]);

  const dotOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });

  const haloScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });

  const haloOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.18],
  });

  const getStyleForVariant = () => {
    switch (variant) {
      case "paid":
      case "stage_won":
        return {
          bg: isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(0, 168, 121, 0.12)",
          text: isDark ? "#34D399" : "#00A879",
          border: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(0, 168, 121, 0.22)",
          dot: isDark ? "#10B981" : "#00A879",
        };
      case "high_intent":
        return {
          bg: isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(0, 168, 121, 0.14)",
          text: isDark ? "#34D399" : "#00A879",
          border: isDark ? "rgba(16, 185, 129, 0.32)" : "rgba(0, 168, 121, 0.25)",
          dot: isDark ? "#10B981" : "#00A879",
        };
      case "pending":
      case "medium_intent":
      case "stage_proposal":
        return {
          bg: isDark ? "rgba(242, 184, 75, 0.14)" : "rgba(245, 158, 11, 0.12)",
          text: isDark ? "#FBBF24" : "#D97706",
          border: isDark ? "rgba(242, 184, 75, 0.28)" : "rgba(245, 158, 11, 0.25)",
          dot: isDark ? "#FBBF24" : "#D97706",
        };
      case "overdue":
        return {
          bg: isDark ? "rgba(255, 107, 107, 0.14)" : "rgba(224, 82, 96, 0.12)",
          text: isDark ? "#FF6B6B" : "#DC2626",
          border: isDark ? "rgba(255, 107, 107, 0.32)" : "rgba(224, 82, 96, 0.28)",
          dot: isDark ? "#FF6B6B" : "#DC2626",
        };
      case "low_intent":
      case "no_payment":
      case "stage_new":
      case "neutral":
      default:
        return {
          bg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(16, 21, 19, 0.05)",
          text: isDark ? "#94A3B8" : "#5E6964",
          border: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(16, 21, 19, 0.10)",
          dot: isDark ? "#64748B" : "#8FA09A",
        };
    }
  };

  const current = getStyleForVariant();
  const isSmall = size === "small";

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
          paddingHorizontal: isSmall ? 8 : 10,
          paddingVertical: isSmall ? 3 : 4.5,
        },
      ]}
    >
      {showDot && (
        <View style={styles.dotWrapper}>
          {isPulsing && (
            <Animated.View
              style={[
                styles.dotHalo,
                {
                  backgroundColor: current.dot,
                  opacity: haloOpacity,
                  transform: [{ scale: haloScale }],
                },
              ]}
            />
          )}
          <Animated.View
            style={[
              styles.dot,
              {
                backgroundColor: current.dot,
                opacity: isPulsing ? dotOpacity : 1,
              },
            ]}
          />
        </View>
      )}
      <Text
        style={[
          styles.text,
          {
            color: current.text,
            fontSize: isSmall ? 11 : 12,
            fontFamily: Typography.medium,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
    justifyContent: "center",
    alignItems: "center",
    gap: 5.5,
  },
  dotWrapper: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotHalo: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    fontFamily: Typography.medium,
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },
});
