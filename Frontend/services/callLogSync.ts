/**
 * Call Log Sync Service
 *
 * Reads call logs using `react-native-call-log`, filters entries newer
 * than the last-synced timestamp, batches them, and POSTs to the backend.
 * Failed batches are queued in AsyncStorage for retry.
 */

import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { getAccessToken } from "@/services/api";

// ── Storage keys ───────────────────────────────────────────────────────
const LAST_SYNC_KEY = "calltracer_last_sync_timestamp";
const RETRY_QUEUE_KEY = "calltracer_retry_queue";
const SYNC_COUNT_KEY = "calltracer_total_synced";
const UPLOADED_RECS_KEY = "calltracer_uploaded_recordings";
const LAST_REC_SCAN_KEY = "calltracer_last_recording_scan";

export interface DeviceRecordingFile {
  uri: string;
  name: string;
  size: number;
  lastModifiedMs: number;
  mimeType: string;
}

// ── Types ──────────────────────────────────────────────────────────────

export interface RawCallLog {
  phoneNumber: string;
  callType: string;
  duration: number; // seconds
  timestamp: number; // unix millis
}

interface SyncableCallLog {
  phone_number: string;
  call_type: "incoming" | "outgoing" | "missed";
  duration: number;
  timestamp: string; // ISO 8601
}

// ── Call type mapping ──────────────────────────────────────────────────

function mapCallType(
  nativeType: string | undefined
): "incoming" | "outgoing" | "missed" {
  if (!nativeType) return "missed";
  const normalized = nativeType.toUpperCase();
  if (normalized.includes("INCOMING") || normalized === "1") return "incoming";
  if (normalized.includes("OUTGOING") || normalized === "2") return "outgoing";
  return "missed";
}

// ── Helpers ────────────────────────────────────────────────────────────

export async function getLastSyncTimestamp(): Promise<number> {
  const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

export async function setLastSyncTimestamp(ts: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, ts.toString());
}

export async function getTotalSyncedCount(): Promise<number> {
  const stored = await AsyncStorage.getItem(SYNC_COUNT_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

async function incrementSyncedCount(count: number): Promise<void> {
  const current = await getTotalSyncedCount();
  await AsyncStorage.setItem(SYNC_COUNT_KEY, (current + count).toString());
}

export async function getLastSyncTime(): Promise<string | null> {
  const ts = await getLastSyncTimestamp();
  if (ts === 0) return null;
  return new Date(ts).toLocaleString();
}

// ── Retry queue ────────────────────────────────────────────────────────

async function getRetryQueue(): Promise<SyncableCallLog[][]> {
  const stored = await AsyncStorage.getItem(RETRY_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function addToRetryQueue(batch: SyncableCallLog[]): Promise<void> {
  const queue = await getRetryQueue();
  queue.push(batch);
  const trimmed = queue.slice(-10);
  await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(trimmed));
}

// ── Read from react-native-call-log ────────────────────────────────────

/**
 * Checks if the native CallLogs module is linked in the current environment.
 * (False in standard Expo Go sandbox, True in Development Build or standalone APK)
 */
export function isNativeCallLogAvailable(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    const turbo = (TurboModuleRegistry as any)?.get?.("CallLogs");
    if (turbo != null) return true;
  } catch {
    //
  }
  return NativeModules?.CallLogs != null;
}

export async function fetchDeviceCallLogs(
  sinceTimestamp: number
): Promise<RawCallLog[]> {
  if (Platform.OS !== "android") return [];

  // Check if native module is present to prevent Expo Go sandbox errors
  if (!isNativeCallLogAvailable()) {
    return [];
  }

  try {
    const CallLogsModule = require("react-native-call-log");
    const CallLogs = CallLogsModule?.default || CallLogsModule;
    if (!CallLogs || !CallLogs.load) return [];

    const filter = sinceTimestamp > 0 ? { minTimestamp: sinceTimestamp } : undefined;
    const logs = await CallLogs.load(-1, filter);

    if (!Array.isArray(logs)) return [];

    return logs.map((log: any) => {
      const ts = log.timestamp ? parseInt(log.timestamp.toString(), 10) : Date.now();
      const dur = typeof log.duration === "number" ? log.duration : parseInt(log.duration || "0", 10);
      return {
        phoneNumber: log.phoneNumber || log.number || "Unknown",
        callType: log.type || (log.rawType ? log.rawType.toString() : "MISSED"),
        duration: Math.max(0, isNaN(dur) ? 0 : dur),
        timestamp: isNaN(ts) ? Date.now() : ts,
      };
    });
  } catch (error: any) {
    console.warn("[CallLogSync] Native call read bypassed:", error?.message || error);
    return [];
  }
}

// ── Core sync logic ────────────────────────────────────────────────────

async function sendBatch(batch: SyncableCallLog[]): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    await api.post("/call-logs/sync/", { call_logs: batch });
    return true;
  } catch (error: any) {
    console.warn("Sync batch failed:", error.message);
    return false;
  }
}

/**
 * Resets the last-sync checkpoint and performs a full device call-log sync.
 */
export async function forceFullResync(): Promise<{
  synced: number;
  failed: number;
  total: number;
  isNative: boolean;
}> {
  await AsyncStorage.removeItem(LAST_SYNC_KEY);
  return syncCallLogs();
}

/**
 * Main sync function — reads call logs, batches, and sends.
 */
