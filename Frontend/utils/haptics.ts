import { Platform, Vibration } from "react-native";

/**
 * Triggers a light, non-blocking tactile haptic pulse on native platforms.
 * Uses React Native core Vibration to guarantee stability across all Android
 * and iOS runtime engines without suspend export or linking crashes.
 */
export function triggerLightHaptic(): void {
  if (Platform.OS === "web") return;
  try {
    // 10ms micro pulse for tactile feedback
    Vibration.vibrate(10);
  } catch {
    // Silently ignore on unsupported hardware/simulators
  }
}

/**
 * Triggers a subtle selection tick on tab/chip/filter interactions.
 */
export function triggerSelectionHaptic(): void {
  if (Platform.OS === "web") return;
  try {
    // 6ms minimal selection tick
    Vibration.vibrate(6);
  } catch {
    // Silently ignore on unsupported hardware/simulators
  }
}
