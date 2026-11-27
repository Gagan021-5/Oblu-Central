/** API service for the shared AWS Django backend and JWT interceptors. */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { NativeModules, Platform } from "react-native";
import { router } from "expo-router";

const DEFAULT_API_BASE_URL = "http://13.126.98.201/api";

function resolveApiBaseUrl(): string {
  // Use an explicit environment override when provided; Expo's Metro host is
  // only the JavaScript bundler and is not necessarily where Django is running.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  return DEFAULT_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();
console.log("[API] Resolved Backend Base URL:", API_BASE_URL);

// ── Token storage keys ─────────────────────────────────────────────────
const ACCESS_TOKEN_KEY = "calltracer_access_token";
const REFRESH_TOKEN_KEY = "calltracer_refresh_token";

// ── Token helpers ──────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveTokens(
  access: string,
  refresh: string
): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
  if (Platform.OS === "android") {
    try {
      NativeModules?.CallRecordingScanner?.saveSyncConfig?.(
        access,
        refresh,
        API_BASE_URL,
        0
      );
    } catch {}
  }
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  if (Platform.OS === "android") {
    try {
      NativeModules?.CallRecordingScanner?.clearSyncConfig?.();
    } catch {}
  }
}

// ── Axios instance ─────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor: attach JWT ────────────────────────────────────

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 → logout ──────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await clearTokens();
      router.replace("/(auth)/login");
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
