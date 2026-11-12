/**
 * AuthContext — provides authentication state and methods to the entire app.
 *
 * Exposes: user, permissionProfile, isLoading, login(), register(), logout(), refreshProfile()
 * Stores JWT tokens in expo-secure-store.
 * Decodes the JWT and syncs with live RBAC permissions from /access-control/my-permissions/
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import api, {
  saveTokens,
  clearTokens,
  getAccessToken,
} from "@/services/api";
import {
  fetchUserPermissionsApi,
  UserPermissionProfile,
  AllowedApp,
  HierarchyScope,
  UserRoleItem,
} from "@/services/permissionService";

// ── Types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  username: string;
  name?: string;
  email?: string;
  gender?: string;
  role: string;
  consent_given?: boolean;
  roleKey?: string;
  roleTitle?: string;
  permissions?: string[];
  allowed_apps?: AllowedApp[];
  hierarchy_scope?: HierarchyScope;
  roles?: UserRoleItem[];
}

interface AuthContextType {
  user: AuthUser | null;
  permissionProfile: UserPermissionProfile | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserPermissionProfile | null>;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  role?: string;
  first_name?: string;
  manager?: string;
  device_id?: string;
  device_model?: string;
}

// ── JWT Decode helper ──────────────────────────────────────────────────

function decodeJWT(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// ── Context ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  permissionProfile: null,
  isLoading: true,
  login: async () => ({} as AuthUser),
  register: async () => {},
  logout: async () => {},
  refreshProfile: async () => null,
});

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

// ── Provider ───────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissionProfile, setPermissionProfile] = useState<UserPermissionProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncUserProfile = useCallback(async (baseUser: Partial<AuthUser>): Promise<AuthUser> => {
    try {
      const profile = await fetchUserPermissionsApi();
      setPermissionProfile(profile);
      const syncedUser: AuthUser = {
        id: profile.user?.id || baseUser.id || 1,
        username: profile.user?.username || baseUser.username || "",
        name: profile.user?.name || profile.full_name || baseUser.name || (profile.user?.username ? profile.user.username.replace(/_/g, " ") : "Employee"),
        email: profile.email || baseUser.email,
        gender: profile.user?.gender || profile.gender || baseUser.gender || "",
        role: profile.user?.role || baseUser.role || "Employee",
        consent_given: baseUser.consent_given ?? true,
        permissions: profile.permissions || [],
        allowed_apps: profile.allowed_apps || [],
        hierarchy_scope: profile.hierarchy_scope,
        roles: profile.roles || [],
      };
      setUser(syncedUser);
      return syncedUser;
    } catch {
      const fallbackUser: AuthUser = {
        id: baseUser.id || 1,
        username: baseUser.username || "",
        name: baseUser.name || baseUser.username || "Employee",
        email: baseUser.email,
        role: baseUser.role || "Employee",
        consent_given: baseUser.consent_given ?? true,
      };
      setUser(fallbackUser);
      return fallbackUser;
    }
  }, []);

  // Check for existing token on app mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const decoded = decodeJWT(token);
          if (decoded && decoded.exp * 1000 > Date.now()) {
            await syncUserProfile({
              id: decoded.user_id,
              username: decoded.username,
              role: decoded.role,
              consent_given: decoded.consent_given || false,
            });
          } else {
            await clearTokens();
            setUser(null);
          }
        }
      } catch {
        await clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [syncUserProfile]);

  const login = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    await clearTokens();
    const response = await api.post("/auth/login/", { username, password });
    const { access, refresh, user: userData } = response.data;
    if (!access || !refresh) throw new Error("The server did not return an authentication token.");
    await saveTokens(access, refresh);

    return await syncUserProfile({
      id: userData?.id || response.data.user_id,
      username: userData?.username || response.data.username,
      email: userData?.email,
      role: userData?.role || response.data.role,
      consent_given: userData?.consent_given || false,
    });
  }, [syncUserProfile]);

  const register = useCallback(async (data: RegisterData) => {
    await clearTokens();
    const regResp = await api.post("/auth/register/", data);
    const { tokens, user: userData } = regResp.data;

    if (tokens?.access && tokens?.refresh) {
      await saveTokens(tokens.access, tokens.refresh);
      await syncUserProfile({
        id: userData.id,
        username: userData.username,
        role: userData.role,
        consent_given: userData.consent_given || false,
      });
    }
  }, [syncUserProfile]);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
    setPermissionProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await fetchUserPermissionsApi();
      setPermissionProfile(profile);
      if (profile.user) {
        setUser((prev) => ({
          ...prev!,
          name: profile.user.name || profile.full_name || prev?.name,
          role: profile.user.role || prev?.role || "Employee",
          permissions: profile.permissions,
          allowed_apps: profile.allowed_apps,
          hierarchy_scope: profile.hierarchy_scope,
          roles: profile.roles,
        }));
      }
      return profile;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissionProfile,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
