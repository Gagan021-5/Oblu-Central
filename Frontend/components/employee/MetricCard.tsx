import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { MetricBadge3D } from "@/components/employee/SubAppLogo";
import { triggerLightHaptic } from "@/utils/haptics";

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isHighlight?: boolean;
  isLive?: boolean;
  loading?: boolean;
  onPress?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = React.memo(({
  label,
  value,
  subValue,
  icon,
  isHighlight = false,
  isLive = false,
  loading = false,
  onPress,
}) => {
  const { isDark } = useTheme();
  const pressScale = useSharedValue(1);
  const shimmerOpacity = useSharedValue(0.35);

  useEffect(() => {
    if (!loading) {
      shimmerOpacity.value = 1;
      return;
    }
    shimmerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 720 }),
        withTiming(0.32, { duration: 720 })
      ),
      -1,
      false
    );
  }, [loading, shimmerOpacity]);

  const cardMotionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const shimmerBarStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  const shimmerBg = isDark ? "#1C2E27" : "#E5EDE8";

  const handlePressIn = () => {
    if (!onPress) return;
    triggerLightHaptic();
    pressScale.value = withSpring(0.96, { damping: 16, stiffness: 320 });
  };

  const handlePressOut = () => {
    if (!onPress) return;
    pressScale.value = withSpring(1, { damping: 14, stiffness: 280 });
  };

  const cardBody = (
    <Animated.View
      style={[
        styles.outwardCard,
        {
          backgroundColor: isDark ? "#15251F" : "#FFFFFF",
          borderColor: isHighlight
            ? isDark ? "rgba(53, 214, 160, 0.42)" : "rgba(0, 168, 121, 0.35)"
            : isDark ? "rgba(53, 214, 160, 0.22)" : "rgba(13, 43, 32, 0.08)",
          borderTopColor: isHighlight
            ? isDark ? "rgba(53, 214, 160, 0.65)" : "rgba(0, 168, 121, 0.50)"
            : isDark ? "rgba(53, 214, 160, 0.38)" : "rgba(255, 255, 255, 0.98)",
          borderBottomColor: isDark ? "#0C1612" : "rgba(13, 43, 32, 0.14)",
          shadowColor: isHighlight
            ? isDark ? "#35D6A0" : "#00A879"
            : isDark ? "#000000" : "#0D2B20",
          shadowOpacity: isHighlight ? (isDark ? 0.30 : 0.15) : (isDark ? 0.36 : 0.09),
        },
        cardMotionStyle,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.labelBadge}>
          {isLive && (
            <View
              style={[
                styles.liveDot,
                { backgroundColor: isDark ? "#35D6A0" : "#00A879" },
              ]}
            />
          )}
          <Text
            style={[
              styles.labelText,
              {
                color: isHighlight
                  ? isDark ? "#35D6A0" : "#00A879"
                  : isDark ? "#8FA09A" : "#5E6964",
              },
            ]}
            numberOfLines={1}
          >
            {label.toUpperCase()}
          </Text>
        </View>
        {icon && <MetricBadge3D icon={String(icon)} label={label} size={36} borderRadius={11} isHighlight={isHighlight} />}
      </View>

      {loading ? (
        <View style={styles.skeletonGroup}>
          <Animated.View
            style={[styles.skeletonValue, { backgroundColor: shimmerBg }, shimmerBarStyle]}
          />
          <Animated.View
            style={[styles.skeletonSub, { backgroundColor: shimmerBg }, shimmerBarStyle]}
          />
        </View>
      ) : (
        <>
          <Text
            style={[
              styles.valueText,
              {
                color: isHighlight
                  ? isDark ? "#35D6A0" : "#00A879"
                  : isDark ? "#F1F7F4" : "#101513",
              },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>

          {(subValue || onPress) && (
            <View style={styles.subRow}>
              <Text
                style={[
                  styles.subText,
                  { color: isDark ? "#8FA09A" : "#5E6964" },
                ]}
                numberOfLines={1}
              >
                {subValue || ""}
              </Text>
              {onPress && (
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isHighlight ? (isDark ? "#35D6A0" : "#00A879") : isDark ? "#6B7C75" : "#9BA8A2"}
                />
              )}
            </View>
          )}
        </>
      )}
    </Animated.View>
  );

  if (!onPress) {
    return cardBody;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressableSlot}
      accessibilityRole="button"
    >
      {cardBody}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressableSlot: {
    flex: 1,
  },
  outwardCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
    zIndex: 2,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginRight: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
  },
  valueText: {
    fontSize: 26,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    gap: 4,
  },
  subText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  skeletonGroup: {
    paddingTop: 6,
    gap: 10,
  },
  skeletonValue: {
    height: 26,
    width: "52%",
    borderRadius: 8,
  },
  skeletonSub: {
    height: 12,
    width: "74%",
    borderRadius: 6,
  },
});
