import { Platform, NativeModules } from "react-native";

let Haptics: any = null;
try {
  // Only bind if native module is actually linked in the current APK binary
  if (NativeModules.ExpoHaptics || NativeModules.Haptics) {
    Haptics = require("expo-haptics");
  }
} catch {
  // Native module not linked
}

/**
 * Triggers a light, non-blocking tactile haptic pulse on native platforms.
 */
export function triggerLightHaptic(): void {
  if (Platform.OS === "web" || !Haptics) return;
  try {
    const res = Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
    if (res && typeof res.catch === "function") {
      res.catch(() => {});
    }
  } catch {
    // Ignore on unsupported simulators/hardware
  }
}

/**
 * Triggers a subtle selection tick haptic on tab/chip/filter interactions.
 */
export function triggerSelectionHaptic(): void {
  if (Platform.OS === "web" || !Haptics) return;
  try {
    const res = Haptics.selectionAsync?.();
    if (res && typeof res.catch === "function") {
      res.catch(() => {});
    }
  } catch {
    // Ignore on unsupported simulators/hardware
  }
}

