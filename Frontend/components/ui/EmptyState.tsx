import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { employeeTheme } from "@/constants/employeeTheme";
import { triggerSelectionHaptic } from "@/utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "file-tray-outline",
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { colors, isDark } = useTheme();
  const t = isDark ? employeeTheme.dark : employeeTheme.light;
  const floatAnim = useRef(new Animated.Value(-6)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 6,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const floatStyle = {
    transform: [{ translateY: floatAnim }],
  };

  const shadowScale = floatAnim.interpolate({
    inputRange: [-6, 6],
    outputRange: [0.88, 1.06],
  });

  const shadowOpacity = floatAnim.interpolate({
    inputRange: [-6, 6],
    outputRange: [0.25, 0.6],
  });

  const shadowRingStyle = {
    transform: [{ scaleX: shadowScale }, { scaleY: shadowScale }],
    opacity: shadowOpacity,
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.95, friction: 5, tension: 300, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, { toValue: 1.0, friction: 6, tension: 280, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    triggerSelectionHaptic();
    onAction?.();
  };

  const buttonAnimStyle = {
    transform: [{ scale: buttonScale }],
  };

  return (
    <View style={styles.container}>
      {/* Floating Levitation Icon + Synchronized Inverse Shadow */}
      <View style={styles.levitationStage}>
        <Animated.View
          style={[
            styles.iconCircle,
            {
              backgroundColor: isDark
                ? "rgba(16, 185, 129, 0.12)"
                : "#DDF4EA",
              borderColor: isDark
                ? "rgba(16, 185, 129, 0.28)"
                : "rgba(0, 168, 121, 0.22)",
            },
            floatStyle,
          ]}
        >
          <Ionicons
            name={icon}
            size={32}
            color={isDark ? "#10B981" : "#00A879"}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.shadowRing,
            {
              backgroundColor: isDark
                ? "rgba(16, 185, 129, 0.25)"
                : "rgba(0, 168, 121, 0.20)",
            },
            shadowRingStyle,
          ]}
        />
      </View>

      <Text
        style={[
          styles.title,
          { color: isDark ? "#F8FAFC" : "#101513" },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.description,
          { color: isDark ? "#94A3B8" : "#5E6964" },
        ]}
      >
        {description}
      </Text>

      {actionLabel && onAction && (
        <AnimatedPressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={[
            styles.button,
            { backgroundColor: t.primary },
            buttonAnimStyle,
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              { color: isDark ? "#090B10" : "#FFFFFF" },
            ]}
          >
            {actionLabel}
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  levitationStage: {
    width: 80,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  shadowRing: {
    position: "absolute",
    bottom: 2,
    width: 44,
    height: 12,
    borderRadius: 22,
    zIndex: 1,
  },
  title: {
    fontSize: FontSizes.sectionTitle,
    fontFamily: Typography.semiBold,
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.semiBold,
  },
});
