import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname, useGlobalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes, Shadows } from "@/constants/theme";
import { triggerSelectionHaptic, triggerLightHaptic } from "@/utils/haptics";

export interface FloatingTabBarProps {
  onQuickActionPress?: () => void;
  isQuickActionOpen?: boolean;
}

interface TabItem {
  key: string;
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
}

interface TabButtonProps {
  item: TabItem;
  isDark: boolean;
}

const TabButton: React.FC<TabButtonProps> = React.memo(({ item, isDark }) => {
  const bounceScale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    triggerSelectionHaptic();
    Animated.sequence([
      Animated.spring(bounceScale, {
        toValue: 1.14,
        friction: 4,
        tension: 300,
        useNativeDriver: true,
      }),
      Animated.spring(bounceScale, {
        toValue: 1.0,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
    item.onPress();
  };

  const activeColor = "#10B981";
  const inactiveColor = isDark ? "#64748B" : "#8FA09A";
  const color = item.isActive ? activeColor : inactiveColor;

  return (
    <Pressable
      style={styles.tabButton}
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityState={{ selected: item.isActive }}
      accessibilityLabel={item.label}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale: bounceScale }] }]}>
        <Ionicons
          name={item.isActive ? item.iconActive : item.iconInactive}
          size={21}
          color={color}
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.tabLabel,
            {
              color,
              fontFamily: item.isActive ? Typography.bold : Typography.medium,
            },
          ]}
        >
          {item.label}
        </Text>
        {item.isActive ? (
          <View
            style={[
              styles.activeDot,
              { backgroundColor: activeColor },
            ]}
          />
        ) : (
          <View style={styles.inactiveDotPlaceholder} />
        )}
      </Animated.View>
    </Pressable>
  );
});

