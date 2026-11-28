/**
 * App entry point — role-based redirect.
 *
 * Unauthenticated → Login
 * role='admin'    → Admin dashboard
 * role='user'     → Check consent → Consent screen or Status screen
 */

import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { isAdminUser } from "@/services/permissionService";

export default function Index() {
  const { user, permissionProfile, isLoading } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (isLoading) return;

    (async () => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      if (isAdminUser(user, permissionProfile)) {
        router.replace("/(admin)/users");
        return;
      }

      // Non-admin role — direct to Employee Workspace Dashboard (RBAC-filtered)
      router.replace("/(employee)");
    })();
  }, [user, permissionProfile, isLoading]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
