/**
 * Temporary production rollout gate:
 * Only Customer Dashboard and Calls are live; all other sub-apps route to /maintenance.
 */

export const ACTIVE_SUB_APPS = new Set<string>([
  "all",
  "customers",
  "customer-dashboard",
  "calls",
  "call-logs",
]);

export const SUB_APP_LABELS: Record<string, string> = {
  hrms: "HRMS & Attendance",
  leads: "Leads & Pipeline",
  inventory: "Inventory & Warehouse",
  proforma: "Proforma Invoices",
  incentives: "Incentives & Commissions",
  security: "Team Devices & Security",
};

export function isSubAppUnderMaintenance(appId: string): boolean {
  return !ACTIVE_SUB_APPS.has(appId.toLowerCase());
}

export function getMaintenanceRoute(appId: string): {
  pathname: "/maintenance";
  params: { app: string };
} {
  const key = appId.toLowerCase();
  const label = SUB_APP_LABELS[key] || appId;
  return {
    pathname: "/maintenance",
    params: { app: label },
  };
}
