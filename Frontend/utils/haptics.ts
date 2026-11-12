import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Triggers a light, non-blocking tactile haptic pulse on native platforms.
 */
export function triggerLightHaptic(): void {
  if (Platform.OS === "web") return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore on unsupported simulators/hardware
  }
}

/**
 * Triggers a subtle selection tick haptic on tab/chip/filter interactions.
 */
export function triggerSelectionHaptic(): void {
  if (Platform.OS === "web") return;
  try {
    void Haptics.selectionAsync();
  } catch {
    // Ignore on unsupported simulators/hardware
  }
}