const FloatingTabBarComponent: React.FC<FloatingTabBarProps> = ({
  onQuickActionPress,
  isQuickActionOpen = false,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ tab?: string }>();
  const activeTabParam = params.tab || "dashboard";

  // Center FAB spring rotation animation (0deg -> 45deg when QuickActionModal is open)
  const fabRotation = useRef(new Animated.Value(isQuickActionOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(fabRotation, {
      toValue: isQuickActionOpen ? 1 : 0,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [isQuickActionOpen, fabRotation]);

  const fabRotateDeg = fabRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const isAdmin = useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    const u = (user?.username || "").toLowerCase();
    return (
      r === "admin" ||
      r.includes("admin") ||
      r.includes("director") ||
      u === "infected" ||
      u === "akshay_narayan" ||
      u === "nitin_aggarwal" ||
      u === "abhijay"
    );
  }, [user]);

  // Check if current user is HR persona (vanshika, anshika, or role HR)
  const isHR = useMemo(() => {
    const role = ((user as any)?.role || "").toLowerCase();
    const username = ((user as any)?.username || "").toLowerCase();
    return (
      role.includes("hr") ||
      role.includes("human resource") ||
      role.includes("people ops") ||
      username.includes("vanshika") ||
      username.includes("anshika")
    );
  }, [user]);

  // Route active checks
  const isHome =
    (pathname === "/(employee)" ||
      pathname === "/(employee)/" ||
      pathname === "/(admin)/users" ||
      pathname === "/" ||
      pathname === "/index" ||
      pathname === "") &&
    activeTabParam !== "staff";

  const isStaffActive =
    (pathname === "/(employee)" || pathname === "/(employee)/") &&
    activeTabParam === "staff";

  const isCustomers = pathname.includes("customers");
  const isProfile = pathname.includes("profile") || pathname.includes("more");
  const isCalls =
    pathname.includes("status") ||
    pathname.includes("(user)") ||
    pathname.includes("call-logs") ||
    pathname.includes("calls");

  // Standard Non-HR Navigation Items (4 Clean Tabs: Home, Customers, Calls, Profile)
  const standardNavItems: TabItem[] = [
    {
      key: "home",
      label: "Home",
      iconActive: "home",
      iconInactive: "home-outline",
      isActive: isHome,
      onPress: () => {
        if (isAdmin) {
          router.replace("/(admin)/users" as any);
        } else if (!isHome) {
          router.replace("/(employee)" as any);
        }
      },
    },
    {
      key: "customers",
      label: "Customers",
      iconActive: "people",
      iconInactive: "people-outline",
      isActive: isCustomers,
      onPress: () => {
        if (isAdmin) {
          router.replace("/(admin)/customers" as any);
        } else if (!isCustomers) {
          router.replace("/(employee)/customers" as any);
        }
      },
    },
    {
      key: "calls",
      label: "Calls",
      iconActive: "call",
      iconInactive: "call-outline",
      isActive: isCalls,
      onPress: () => {
        if (isAdmin) {
          router.replace("/(admin)/call-logs" as any);
        } else if (!isCalls) {
          router.replace({ pathname: "/(user)/status", params: { from: "workspace" } } as any);
        }
      },
    },
    {
      key: "profile",
      label: "Profile",
      iconActive: "person",
      iconInactive: "person-outline",
      isActive: isProfile,
      onPress: () => {
        if (isAdmin) {
          router.push("/(admin)/more" as any);
        } else if (!isProfile) {
          router.push("/(employee)/profile" as any);
        }
      },
    },
  ];

  // HR Navigation Items (4 Clean Tabs: HRMS, Staff, Calls, Profile)
  const hrNavItems: TabItem[] = [
    {
      key: "hrms",
      label: "HRMS",
      iconActive: "briefcase",
      iconInactive: "briefcase-outline",
      isActive: isHome,
      onPress: () => {
        router.replace({ pathname: "/(employee)", params: { tab: "dashboard" } } as any);
      },
    },
    {
      key: "staff",
      label: "Staff",
      iconActive: "people",
      iconInactive: "people-outline",
      isActive: isStaffActive,
      onPress: () => {
        router.replace({ pathname: "/(employee)", params: { tab: "staff" } } as any);
      },
    },
    {
      key: "calls",
      label: "Calls",
      iconActive: "call",
      iconInactive: "call-outline",
      isActive: isCalls,
      onPress: () => {
        if (!isCalls) {
          router.replace({ pathname: "/(user)/status", params: { from: "workspace" } } as any);
        }
      },
    },
    {
      key: "profile",
      label: "Profile",
      iconActive: "person",
      iconInactive: "person-outline",
      isActive: isProfile,
      onPress: () => {
        if (isAdmin) {
          router.push("/(admin)/more" as any);
        } else if (!isProfile) {
          router.push("/(employee)/profile" as any);
        }
      },
    },
  ];

  const isMainTab = useMemo(() => {
    const p = (pathname || "").toLowerCase();
    // Do not show dock on sub-screens (they have dedicated headers, back buttons, and full layouts)
    if (
      p.includes("/tool") ||
      p.includes("/customers/") ||
      p.includes("/leads/") ||
      p.includes("/hrms") ||
      p.includes("/inventory") ||
      p.includes("/proforma") ||
      p.includes("/incentives") ||
      p.includes("/security") ||
      p.includes("/stats") ||
      p.includes("/customer-dashboard") ||
      p.includes("/consent")
    ) {
      return false;
    }
    return (
      isHome ||
      isStaffActive ||
      p === "/(admin)/customers" ||
      p === "/(employee)/customers" ||
      p === "/(employee)/customers/" ||
      p === "/(admin)/call-logs" ||
      p === "/(user)/status" ||
      p === "/(admin)/more" ||
      p === "/(employee)/profile"
    );
  }, [pathname, isHome, isStaffActive]);

  if (!isMainTab) {
    return null;
  }

  const currentNavItems = isHR ? hrNavItems : standardNavItems;
  const bottomOffset = Math.max(insets.bottom, 12);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.dockWrapper,
        {
          bottom: bottomOffset,
        },
      ]}
    >
      <View
        style={[
          styles.dockContainer,
          {
            backgroundColor: isDark ? "#0C0E15" : "#121A16",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(255, 255, 255, 0.12)",
          },
          Shadows.floatingDock,
        ]}
      >
        {onQuickActionPress ? (
          // Render with center rotating FAB
          <>
            <TabButton item={currentNavItems[0]} isDark={isDark} />
            <TabButton item={currentNavItems[1]} isDark={isDark} />
            
            <Pressable
              style={styles.fabButton}
              onPress={() => {
                triggerLightHaptic();
                onQuickActionPress();
              }}
              accessibilityRole="button"
              accessibilityLabel="Quick action"
            >
              <Animated.View
                style={[
                  styles.fabInner,
                  { transform: [{ rotate: fabRotateDeg }] },
                ]}
              >
                <Ionicons name="add" size={24} color="#06281E" />
              </Animated.View>
            </Pressable>

            <TabButton item={currentNavItems[2]} isDark={isDark} />
            <TabButton item={currentNavItems[3]} isDark={isDark} />
          </>
        ) : (
          // Render standard 4 tabs
          currentNavItems.map((item) => (
            <TabButton key={item.key} item={item} isDark={isDark} />
          ))
        )}
      </View>
    </View>
  );
};

export const FloatingTabBar = React.memo(FloatingTabBarComponent);

const styles = StyleSheet.create({
  dockWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  dockContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 32,
    borderWidth: 1,
    width: "92%",
    maxWidth: 380,
    height: 64,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    position: "relative",
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: FontSizes.tabLabel,
    marginTop: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  inactiveDotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 2,
  },
  fabButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabInner: {
    alignItems: "center",
    justifyContent: "center",
  },
});
