/**
 * Login Screen — NEXUS CRM Graphite Mint Design System.
 * All auth logic and API calls preserved exactly.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { ORG_ROLES, DummyTestUser } from "@/data/rolesData";
import { isAdminUser } from "@/services/permissionService";


function isAdm(u: any) {
  return isAdminUser(u);
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, logout } = useAuth();
  const { colors, isDark } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Required Fields", "Please enter both your username and password.");
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await login(username.trim(), password);
      if (isAdm(loggedUser)) {
        router.replace("/(admin)/users");
      } else {
        router.replace("/(employee)");
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Login failed. Please check your credentials and connection.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRoleLogin = async (targetUser: DummyTestUser) => {
    await logout();
    const pwd = targetUser.password || "test1234";
    setUsername(targetUser.username);
    setPassword(pwd);
    setLoading(true);
    try {
      // 1. Authenticate with real Django backend first
      const loggedUser = await login(targetUser.username, pwd);
      if (isAdm(loggedUser)) {
        router.replace("/(admin)/users");
      } else {
        router.replace("/(employee)");
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "This account could not sign in to the backend. Check its credentials and connection.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const topPadding = Math.max(insets.top, 24);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPadding + 20,
            paddingBottom: Math.max(insets.bottom, 24) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/logo.webp")}
              style={styles.pandaLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
            Oblu
          </Text>
          <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>
            Future is Innovation
          </Text>
        </View>

        {/* Login Card */}
        <View
          style={[
            styles.loginCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: Spacing.xl }]}>
            Sign In
          </Text>

          <View style={styles.form}>
            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Username
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Enter your username"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Password
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 1-Tap Test Role Logins From Org Diagram */}
        <View
          style={[
            styles.quickLoginCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.45)",
            },
          ]}
        >
          <View style={styles.quickHeader}>
            <View style={styles.yellowBadge}>
              <Ionicons name="flash" size={13} color="#D97706" />
              <Text style={styles.yellowBadgeText}>TEST ROLES</Text>
            </View>
            <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>
              1-Tap Role Testing Logins
            </Text>
            <Text style={[styles.quickSubtitle, { color: colors.textMuted }]}>
              Tap any employee below to instantly sign in and inspect their profile & yellow box permissions. All accounts use password <Text style={{ fontFamily: Typography.bold, color: isDark ? "#F59E0B" : "#B45309" }}>test1234</Text>.
            </Text>
          </View>

          {ORG_ROLES.map((role) => (
            <View key={role.key} style={styles.roleGroup}>
              <View style={styles.roleGroupHeader}>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: role.badgeColor + "20",
                      borderColor: role.badgeColor + "55",
                    },
                  ]}
                >
                  <Text style={[styles.roleBadgeText, { color: role.badgeColor }]}>
                    {role.shortTitle}
                  </Text>
                </View>
                <Text style={[styles.roleGroupName, { color: colors.textSecondary }]}>
                  {role.title}
                </Text>
              </View>

              <View style={styles.userChipsRow}>
                {role.users.map((u) => (
                  <TouchableOpacity
                    key={u.username}
                    style={[
                      styles.userChip,
                      {
                        backgroundColor: isDark ? "#121F1B" : "#F7FAF8",
                        borderColor: isDark ? "#294039" : "#D8E0DC",
                      },
                    ]}
                    onPress={() => handleQuickRoleLogin(u)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.chipAvatar,
                        { backgroundColor: role.badgeColor },
                      ]}
                    >
                      <Text style={styles.chipAvatarText}>{u.avatarInitials}</Text>
                    </View>
                    <View style={styles.chipInfo}>
                      <Text
                        style={[styles.chipUserName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {u.name}
                      </Text>
                      <Text
                        style={[
                          styles.chipUsername,
                          { color: isDark ? "#35D6A0" : "#00A879" },
                        ]}
                        numberOfLines={1}
                      >
                        @{u.username}
                      </Text>
                    </View>
                    <View style={styles.loginArrow}>
                      <Ionicons
                        name="arrow-forward-circle"
                        size={20}
                        color={isDark ? "#35D6A0" : "#00A879"}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sub-role branch UI (ASM under RSM Ankush & Aman) */}
              {role.subRole && (
                <View
                  style={[
                    styles.subRoleBox,
                    {
                      backgroundColor: isDark
                        ? "rgba(20, 184, 166, 0.08)"
                        : "rgba(20, 184, 166, 0.05)",
                      borderColor: isDark
                        ? "rgba(20, 184, 166, 0.35)"
                        : "rgba(20, 184, 166, 0.30)",
                    },
                  ]}
                >
                  <View style={styles.subRoleHeader}>
                    <Ionicons
                      name="return-down-forward"
                      size={16}
                      color={isDark ? "#35D6A0" : "#00A879"}
                    />
                    <View
                      style={[
                        styles.subRoleBadge,
                        {
                          backgroundColor: role.subRole.badgeColor + "20",
                          borderColor: role.subRole.badgeColor + "55",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subRoleBadgeText,
                          { color: role.subRole.badgeColor },
                        ]}
                      >
                        {role.subRole.shortTitle}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.subRoleTitle,
                        { color: isDark ? "#A7F3D0" : "#065F46" },
                      ]}
                    >
                      {role.subRole.title}
                    </Text>
                  </View>

                  <View style={styles.userChipsRow}>
                    {role.subRole.users.map((subUser) => (
                      <TouchableOpacity
                        key={subUser.username}
                        style={[
                          styles.userChip,
                          styles.subUserChip,
                          {
                            backgroundColor: isDark ? "#0A1411" : "#FFFFFF",
                            borderColor: isDark
                              ? "rgba(20, 184, 166, 0.45)"
                              : "#BCEBE1",
                          },
                        ]}
                        onPress={() => handleQuickRoleLogin(subUser)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.chipAvatar,
                            { backgroundColor: role.subRole!.badgeColor },
                          ]}
                        >
                          <Text style={styles.chipAvatarText}>
                            {subUser.avatarInitials}
                          </Text>
                        </View>
                        <View style={styles.chipInfo}>
                          <Text
                            style={[
                              styles.chipUserName,
                              { color: colors.textPrimary },
                            ]}
                            numberOfLines={1}
                          >
                            {subUser.name}
                          </Text>
                          <Text
                            style={[
                              styles.chipUsername,
                              { color: isDark ? "#35D6A0" : "#00A879" },
                            ]}
                            numberOfLines={1}
                          >
                            @{subUser.username}
                          </Text>
                        </View>
                        <View style={styles.loginArrow}>
                          <Ionicons
                            name="arrow-forward-circle"
                            size={20}
                            color={isDark ? "#35D6A0" : "#00A879"}
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.screenPadding,
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  pandaLogo: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  brandTitle: {
    fontFamily: Typography.heading,
    fontSize: 26,
    letterSpacing: -0.6,
  },
  brandSubtitle: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.label,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  loginCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xxl,
    ...Shadows.card,
  },
  cardTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
    marginTop: 4,
    marginBottom: Spacing.xxl,
  },
  form: {
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
  },
  eyeIcon: {
    padding: 4,
  },
  submitButton: {
    height: 50,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
    ...Shadows.mintButton,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: Typography.bold,
    color: "#FFFFFF",
    fontSize: FontSizes.button,
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  footerText: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
  },
  linkText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  quickLoginCard: {
    marginTop: 24,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: 18,
    ...Shadows.card,
  },
  quickHeader: {
    marginBottom: 16,
  },
  yellowBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    marginBottom: 8,
  },
  yellowBadgeText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    color: "#D97706",
    letterSpacing: 0.6,
  },
  quickTitle: {
    fontSize: 18,
    fontFamily: Typography.headingSemi,
    letterSpacing: -0.3,
  },
  quickSubtitle: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  roleGroup: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  roleGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  roleGroupName: {
    fontSize: 13,
    fontFamily: Typography.semiBold,
    flex: 1,
  },
  userChipsRow: {
    gap: 8,
  },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  chipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  chipAvatarText: {
    fontSize: 11,
    fontFamily: Typography.bold,
    color: "#FFFFFF",
  },
  chipInfo: {
    flex: 1,
  },
  chipUserName: {
    fontSize: 13,
    fontFamily: Typography.semiBold,
  },
  chipUsername: {
    fontSize: 11,
    fontFamily: Typography.medium,
    marginTop: 1,
  },
  loginArrow: {
    paddingLeft: 4,
  },
  subRoleBox: {
    marginTop: 10,
    marginLeft: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  subRoleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  subRoleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  subRoleBadgeText: {
    fontSize: 9,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
  },
  subRoleTitle: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
    flex: 1,
  },
  subUserChip: {
    marginLeft: 6,
  },
});
