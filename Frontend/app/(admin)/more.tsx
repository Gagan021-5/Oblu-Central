/**
 * Admin — Profile Screen
 * 
 * Contains:
 * 1. User Profile Details (username, email, role like previous UI)
 * 2. Appearance & Theme toggle (Light & Dark)
 * 3. Sign Out button
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { PersonAvatar3D } from "@/components/employee/SubAppLogo";
import { fetchHRMSSelfProfileApi } from "@/services/hrmsService";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isDark, colors, setMode } = useTheme();
  const [empGender, setEmpGender] = useState<string>(user?.gender || "");

  useEffect(() => {
    let mounted = true;
    fetchHRMSSelfProfileApi()
      .then((res) => {
        if (mounted && res?.employee?.gender) {
          setEmpGender(res.employee.gender);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const username = user?.username || "Admin";
  const userEmail = user?.email || (user?.username ? `${user.username.toLowerCase()}@nexus.io` : "admin@nexus.io");
  const isAdm =
    (user?.role || "").toLowerCase().includes("admin") ||
    (user?.role || "").toLowerCase().includes("director") ||
    (user?.username || "").toLowerCase() === "infected" ||
    (user?.username || "").toLowerCase() === "akshay_narayan" ||
    (user?.username || "").toLowerCase() === "nitin_aggarwal";

  const userRole = isAdm
    ? (user?.role && !user.role.toLowerCase().includes("salesperson") && !user.role.toLowerCase().includes("employee"))
      ? user.role
      : (username.toLowerCase() === "infected" ? "Super Administrator" : username.toLowerCase().includes("akshay") ? "Managing Director & System Admin" : "Executive Director & System Admin")
    : (user?.role || "Account Executive");

  const initials = user?.name
    ? user.name.split(" ").filter(Boolean).map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()
    : (user?.username ? user.username.substring(0, 2).toUpperCase() : "AD");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(admin)/users"))}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.screenHeading, { color: colors.textPrimary }]}>
            Profile
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: Spacing.screenPadding,
          paddingTop: Spacing.md,
          paddingBottom: Math.max(insets.bottom, 16) + 90,
        }}
      >
        {/* User Details Card (Matches previous UI) */}
        <View
          style={[
            styles.userCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <PersonAvatar3D
            gender={empGender || user?.gender}
            size={60}
            borderWidth={2}
            borderColor={colors.primaryBorder}
          />
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>
              {username}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textMuted }]}>
              {userEmail}
            </Text>
            <View
              style={[
                styles.rolePill,
                { backgroundColor: colors.secondarySurface, borderColor: colors.borderLight },
              ]}
            >
              <Text style={[styles.roleText, { color: colors.primary }]}>
                {userRole}
              </Text>
            </View>
          </View>
        </View>

        {/* Appearance & Theme Toggle (Light & Dark) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            APPEARANCE & THEME
          </Text>
        </View>

        <View
          style={[
            styles.themeCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.themeRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setMode("light")}
              style={[
                styles.themeBtn,
                {
                  backgroundColor: !isDark
                    ? colors.mintTintedSurface
                    : colors.secondarySurface,
                  borderColor: !isDark
                    ? colors.primaryBorder
                    : colors.borderLight,
                },
              ]}
            >
              <Ionicons
                name="sunny-outline"
                size={18}
                color={!isDark ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.themeBtnText,
                  {
                    color: !isDark ? colors.primary : colors.textSecondary,
                    fontFamily: !isDark ? Typography.semiBold : Typography.regular,
                  },
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setMode("dark")}
              style={[
                styles.themeBtn,
                {
                  backgroundColor: isDark
                    ? colors.mintTintedSurface
                    : colors.secondarySurface,
                  borderColor: isDark
                    ? colors.primaryBorder
                    : colors.borderLight,
                },
              ]}
            >
              <Ionicons
                name="moon-outline"
                size={18}
                color={isDark ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.themeBtnText,
                  {
                    color: isDark ? colors.primary : colors.textSecondary,
                    fontFamily: isDark ? Typography.semiBold : Typography.regular,
                  },
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSignOut}
          style={[
            styles.signOutBtn,
            {
              backgroundColor: colors.secondarySurface,
              borderColor: colors.borderLight,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={[styles.signOutText, { color: colors.error }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  screenHeading: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.screenTitle,
    letterSpacing: -0.2,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 14,
    ...Shadows.card,
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: Typography.bold,
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontFamily: Typography.headingSemi,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
  },
  rolePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginTop: 4,
  },
  roleText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.caption,
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
    letterSpacing: 0.6,
  },
  themeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 8,
    marginBottom: 24,
    ...Shadows.card,
  },
  themeRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  themeBtnText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.bodySmall,
  },
  signOutBtn: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signOutText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.button,
  },
});
