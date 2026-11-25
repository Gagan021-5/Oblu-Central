/**
 * Background Sync Service
 *
 * Registers a background task that periodically syncs call logs.
 * Uses expo-background-task + expo-task-manager.
 *
 * Background tasks run in development builds / release builds,
 * not inside standard Expo Go.
 */

import * as TaskManager from "expo-task-manager";
import { AppRegistry, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { syncCallLogs } from "@/services/callLogSync";

// ── Task name constant ─────────────────────────────────────────────────
export const CALL_LOG_SYNC_TASK = "CALL_LOG_SYNC_TASK";

// Check if running inside Expo Go
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === "expo";

// ── Lazy import for expo-background-task ────────────────────────────────
let BackgroundTask: any = null;

async function loadBackgroundTask() {
  if (isExpoGo) return;
  try {
    BackgroundTask = require("expo-background-task");
  } catch {
    // Module not available
  }
}

// ── Register Headless JS Task for Call-End & Boot Sync (when app is closed) ─
if (!isExpoGo && Platform.OS === "android") {
  try {
    AppRegistry.registerHeadlessTask("CALL_END_SYNC_TASK", () => async () => {
      try {
        await syncCallLogs();
      } catch {
        // Handled silently in headless background
      }
    });
  } catch {
    // Ignore duplicate registration in fast refresh
  }
}

// ── Define the background task ──────────────────────────────────────────
// Must be called at module scope (outside React component tree)
if (!isExpoGo) {
  try {
    TaskManager.defineTask(CALL_LOG_SYNC_TASK, async () => {
      try {
        console.log("[BackgroundSync] Running call log sync...");
        const result = await syncCallLogs();
        console.log(
          `[BackgroundSync] Done: ${result.synced} synced, ${result.failed} failed`
        );

        if (!BackgroundTask) await loadBackgroundTask();

        if (result.synced > 0 || result.failed > 0) {
          return BackgroundTask?.BackgroundTaskResult?.NewData ?? 1;
        }
        return BackgroundTask?.BackgroundTaskResult?.NoData ?? 2;
      } catch (error) {
        console.error("[BackgroundSync] Error:", error);
        return BackgroundTask?.BackgroundTaskResult?.Failed ?? 3;
      }
    });
  } catch {
    // Ignore task definition errors in dev
  }
}

// ── Registration helper ─────────────────────────────────────────────────

/**
 * Register the background sync task. Call this once after the user
 * grants consent and permissions.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  // In Expo Go, native background tasks are not supported.
  if (isExpoGo) {
    return false;
  }

  if (Platform.OS !== "android") {
    return false;
  }

  await loadBackgroundTask();

  if (!BackgroundTask) {
    return false;
  }

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      CALL_LOG_SYNC_TASK
    );

    if (isRegistered) {
      return true;
    }

    await BackgroundTask.registerTaskAsync(CALL_LOG_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
    });

    console.log("[BackgroundSync] Task registered successfully");
    return true;
  } catch (error) {
    console.error("[BackgroundSync] Failed to register background task:", error);
    return false;
  }
}

/**
 * Unregister the background sync task.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  if (isExpoGo) return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      CALL_LOG_SYNC_TASK
    );
    if (isRegistered) {
      await TaskManager.unregisterTaskAsync(CALL_LOG_SYNC_TASK);
      console.log("[BackgroundSync] Task unregistered");
    }
  } catch (error) {
    console.error("[BackgroundSync] Failed to unregister background task:", error);
  }
}
