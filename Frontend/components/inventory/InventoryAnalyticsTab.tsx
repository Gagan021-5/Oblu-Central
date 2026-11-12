import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
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
  const { colors } = useTheme();
  const section = initialSection;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {section === "contribution"
              ? "Sales Contribution"
              : section === "category"
              ? "Category Analytics"
              : section === "comparison"
              ? "Sales Comparison"
              : "Inventory Report"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
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
});
