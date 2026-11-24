import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  DimensionValue,
  Animated,
  Easing,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface ShimmerItemProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  phaseDelay?: number;
}

const ShimmerItem: React.FC<ShimmerItemProps> = ({
  width,
  height,
  borderRadius = 6,
  style,
  phaseDelay = 0,
}) => {
  const { isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 0.88,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0.42,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    }, phaseDelay);

    return () => {
      clearTimeout(timer);
      if (anim) anim.stop();
    };
  }, [phaseDelay, pulse]);

  const baseBg = isDark ? "#1E2435" : "#E2E9E5";

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseBg,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
};

export interface SkeletonCardProps {
  height?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ height = 110 }) => {
  const { isDark } = useTheme();
  const shimmerProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerProgress]);

  const translateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-250, 480],
  });

  const sheenAnimStyle = {
    transform: [{ translateX }, { skewX: "-20deg" }],
  };

  return (
    <View
      style={[
        styles.card,
        {
          height,
          backgroundColor: isDark ? "#12151E" : "#FFFFFF",
          borderColor: isDark ? "rgba(255, 255, 255, 0.07)" : "#D8E0DC",
          borderTopColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.98)",
        },
      ]}
    >
      {/* Top Row: Avatar + Title/Subtitle + Pill */}
      <View style={styles.topRow}>
        <ShimmerItem width={40} height={40} borderRadius={20} phaseDelay={0} />
        <View style={styles.headerText}>
          <ShimmerItem width="68%" height={13} borderRadius={6} phaseDelay={120} style={{ marginBottom: 6 }} />
          <ShimmerItem width="42%" height={10} borderRadius={4} phaseDelay={240} />
        </View>
        <ShimmerItem width={58} height={20} borderRadius={10} phaseDelay={180} />
      </View>

      {/* Bottom Row: Metrics & Dates */}
      <View style={styles.bottomRow}>
        <ShimmerItem width="38%" height={10} borderRadius={4} phaseDelay={300} />
        <ShimmerItem width="22%" height={10} borderRadius={4} phaseDelay={360} />
      </View>

      {/* Sweeping Shimmer Light Sheen */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerSheen,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(255, 255, 255, 0.55)",
          },
          sheenAnimStyle,
        ]}
      />
    </View>
  );
};

export interface SkeletonCardListProps {
  count?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

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

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = "100%",
  height = 120,
  borderRadius = 16,
  style,
}) => {
  const { isDark } = useTheme();
  const shimmerProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerProgress]);

  const translateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-250, 480],
  });

  const sheenAnimStyle = {
    transform: [{ translateX }, { skewX: "-20deg" }],
  };

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? "#12151E" : "#FFFFFF",
          borderColor: isDark ? "rgba(255, 255, 255, 0.07)" : "#D8E0DC",
          borderWidth: 1,
          overflow: "hidden",
          position: "relative",
        },
        style,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? "#1A1E2B" : "#E8EFEB",
            opacity: 0.5,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerSheen,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.6)",
          },
          sheenAnimStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listWrap: {
    width: "100%",
    paddingTop: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 16,
    marginBottom: 12,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  shimmerSheen: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 80,
  },
});
