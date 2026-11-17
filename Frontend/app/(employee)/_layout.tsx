import React from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { FloatingTabBar } from "@/components/employee/FloatingTabBar";

export default function EmployeeLayout() {
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
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="profile" options={{ animation: "slide_from_right" }} />
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
