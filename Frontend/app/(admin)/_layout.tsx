import React from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { FloatingTabBar } from "@/components/employee/FloatingTabBar";

export default function AdminLayout() {
  const { t } = useEmployeeTheme();

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          animation: "none",
        }}
      >
        <Stack.Screen name="users" options={{ animation: "none" }} />
        <Stack.Screen name="customers" options={{ animation: "none" }} />
        <Stack.Screen name="call-logs" options={{ animation: "none" }} />
        <Stack.Screen name="more" options={{ animation: "none" }} />
        <Stack.Screen name="hrms" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="inventory" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="proforma" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="incentives" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="security" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="leads" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="stats" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="customer-dashboard" options={{ animation: "slide_from_right" }} />
      </Stack>

      {/* Persistent Floating Bottom Navigation (Clean 4-tab dock) */}
      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
