import React from "react";
import {
  View,
  Image,
  StyleSheet,
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

const SUBAPP_LOGOS: Record<string, ImageSourcePropType> = {
  all: require("@/assets/subapps/all.webp"),
  hrms: require("@/assets/subapps/hrms.webp"),
  hr: require("@/assets/subapps/hrms.webp"),
  customers: require("@/assets/subapps/customers.webp"),
  customer_data: require("@/assets/subapps/customers.webp"),
  calls: require("@/assets/subapps/calls.webp"),
  call_tracker: require("@/assets/subapps/calls.webp"),
  leads: require("@/assets/subapps/leads.webp"),
  inventory: require("@/assets/subapps/inventory.webp"),
  proforma: require("@/assets/subapps/proforma.webp"),
  incentives: require("@/assets/subapps/incentives.webp"),
  security: require("@/assets/subapps/security.webp"),
};

const AVATAR_LOGOS: Record<"male" | "female" | "default", ImageSourcePropType> = {
  male: require("@/assets/subapps/avatar_male.webp"),
  female: require("@/assets/subapps/avatar_female.webp"),
  default: require("@/assets/subapps/avatar_default.webp"),
};

const METRIC_LOGOS: Record<string, ImageSourcePropType> = {
  "people-outline": require("@/assets/subapps/metric_people.webp"),
  "call-outline": require("@/assets/subapps/calls.webp"),
  "briefcase-outline": require("@/assets/subapps/hrms.webp"),
  "business-outline": require("@/assets/subapps/customers.webp"),
  "time-outline": require("@/assets/subapps/metric_clock.webp"),
  "calendar-outline": require("@/assets/subapps/metric_calendar.webp"),
  "cube-outline": require("@/assets/subapps/inventory.webp"),
  "document-text-outline": require("@/assets/subapps/proforma.webp"),
  "receipt-outline": require("@/assets/subapps/proforma.webp"),
  "trophy-outline": require("@/assets/subapps/incentives.webp"),
  "cash-outline": require("@/assets/subapps/incentives.webp"),
  "trending-up-outline": require("@/assets/subapps/incentives.webp"),
  "cart-outline": require("@/assets/subapps/incentives.webp"),
  "shield-checkmark-outline": require("@/assets/subapps/security.webp"),
  "hardware-chip-outline": require("@/assets/subapps/security.webp"),
  "filter-outline": require("@/assets/subapps/leads.webp"),
  "flash-outline": require("@/assets/subapps/leads.webp"),
  "alert-circle-outline": require("@/assets/subapps/metric_alert.webp"),
  "warning-outline": require("@/assets/subapps/metric_alert.webp"),
  "checkmark-circle-outline": require("@/assets/subapps/metric_check.webp"),
  "checkmark-done-circle-outline": require("@/assets/subapps/metric_check.webp"),
  "checkmark-done-outline": require("@/assets/subapps/metric_check.webp"),
};

/**
 * Resolves the bundled 3D miniature logo asset for a mobile sub-app.
 */
export function getSubAppLogoSource(appId: string): ImageSourcePropType {
  const key = (appId || "all").toLowerCase().trim();
  return SUBAPP_LOGOS[key] || SUBAPP_LOGOS.all;
}

/**
 * Resolves a context-specific 3D miniature icon for dashboard MetricCard tiles.
 */
export function getMetricLogoSource(
  iconName?: string,
  label?: string
): ImageSourcePropType {
  const text = (label || "").toLowerCase();
  if (text.includes("customer") || text.includes("enterprise account")) {
    return SUBAPP_LOGOS.customers;
  }
  if (text.includes("call")) {
    return SUBAPP_LOGOS.calls;
  }
  if (text.includes("leave")) {
    return METRIC_LOGOS["time-outline"];
  }
  if (text.includes("staff") || text.includes("eligible rep")) {
    return METRIC_LOGOS["people-outline"];
  }
  if (text.includes("invoice") || text.includes("quotation")) {
    return SUBAPP_LOGOS.proforma;
  }
  if (iconName && METRIC_LOGOS[iconName]) {
    return METRIC_LOGOS[iconName];
  }
  return SUBAPP_LOGOS.all;
}

/**
 * Resolves the 3D person profile avatar based strictly on registered gender.
 */
export function getPersonAvatarSource(gender?: string | null): ImageSourcePropType {
  const norm = (gender || "").trim().toLowerCase();
  if (norm === "m" || norm === "male") {
    return AVATAR_LOGOS.male;
  }
  if (norm === "f" || norm === "female") {
    return AVATAR_LOGOS.female;
  }
  return AVATAR_LOGOS.default;
}

interface SubAppLogoProps {
  appId: string;
  size?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders the 3D miniature sub-app logo inside a rounded tile frame.
 */
export const SubAppLogo: React.FC<SubAppLogoProps> = React.memo(
  ({
    appId,
    size = 56,
    borderRadius = 16,
    borderWidth = 1,
    borderColor,
    style,
  }) => {
    const { isDark } = useTheme();
    const resolvedBorder =
      borderColor ?? (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(13, 43, 32, 0.10)");
    const backdrop = isDark ? "#141822" : "#EEF7F1";

    return (
      <View
        style={[
          styles.frame,
          {
            width: size,
            height: size,
            borderRadius,
            borderWidth,
            borderColor: resolvedBorder,
            backgroundColor: backdrop,
          },
          style,
        ]}
      >
        <Image
          source={getSubAppLogoSource(appId)}
          style={styles.subappImage}
          resizeMode="contain"
        />
      </View>
    );
  }
);

interface MetricBadge3DProps {
  icon?: string;
  label?: string;
  size?: number;
  borderRadius?: number;
  isHighlight?: boolean;
}

/**
 * Renders the 3D miniature badge on the top-right corner of MetricCard widgets.
 */
export const MetricBadge3D: React.FC<MetricBadge3DProps> = React.memo(
  ({ icon, label, size = 36, borderRadius = 11, isHighlight = false }) => {
    const { isDark } = useTheme();
    const borderColor = isHighlight
      ? isDark
        ? "rgba(16, 185, 129, 0.45)"
        : "rgba(0, 168, 121, 0.28)"
      : isDark
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(13, 43, 32, 0.10)";

    return (
      <View
        style={[
          styles.frame,
          {
            width: size,
            height: size,
            borderRadius,
            borderWidth: 1,
            borderColor,
            backgroundColor: isDark ? "#1A1E2B" : "#EEF7F1",
          },
        ]}
      >
        <Image
          source={getMetricLogoSource(icon, label)}
          style={styles.badgeImage}
          resizeMode="contain"
        />
      </View>
    );
  }
);

interface PersonAvatar3DProps {
  gender?: string | null;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
}

/**
 * Renders a circular 3D profile avatar matching registered male/female gender or default neutral.
 */
export const PersonAvatar3D: React.FC<PersonAvatar3DProps> = React.memo(
  ({ gender, size = 60, borderWidth = 2, borderColor }) => {
    const { isDark } = useTheme();
    const resolvedBorder = borderColor ?? (isDark ? "#35D6A0" : "#00A879");

    return (
      <View
        style={[
          styles.frame,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: resolvedBorder,
            backgroundColor: isDark ? "#1E342B" : "#E8F5EE",
          },
        ]}
      >
        <Image
          source={getPersonAvatarSource(gender)}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  subappImage: {
    width: "88%",
    height: "88%",
  },
  badgeImage: {
    width: "86%",
    height: "86%",
  },
  avatarImage: {
    width: "96%",
    height: "96%",
  },
});
