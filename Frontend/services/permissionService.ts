/**
 * Permission Service — connects to Django DRF access control / auth endpoints.
 * Returns authenticated user details, allowed apps, active roles, and hierarchy scope.
 */

import api from "./api";

export interface AllowedApp {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
}

export interface SubordinateUser {
  id: number;
  salesperson_id?: number | null;
  username: string;
  name: string;
  role: string;
}

export interface HierarchyScope {
  can_view_all_salespersons: boolean;
  subordinates: SubordinateUser[];
}

export interface UserRoleItem {
  key: string;
  name: string;
  temporary?: boolean;
  expires_at?: string | null;
}

export interface UserPermissionProfile {
  user: {
    id: number;
    username: string;
    name: string;
    role: string;
    gender?: string | null;
    reporting_to?: string | null;
  };
  allowed_apps: AllowedApp[];
  hierarchy_scope: HierarchyScope;
  permissions: string[];
  roles?: UserRoleItem[];
  scopes?: Record<string, string[]>;
  user_id?: number;
  full_name?: string;
  gender?: string | null;
  email?: string;
}

export const DEFAULT_ALLOWED_APPS: AllowedApp[] = [
  // Intentionally empty: visible apps must come from the authenticated RBAC API.
];

export async function fetchUserPermissionsApi(): Promise<UserPermissionProfile> {
  try {
    const res = await api.get<UserPermissionProfile>("/access-control/my-permissions/");
    if (res.data && res.data.user && Array.isArray(res.data.allowed_apps)) {
      return res.data;
    }
  } catch {
    // Try secondary endpoint
  }

  try {
    const res = await api.get<UserPermissionProfile>("/auth/me/");
    if (res.data && res.data.user && Array.isArray(res.data.allowed_apps)) {
      return res.data;
    }
  } catch {
    // Fallback handled below
  }

  // Fail closed. Never substitute a privileged demo profile when the server
  // permission endpoints are unavailable; that makes every signed-in account
  // appear to have Business Manager access.
  return {
    user: { id: 0, username: "", name: "", role: "Employee" },
    allowed_apps: [],
    hierarchy_scope: { can_view_all_salespersons: false, subordinates: [] },
    roles: [],
    permissions: [],
  };
}

export function hasPermission(
  profile: UserPermissionProfile | null,
  permissionKey: string
): boolean {
  if (!profile || !profile.permissions) return false;
  if (profile.permissions.includes("*")) return true;
  return profile.permissions.includes(permissionKey);
}

export function hasRole(
  profile: UserPermissionProfile | null,
  roleKey: string
): boolean {
  if (!profile || !profile.roles) return false;
  const target = roleKey.toLowerCase();
  return profile.roles.some((r) => r.key.toLowerCase() === target || r.name.toLowerCase().includes(target));
}
