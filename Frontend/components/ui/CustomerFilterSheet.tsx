import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { FontSizes, Radius, Typography } from "@/constants/theme";

export type CustomerPaymentFilter = "all" | "paid" | "pending" | "overdue" | "no_payment";
export type CustomerBalanceFilter = "all" | "outstanding";
export type CustomerSortOption = "default" | "name_asc" | "name_desc" | "outstanding_high" | "outstanding_low";
export type CustomerActivityFilter = "all" | "followup_due" | "payment_pending" | "recently_contacted";


interface CustomerFilterSheetProps {
  visible: boolean;
  activityFilter?: CustomerActivityFilter;
  onActivityFilterChange?: (value: CustomerActivityFilter) => void;
  paymentFilter: CustomerPaymentFilter;
  balanceFilter: CustomerBalanceFilter;
  sortOption: CustomerSortOption;
  salespersonFilter?: string | number;
  onSalespersonFilterChange?: (value: string | number) => void;
  stateFilter?: string;
  onStateFilterChange?: (value: string) => void;
  salespersonOptions?: Array<{ id: number; name: string }>;
  stateOptions?: string[];
  onPaymentFilterChange: (value: CustomerPaymentFilter) => void;
  onBalanceFilterChange: (value: CustomerBalanceFilter) => void;
  onSortOptionChange: (value: CustomerSortOption) => void;
  onClose: () => void;
  onReset: () => void;
}

const PAYMENT_OPTIONS: { value: CustomerPaymentFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "no_payment", label: "No payment" },
];

const SORT_OPTIONS: { value: CustomerSortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "default", label: "Default order", icon: "list-outline" },
  { value: "name_asc", label: "Name: A to Z", icon: "arrow-down-outline" },
  { value: "name_desc", label: "Name: Z to A", icon: "arrow-up-outline" },
  { value: "outstanding_high", label: "Highest outstanding", icon: "trending-up-outline" },
  { value: "outstanding_low", label: "Lowest outstanding", icon: "trending-down-outline" },
];

export function CustomerFilterSheet({
  visible,
  activityFilter = "all",
  onActivityFilterChange,
  paymentFilter,
  balanceFilter,
  sortOption,
  salespersonFilter = "all",
  onSalespersonFilterChange,
  stateFilter = "all",
  onStateFilterChange,
  salespersonOptions = [],
  stateOptions = [],
  onPaymentFilterChange,
  onBalanceFilterChange,
  onSortOptionChange,
  onClose,
  onReset,
}: CustomerFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const accent = isDark ? "#35D6A0" : "#00A879";

  const renderChip = (selected: boolean, label: string, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? (isDark ? "rgba(53, 214, 160, 0.18)" : "#E6F8F2") : colors.card,
          borderColor: selected ? accent : colors.cardBorder,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? accent : colors.textPrimary, fontFamily: selected ? Typography.semiBold : Typography.regular }]}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={13} color={accent} style={{ marginLeft: 3 }} /> : null}
    </TouchableOpacity>
  );

  const renderChoice = (selected: boolean, label: string, onPress: () => void, icon?: keyof typeof Ionicons.glyphMap) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? (isDark ? "rgba(53, 214, 160, 0.13)" : "#E6F8F2") : colors.card,
          borderColor: selected ? accent : colors.cardBorder,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={selected ? accent : colors.textMuted} /> : null}
      <Text style={[styles.choiceText, { color: selected ? accent : colors.textPrimary }]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={17} color={accent} /> : null}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close filters" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.cardBorder,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Filter & sort</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Refine your customer directory</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" style={styles.closeButton}>
              <Ionicons name="close" size={21} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionsContent}>
            {onActivityFilterChange ? <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CUSTOMER LIST</Text>
              <View style={styles.optionsGroup}>
                {renderChoice(activityFilter === "all", "All customers", () => onActivityFilterChange("all"))}
                {renderChoice(activityFilter === "followup_due", "Follow-up due", () => onActivityFilterChange("followup_due"))}
                {renderChoice(activityFilter === "payment_pending", "Payment pending", () => onActivityFilterChange("payment_pending"))}
                {renderChoice(activityFilter === "recently_contacted", "Recently contacted", () => onActivityFilterChange("recently_contacted"))}
              </View>
            </> : null}

            <Text style={[styles.sectionLabel, onActivityFilterChange ? styles.sortLabel : null, { color: colors.textSecondary }]}>PAYMENT STATUS</Text>
            <View style={styles.optionsGroup}>
              {PAYMENT_OPTIONS.map((option) =>
                renderChoice(paymentFilter === option.value, option.label, () => onPaymentFilterChange(option.value))
              )}
            </View>

            <Text style={[styles.sectionLabel, styles.sortLabel, { color: colors.textSecondary }]}>OUTSTANDING BALANCE</Text>
            <View style={styles.optionsGroup}>
              {renderChoice(balanceFilter === "all", "Any balance", () => onBalanceFilterChange("all"))}
              {renderChoice(balanceFilter === "outstanding", "Has outstanding balance", () => onBalanceFilterChange("outstanding"))}
            </View>

            {onSalespersonFilterChange ? (
              <>
                <Text style={[styles.sectionLabel, styles.sortLabel, { color: colors.textSecondary }]}>SALESPERSON</Text>
                <View style={styles.chipsWrapContainer}>
                  {renderChip(!salespersonFilter || salespersonFilter === "all", "All Salespersons", () => onSalespersonFilterChange("all"))}
                  {salespersonOptions.map((sp) =>
                    renderChip(
                      String(salespersonFilter) === String(sp.id) || String(salespersonFilter) === sp.name,
                      sp.name,
                      () => onSalespersonFilterChange(sp.id)
                    )
                  )}
                </View>
              </>
            ) : null}

            {onStateFilterChange ? (
              <>
                <Text style={[styles.sectionLabel, styles.sortLabel, { color: colors.textSecondary }]}>STATE / REGION</Text>
                <View style={styles.chipsWrapContainer}>
                  {renderChip(!stateFilter || stateFilter === "all", "All States", () => onStateFilterChange("all"))}
                  {stateOptions.map((st) =>
                    renderChip(stateFilter === st, st, () => onStateFilterChange(st))
                  )}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onReset} activeOpacity={0.75} style={styles.resetButton}>
              <Text style={[styles.resetText, { color: colors.textSecondary }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={[styles.applyButton, { backgroundColor: accent }]}>
              <Text style={styles.applyText}>Show results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  title: {
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.sectionTitle,
  },
  subtitle: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    marginTop: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsContent: {
    paddingBottom: 10,
  },
  sectionLabel: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.micro,
    letterSpacing: 0.7,
    marginTop: 4,
    marginBottom: 10,
  },
  sortLabel: {
    marginTop: 20,
  },
  optionsGroup: {
    gap: 10,
  },
  chipsWrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingVertical: 4,
  },
  chip: {
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: FontSizes.bodySmall,
  },
  choice: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  choiceText: {
    flex: 1,
    fontFamily: Typography.medium,
    fontSize: FontSizes.bodySmall,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
  },
  resetButton: {
    minWidth: 82,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  applyButton: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: {
    color: "#FFFFFF",
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
});
