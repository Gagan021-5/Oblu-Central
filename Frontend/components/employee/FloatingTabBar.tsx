import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname, useGlobalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes, Shadows } from "@/constants/theme";

interface FloatingTabBarProps {
  onQuickActionPress?: () => void;
}

const FloatingTabBarComponent: React.FC<FloatingTabBarProps> = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ tab?: string }>();
  const activeTabParam = params.tab || "dashboard";

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
  const standardNavItems = [
    {
      key: "home",
      label: "Home",
      iconActive: "home" as const,
      iconInactive: "home-outline" as const,
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
      iconActive: "people" as const,
      iconInactive: "people-outline" as const,
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
      iconActive: "call" as const,
      iconInactive: "call-outline" as const,
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
      iconActive: "person" as const,
      iconInactive: "person-outline" as const,
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
  const hrNavItems = [
    {
      key: "hrms",
      label: "HRMS",
      iconActive: "briefcase" as const,
      iconInactive: "briefcase-outline" as const,
      isActive: isHome,
      onPress: () => {
        router.replace({ pathname: "/(employee)", params: { tab: "dashboard" } } as any);
      },
    },
    {
      key: "staff",
      label: "Staff",
      iconActive: "people" as const,
      iconInactive: "people-outline" as const,
      isActive: isStaffActive,
      onPress: () => {
        router.replace({ pathname: "/(employee)", params: { tab: "staff" } } as any);
      },
    },
    {
      key: "calls",
      label: "Calls",
      iconActive: "call" as const,
      iconInactive: "call-outline" as const,
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
      iconActive: "person" as const,
      iconInactive: "person-outline" as const,
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
            backgroundColor: isDark ? "#13231D" : "#121A16",
            borderColor: isDark
              ? "rgba(53, 214, 160, 0.26)"
              : "rgba(255, 255, 255, 0.12)",
          },
          Shadows.floatingDock,
        ]}
      >
        {currentNavItems.map((item) => {
          const color = item.isActive
            ? isDark
              ? "#35D6A0"
              : "#19C997"
            : "#8FA09A";
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.tabButton}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
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
                    fontFamily: item.isActive ? Typography.semiBold : Typography.medium,
                  },
                ]}
              >
                {item.label}
              </Text>
              {item.isActive && (
                <View
                  style={[
                    styles.activeDot,
                    { backgroundColor: isDark ? "#35D6A0" : "#19C997" },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
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
    paddingHorizontal: 10,
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
    paddingVertical: 4,
    position: "relative",
  },
  tabLabel: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.tabLabel,
    marginTop: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
