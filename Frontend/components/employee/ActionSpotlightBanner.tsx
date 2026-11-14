import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import { router } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;

export interface SpotlightCardItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel: string;
  route?: string;
  onPress?: () => void;
  isLive?: boolean;
}

export interface ActionSpotlightBannerProps {
  cards?: SpotlightCardItem[];
  followUpsCount?: number;
  callsCount?: number;
  pendingLeavesCount?: number;
  leadsCount?: number;
  onQuickActionPress?: () => void;
}

export const ActionSpotlightBanner: React.FC<ActionSpotlightBannerProps> = ({
  cards,
  followUpsCount = 0,
  callsCount = 0,
  pendingLeavesCount = 0,
  leadsCount = 0,
  onQuickActionPress,
}) => {
  const { isDark } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isInteracting = useRef(false);

  // Live pulsing halo animation for active card
  const haloAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(haloAnim, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [haloAnim]);

  // Dynamically assemble smart deck if cards not provided directly
  const spotlightCards: SpotlightCardItem[] = useMemo(() => {
    if (cards && cards.length > 0) return cards;

    const items: SpotlightCardItem[] = [];

    if (followUpsCount > 0) {
      items.push({
        id: "followups",
        icon: "calendar-outline",
        title: "Follow-ups Queue",
        subtitle: `${followUpsCount} customer review${followUpsCount > 1 ? "s" : ""} scheduled`,
        actionLabel: "Review →",
        route: "/(employee)/customers",
        isLive: true,
      });
    }

    if (callsCount > 0) {
      items.push({
        id: "calls",
        icon: "call-outline",
        title: "Live Telephony Active",
        subtitle: `${callsCount} calls synced with central telemetry`,
        actionLabel: "Logs →",
        route: "/(employee)/customers/tool/call_tracker",
        isLive: true,
      });
    }

    if (pendingLeavesCount > 0) {
      items.push({
        id: "leaves",
        icon: "time-outline",
        title: "Leave Approvals",
        subtitle: `${pendingLeavesCount} employee request${pendingLeavesCount > 1 ? "s" : ""} pending review`,
        actionLabel: "Approve →",
        route: "/(employee)/hrms",
        isLive: true,
      });
    }

    // Default fast action card
    items.push({
      id: "proforma",
      icon: "flash-outline",
      title: "Commercial Dispatch",
      subtitle: "Issue quick proforma or tax quotation",
      actionLabel: "Create →",
      route: "/(employee)/proforma",
      isLive: false,
    });

    if (items.length < 2 && leadsCount > 0) {
      items.push({
        id: "leads",
        icon: "filter-outline",
        title: "Lead Pipeline",
        subtitle: `${leadsCount} warm prospect${leadsCount > 1 ? "s" : ""} awaiting outreach`,
        actionLabel: "Pipeline →",
        route: "/(employee)/leads",
        isLive: true,
      });
    }

    return items;
  }, [cards, followUpsCount, callsCount, pendingLeavesCount, leadsCount]);

  // Gentle auto-scrolling every 5.5 seconds when user is not touching
  useEffect(() => {
    if (spotlightCards.length <= 1) return;

    const interval = setInterval(() => {
      if (isInteracting.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % spotlightCards.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5500);

    return () => clearInterval(interval);
  }, [spotlightCards.length]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / CARD_WIDTH);
    if (idx !== activeIndex && idx >= 0 && idx < spotlightCards.length) {
      setActiveIndex(idx);
    }
  };

  const handleCardPress = (item: SpotlightCardItem) => {
    triggerLightHaptic();
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route as any);
    } else if (onQuickActionPress) {
      onQuickActionPress();
    }
  };

  return (
    <View style={styles.bannerContainer}>
      <FlatList
        ref={flatListRef}
        data={spotlightCards}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onTouchStart={() => {
          isInteracting.current = true;
        }}
        onTouchEnd={() => {
          setTimeout(() => {
            isInteracting.current = false;
          }, 3000);
        }}
        renderItem={({ item }) => (
          <View style={[styles.cardWrapper, { width: CARD_WIDTH }]}>
            <Pressable
              onPress={() => handleCardPress(item)}
              style={({ pressed }) => [
                styles.cardContainer,
                {
                  backgroundColor: isDark ? "#131822" : "#FFFFFF",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(0, 168, 121, 0.22)",
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
              accessibilityRole="button"
            >
              {/* Left: 36x36 Icon Container with Live Dot */}
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isDark ? "#1A1E2B" : "#EEF7F1",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 168, 121, 0.20)",
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={19}
                  color={isDark ? "#10B981" : "#00A879"}
                />
                {item.isLive && (
                  <View style={styles.liveHaloBox}>
                    <Animated.View
                      style={[
                        styles.liveHaloPulse,
                        {
                          backgroundColor: isDark ? "#10B981" : "#00A879",
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
                            outputRange: [0.65, 0],
                          }),
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.liveCenterDot,
                        { backgroundColor: isDark ? "#10B981" : "#00A879" },
                      ]}
                    />
                  </View>
                )}
              </View>

              {/* Center: Title & Muted Subtitle */}
              <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: isDark ? "#F8FAFC" : "#101513" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: isDark ? "#94A3B8" : "#5E6964" },
                  ]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              </View>

              {/* Right: Emerald Pill Button */}
              <View
                style={[
                  styles.actionButton,
                  { backgroundColor: isDark ? "#10B981" : "#00A879" },
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: isDark ? "#06281E" : "#FFFFFF" },
                  ]}
                >
                  {item.actionLabel}
                </Text>
              </View>
            </Pressable>
          </View>
        )}
      />

      {/* Pagination Dots */}
      {spotlightCards.length > 1 && (
        <View style={styles.paginationRow}>
          {spotlightCards.map((_, i) => {
            const isActive = i === activeIndex;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isActive
                    ? [
                        styles.dotActive,
                        { backgroundColor: isDark ? "#10B981" : "#00A879" },
                      ]
                    : {
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#D8E0DC",
                      },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    marginVertical: 10,
    alignItems: "center",
  },
  cardWrapper: {
    paddingHorizontal: 0,
  },
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.2,
    shadowColor: "#0D2B20",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginRight: 10,
  },
  liveHaloBox: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  liveHaloPulse: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveCenterDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11.5,
    fontFamily: Typography.medium,
    lineHeight: 15,
  },
  actionButton: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 11.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.2,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
});
