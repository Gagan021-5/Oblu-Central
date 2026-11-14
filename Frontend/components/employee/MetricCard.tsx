import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { MetricBadge3D } from "@/components/employee/SubAppLogo";
import { triggerLightHaptic } from "@/utils/haptics";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  subtitle?: string; // alias for compatibility
  icon?: keyof typeof Ionicons.glyphMap;
  isHighlight?: boolean;
  isLive?: boolean;
  liveDot?: boolean; // alias for compatibility
  loading?: boolean;
  onPress?: () => void;
  index?: number;
  trendBadge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = React.memo(({
  label,
  value,
  subValue,
  subtitle,
  icon,
  isHighlight = false,
  isLive = false,
  liveDot = false,
  loading = false,
  onPress,
  index = 0,
  trendBadge,
}) => {
  const { isDark } = useTheme();

  const finalSubValue = subValue ?? subtitle ?? "";
  const isLiveEffective = Boolean(isLive || liveDot || finalSubValue.includes("Live"));

  // Spring press physics
  const pressScale = useRef(new Animated.Value(1)).current;
  const chevronShift = useRef(new Animated.Value(0)).current;

  // Staggered entrance physics
  const entranceAnim = useRef(new Animated.Value(0)).current;

  // Dual-layer pulsing halo loop
  const haloAnim = useRef(new Animated.Value(0)).current;

  // Loading skeleton shimmer
  const shimmerOpacity = useRef(new Animated.Value(0.35)).current;

  // Count-up display value
  const [displayValue, setDisplayValue] = useState<string | number>(value);

  // Staggered entrance animation on mount
  useEffect(() => {
    const delay = (index ?? 0) * 70;
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 380,
      delay,
      useNativeDriver: true,
    }).start();
  }, [index, entranceAnim]);

  // Dual-layer pulse halo animation loop
  useEffect(() => {
    if (!isLiveEffective) return;
    const loop = Animated.loop(
      Animated.timing(haloAnim, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isLiveEffective, haloAnim]);

  // Loading skeleton shimmer loop
  useEffect(() => {
    if (!loading) {
      shimmerOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.85,
          duration: 720,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.32,
          duration: 720,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading, shimmerOpacity]);

  // Numeric count-up animation over 650ms
  useEffect(() => {
    if (loading) {
      setDisplayValue(value);
      return;
    }

    const valStr = String(value).trim();
    // Parse optional prefix (e.g. ₹), number sequence with commas/decimals, and suffix (e.g. %, +)
    const match = valStr.match(/^([^0-9.-]*)([0-9,.]+)([^0-9.-]*)$/);

    if (!match) {
      setDisplayValue(value);
      return;
    }

    const prefix = match[1] || "";
    const numPart = match[2];
    const suffix = match[3] || "";
    const cleanNum = parseFloat(numPart.replace(/,/g, ""));

    if (isNaN(cleanNum)) {
      setDisplayValue(value);
      return;
    }

    const hasCommas = numPart.includes(",");
    const isInteger = !numPart.includes(".");
    const duration = 650;
    const startTime = Date.now();
    let frameId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic: 1 - (1 - progress)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = isInteger
        ? Math.round(eased * cleanNum)
        : +(eased * cleanNum).toFixed(1);

      let formattedNum = String(current);
      if (hasCommas) {
        formattedNum = current.toLocaleString("en-IN");
      }

      setDisplayValue(`${prefix}${formattedNum}${suffix}`);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(value);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, loading]);

  const shimmerBg = isDark ? "#1C2E27" : "#E5EDE8";

  const handlePressIn = () => {
    if (!onPress) return;
    triggerLightHaptic();
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 0.96,
        friction: 6,
        tension: 300,
        useNativeDriver: true,
      }),
      Animated.spring(chevronShift, {
        toValue: 2,
        friction: 6,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
      Animated.spring(chevronShift, {
        toValue: 0,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
    ]).start();
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
          opacity: entranceAnim,
          transform: [
            { scale: pressScale },
            {
              translateY: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.labelBadge}>
          {isLiveEffective && (
            <View style={styles.liveHaloContainer}>
              <Animated.View
                style={[
                  styles.liveHaloPulse,
                  {
                    backgroundColor: isDark ? "#35D6A0" : "#00A879",
                    transform: [
                      {
                        scale: haloAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2.2],
                        }),
                      },
                    ],
                    opacity: haloAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 0],
                    }),
                  },
                ]}
              />
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: isDark ? "#35D6A0" : "#00A879" },
                ]}
              />
            </View>
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {trendBadge && (
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor: isHighlight
                    ? isDark ? "rgba(53, 214, 160, 0.16)" : "rgba(0, 168, 121, 0.12)"
                    : isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(13, 43, 32, 0.06)",
                  borderColor: isHighlight
                    ? isDark ? "rgba(53, 214, 160, 0.30)" : "rgba(0, 168, 121, 0.22)"
                    : isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(13, 43, 32, 0.08)",
                },
              ]}
            >
              <Text
                style={[
                  styles.trendBadgeText,
                  {
                    color: isHighlight
                      ? isDark ? "#35D6A0" : "#00A879"
                      : isDark ? "#8FA09A" : "#5E6964",
                  },
                ]}
              >
                {trendBadge}
              </Text>
            </View>
          )}
          {icon && (
            <MetricBadge3D
              icon={String(icon)}
              label={label}
              size={32}
              borderRadius={10}
              isHighlight={isHighlight}
            />
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.skeletonGroup}>
          <Animated.View
            style={[styles.skeletonValue, { backgroundColor: shimmerBg, opacity: shimmerOpacity }]}
          />
          <Animated.View
            style={[styles.skeletonSub, { backgroundColor: shimmerBg, opacity: shimmerOpacity }]}
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
            adjustsFontSizeToFit
          >
            {displayValue}
          </Text>

          {(finalSubValue || onPress) && (
            <View style={styles.subRow}>
              <Text
                style={[
                  styles.subText,
                  { color: isDark ? "#8FA09A" : "#5E6964" },
                ]}
                numberOfLines={1}
              >
                {finalSubValue}
              </Text>
              {onPress && (
                <Animated.View
                  style={[
                    styles.chevronPill,
                    {
                      backgroundColor: isHighlight
                        ? isDark ? "rgba(53, 214, 160, 0.16)" : "rgba(0, 168, 121, 0.12)"
                        : isDark ? "#1C3028" : "#F4F7F5",
                      borderColor: isHighlight
                        ? isDark ? "rgba(53, 214, 160, 0.30)" : "rgba(0, 168, 121, 0.24)"
                        : isDark ? "#294039" : "#E4ECE8",
                      transform: [{ translateX: chevronShift }],
                    },
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color={
                      isHighlight
                        ? isDark ? "#35D6A0" : "#00A879"
                        : isDark ? "#8FA09A" : "#5E6964"
                    }
                  />
                </Animated.View>
              )}
            </View>
          )}

          {/* Subtle bottom accent progress bar */}
          <View
            style={[
              styles.bottomAccentTrack,
              {
                backgroundColor: isHighlight
                  ? isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(0, 168, 121, 0.14)"
                  : isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(13, 43, 32, 0.04)",
              },
            ]}
          >
            <View
              style={[
                styles.bottomAccentFill,
                {
                  backgroundColor: isHighlight
                    ? isDark ? "#35D6A0" : "#00A879"
                    : isDark ? "rgba(53, 214, 160, 0.35)" : "rgba(0, 168, 121, 0.28)",
                  width: isHighlight ? "70%" : "35%",
                },
              ]}
            />
          </View>
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
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
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
    minWidth: 0,
  },
  liveHaloContainer: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  liveHaloPulse: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelText: {
    flexShrink: 1,
    fontSize: 9.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  trendBadgeText: {
    fontSize: 9,
    fontFamily: Typography.bold,
    letterSpacing: 0.2,
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
  chevronPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomAccentTrack: {
    height: 2.5,
    borderRadius: 1.5,
    overflow: "hidden",
    marginTop: 8,
    width: "100%",
  },
  bottomAccentFill: {
    height: "100%",
    borderRadius: 1.5,
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
