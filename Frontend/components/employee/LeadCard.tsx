import React from "react";
import { View, Text, StyleSheet, Linking, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { StatusPill } from "@/components/ui/StatusPill";
import { Lead } from "@/data/mockLeads";
import { hapticLight, hapticSelection } from "@/utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface QuickActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  isDark: boolean;
  variant?: "primary" | "whatsapp" | "neutral";
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon,
  label,
  onPress,
  isDark,
  variant = "neutral",
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 16, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1.0, { damping: 18, stiffness: 280 });
  };

  const handlePress = (e: any) => {
    e.stopPropagation?.();
    hapticSelection();
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg =
    variant === "primary"
      ? isDark
        ? "rgba(53, 214, 160, 0.16)"
        : "#DDF4EA"
      : variant === "whatsapp"
      ? isDark
        ? "rgba(37, 211, 102, 0.16)"
        : "rgba(37, 211, 102, 0.12)"
      : isDark
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(16, 21, 19, 0.05)";

  const color =
    variant === "primary"
      ? isDark
        ? "#35D6A0"
        : "#00A879"
      : variant === "whatsapp"
      ? isDark
        ? "#25D366"
        : "#128C7E"
      : isDark
      ? "#BAC7C1"
      : "#4E5A55";

  const border =
    variant === "primary"
      ? isDark
        ? "rgba(53, 214, 160, 0.28)"
        : "rgba(0, 168, 121, 0.25)"
      : variant === "whatsapp"
      ? isDark
        ? "rgba(37, 211, 102, 0.30)"
        : "rgba(37, 211, 102, 0.22)"
      : isDark
      ? "rgba(255, 255, 255, 0.09)"
      : "rgba(16, 21, 19, 0.08)";

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        styles.quickActionPill,
        { backgroundColor: bg, borderColor: border },
        animStyle,
      ]}
    >
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.quickActionText, { color }]}>{label}</Text>
    </AnimatedPressable>
  );
};

export interface LeadCardProps {
  lead: Lead;
  index?: number;
  onPress: () => void;
  onQuickAction?: (action: "call" | "whatsapp" | "followup", lead: Lead) => void;
}

const LeadCardComponent: React.FC<LeadCardProps> = ({
  lead,
  index = 0,
  onPress,
  onQuickAction,
}) => {
  const { colors, isDark } = useTheme();
  const cardScale = useSharedValue(1);

  const handleCardPressIn = () => {
    cardScale.value = withSpring(0.975, { damping: 16, stiffness: 280 });
    hapticLight();
  };

  const handleCardPressOut = () => {
    cardScale.value = withSpring(1.0, { damping: 16, stiffness: 280 });
  };

  const handleCall = () => {
    const phone = lead.phone || "";
    if (phone && phone !== "nan") {
      const cleaned = phone.replace(/[^0-9+]/g, "");
      Linking.openURL(`tel:${cleaned}`).catch(() => {});
    }
    onQuickAction?.("call", lead);
  };

  const handleWhatsApp = () => {
    const phone = lead.phone || "";
    if (phone && phone !== "nan") {
      const cleaned = phone.replace(/[^0-9]/g, "");
      Linking.openURL(`https://wa.me/${cleaned}`).catch(() => {});
    }
    onQuickAction?.("whatsapp", lead);
  };

  const handleFollowup = () => {
    onQuickAction?.("followup", lead);
  };

  const displayName = lead.companyName || lead.company || lead.name || "Lead";
  const initials =
    displayName
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
  const isHotLead = intentRaw === "High" || scoreText >= 80;

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const entranceDelay = Math.min(index ?? 0, 8) * 35;

  return (
    <Animated.View
      entering={FadeInDown.delay(entranceDelay).springify().damping(18).stiffness(240)}
      style={cardAnimStyle}
    >
      <AnimatedPressable
        onPressIn={handleCardPressIn}
        onPressOut={handleCardPressOut}
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? "#12151E" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(13, 43, 32, 0.08)",
            borderTopColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.98)",
            borderBottomColor: isDark ? "#0A0D14" : "rgba(13, 43, 32, 0.12)",
            shadowColor: isDark ? "#000000" : "#0D2B20",
            shadowOpacity: isDark ? 0.5 : 0.08,
          },
        ]}
      >
        {/* Top Row: Company & Value + Intent Indicator */}
        <View style={styles.topRow}>
          <View style={styles.leadHeader}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: isDark ? "#1A1E2B" : "#DDF4EA",
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
              label={`${intentRaw} (${scoreText})`}
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
              backgroundColor: isDark ? "#181C27" : "#F7F9F8",
              borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#E8EFEB",
            },
          ]}
        >
          <View style={styles.metaCol}>
            <Text
              style={[
                styles.metaLabel,
                { color: isDark ? "#6E7A8A" : "#87928D" },
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
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC" },
            ]}
          />

          <View style={styles.metaCol}>
            <Text
              style={[
                styles.metaLabel,
                { color: isDark ? "#6E7A8A" : "#87928D" },
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
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC" },
            ]}
          />

          <View style={styles.metaCol}>
            <Text
              style={[
                styles.metaLabel,
                { color: isDark ? "#6E7A8A" : "#87928D" },
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

        {/* Hot Lead Score Glow Highlight */}
        {isHotLead && (
          <View
            style={[
              styles.hotLeadBadge,
              {
                backgroundColor: isDark
                  ? "rgba(53, 214, 160, 0.12)"
                  : "rgba(0, 168, 121, 0.08)",
                borderColor: isDark
                  ? "rgba(53, 214, 160, 0.28)"
                  : "rgba(0, 168, 121, 0.20)",
              },
            ]}
          >
            <Ionicons
              name="flame"
              size={13}
              color={isDark ? "#35D6A0" : "#00A879"}
            />
            <Text
              style={[
                styles.hotLeadText,
                { color: isDark ? "#35D6A0" : "#00A879" },
              ]}
            >
              High Intent Lead ({scoreText}/100) • Prioritize outreach
            </Text>
          </View>
        )}

        {/* Footer: Target Date + 1-Tap Quick Action Strip */}
        <View style={styles.footerRow}>
          <Text
            style={[
              styles.closingDateText,
              { color: isDark ? "#6E7A8A" : "#87928D" },
            ]}
          >
            Target: {closingText}
          </Text>

          {/* 1-Tap Quick Action Pills (Call / WhatsApp / Followup) */}
          <View style={styles.quickActionStrip}>
            <QuickActionButton
              icon="call"
              label="Call"
              onPress={handleCall}
              isDark={isDark}
              variant="primary"
            />
            <QuickActionButton
              icon="logo-whatsapp"
              label="Chat"
              onPress={handleWhatsApp}
              isDark={isDark}
              variant="whatsapp"
            />
            <QuickActionButton
              icon="calendar-outline"
              label="Follow"
              onPress={handleFollowup}
              isDark={isDark}
            />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
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
  hotLeadBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  hotLeadText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
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
  quickActionStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  quickActionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  quickActionText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
});
