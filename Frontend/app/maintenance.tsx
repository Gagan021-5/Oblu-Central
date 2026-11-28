import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { Typography } from "@/constants/theme";

export default function MaintenanceScreen() {
  const insets = useSafeAreaInsets();
  const { app } = useLocalSearchParams<{ app?: string }>();
  const { colors } = useTheme();
  const { t, isDark } = useEmployeeTheme();

  const appName = (app && String(app).trim()) || "This Module";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.bg,
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
    >
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? "#192D25" : "#FFFFFF",
              borderColor: t.border,
            },
          ]}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={20} color={t.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: `${colors.primary}18`,
              borderColor: `${colors.primary}40`,
            },
          ]}
        >
          <Ionicons name="construct-outline" size={44} color={colors.primary} />
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: isDark ? "#2D2412" : "#FEF3C7",
              borderColor: isDark ? "#78350F" : "#FDE68A",
            },
          ]}
        >
          <Ionicons name="time-outline" size={14} color="#D97706" />
          <Text style={styles.badgeText}>UNDER MAINTENANCE</Text>
        </View>

        <Text style={[styles.title, { color: t.text }]}>
          {appName} is Under Maintenance
        </Text>

        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          We are currently rolling out{" "}
          <Text style={{ fontFamily: Typography.semiBold, color: t.text }}>
            Customer Dashboard
          </Text>{" "}
          and{" "}
          <Text style={{ fontFamily: Typography.semiBold, color: t.text }}>
            Calls
          </Text>{" "}
          in production first. This module will be available soon.
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Back to Workspace</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Typography.bold,
    color: "#D97706",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 22,
    fontFamily: Typography.bold,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Typography.regular,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 28,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: Typography.bold,
  },
});