export async function syncCallLogs(
  customReader?: (sinceTimestamp: number) => Promise<RawCallLog[]>
): Promise<{ synced: number; failed: number; total: number; isNative: boolean }> {
  const isNative = isNativeCallLogAvailable();
  const lastSync = await getLastSyncTimestamp();

  let rawLogs: RawCallLog[];
  try {
    const reader = customReader || fetchDeviceCallLogs;
    rawLogs = await reader(lastSync);
  } catch (error: any) {
    return { synced: 0, failed: 0, total: 0, isNative };
  }

  const newLogs = lastSync > 0 ? rawLogs.filter((l) => l.timestamp > lastSync) : rawLogs;

  if (!newLogs || newLogs.length === 0) {
    await flushRetryQueue();
    return { synced: 0, failed: 0, total: 0, isNative };
  }

  const syncable: SyncableCallLog[] = newLogs.map((log) => ({
    phone_number: log.phoneNumber || "Unknown",
    call_type: mapCallType(log.callType),
    duration: Math.max(0, log.duration || 0),
    timestamp: new Date(log.timestamp).toISOString(),
  }));

  const BATCH_SIZE = 100;
  const batches: SyncableCallLog[][] = [];
  for (let i = 0; i < syncable.length; i += BATCH_SIZE) {
    batches.push(syncable.slice(i, i + BATCH_SIZE));
  }

  let synced = 0;
  let failed = 0;

  for (const batch of batches) {
    const success = await sendBatch(batch);
    if (success) {
      synced += batch.length;
    } else {
      failed += batch.length;
      await addToRetryQueue(batch);
    }
  }

  if (synced > 0) {
    const newestTimestamp = Math.max(...newLogs.map((l) => l.timestamp));
    await setLastSyncTimestamp(newestTimestamp);
    await incrementSyncedCount(synced);
  }

  await flushRetryQueue();
  await syncCallRecordings(newLogs).catch(() => {});
  return { synced, failed, total: newLogs.length, isNative };
}

/**
 * Option A: Scans the device's built-in dialer call-recording folders
 * and uploads any newly recorded audio files matched to recent calls.
 */
export async function syncCallRecordings(
  recentLogs: RawCallLog[] = []
): Promise<{ uploaded: number }> {
  if (Platform.OS !== "android") return { uploaded: 0 };
  const scanner = NativeModules?.CallRecordingScanner;
  if (!scanner?.findRecentRecordings) return { uploaded: 0 };

  const token = await getAccessToken();
  if (!token) return { uploaded: 0 };

  const storedScan = await AsyncStorage.getItem(LAST_REC_SCAN_KEY);
  const sinceMs = storedScan
    ? Math.max(0, parseInt(storedScan, 10) - 5 * 60 * 1000)
    : Date.now() - 24 * 60 * 60 * 1000;

  let files: DeviceRecordingFile[] = [];
  try {
    files = await scanner.findRecentRecordings(sinceMs);
  } catch {
    return { uploaded: 0 };
  }
  if (!Array.isArray(files) || files.length === 0) {
    await AsyncStorage.setItem(LAST_REC_SCAN_KEY, Date.now().toString());
    return { uploaded: 0 };
  }

  const uploadedRaw = await AsyncStorage.getItem(UPLOADED_RECS_KEY);
  const uploadedSet = new Set<string>(uploadedRaw ? JSON.parse(uploadedRaw) : []);
  let uploaded = 0;

  for (const file of files) {
    const key = `${file.name}_${file.size}`;
    if (uploadedSet.has(key)) continue;

    // Try matching to a synced call log within ±3 minutes of call end
    const matchedLog = recentLogs.find((l) => {
      if (l.duration <= 0) return false;
      const callEnd = l.timestamp + l.duration * 1000;
      return Math.abs(file.lastModifiedMs - callEnd) <= 3 * 60 * 1000;
    });

    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "audio/mp4",
    } as any);
    if (matchedLog) {
      formData.append("phone_number", matchedLog.phoneNumber);
      formData.append("call_type", mapCallType(matchedLog.callType));
      formData.append("duration", String(matchedLog.duration));
      formData.append("timestamp", new Date(matchedLog.timestamp).toISOString());
    } else {
      formData.append("timestamp", new Date(file.lastModifiedMs).toISOString());
    }

    try {
      await api.post("/call-logs/upload-recording/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      uploadedSet.add(key);
      uploaded++;
    } catch {
      // Will retry on next sync cycle
    }
  }

  const trimmed = Array.from(uploadedSet).slice(-300);
  await AsyncStorage.setItem(UPLOADED_RECS_KEY, JSON.stringify(trimmed));
  await AsyncStorage.setItem(LAST_REC_SCAN_KEY, Date.now().toString());
  return { uploaded };
}

/**
 * Pipeline test sync helper — sends sample calls for this employee.
 */
export async function syncTestCallLogs(): Promise<{ synced: number }> {
  const sampleNumbers = [
    "+1 (555) 987-1234",
    "+1 (555) 654-7890",
    "+91 98765 11223",
  ];
  const types: Array<"incoming" | "outgoing" | "missed"> = [
    "incoming",
    "outgoing",
    "missed",
  ];

  const now = Date.now();
  const testBatch: SyncableCallLog[] = sampleNumbers.map((num, i) => ({
    phone_number: num,
    call_type: types[i % types.length],
    duration: types[i] === "missed" ? 0 : 120 + i * 45,
    timestamp: new Date(now - i * 3600000).toISOString(),
  }));

  const success = await sendBatch(testBatch);
  if (success) {
    await setLastSyncTimestamp(now);
    await incrementSyncedCount(testBatch.length);
    return { synced: testBatch.length };
  }
  throw new Error("Backend server did not accept sync batch");
}

async function flushRetryQueue(): Promise<void> {
  const queue = await getRetryQueue();
  if (queue.length === 0) return;

  const remaining: SyncableCallLog[][] = [];

  for (const batch of queue) {
    const success = await sendBatch(batch);
    if (!success) {
      remaining.push(batch);
    } else {
      await incrementSyncedCount(batch.length);
    }
  }

  await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(remaining));
}
