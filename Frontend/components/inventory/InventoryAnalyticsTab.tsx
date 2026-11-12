import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
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

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {initialSection === "contribution"
              ? "Sales Contribution"
              : initialSection === "category"
              ? "Category Analytics"
              : initialSection === "comparison"
              ? "Sales Comparison"
              : "Inventory Report"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {initialSection === "contribution"
              ? "Revenue share rankings & Tax Invoice sales ledger"
              : initialSection === "category"
              ? "Product growth trends & customer intelligence"
              : initialSection === "comparison"
              ? "Category-wise & product-wise velocity comparison"
              : "Catalog thresholds, predictions & expected deliveries"}
          </Text>
        </View>
      </View>

      {initialSection === "contribution" && <SalesContributionSection />}
      {initialSection === "category" && <CategoryAnalyticsSection />}
      {initialSection === "comparison" && <SalesComparisonSection />}
      {initialSection === "report" && <InventoryReportSection onOpenProduct={onOpenProduct} />}
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

