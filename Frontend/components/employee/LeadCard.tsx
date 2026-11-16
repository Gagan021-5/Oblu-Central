import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { StatusPill } from "@/components/ui/StatusPill";
import { Lead } from "@/data/mockLeads";

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
}

const LeadCardComponent: React.FC<LeadCardProps> = ({ lead, onPress }) => {
  const { colors, isDark } = useTheme();

  const handleCall = (e: any) => {
    e.stopPropagation?.();
    const phone = lead.phone || "";
    if (phone && phone !== "nan") {
      const cleaned = phone.replace(/[^0-9+]/g, "");
      Linking.openURL(`tel:${cleaned}`).catch(() => {});
    }
  };

  const displayName = lead.companyName || lead.company || lead.name || "Lead";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "LD";

  const intentRaw = lead.intentLevel || lead.intent || "Medium";
  const intentVariant =
    intentRaw === "High"
      ? "high_intent"
      : intentRaw === "Medium"
      ? "medium_intent"
      : "low_intent";

  const contactText = lead.contactPerson || lead.name || "Contact";
  const sourceText = lead.leadSource || (lead as any).source_name || "Website";
  const stageText = lead.stage || (lead as any).stage_name || "New";
  const estValueText = lead.estimatedValue || "₹0";
  const followUpText = (lead.nextFollowUp || (lead as any).followup_note || "None scheduled").split(",")[0];
  const closingText = lead.expectedClosingDate || "Open";
  const scoreText = lead.intentScore ?? 80;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#12201B" : "#FFFFFF",
          borderColor: isDark ? "rgba(32, 227, 173, 0.18)" : "rgba(13, 43, 32, 0.08)",
          borderTopColor: isDark ? "rgba(32, 227, 173, 0.38)" : "rgba(255, 255, 255, 0.98)",
          borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
          shadowColor: isDark ? "#000000" : "#0D2B20",
          shadowOpacity: isDark ? 0.46 : 0.09,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Top Row: Company & Value + Intent Indicator */}
      <View style={styles.topRow}>
        <View style={styles.leadHeader}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: isDark ? "#15221D" : "#DDF4EA",
                borderColor: isDark
                  ? "rgba(53, 214, 160, 0.25)"
                  : "rgba(0, 168, 121, 0.25)",
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: isDark ? "#35D6A0" : "#00A879" },
              ]}
            >
              {initials}
            </Text>
          </View>
          <View style={styles.titleInfo}>
            <Text
              style={[
                styles.companyName,
                { color: isDark ? "#F1F7F4" : "#101513" },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {displayName}
            </Text>
            <Text
              style={[
                styles.contactPerson,
                { color: isDark ? "#8FA09A" : "#5E6964" },
              ]}
              numberOfLines={1}
            >
              {contactText} • {sourceText}
            </Text>
          </View>
        </View>

        <View style={styles.pillsCol}>
          <StatusPill
            label={`${intentRaw} Intent (${scoreText})`}
            variant={intentVariant}
            size="small"
          />
        </View>
      </View>

      {/* Middle Row: Stage & Estimated Value Bar */}
      <View
        style={[
          styles.middleBar,
          {
            backgroundColor: isDark ? "#121F1B" : "#F7F9F8",
            borderColor: isDark ? "#1C2D26" : "#E8EFEB",
          },
        ]}
      >
        <View style={styles.metaCol}>
          <Text
            style={[
              styles.metaLabel,
              { color: isDark ? "#65756F" : "#87928D" },
            ]}
          >
            Stage
          </Text>
          <Text
            style={[
              styles.stageText,
              { color: isDark ? "#35D6A0" : "#00A879" },
            ]}
          >
            {stageText}
          </Text>
        </View>

        <View
          style={[
            styles.metaDivider,
            { backgroundColor: isDark ? "#294039" : "#D8E0DC" },
          ]}
        />

        <View style={styles.metaCol}>
          <Text
            style={[
              styles.metaLabel,
              { color: isDark ? "#65756F" : "#87928D" },
            ]}
          >
            Estimated Value
          </Text>
          <Text
            style={[
              styles.valueText,
              { color: isDark ? "#F1F7F4" : "#101513" },
            ]}
          >
            {estValueText}
          </Text>
        </View>

        <View
          style={[
            styles.metaDivider,
            { backgroundColor: isDark ? "#294039" : "#D8E0DC" },
          ]}
        />

        <View style={styles.metaCol}>
          <Text
            style={[
              styles.metaLabel,
              { color: isDark ? "#65756F" : "#87928D" },
            ]}
          >
            Follow-up
          </Text>
          <Text
            style={[
              styles.metaLabelValue,
              { color: isDark ? "#8FA09A" : "#5E6964" },
            ]}
            numberOfLines={1}
          >
            {followUpText}
          </Text>
        </View>
      </View>

      {/* Footer: Quick call + Chevron */}
      <View style={styles.footerRow}>
        <Text
          style={[
            styles.closingDateText,
            { color: isDark ? "#65756F" : "#87928D" },
          ]}
        >
          Target: {closingText}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.callBtn,
              {
                backgroundColor: isDark
                  ? "rgba(53, 214, 160, 0.12)"
                  : "#DDF4EA",
                borderColor: isDark
                  ? "rgba(53, 214, 160, 0.25)"
                  : "rgba(0, 168, 121, 0.25)",
              },
            ]}
            onPress={handleCall}
            activeOpacity={0.7}
          >
            <Ionicons
              name="call"
              size={13}
              color={isDark ? "#35D6A0" : "#00A879"}
            />
            <Text
              style={[
                styles.callBtnText,
                { color: isDark ? "#35D6A0" : "#00A879" },
              ]}
            >
              Call
            </Text>
          </TouchableOpacity>

          <Ionicons
            name="chevron-forward"
            size={16}
            color={isDark ? "#65756F" : "#87928D"}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const LeadCard = React.memo(LeadCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 14,
    marginBottom: 10,
    zIndex: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  leadHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.bold,
  },
  titleInfo: {
    flex: 1,
    minWidth: 0,
  },
  companyName: {
    fontSize: FontSizes.body,
    fontFamily: Typography.semiBold,
    letterSpacing: -0.2,
  },
  contactPerson: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  pillsCol: {
    alignItems: "flex-end",
  },
  middleBar: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
    marginBottom: 2,
  },
  stageText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.bold,
  },
  valueText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.bold,
  },
  metaLabelValue: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.medium,
  },
  metaDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closingDateText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  callBtnText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
});
