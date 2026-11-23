import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes, Radius, Shadows } from "@/constants/theme";
import { MetricCard } from "@/components/employee/MetricCard";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";

export default function IncentivesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = (user?.role || "").toLowerCase().includes("admin");

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(isAdmin ? "/(admin)/users" : "/(employee)"))}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={isDark ? "#F1F7F4" : "#101513"} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.screenHeading, { color: colors.textPrimary }]}>
            Commissions & Incentives
          </Text>
          <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
            Performance slabs & bonus payout telemetry
          </Text>
        </View>

        <SubAppHomeButton size={38} isAdmin={true} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.metricsRow}>
          <MetricCard
            label="Projected Bonus"
            value="₹42,500"
            subValue="October 2026 forecast"
            icon="trophy-outline"
            isHighlight
          />
          <MetricCard
            label="Target Achieved"
            value="86%"
            subValue="₹12.9L of ₹15L quota"
            icon="trending-up-outline"
          />
        </View>

        {/* Current Slab Highlight Card */}
        <View style={[styles.tierCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.tierHeader}>
            <View
              style={[
                styles.tierIconBox,
                { backgroundColor: isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(245, 158, 11, 0.12)" },
              ]}
            >
              <Ionicons name="medal" size={24} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierTitle, { color: colors.textPrimary }]}>Gold Tier Achiever</Text>
              <Text style={[styles.tierSub, { color: colors.textSecondary }]}>1.5x Base Commission Multiplier</Text>
            </View>
          </View>

          {/* Progress to Next Tier */}
          <View style={styles.progressSection}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Progress to Platinum (₹15L)</Text>
              <Text style={[styles.progressPercent, { color: isDark ? "#35D6A0" : "#00A879" }]}>86%</Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(16, 21, 19, 0.08)" }]}>
              <View style={[styles.progressBarFill, { width: "86%", backgroundColor: isDark ? "#35D6A0" : "#00A879" }]} />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Commission Slabs Breakdown</Text>

        {[
          { title: "Base Achievement (75% Quota)", rate: "1.0% on gross bookings", status: "Unlocked", isDone: true },
          { title: "Silver Achiever (100% Quota)", rate: "1.25% on gross bookings", status: "Unlocked", isDone: true },
          { title: "Gold Tier (125% Quota)", rate: "1.5% + ₹10,000 Milestone Bonus", status: "Current Slab", isCurrent: true },
          { title: "Platinum Club (150% Quota)", rate: "2.0% + Executive Dental Kit Gift", status: "Locked", isLocked: true },
        ].map((slab, i) => (
          <View
            key={i}
            style={[
              styles.slabCard,
              {
                backgroundColor: colors.card,
                borderColor: slab.isCurrent ? (isDark ? "#35D6A0" : "#00A879") : colors.cardBorder,
                borderWidth: slab.isCurrent ? 2 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.slabDot,
                {
                  backgroundColor: slab.isDone
                    ? isDark ? "#35D6A0" : "#00A879"
                    : slab.isCurrent
                    ? "#D97706"
                    : colors.textMuted,
                },
              ]}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.slabTitle, { color: colors.textPrimary }]}>{slab.title}</Text>
              <Text style={[styles.slabRate, { color: colors.textSecondary }]}>{slab.rate}</Text>
            </View>
            <Text
              style={[
                styles.slabStatus,
                {
                  color: slab.isDone
                    ? isDark ? "#35D6A0" : "#00A879"
                    : slab.isCurrent
                    ? "#D97706"
                    : colors.textMuted,
                },
              ]}
            >
              {slab.status}
            </Text>
          </View>
        ))}
      </ScrollView>

          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
  },
  screenHeading: {
    fontFamily: Typography.bold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  screenSub: {
    fontFamily: Typography.medium,
    fontSize: 12,
    marginTop: 1,
  },
  topBarRightPlaceholder: {
    width: 38,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  tierCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    ...Shadows.card,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  tierIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  tierTitle: {
    fontFamily: Typography.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  tierSub: {
    fontFamily: Typography.medium,
    fontSize: 13,
    marginTop: 2,
  },
  progressSection: {
    marginTop: 4,
  },
  progressLabel: {
    fontFamily: Typography.medium,
    fontSize: 12,
  },
  progressPercent: {
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  sectionHeading: {
    fontFamily: Typography.bold,
    fontSize: 16,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  slabCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
    ...Shadows.card,
  },
  slabDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slabTitle: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  slabRate: {
    fontFamily: Typography.medium,
    fontSize: 12,
  },
  slabStatus: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
});
