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

/**
 * Resolves the bundled 3D miniature diorama logo asset for a mobile sub-app.
 */
export function getSubAppLogoSource(appId: string): ImageSourcePropType {
  const key = (appId || "all").toLowerCase().trim();
  return SUBAPP_LOGOS[key] || SUBAPP_LOGOS.all;
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
 * Renders the 3D miniature diorama sub-app logo inside a rounded tile frame.
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
      borderColor ?? (isDark ? "#294039" : "rgba(13, 43, 32, 0.10)");
    const backdrop = isDark ? "#12201B" : "#F4F7F5";

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
          style={styles.image}
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
  image: {
    width: "100%",
    height: "100%",
  },
});

