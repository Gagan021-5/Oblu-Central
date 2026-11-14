import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { SubAppLogo } from "@/components/employee/SubAppLogo";
import { triggerLightHaptic } from "@/utils/haptics";

export interface SubAppCardProps {
  // ─── Explore Apps Rail Category Props ───
  active?: boolean;
  label?: string;
  appId?: string;
  accentColor?: string;

  // ─── Bento Dashboard Module Props (Backward Compatibility) ───
  type?: "customers" | "leads" | "inventory" | "proforma" | "hrms" | "incentives" | "call_tracker" | "calls";
  callsCount?: number;
  syncStatusText?: string;
  onPress: () => void;
  customersCount?: number;
  followUpsCount?: number;
  leadsCount?: number;
  pipelineValue?: string;
  skusCount?: number;
  lowStockCount?: number;
  invoicesCount?: number;
  pendingApprovalsCount?: number;
  employeesCount?: number;
  pendingLeavesCount?: number;
  incentivesAccrued?: string;
  incentivesDisbursed?: string;
}

export const SubAppCard: React.FC<SubAppCardProps> = React.memo(({
  // Rail props
  active = false,
  label,
  appId,
  accentColor,

  // Bento props
  type,
  onPress,
  customersCount = 0,
  followUpsCount = 0,
  leadsCount = 0,
  pipelineValue = "₹0",
  skusCount = 542,
  lowStockCount = 14,
  invoicesCount = 28,
  pendingApprovalsCount = 3,
  employeesCount = 12,
  pendingLeavesCount = 2,
  incentivesAccrued = "₹64,250",
  incentivesDisbursed = "₹48,000",
  callsCount = 0,
  syncStatusText = "Activity sync active",
}) => {
  const { isDark } = useTheme();

  // Rail spring press feedback (scale: 0.92 on press-in, 1 on release)
  const railPressScale = useRef(new Animated.Value(1)).current;
  const iconPopScale = useRef(new Animated.Value(active ? 1.06 : 1.0)).current;
  const iconWiggle = useRef(new Animated.Value(0)).current;
  const indicatorAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  // Bento spring press feedback (scale: 0.96 on press-in, 1 on release)
  const bentoPressScale = useRef(new Animated.Value(1)).current;
  const bentoChevronShift = useRef(new Animated.Value(0)).current;

  const isRailMode = Boolean(label !== undefined || appId !== undefined || active !== undefined && !type);

  // Animate 3D icon container spring pop & wiggle when active changes
  useEffect(() => {
    if (!isRailMode) return;

    if (active) {
      Animated.parallel([
        Animated.spring(iconPopScale, {
          toValue: 1.06,
          friction: 4,
          tension: 260,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(iconWiggle, {
            toValue: -4,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.spring(iconWiggle, {
            toValue: 0,
            friction: 4,
            tension: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(indicatorAnim, {
          toValue: 1,
          friction: 6,
          tension: 280,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(iconPopScale, {
          toValue: 1.0,
          friction: 5,
          tension: 260,
          useNativeDriver: true,
        }),
        Animated.spring(indicatorAnim, {
          toValue: 0,
          friction: 6,
          tension: 280,
          useNativeDriver: false,
        }),
      ]).start();
      iconWiggle.setValue(0);
    }
  }, [active, isRailMode, iconPopScale, iconWiggle, indicatorAnim]);

  // Handle Rail Press
  const handleRailPressIn = () => {
    triggerLightHaptic();
    Animated.spring(railPressScale, {
      toValue: 0.92,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleRailPressOut = () => {
    Animated.spring(railPressScale, {
      toValue: 1,
      friction: 5,
      tension: 280,
      useNativeDriver: true,
    }).start();
  };

  // Handle Bento Press
  const handleBentoPressIn = () => {
    triggerLightHaptic();
    Animated.parallel([
      Animated.spring(bentoPressScale, {
        toValue: 0.96,
        friction: 6,
        tension: 300,
        useNativeDriver: true,
      }),
      Animated.spring(bentoChevronShift, {
        toValue: 2,
        friction: 6,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBentoPressOut = () => {
    Animated.parallel([
      Animated.spring(bentoPressScale, {
        toValue: 1,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
      Animated.spring(bentoChevronShift, {
        toValue: 0,
        friction: 5,
        tension: 280,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ─── 1. RENDER RAIL CATEGORY ITEM (Explore Apps 3D Rail) ───
  if (isRailMode) {
    const finalAppId = appId || "all";
    const primaryColor = accentColor || (isDark ? "#35D6A0" : "#00A879");

    return (
      <Pressable
        onPress={onPress}
        onPressIn={handleRailPressIn}
        onPressOut={handleRailPressOut}
        style={styles.railItemSlot}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Animated.View
          style={[
            styles.railItemContainer,
            { transform: [{ scale: railPressScale }] },
          ]}
        >
          {/* 3D Icon Container with Pop, Wiggle & Emerald Glow */}
          <Animated.View
            style={[
              styles.railIconCircle,
              {
                borderColor: active ? primaryColor : isDark ? "#2D493F" : "#D8E0DC",
                borderWidth: active ? 2 : 1,
                shadowColor: isDark ? "#35D6A0" : "#00A879",
                shadowOpacity: active ? (isDark ? 0.45 : 0.22) : 0.08,
                shadowRadius: active ? 10 : 5,
                elevation: active ? 6 : 3,
                transform: [
                  { scale: iconPopScale },
                  {
                    rotate: iconWiggle.interpolate({
                      inputRange: [-4, 0],
                      outputRange: ["-4deg", "0deg"],
                    }),
                  },
                ],
              },
            ]}
          >
            <SubAppLogo
              appId={finalAppId}
              borderRadius={0}
              borderWidth={0}
              style={{ width: "100%", height: "100%" }}
            />
          </Animated.View>

          {/* Category Label */}
          <Text
            style={[
              styles.railLabel,
              {
                color: active
                  ? isDark ? "#F1F7F4" : "#101513"
                  : isDark ? "#8FA09A" : "#5E6964",
                fontFamily: active ? Typography.bold : Typography.medium,
              },
            ]}
            numberOfLines={1}
          >
            {label || finalAppId}
          </Text>

          {/* Animated Green Indicator Bar (Width 0 -> 20 and opacity 0 -> 1) */}
          <Animated.View
            style={[
              styles.railActiveIndicator,
              {
                backgroundColor: primaryColor,
                width: indicatorAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
                opacity: indicatorAnim,
              },
            ]}
          />
        </Animated.View>
      </Pressable>
    );
  }

  // ─── 2. RENDER BENTO MODULE CARD (Backward Compatibility) ───
  const bentoType = type || "customers";
  const config = {
    customers: {
      title: "Customers Directory",
      sub: "Active accounts & follow-up queue",
      tag: "CRM CORE",
      icon: "people" as const,
      color: isDark ? "#35D6A0" : "#00A879",
      bgRgba: isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.10)",
      badgeColor: isDark ? "#35D6A0" : "#00A879",
      statNum: customersCount,
      statLabel: `${followUpsCount} reviews scheduled`,
    },
    leads: {
      title: "Leads & Prospects",
      sub: "Active pipeline & conversion stages",
      tag: "PIPELINE",
      icon: "filter" as const,
      color: isDark ? "#20E3AD" : "#19C997",
      bgRgba: isDark ? "rgba(32, 227, 173, 0.14)" : "rgba(25, 201, 151, 0.10)",
      badgeColor: isDark ? "#20E3AD" : "#19C997",
      statNum: leadsCount,
      statLabel: `Pipeline: ${pipelineValue}`,
    },
    inventory: {
      title: "Warehouse Inventory",
      sub: "SKUs, reorder thresholds & telemetry",
      tag: "LOGISTICS",
      icon: "cube" as const,
      color: isDark ? "#818CF8" : "#6366F1",
      bgRgba: isDark ? "rgba(129, 140, 248, 0.14)" : "rgba(99, 102, 241, 0.10)",
      badgeColor: isDark ? "#818CF8" : "#6366F1",
      statNum: skusCount,
      statLabel: `${lowStockCount} alerts below threshold`,
    },
    proforma: {
      title: "Commercial Proforma",
      sub: "Price quotations, approvals & dispatch",
      tag: "COMMERCIAL",
      icon: "document-text" as const,
      color: isDark ? "#38BDF8" : "#0284C7",
      bgRgba: isDark ? "rgba(56, 189, 248, 0.14)" : "rgba(2, 132, 199, 0.10)",
      badgeColor: isDark ? "#38BDF8" : "#0284C7",
      statNum: invoicesCount,
      statLabel: `${pendingApprovalsCount} awaiting approval`,
    },
    hrms: {
      title: "HR Operations Suite",
      sub: "Workforce directory & leave approvals",
      tag: "HUMAN RESOURCES",
      icon: "briefcase" as const,
      color: isDark ? "#F59E0B" : "#D97706",
      bgRgba: isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(217, 119, 6, 0.10)",
      badgeColor: isDark ? "#F59E0B" : "#D97706",
      statNum: employeesCount,
      statLabel: `${pendingLeavesCount} leaves awaiting review`,
    },
    incentives: {
      title: "Sales Incentives",
      sub: "Commission cycle, payouts & tiers",
      tag: "COMMISSIONS",
      icon: "trophy" as const,
      color: isDark ? "#EC4899" : "#DB2777",
      bgRgba: isDark ? "rgba(236, 72, 153, 0.14)" : "rgba(219, 39, 119, 0.10)",
      badgeColor: isDark ? "#EC4899" : "#DB2777",
      statNum: incentivesAccrued,
      statLabel: `${incentivesDisbursed} disbursed`,
    },
    call_tracker: {
      title: "Call Intelligence",
      sub: "Activity synchronization & recording logs",
      tag: "TELEMETRY",
      icon: "call" as const,
      color: isDark ? "#38BDF8" : "#0284C7",
      bgRgba: isDark ? "rgba(56, 189, 248, 0.14)" : "rgba(2, 132, 199, 0.10)",
      badgeColor: isDark ? "#38BDF8" : "#0284C7",
      statNum: callsCount,
      statLabel: syncStatusText,
    },
    calls: {
      title: "Call Intelligence",
      sub: "Activity synchronization & recording logs",
      tag: "TELEMETRY",
      icon: "call" as const,
      color: isDark ? "#38BDF8" : "#0284C7",
      bgRgba: isDark ? "rgba(56, 189, 248, 0.14)" : "rgba(2, 132, 199, 0.10)",
      badgeColor: isDark ? "#38BDF8" : "#0284C7",
      statNum: callsCount,
      statLabel: syncStatusText,
    },
  }[bentoType];

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handleBentoPressIn}
      onPressOut={handleBentoPressOut}
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          styles.outwardContainer,
          {
            backgroundColor: isDark ? "#15251F" : "#FFFFFF",
            borderColor: isDark ? "rgba(53, 214, 160, 0.22)" : "rgba(13, 43, 32, 0.08)",
            borderTopColor: isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(255, 255, 255, 0.98)",
            borderBottomColor: isDark ? "#0C1612" : "rgba(13, 43, 32, 0.14)",
            shadowColor: isDark ? "#000000" : "#0D2B20",
            shadowOpacity: isDark ? 0.36 : 0.09,
            transform: [{ scale: bentoPressScale }],
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <SubAppLogo
            appId={bentoType}
            size={48}
            borderRadius={14}
            borderColor={isDark ? "rgba(53, 214, 160, 0.28)" : "rgba(13, 43, 32, 0.12)"}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.tagPill, { backgroundColor: config.bgRgba }]}>
              <Text style={[styles.tagText, { color: config.badgeColor }]}>
                {config.tag}
              </Text>
            </View>
            <Animated.View
              style={[
                styles.arrowCircle,
                {
                  backgroundColor: isDark ? "#162721" : "#F4F7F5",
                  borderColor: isDark ? "#294039" : "#D8E0DC",
                  transform: [{ translateX: bentoChevronShift }],
                },
              ]}
            >
              <Ionicons name="arrow-forward" size={15} color={config.color} />
            </Animated.View>
          </View>
        </View>

        <Text
          style={[
            styles.statNumber,
            { color: isDark ? "#F1F7F4" : "#101513" },
          ]}
        >
          {config.statNum}
        </Text>

        <Text
          style={[
            styles.titleText,
            { color: isDark ? "#F1F7F4" : "#101513" },
          ]}
        >
          {config.title}
        </Text>

        <Text
          style={[
            styles.subText,
            { color: isDark ? "#8FA09A" : "#5E6964" },
          ]}
        >
          {config.statLabel}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

export const SubAppRailCard = SubAppCard;

const styles = StyleSheet.create({
  // ─── Rail Item Styles ───
  railItemSlot: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 2,
  },
  railItemContainer: {
    alignItems: "center",
    width: 72,
  },
  railIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  railLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  railActiveIndicator: {
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
  },

  // ─── Bento Card Styles ───
  outwardContainer: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
    zIndex: 2,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 28,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  titleText: {
    fontSize: 15,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subText: {
    fontSize: 12,
    fontFamily: Typography.medium,
  },
});
