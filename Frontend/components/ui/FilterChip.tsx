import React, { useEffect, useRef } from "react";
import { Text, View, StyleSheet, Pressable, Animated } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { hapticSelection } from "@/utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FilterChipProps {
  label: string;
  count?: number;
  isActive: boolean;
  onPress: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  count,
  isActive,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const prevActiveRef = useRef(isActive);

  useEffect(() => {
    if (!prevActiveRef.current && isActive) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.05, friction: 5, tension: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1.0, friction: 6, tension: 280, useNativeDriver: true }),
      ]).start();
    }
    prevActiveRef.current = isActive;
  }, [isActive, scale]);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.93, friction: 5, tension: 300, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1.0, friction: 6, tension: 280, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    hapticSelection();
    onPress();
  };

  const animatedStyle = {
    transform: [{ scale }],
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        styles.chip,
        {
          backgroundColor: isActive
            ? isDark
              ? "rgba(53, 214, 160, 0.16)"
              : "#DDF4EA"
            : isDark
            ? "#121F1B"
            : "#FFFFFF",
          borderColor: isActive
            ? colors.primary
            : isDark
            ? "#294039"
            : "#D8E0DC",
        },
        isActive && {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.35 : 0.22,
          shadowRadius: 6,
          elevation: 3,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: isActive
              ? colors.primary
              : isDark
              ? "#8FA09A"
              : "#5E6964",
            fontFamily: isActive ? Typography.semiBold : Typography.medium,
          },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isActive
                ? colors.primary
                : isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(16, 21, 19, 0.06)",
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: isActive
                  ? isDark
                    ? "#080C0B"
                    : "#FFFFFF"
                  : isDark
                  ? "#8FA09A"
                  : "#5E6964",
              },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  label: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.bodySmall,
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
});
