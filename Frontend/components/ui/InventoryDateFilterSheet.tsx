import React, { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { FontSizes, Radius, Typography } from "@/constants/theme";

interface InventoryDateFilterSheetProps {
  visible: boolean;
  startDate: string;
  endDate: string;
  isCustom: boolean;
  onApply: (start: string, end: string) => void;
  onReset: () => void;
  onClose: () => void;
}

interface DatePreset {
  id: string;
  label: string;
  start: string;
  end: string;
  sublabel?: string;
}

const MONTH_PRESETS: DatePreset[] = [
  { id: "oct_2026", label: "October 2026", start: "2026-10-01", end: "2026-10-31", sublabel: "Full Month (1–31)" },
  { id: "sep_2026", label: "September 2026", start: "2026-09-01", end: "2026-09-30", sublabel: "Full Month (1–30)" },
  { id: "aug_2026", label: "August 2026", start: "2026-08-01", end: "2026-08-31", sublabel: "Full Month (1–31)" },
  { id: "jul_2026", label: "July 2026", start: "2026-07-01", end: "2026-07-31", sublabel: "Full Month (1–31)" },
  { id: "jun_2026", label: "June 2026", start: "2026-06-01", end: "2026-06-30", sublabel: "Full Month (1–30)" },
  { id: "may_2026", label: "May 2026", start: "2026-05-01", end: "2026-05-31", sublabel: "Full Month (1–31)" },
  { id: "apr_2026", label: "April 2026", start: "2026-04-01", end: "2026-04-30", sublabel: "Full Month (1–30)" },
];

const QUARTER_PRESETS: DatePreset[] = [
  { id: "q2_fy26", label: "Q2 FY26", start: "2026-07-01", end: "2026-09-30", sublabel: "Jul – Sep (92 Days)" },
  { id: "q1_fy26", label: "Q1 FY26", start: "2026-04-01", end: "2026-06-30", sublabel: "Apr – Jun (91 Days)" },
];

export function InventoryDateFilterSheet({
  visible,
  startDate,
  endDate,
  isCustom,
  onApply,
  onReset,
  onClose,
}: InventoryDateFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const accent = isDark ? "#35D6A0" : "#159A7C";

  const [fromInput, setFromInput] = useState(startDate);
  const [toInput, setToInput] = useState(endDate);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (visible) {
      setFromInput(startDate || "2026-10-01");
      setToInput(endDate || "2026-10-31");
      setErrorMsg("");
    }
  }, [visible, startDate, endDate]);

  const selectPreset = (preset: DatePreset) => {
    setFromInput(preset.start);
    setToInput(preset.end);
    setErrorMsg("");
  };

  const handleApply = () => {
    const trimmedStart = fromInput.trim();
    const trimmedEnd = toInput.trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(trimmedStart) || !dateRegex.test(trimmedEnd)) {
      setErrorMsg("Please use valid YYYY-MM-DD format (e.g. 2026-10-01).");
      return;
    }

    if (trimmedStart > trimmedEnd) {
      setErrorMsg("Start date cannot be after End date.");
      return;
    }

    setErrorMsg("");
    onApply(trimmedStart, trimmedEnd);
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const foreground = isDark ? "#F1F7F4" : "#0F172A";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const sheetBg = isDark ? "#111B18" : "#FFFFFF";
  const borderColor = isDark ? "#1E2F29" : "#E2E8F0";
  const inputBg = isDark ? "#172722" : "#F8FAFC";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: sheetBg,
              borderColor,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          {/* Grab Bar */}
          <View style={styles.grabBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calendar-outline" size={20} color={accent} />
                <Text style={[styles.title, { color: foreground }]}>
                  Custom Date Range
                </Text>
              </View>
              <Text style={[styles.subtitle, { color: muted }]}>
                Select any custom range to recalculate all graphs & values.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: inputBg, borderColor }]}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Manual Date Inputs */}
            <Text style={[styles.sectionLabel, { color: foreground }]}>
              DATE RANGE (YYYY-MM-DD)
            </Text>

            <View style={styles.dateInputsRow}>
              <View style={styles.inputFieldWrap}>
                <Text style={[styles.inputSublabel, { color: muted }]}>FROM</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor,
                      color: foreground,
                    },
                  ]}
                  value={fromInput}
                  onChangeText={(val) => {
                    setFromInput(val);
                    setErrorMsg("");
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={muted}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </View>

              <Ionicons
                name="arrow-forward"
                size={18}
                color={muted}
                style={{ marginTop: 22, marginHorizontal: 4 }}
              />

              <View style={styles.inputFieldWrap}>
                <Text style={[styles.inputSublabel, { color: muted }]}>TO</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor,
                      color: foreground,
                    },
                  ]}
                  value={toInput}
                  onChangeText={(val) => {
                    setToInput(val);
                    setErrorMsg("");
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={muted}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color="#DC2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Quick Month Selectors */}
            <Text style={[styles.sectionLabel, { color: foreground, marginTop: 18 }]}>
              QUICK MONTH SELECTOR
            </Text>
            <View style={styles.presetGrid}>
              {MONTH_PRESETS.map((p) => {
                const isSelected = fromInput === p.start && toInput === p.end;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => selectPreset(p)}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(21, 154, 124, 0.2)"
                            : "#E2F7F1"
                          : inputBg,
                        borderColor: isSelected ? accent : borderColor,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetCardLabel,
                        {
                          color: isSelected ? accent : foreground,
                          fontFamily: isSelected ? Typography.bold : Typography.semiBold,
                        },
                      ]}
                    >
                      {p.label}
                    </Text>
                    {p.sublabel && (
                      <Text style={[styles.presetCardSub, { color: muted }]}>
                        {p.sublabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quarterly Presets */}
            <Text style={[styles.sectionLabel, { color: foreground, marginTop: 18 }]}>
              QUARTERLY PRESETS
            </Text>
            <View style={styles.presetGrid}>
              {QUARTER_PRESETS.map((p) => {
                const isSelected = fromInput === p.start && toInput === p.end;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => selectPreset(p)}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(21, 154, 124, 0.2)"
                            : "#E2F7F1"
                          : inputBg,
                        borderColor: isSelected ? accent : borderColor,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetCardLabel,
                        {
                          color: isSelected ? accent : foreground,
                          fontFamily: isSelected ? Typography.bold : Typography.semiBold,
                        },
                      ]}
                    >
                      {p.label}
                    </Text>
                    {p.sublabel && (
                      <Text style={[styles.presetCardSub, { color: muted }]}>
                        {p.sublabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footerRow, { borderTopColor: borderColor }]}>
            {isCustom && (
              <TouchableOpacity
                onPress={handleReset}
                style={[styles.resetButton, { borderColor }]}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#DC2626" />
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleApply}
              style={[styles.applyButton, { backgroundColor: accent }]}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
              <Text style={styles.applyButtonText}>Apply Custom Range</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "88%",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#94A3B8",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: Typography.bold,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollBody: {
    maxHeight: 400,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Typography.bold,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  dateInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputFieldWrap: {
    flex: 1,
  },
  inputSublabel: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  textInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: Typography.semiBold,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    marginTop: 8,
  },
  errorText: {
    fontSize: 11,
    color: "#DC2626",
    fontFamily: Typography.medium,
    flex: 1,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetCard: {
    flexBasis: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  presetCardLabel: {
    fontSize: 12,
  },
  presetCardSub: {
    fontSize: 10,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resetButtonText: {
    fontSize: 13,
    color: "#DC2626",
    fontFamily: Typography.semiBold,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#159A7C",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  applyButtonText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: Typography.bold,
  },
});
