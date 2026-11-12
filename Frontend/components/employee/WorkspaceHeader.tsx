import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { NotificationCenterModal } from "@/components/employee/NotificationCenterModal";
import { getRoleWorkspaceContext } from "@/utils/greetings";
import { PersonAvatar3D } from "@/components/employee/SubAppLogo";

const HEADER_MOON = require("@/assets/subapps/header_moon.webp");
const HEADER_SUN = require("@/assets/subapps/header_sun.webp");
const HEADER_BELL = require("@/assets/subapps/header_bell.webp");

interface WorkspaceHeaderProps {
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

const WorkspaceHeaderComponent: React.FC<WorkspaceHeaderProps> = ({
  onNotificationPress,
  onProfilePress,
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
            <Text
              style={[
                styles.dateText,
                { color: isDark ? "#8FA09A" : "#5E6964" },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formattedDate}
            </Text>
          </View>
        </View>

        {/* Right Actions: Theme Toggle, Notifications, Avatar */}
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
                borderColor: isDark ? "#294039" : "#D8E0DC",
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Toggle theme"
          >
            <Image
              source={isDark ? HEADER_SUN : HEADER_MOON}
              style={styles.headerIcon3D}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
                borderColor: isDark ? "#294039" : "#D8E0DC",
              },
            ]}
            onPress={handleNotificationClick}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Image
              source={HEADER_BELL}
              style={styles.headerIcon3D}
              resizeMode="contain"
            />
            {unreadCount > 0 && (
              <View
                style={[
                  styles.notificationBadge,
                  { backgroundColor: isDark ? "#35D6A0" : "#00A879" },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isDark ? "#0A1612" : "#FFFFFF" },
                  ]}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handleProfileClick}
            activeOpacity={0.8}
            accessibilityLabel="Profile"
          >
            <PersonAvatar3D
              gender={user?.gender}
              size={38}
              borderWidth={1.5}
              borderColor={isDark ? "#35D6A0" : "rgba(0, 168, 121, 0.35)"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting Heading */}
      <Text
        style={[
          styles.greetingTitle,
          { color: isDark ? "#F1F7F4" : "#101513" },
        ]}
      >
        {roleContext.subGreeting}, {displayName}
      </Text>



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
    flexShrink: 1,
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
    width: 26,
    height: 26,
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
