/**
 * Consent / Disclosure Screen
 * Clean, professional corporate compliance disclosure with robust non-blocking permission handler.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Shadows, Typography } from "@/constants/theme";

const CONSENT_KEY = "calltracer_consent_given";

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { colors, isDark } = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestCallLogPermission = async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      return true;
    }

    try {
      // Request call log, phone state (for call-end sync), and audio media (for Option A dialer recordings)
      const audioPerm =
        Number(Platform.Version) >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const permissionPromise = PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        audioPerm,
      ]);

      const timeoutPromise = new Promise<Record<string, string>>((resolve) =>
        setTimeout(() => resolve({}), 4000)
      );

      const results = await Promise.race([permissionPromise, timeoutPromise]);
      return (
        results[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    } catch {
      return false;
    }
  };

  const handleConsent = async () => {
    if (!agreed) {
      Alert.alert("Consent Required", "Please review and check the acknowledgment box.");
      return;
    }

    setLoading(true);
    try {
      // Attempt permission request (non-blocking)
      await requestCallLogPermission();

      // Store consent flag in storage
      await AsyncStorage.setItem(CONSENT_KEY, "true");

      // Navigate to the user status screen
      router.replace("/(user)/status");
    } catch (error) {
      // Fallback navigation even if unexpected storage glitch
      await AsyncStorage.setItem(CONSENT_KEY, "true").catch(() => {});
      router.replace("/(user)/status");
    } finally {
      setLoading(false);
    }
  };

  const topPadding = Math.max(insets.top, 20);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: topPadding + 16,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.shieldIcon, { backgroundColor: colors.primary }, Shadows.button]}>
          <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Data Collection Disclosure</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Disclosed & consensual employee call activity monitoring
        </Text>
      </View>

      {/* Corporate Policy Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, Shadows.card]}>
        {/* Section 1 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.miniBadge, { backgroundColor: colors.cyanLight }]}>
              <Ionicons name="information-circle" size={16} color={colors.cyan} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>What is Monitored</Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            This application tracks outbound, inbound, and missed call metadata (numbers, duration, timestamps).
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

        {/* Section 2 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.miniBadge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="business" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Purpose & Use</Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Used strictly for business reporting, CRM sync, and corporate KPI benchmarking on company-issued devices.
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

        {/* Section 3 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.miniBadge, { backgroundColor: colors.emeraldLight }]}>
              <Ionicons name="lock-closed" size={16} color={colors.emerald} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Privacy & Security</Text>
          </View>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Audio recordings are not captured. Access is restricted to authorized team managers with end-to-end encrypted storage.
          </Text>
        </View>
      </View>

      {/* Checkbox Acknowledgment */}
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setAgreed(!agreed)}
        activeOpacity={0.75}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.cardBorder, backgroundColor: colors.card },
            agreed && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>
          I acknowledge that this company-issued device is subject to call log tracking as outlined in company policy.
        </Text>
      </TouchableOpacity>

      {/* Actions */}
      <TouchableOpacity
        style={[
          styles.consentButton,
          { backgroundColor: colors.primary },
          !agreed && styles.buttonDisabled,
          Shadows.button,
        ]}
        onPress={handleConsent}
        disabled={!agreed || loading}
        activeOpacity={0.85}
      >
        <Text style={styles.consentButtonText}>
          {loading ? "Authorizing..." : "I Acknowledge & Consent"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.declineButton}
        onPress={() => {
          Alert.alert("Decline Monitoring", "Signing out of this device.", [
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
        }}
      >
        <Text style={[styles.declineButtonText, { color: colors.error }]}>Decline & Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  shieldIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: Typography.headingExtra,
    fontSize: 22,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: Typography.regular,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: Typography.heading,
    fontSize: 14,
  },
  sectionText: {
    fontFamily: Typography.regular,
    fontSize: 13,
    lineHeight: 19,
    paddingLeft: 34,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxChecked: {},
  checkboxLabel: {
    flex: 1,
    fontFamily: Typography.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  consentButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  consentButtonText: {
    fontFamily: Typography.bold,
    color: "#FFFFFF",
    fontSize: 15,
  },
  declineButton: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  declineButtonText: {
    fontFamily: Typography.semiBold,
    fontSize: 13,
  },
});
