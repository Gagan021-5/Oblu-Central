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
import { Customer } from "@/data/customerTypes";
import { hapticLight, hapticSelection } from "@/utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface QuickActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  isDark: boolean;
  variant?: "primary" | "warning" | "neutral";
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
      : variant === "warning"
      ? isDark
        ? "rgba(239, 68, 68, 0.16)"
        : "rgba(239, 68, 68, 0.10)"
      : isDark
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(16, 21, 19, 0.05)";

  const color =
    variant === "primary"
      ? isDark
        ? "#35D6A0"
        : "#00A879"
      : variant === "warning"
      ? isDark
        ? "#F87171"
        : "#DC2626"
      : isDark
      ? "#BAC7C1"
      : "#4E5A55";

  const border =
    variant === "primary"
      ? isDark
        ? "rgba(53, 214, 160, 0.28)"
        : "rgba(0, 168, 121, 0.25)"
      : variant === "warning"
      ? isDark
        ? "rgba(239, 68, 68, 0.30)"
        : "rgba(239, 68, 68, 0.20)"
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

export interface CustomerCardProps {
  customer: Customer;
  index?: number;
  onPress: () => void;
  onQuickAction?: (action: "call" | "remark" | "followup", customer: Customer) => void;
}

const CustomerCardComponent: React.FC<CustomerCardProps> = ({
  customer,
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
    const phone = customer.phone || "";
    if (phone && phone !== "nan") {
      const cleaned = phone.replace(/[^0-9+]/g, "");
      Linking.openURL(`tel:${cleaned}`).catch(() => {});
    }
    onQuickAction?.("call", customer);
  };

  const handleRemark = () => {
    onQuickAction?.("remark", customer);
  };

  const handleFollowup = () => {
    onQuickAction?.("followup", customer);
  };

  // Safe name & avatar initials
  const customerName = customer.name || (customer as any).companyName || "";
  const initials =
    customerName
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CU";

  const contactText = customer.contactPerson || "";
  const locationText = customer.city || (customer as any).district || (customer as any).state || "";
  const paymentStatus = customer.paymentStatus || "pending";
  const isOverdue = paymentStatus === "overdue";
  const pillLabel = String(paymentStatus).replace("_", " ");
  const lastContact = customer.lastContactTime || "No recent contact";
  const nextFollowUp = customer.nextFollowUp || "None scheduled";
  const salespersonName = customer.assignedSalesperson || "Unassigned";

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // Staggered delay capped at index <= 8 to keep long lists fast
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
        {/* Top Row: Avatar + Name/City + Payment Pill */}
        <View style={styles.headerRow}>
          <View style={styles.nameBlock}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: isDark ? "#1A1E2B" : "#DDF4EA",
                  borderColor: isDark ? "rgba(53, 214, 160, 0.25)" : "rgba(0, 168, 121, 0.25)",
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
                ellipsizeMode="tail"
              >
                {customerName}
              </Text>
              <View style={styles.contactRow}>
                <Text
                  style={[
                    styles.contactPerson,
                    { color: isDark ? "#8FA09A" : "#5E6964" },
                  ]}
                  numberOfLines={1}
                >
                  {[contactText, locationText].filter(Boolean).join(" • ")}
                </Text>
              </View>
            </View>
          </View>

          <StatusPill
            label={pillLabel}
            variant={paymentStatus as any}
            size="small"
          />
        </View>

        {/* Middle Row: Follow-up & Last Contact */}
        <View
          style={[
            styles.metaContainer,
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
              Last Contact
            </Text>
            <Text
              style={[
                styles.metaValue,
                { color: isDark ? "#F1F7F4" : "#101513" },
              ]}
              numberOfLines={1}
            >
              {lastContact}
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
              Next Follow-up
            </Text>
            <Text
              style={[
                styles.metaValueHighlight,
                { color: isDark ? "#35D6A0" : "#00A879" },
              ]}
              numberOfLines={1}
            >
              {nextFollowUp}
            </Text>
          </View>
        </View>

        {/* Overdue Warning Soft Glow Strip if applicable */}
        {isOverdue && (
          <View
            style={[
              styles.overdueBadge,
              {
                backgroundColor: isDark
                  ? "rgba(239, 68, 68, 0.14)"
                  : "rgba(239, 68, 68, 0.08)",
                borderColor: isDark
                  ? "rgba(239, 68, 68, 0.32)"
                  : "rgba(239, 68, 68, 0.22)",
              },
            ]}
          >
            <Ionicons
              name="alert-circle"
              size={13}
              color={isDark ? "#F87171" : "#DC2626"}
            />
            <Text
              style={[
                styles.overdueText,
                { color: isDark ? "#F87171" : "#DC2626" },
              ]}
            >
              Payment Overdue • Outstanding action required
            </Text>
          </View>
        )}

        {/* Footer Row: Quick Action Mini-Pill Drawer + Salesperson */}
        <View style={styles.footerRow}>
          <View style={styles.salespersonRow}>
            <Ionicons
              name="person-circle-outline"
              size={14}
              color={isDark ? "#8FA09A" : "#5E6964"}
            />
            <Text
              style={[
                styles.salespersonText,
                { color: isDark ? "#8FA09A" : "#5E6964" },
              ]}
              numberOfLines={1}
            >
              {salespersonName}
            </Text>
          </View>

          {/* 1-Tap Quick Action Pills (Zomato/Swiggy Tactile Strip) */}
          <View style={styles.quickActionStrip}>
            <QuickActionButton
              icon="call"
              label="Call"
              onPress={handleCall}
              isDark={isDark}
              variant="primary"
            />
            <QuickActionButton
              icon="chatbubble-ellipses-outline"
              label={
                ((customer as any).remarks_count ?? (customer as any).remarksCount ?? (customer.remarks?.length || 0)) > 0
                  ? `Remark (${(customer as any).remarks_count ?? (customer as any).remarksCount ?? customer.remarks?.length})`
                  : "Remark"
              }
              onPress={handleRemark}
              isDark={isDark}
            />
            <QuickActionButton
              icon="calendar-outline"
              label="Follow-up"
              onPress={handleFollowup}
              isDark={isDark}
            />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

export const CustomerCard = React.memo(CustomerCardComponent);

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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  nameBlock: {
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
  contactRow: {
    marginTop: 2,
  },
  contactPerson: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
  },
  metaContainer: {
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
  metaValue: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.medium,
  },
  metaValueHighlight: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.bold,
  },
  metaDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  overdueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  overdueText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  salespersonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  salespersonText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    flexShrink: 1,
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
