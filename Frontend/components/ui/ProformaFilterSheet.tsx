import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { FontSizes, Radius, Typography } from "@/constants/theme";

export type ProformaDocTypeFilter = "all" | "proforma" | "quotation";
export type ProformaStatusFilter = "all" | "approved" | "pending" | "billed";
export type ProformaSortOption = "newest" | "oldest" | "amount_high" | "amount_low" | "client_asc";

interface ProformaFilterSheetProps {
  visible: boolean;
  docTypeFilter: ProformaDocTypeFilter;
  statusFilter: ProformaStatusFilter;
  sortOption: ProformaSortOption;
  stats?: {
    approved_count?: number;
    pending_approvals?: number;
    billed_count?: number;
    total_count?: number;
  };
  onDocTypeChange: (val: ProformaDocTypeFilter) => void;
  onStatusChange: (val: ProformaStatusFilter) => void;
  onSortChange: (val: ProformaSortOption) => void;
  onClose: () => void;
  onReset: () => void;
}

const DOC_TYPE_OPTIONS: { value: ProformaDocTypeFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "all", label: "All Documents", icon: "documents-outline" },
  { value: "proforma", label: "Proforma Invoices", icon: "document-text-outline" },
  { value: "quotation", label: "Quotations Only", icon: "reader-outline" },
];

const STATUS_OPTIONS: { value: ProformaStatusFilter; label: string; keyCount?: "approved_count" | "pending_approvals" | "billed_count" | "total_count" }[] = [
  { value: "all", label: "All Statuses", keyCount: "total_count" },
  { value: "approved", label: "Approved", keyCount: "approved_count" },
  { value: "pending", label: "Pending Approvals", keyCount: "pending_approvals" },
  { value: "billed", label: "Billed / Dispatched", keyCount: "billed_count" },
];

const SORT_OPTIONS: { value: ProformaSortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "newest", label: "Newest First", icon: "calendar-outline" },
  { value: "oldest", label: "Oldest First", icon: "time-outline" },
  { value: "amount_high", label: "Highest Amount", icon: "trending-up-outline" },
  { value: "amount_low", label: "Lowest Amount", icon: "trending-down-outline" },
  { value: "client_asc", label: "Client Name (A - Z)", icon: "text-outline" },
];

export function ProformaFilterSheet({
  visible,
  docTypeFilter,
  statusFilter,
  sortOption,
  stats,
  onDocTypeChange,
  onStatusChange,
  onSortChange,
  onClose,
  onReset,
}: ProformaFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const accent = isDark ? "#35D6A0" : "#00A879";

  const isFiltersActive = docTypeFilter !== "all" || statusFilter !== "all" || sortOption !== "newest";

  const renderChoice = (
    selected: boolean,
    label: string,
    onPress: () => void,
    icon?: keyof typeof Ionicons.glyphMap,
    count?: number
  ) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.choice,
        {
          backgroundColor: selected
            ? isDark
              ? "rgba(53, 214, 160, 0.13)"
              : "#E6F8F2"
            : colors.card,
          borderColor: selected ? accent : colors.cardBorder,
        },
      ]}
    >
      <View style={styles.choiceLeft}>
        {icon ? <Ionicons name={icon} size={16} color={selected ? accent : colors.textMuted} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.choiceText, { color: selected ? accent : colors.textPrimary }]}>{label}</Text>
      </View>
      <View style={styles.choiceRight}>
        {count !== undefined && count !== null ? (
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: selected
                  ? isDark
                    ? "rgba(53, 214, 160, 0.25)"
                    : "#D0F2E6"
                  : isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "#F0F3F2",
              },
            ]}
          >
            <Text
              style={[
                styles.countText,
                { color: selected ? accent : colors.textSecondary },
              ]}
            >
              {count}
            </Text>
          </View>
        ) : null}
        {selected ? (
          <Ionicons name="checkmark-circle" size={18} color={accent} style={{ marginLeft: 6 }} />
        ) : null}
      </View>
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
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Filter & Sort</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Proforma Invoices & Quotations
              </Text>
            </View>
            <View style={styles.headerRight}>
              {isFiltersActive ? (
                <TouchableOpacity onPress={onReset} style={styles.resetBtn} activeOpacity={0.7}>
                  <Text style={[styles.resetText, { color: accent }]}>Reset</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* 1. Document Type */}
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>DOCUMENT TYPE</Text>
            <View style={styles.choiceGroup}>
              {DOC_TYPE_OPTIONS.map((opt) =>
                renderChoice(
                  docTypeFilter === opt.value,
                  opt.label,
                  () => onDocTypeChange(opt.value),
                  opt.icon
                )
              )}
            </View>

            {/* 2. Status */}
            <Text style={[styles.sectionHeading, { color: colors.textMuted, marginTop: 16 }]}>APPROVAL & BILLING STATUS</Text>
            <View style={styles.choiceGroup}>
              {STATUS_OPTIONS.map((opt) => {
                const count = opt.keyCount && stats ? stats[opt.keyCount] : undefined;
                return renderChoice(
                  statusFilter === opt.value,
                  opt.label,
                  () => onStatusChange(opt.value),
                  undefined,
                  count
                );
              })}
            </View>

            {/* 3. Sorting */}
            <Text style={[styles.sectionHeading, { color: colors.textMuted, marginTop: 16 }]}>SORT ORDER</Text>
            <View style={styles.choiceGroup}>
              {SORT_OPTIONS.map((opt) =>
                renderChoice(
                  sortOption === opt.value,
                  opt.label,
                  () => onSortChange(opt.value),
                  opt.icon
                )
              )}
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.applyButton, { backgroundColor: accent }]}
              activeOpacity={0.8}
            >
              <Text style={styles.applyButtonText}>
                {isFiltersActive ? "Apply Selected Filters" : "Done"}
              </Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: "85%",
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150, 150, 150, 0.2)",
  },
  title: {
    fontFamily: Typography.bold,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: Typography.regular,
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  resetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetText: {
    fontFamily: Typography.semiBold,
    fontSize: 13,
  },
  scrollContent: {
    paddingVertical: 14,
  },
  sectionHeading: {
    fontFamily: Typography.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  choiceGroup: {
    gap: 8,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  choiceLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  choiceText: {
    fontFamily: Typography.medium,
    fontSize: 14,
  },
  choiceRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontFamily: Typography.bold,
    fontSize: 11,
  },
  footer: {
    paddingTop: 12,
  },
  applyButton: {
    height: 46,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  applyButtonText: {
    fontFamily: Typography.bold,
    fontSize: 15,
    color: "#FFFFFF",
  },
});
