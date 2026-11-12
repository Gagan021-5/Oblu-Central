import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius } from "@/constants/theme";
import { SalesContributionSection } from "./analytics/SalesContributionSection";
import { CategoryAnalyticsSection } from "./analytics/CategoryAnalyticsSection";
import { SalesComparisonSection } from "./analytics/SalesComparisonSection";
import { InventoryReportSection } from "./analytics/InventoryReportSection";

interface InventoryAnalyticsTabProps {
  initialSection?: "contribution" | "category" | "comparison" | "report";
  onOpenProduct?: (itemId: string, tab?: "forecast" | "trends" | "ledger") => void;
}

export function InventoryAnalyticsTab({
  initialSection = "contribution",
  onOpenProduct,
}: InventoryAnalyticsTabProps) {
  const { colors, isDark } = useTheme();
  const [section, setSection] = useState<"contribution" | "category" | "comparison" | "report">(
    initialSection
  );

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);

  const cardBorder = isDark ? "#1E332D" : "#E2E8F0";
  const foreground = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: foreground }]}>
            {section === "contribution"
              ? "Sales Contribution"
              : section === "category"
              ? "Category Analytics"
              : section === "comparison"
              ? "Sales Comparison"
              : "Inventory Report"}
          </Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            {section === "contribution"
              ? "Revenue share rankings & invoice sales ledger by item"
              : section === "category"
              ? "Product growth trends & churned / rising customer intelligence"
              : section === "comparison"
              ? "Category-wise & product-wise period velocity comparison"
              : "Complete catalog thresholds, LR, GPT & closing predictions"}
          </Text>
        </View>
      </View>

      {/* 4-Way Intelligence & Reports Switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScroll}
      >
        <TouchableOpacity
          onPress={() => setSection("contribution")}
          style={[
            styles.tabPill,
            section === "contribution" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="pie-chart-outline"
            size={13}
            color={section === "contribution" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "contribution" ? "#FFFFFF" : muted,
                fontFamily: section === "contribution" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Sales Contribution
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSection("category")}
          style={[
            styles.tabPill,
            section === "category" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="bar-chart-outline"
            size={13}
            color={section === "category" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "category" ? "#FFFFFF" : muted,
                fontFamily: section === "category" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Category Analytics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSection("comparison")}
          style={[
            styles.tabPill,
            section === "comparison" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={13}
            color={section === "comparison" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "comparison" ? "#FFFFFF" : muted,
                fontFamily: section === "comparison" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Sales Comparison
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSection("report")}
          style={[
            styles.tabPill,
            section === "report" && { backgroundColor: "#00A879", borderColor: "#00A879" },
            { borderColor: cardBorder },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={13}
            color={section === "report" ? "#FFFFFF" : muted}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[
              styles.tabPillText,
              {
                color: section === "report" ? "#FFFFFF" : muted,
                fontFamily: section === "report" ? Typography.bold : Typography.medium,
              },
            ]}
          >
            Inventory Report
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {section === "contribution" && <SalesContributionSection />}
      {section === "category" && <CategoryAnalyticsSection />}
      {section === "comparison" && <SalesComparisonSection />}
      {section === "report" && <InventoryReportSection onOpenProduct={onOpenProduct} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontFamily: Typography.bold },
  subtitle: { fontSize: 12, marginTop: 2, fontFamily: Typography.regular },
  tabScroll: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 14,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  tabPillText: { fontSize: 12 },
});
