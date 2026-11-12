import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { SubAppLogo } from "@/components/employee/SubAppLogo";

interface SubAppCardProps {
  type: "customers" | "leads" | "inventory" | "proforma" | "hrms" | "incentives" | "call_tracker" | "calls";
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
  }[type];

  return (
    <TouchableOpacity
      style={[
        styles.outwardContainer,
        {
          backgroundColor: isDark ? "#12201B" : "#FFFFFF",
          borderColor: isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
          borderTopColor: isDark ? "rgba(53, 214, 160, 0.38)" : "rgba(255, 255, 255, 0.98)",
          borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
          shadowColor: isDark ? "#000000" : "#0D2B20",
          shadowOpacity: isDark ? 0.48 : 0.09,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <SubAppLogo
          appId={type}
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
          <View
            style={[
              styles.arrowCircle,
              {
                backgroundColor: isDark ? "#162721" : "#F4F7F5",
                borderColor: isDark ? "#294039" : "#D8E0DC",
              },
            ]}
          >
            <Ionicons name="arrow-forward" size={15} color={config.color} />
          </View>
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
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
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
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
