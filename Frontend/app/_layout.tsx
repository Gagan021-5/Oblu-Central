/**
 * Root layout — NEXUS CRM Graphite Mint Design System.
 * Dynamic light & dark theme with persistent ThemeProvider.
 */

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Colors } from "@/constants/theme";
import { View, Text, TextInput, ActivityIndicator, LogBox } from "react-native";
import { registerBackgroundSync } from "@/services/backgroundSync";

// ── Global Accessibility & Responsiveness Guard ──────────────────────────────
// Caps system accessibility font scaling to 1.15x (15% growth) to prevent
// Android skins (e.g. Vivo Funtouch OS, Xiaomi MIUI) with custom display/font
// zoom from blowing out navigation bars, header rows, and metric cards.
if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.maxFontSizeMultiplier = 1.15;

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.15;

LogBox.ignoreLogs([
  "expo-notifications: Custom sound 'default' not found",
  "Custom sound 'default' not found in native app",
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootContent() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "none",
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // General Sans (Local font assets from assets/fonts)
    "GeneralSans-Bold": require("@/assets/fonts/GeneralSans-Bold.otf"),
    "GeneralSans-BoldItalic": require("@/assets/fonts/GeneralSans-BoldItalic.otf"),
    "GeneralSans-Extralight": require("@/assets/fonts/GeneralSans-Extralight.otf"),
    "GeneralSans-ExtralightItalic": require("@/assets/fonts/GeneralSans-ExtralightItalic.otf"),
    "GeneralSans-Italic": require("@/assets/fonts/GeneralSans-Italic.otf"),
    "GeneralSans-Light": require("@/assets/fonts/GeneralSans-Light.otf"),
    "GeneralSans-LightItalic": require("@/assets/fonts/GeneralSans-LightItalic.otf"),
    "GeneralSans-Medium": require("@/assets/fonts/GeneralSans-Medium.otf"),
    "GeneralSans-MediumItalic": require("@/assets/fonts/GeneralSans-MediumItalic.otf"),
    "GeneralSans-Regular": require("@/assets/fonts/GeneralSans-Regular.otf"),
    "GeneralSans-Semibold": require("@/assets/fonts/GeneralSans-Semibold.otf"),
    "GeneralSans-SemiboldItalic": require("@/assets/fonts/GeneralSans-SemiboldItalic.otf"),
    // General Sans Aliases
    "GeneralSans": require("@/assets/fonts/GeneralSans-Regular.otf"),
    "General Sans": require("@/assets/fonts/GeneralSans-Regular.otf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
    // Initialize OS-level background sync worker
    registerBackgroundSync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <RootContent />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
