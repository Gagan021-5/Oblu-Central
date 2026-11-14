import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Image, Animated } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationCenterModal } from "@/components/employee/NotificationCenterModal";
import { getRoleWorkspaceContext } from "@/utils/greetings";
import { PersonAvatar3D } from "@/components/employee/SubAppLogo";
import { triggerLightHaptic } from "@/utils/haptics";

const HEADER_MOON = require("@/assets/subapps/header_moon.webp");
const HEADER_SUN = require("@/assets/subapps/header_sun.webp");
const HEADER_BELL = require("@/assets/subapps/header_bell.webp");

interface WorkspaceHeaderProps {
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  scrollY?: Animated.Value;
}

const WorkspaceHeaderComponent: React.FC<WorkspaceHeaderProps> = ({
  onNotificationPress,
  onProfilePress,
  scrollY,
}) => {
  const { user } = useAuth();
  const { isDark, setMode } = useTheme();
  const {
    unreadCount,
    openNotificationCenter,
    closeNotificationCenter,
    isNotificationCenterVisible,
  } = useNotifications();

  // Dynamic context based on employee role, department, and time
  const roleContext = useMemo(() => {
    return getRoleWorkspaceContext(user?.role, (user as any)?.department);
  }, [user?.role, (user as any)?.department]);

  // Spring animations for action buttons
  const themeScale = useRef(new Animated.Value(1)).current;
  const bellScale = useRef(new Animated.Value(1)).current;
  const bellSwing = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;

  // Gentle bell swing animation when unread notifications are present
  useEffect(() => {
    if (unreadCount <= 0) {
      bellSwing.setValue(0);
      return;
    }

    const swingSequence = Animated.sequence([
      Animated.timing(bellSwing, { toValue: -14, duration: 90, useNativeDriver: true }),
      Animated.timing(bellSwing, { toValue: 12, duration: 90, useNativeDriver: true }),
      Animated.timing(bellSwing, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(bellSwing, { toValue: 6, duration: 80, useNativeDriver: true }),
      Animated.timing(bellSwing, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]);

    swingSequence.start();

    const interval = setInterval(() => {
      swingSequence.start();
    }, 7000);

    return () => clearInterval(interval);
  }, [unreadCount, bellSwing]);

  // Theme Press
  const handleThemePressIn = () => {
    triggerLightHaptic();
    Animated.spring(themeScale, {
      toValue: 0.88,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleThemePressOut = () => {
    Animated.spring(themeScale, {
      toValue: 1,
      friction: 5,
      tension: 280,
      useNativeDriver: true,
    }).start();
  };

  // Bell Press
  const handleBellPressIn = () => {
    triggerLightHaptic();
    Animated.spring(bellScale, {
      toValue: 0.88,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleBellPressOut = () => {
    Animated.spring(bellScale, {
      toValue: 1,
      friction: 5,
      tension: 280,
      useNativeDriver: true,
    }).start();
  };

  // Avatar Press
  const handleAvatarPressIn = () => {
    triggerLightHaptic();
    Animated.spring(avatarScale, {
      toValue: 0.90,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleAvatarPressOut = () => {
    Animated.spring(avatarScale, {
      toValue: 1,
      friction: 5,
      tension: 280,
      useNativeDriver: true,
    }).start();
  };

  // Display user name dynamically from AuthContext
  const displayName = useMemo(() => {
    if (user?.name && user.name.trim()) {
      return user.name.trim().split(" ")[0];
    }
    if (user?.username) {
      const clean = user.username.replace(/_/g, " ").split(" ")[0];
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return "Team";
  }, [user]);

  // Formatted date: "Monday, 7 September"
  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const toggleTheme = () => {
    setMode(isDark ? "light" : "dark");
  };

  const handleNotificationClick = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      openNotificationCenter();
    }
  };

  const handleProfileClick = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      router.push("/(employee)/profile" as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leftMeta}>
          <View style={styles.brandDateRow}>
            <View
              style={[
                styles.brandLogoContainer,
                {
                  borderColor: isDark ? "#294039" : "#D8E0DC",
                },
              ]}
            >
              <Image
                source={require("@/assets/images/logo.webp")}
                style={styles.brandLogo}
                resizeMode="cover"
              />
            </View>
            <View style={styles.dateAndStatusRow}>
              <Text
                style={[
                  styles.dateText,
                  { color: isDark ? "#94A3B8" : "#5E6964" },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {formattedDate}
              </Text>
              {/* Live status indicator pill */}
              <View
                style={[
                  styles.liveStatusPill,
                  {
                    backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(0, 168, 121, 0.10)",
                    borderColor: isDark ? "rgba(16, 185, 129, 0.30)" : "rgba(0, 168, 121, 0.18)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.liveStatusDot,
                    { backgroundColor: isDark ? "#10B981" : "#00A879" },
                  ]}
                />
                <Text
                  style={[
                    styles.liveStatusText,
                    { color: isDark ? "#10B981" : "#00A879" },
                  ]}
                >
                  Online
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Right Actions: Theme Toggle, Notifications, Avatar with spring scales */}
        <View style={styles.rightActions}>
          <Pressable
            onPress={toggleTheme}
            onPressIn={handleThemePressIn}
            onPressOut={handleThemePressOut}
            accessibilityLabel="Toggle theme"
          >
            <Animated.View
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? "#141822" : "#FFFFFF",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC",
                  transform: [{ scale: themeScale }],
                },
              ]}
            >
              <Image
                source={isDark ? HEADER_SUN : HEADER_MOON}
                style={styles.headerIcon3D}
                resizeMode="contain"
              />
            </Animated.View>
          </Pressable>

          <Pressable
            onPress={handleNotificationClick}
            onPressIn={handleBellPressIn}
            onPressOut={handleBellPressOut}
            accessibilityLabel="Notifications"
          >
            <Animated.View
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? "#141822" : "#FFFFFF",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC",
                  transform: [{ scale: bellScale }],
                },
              ]}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: bellSwing.interpolate({
                        inputRange: [-20, 20],
                        outputRange: ["-20deg", "20deg"],
                      }),
                    },
                  ],
                }}
              >
                <Image
                  source={HEADER_BELL}
                  style={styles.headerIcon3D}
                  resizeMode="contain"
                />
              </Animated.View>
              {unreadCount > 0 && (
                <View
                  style={[
                    styles.notificationBadge,
                    { backgroundColor: isDark ? "#10B981" : "#00A879" },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isDark ? "#06281E" : "#FFFFFF" },
                    ]}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </Animated.View>
          </Pressable>

          <Pressable
            onPress={handleProfileClick}
            onPressIn={handleAvatarPressIn}
            onPressOut={handleAvatarPressOut}
            accessibilityLabel="Profile"
          >
            <Animated.View
              style={[
                styles.avatarButton,
                { transform: [{ scale: avatarScale }] },
              ]}
            >
              <PersonAvatar3D
                gender={user?.gender}
                size={38}
                borderWidth={1.5}
                borderColor={isDark ? "#10B981" : "rgba(0, 168, 121, 0.35)"}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {/* Greeting Heading with Scroll Collapse Animation */}
      <Animated.View
        style={{
          opacity: scrollY
            ? scrollY.interpolate({
                inputRange: [0, 70],
                outputRange: [1, 0],
                extrapolate: "clamp",
              })
            : 1,
          transform: [
            {
              translateY: scrollY
                ? scrollY.interpolate({
                    inputRange: [0, 70],
                    outputRange: [0, -12],
                    extrapolate: "clamp",
                  })
                : 0,
            },
          ],
        }}
      >
        <Text
          style={[
            styles.greetingTitle,
            { color: isDark ? "#F8FAFC" : "#101513" },
          ]}
        >
          {roleContext.subGreeting}, {displayName}
        </Text>
      </Animated.View>

      {/* Interactive Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotificationCenterVisible}
        onClose={closeNotificationCenter}
      />
    </View>
  );
};

export const WorkspaceHeader = React.memo(WorkspaceHeaderComponent);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  leftMeta: {
    flexDirection: "column",
    justifyContent: "center",
    flex: 1,
    marginRight: 8,
  },
  brandDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dateAndStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1,
  },
  brandLogoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  brandLogo: {
    width: "100%",
    height: "100%",
  },
  dateText: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.semiBold,
  },
  liveStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4.5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveStatusDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
  },
  liveStatusText: {
    fontSize: 9.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.3,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerIcon3D: {
    width: 22,
    height: 22,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: Typography.bold,
    textAlign: "center",
    lineHeight: 11,
  },
  avatarButton: {
    marginLeft: 4,
  },
  greetingTitle: {
    fontSize: 24,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
  },
});
