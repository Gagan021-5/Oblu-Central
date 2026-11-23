import React, { useRef } from "react";
import { TouchableOpacity, StyleSheet, Animated, StyleProp, ViewStyle } from "react-native";
import { router, usePathname } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { SubAppLogo } from "@/components/employee/SubAppLogo";
import { triggerLightHaptic } from "@/utils/haptics";

interface SubAppHomeButtonProps {
  isAdmin?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 3D Clay Home Button for Sub-App Headers.
 * Tapping triggers light haptic feedback and navigates directly back to Main Home.
 */
export const SubAppHomeButton: React.FC<SubAppHomeButtonProps> = React.memo(
  ({ isAdmin, size = 42, style }) => {
    const { isDark, colors } = useTheme();
    const { user, permissionProfile } = useAuth();
    const pathname = usePathname();

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const roleText = `${user?.role || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
    const isSuperOrAdmin =
      isAdmin ?? (pathname.includes("(admin)") || roleText.includes("admin") || roleText.includes("superuser"));

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.90,
        useNativeDriver: true,
        friction: 6,
        tension: 300,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1.0,
        useNativeDriver: true,
        friction: 5,
        tension: 250,
      }).start();
    };

    const handlePress = () => {
      triggerLightHaptic();
      const targetRoute = isSuperOrAdmin ? "/(admin)/users" : "/(employee)";
      // Cleanly replace route so back stack does not accumulate deep circular loops
      router.replace(targetRoute as any);
    };

    const iconSize = Math.round(size * 0.72);
    const containerRadius = Math.round(size * 0.34);

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Go to Main Home"
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: containerRadius,
              backgroundColor: isDark ? "#162520" : "#FFFFFF",
              borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#E4EAF0",
              shadowColor: isDark ? "#000000" : "#0D2B20",
            },
            style,
          ]}
        >
          <SubAppLogo appId="home" size={iconSize} borderRadius={0} />
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
});
