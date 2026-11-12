import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, StyleProp, ViewStyle, DimensionValue } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface SkeletonCardProps {
  height?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ height = 110 }) => {
  const { isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.85,
          duration: 720,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.35,
          duration: 720,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animatedValue]);

  const blockBg = isDark ? "#21382F" : "#E4ECE8";

  return (
    <Animated.View
      style={[
        styles.card,
        {
          height,
          backgroundColor: isDark ? "#15251F" : "#FFFFFF",
          borderColor: isDark ? "#2D493F" : "#D8E0DC",
          opacity: animatedValue,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: blockBg }]} />
        <View style={styles.headerText}>
          <View style={[styles.titleBar, { backgroundColor: blockBg }]} />
          <View style={[styles.subtitleBar, { backgroundColor: blockBg }]} />
        </View>
        <View style={[styles.pillBar, { backgroundColor: blockBg }]} />
      </View>
      <View style={styles.bottomRow}>
        <View style={[styles.infoBar, { backgroundColor: blockBg }]} />
        <View style={[styles.infoBarSmall, { backgroundColor: blockBg }]} />
      </View>
    </Animated.View>
  );
};

interface SkeletonCardListProps {
  count?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Stack of pulsing skeleton cards to replace full-screen/list spinners cleanly.
 */
export const SkeletonCardList: React.FC<SkeletonCardListProps> = ({
  count = 4,
  height = 104,
  style,
}) => {
  return (
    <View style={[styles.listWrap, style]}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={`skel-${idx}`} height={height} />
      ))}
    </View>
  );
};

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Single pulsing shimmer block for charts, modals, and inline loading placeholders.
 */
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = "100%",
  height = 120,
  borderRadius = 16,
  style,
}) => {
  const { isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.85,
          duration: 720,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.35,
          duration: 720,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animatedValue]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? "#172721" : "#E6EEE9",
          opacity: animatedValue,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  listWrap: {
    width: "100%",
    paddingTop: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  titleBar: {
    height: 14,
    width: "70%",
    borderRadius: 6,
    marginBottom: 6,
  },
  subtitleBar: {
    height: 10,
    width: "45%",
    borderRadius: 4,
  },
  pillBar: {
    height: 20,
    width: 60,
    borderRadius: 10,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  infoBar: {
    height: 10,
    width: "40%",
    borderRadius: 4,
  },
  infoBarSmall: {
    height: 10,
    width: "25%",
    borderRadius: 4,
  },
});
