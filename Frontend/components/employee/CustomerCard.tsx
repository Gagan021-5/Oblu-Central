import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { StatusPill } from "@/components/ui/StatusPill";
import { Customer } from "@/data/customerTypes";

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
}

const CustomerCardComponent: React.FC<CustomerCardProps> = ({ customer, onPress }) => {
  const { colors, isDark } = useTheme();

  const handleCall = (e: any) => {
    e.stopPropagation?.();
    const phone = customer.phone || "";
    if (phone && phone !== "nan") {
      const cleaned = phone.replace(/[^0-9+]/g, "");
      Linking.openURL(`tel:${cleaned}`).catch(() => {});
    }
  };

  // Safe name & avatar initials
  const customerName = customer.name || (customer as any).companyName || "";
  const initials = customerName
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CU";

  const contactText = customer.contactPerson || "";
  const locationText = customer.city || (customer as any).district || (customer as any).state || "";
  const paymentStatus = customer.paymentStatus || "pending";
  const pillLabel = String(paymentStatus).replace("_", " ");
  const lastContact = customer.lastContactTime || "No recent contact";
  const nextFollowUp = customer.nextFollowUp || "None scheduled";
  const salespersonName = customer.assignedSalesperson || "Unassigned";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#12201B" : "#FFFFFF",
          borderColor: isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
          borderTopColor: isDark ? "rgba(53, 214, 160, 0.38)" : "rgba(255, 255, 255, 0.98)",
          borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
          shadowColor: isDark ? "#000000" : "#0D2B20",
          shadowOpacity: isDark ? 0.46 : 0.09,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Top Row: Avatar + Name/City + Payment Pill */}
      <View style={styles.headerRow}>
        <View style={styles.nameBlock}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: isDark ? "#15221D" : "#DDF4EA",
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
              adjustsFontSizeToFit
              minimumFontScale={0.8}
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

      {/* Footer Row: Quick Call action & Chevron detail */}
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
          >
            {salespersonName}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.callButton,
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
                styles.callButtonText,
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
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  callButtonText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
});
