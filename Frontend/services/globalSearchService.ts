/**
 * Shared Global Search & App-Filtering helpers for Admin and Employee Home screens.
 * Searches across Sub-Apps, Customers, Leads, Proforma Invoices/Quotations,
 * Inventory SKUs, Staff/HRMS Directory, Pending Leaves, and Call Logs.
 */

import api from "./api";
import { fetchCustomersFromApi } from "./customerService";
import { fetchLeadsFromApi } from "./leadService";
import { fetchProformasFromApi, ProformaItem } from "./proformaService";
import { EmployeeDirectoryItem, PendingLeave } from "./hrmsService";
import { Customer } from "@/data/customerTypes";
import { Lead } from "@/data/mockLeads";

export interface SearchableAppItem {
  id: string;
  label: string;
  icon?: string;
}

export interface SearchInventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  unit: string;
  status: string;
}

export interface SearchTelephonyUser {
  id: number;
  username: string;
  email: string;
  role: string;
  device_id?: string | null;
  device_model?: string | null;
}

export interface SearchCallItem {
  id: number;
  user?: number;
  username: string;
  phone_number: string;
  call_type: "incoming" | "outgoing" | "missed";
  duration: number;
  timestamp: string;
}

export interface RemoteGlobalSearchResult {
  customers: Customer[];
  leads: Lead[];
  proformas: ProformaItem[];
  inventory: SearchInventoryItem[];
  calls: SearchCallItem[];
}

export interface UnifiedSearchResults {
  apps: Array<SearchableAppItem & { subtitle: string }>;
  customers: Customer[];
  leads: Lead[];
  proformas: ProformaItem[];
  inventory: SearchInventoryItem[];
  telephonyUsers: SearchTelephonyUser[];
  employees: EmployeeDirectoryItem[];
  leaves: PendingLeave[];
  calls: SearchCallItem[];
  totalCount: number;
}

const APP_SEARCH_META: Record<string, { subtitle: string; keywords: string[] }> = {
  all: {
    subtitle: "Full workspace dashboard overview",
    keywords: ["all", "overview", "dashboard", "home"],
  },
  hrms: {
    subtitle: "Employees, attendance, leaves & payroll",
    keywords: [
      "hrms",
      "hr",
      "human resource",
      "employee",
      "employees",
      "staff",
      "leave",
      "leaves",
      "attendance",
      "punch",
      "salary",
      "payslip",
      "payroll",
      "department",
      "holiday",
      "policy",
    ],
  },
  hr: {
    subtitle: "Employees, attendance, leaves & payroll",
    keywords: ["hrms", "hr", "employee", "leave", "attendance", "payroll"],
  },
  customers: {
    subtitle: "Client directory, payments & follow-ups",
    keywords: [
      "customers",
      "customer",
      "client",
      "clients",
      "account",
      "accounts",
      "outstanding",
      "payment",
      "due",
      "ledger",
      "collection",
      "followup",
    ],
  },
  customer_data: {
    subtitle: "Client directory, payments & follow-ups",
    keywords: ["customers", "customer", "client", "account", "payment"],
  },
  calls: {
    subtitle: "Live telephony, recordings & call logs",
    keywords: [
      "calls",
      "call",
      "telephony",
      "phone",
      "dial",
      "call log",
      "call logs",
      "recording",
      "sim",
      "handset",
    ],
  },
  call_tracker: {
    subtitle: "Live telephony, recordings & call logs",
    keywords: ["calls", "call", "telephony", "phone", "dial", "call log"],
  },
  leads: {
    subtitle: "Sales pipeline, prospects & conversions",
    keywords: ["leads", "lead", "prospect", "prospects", "pipeline", "funnel", "deal", "enquiry"],
  },
  inventory: {
    subtitle: "Stock SKUs, low stock & PO planner",
    keywords: [
      "inventory",
      "stock",
      "item",
      "items",
      "product",
      "products",
      "sku",
      "po",
      "purchase order",
      "tally",
      "warehouse",
      "reorder",
      "dead stock",
    ],
  },
  proforma: {
    subtitle: "Quotations, proforma invoices & dispatch",
    keywords: [
      "proforma",
      "pi",
      "invoice",
      "invoices",
      "quote",
      "quotation",
      "quotations",
      "dispatch",
      "bill",
      "billing",
      "docket",
    ],
  },
  incentives: {
    subtitle: "Commission tiers, targets & payouts",
    keywords: [
      "incentives",
      "incentive",
      "commission",
      "target",
      "targets",
      "bonus",
      "reward",
      "payout",
      "leaderboard",
    ],
  },
  security: {
    subtitle: "Team devices, linked phones & access",
    keywords: [
      "security",
      "team devices",
      "device",
      "devices",
      "phone",
      "phones",
      "linked",
      "handset",
      "handsets",
      "role",
      "roles",
      "permission",
      "permissions",
      "access",
      "user",
      "users",
    ],
  },
};

export function getAppSearchSubtitle(appId: string): string {
  const key = (appId || "").toLowerCase().trim();
  return APP_SEARCH_META[key]?.subtitle || "Open module";
}

/**
 * Filters the horizontal Explore Apps list live against the search query.
 * Hides the "all" tab while searching unless explicitly queried so specific
 * sub-apps (like "leads") appear cleanly on their own.
 */
export function filterExploreApps<T extends SearchableAppItem>(apps: T[], query: string): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return apps;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const explicitAll = tokens.every((t) => ["all", "overview", "dashboard", "home"].includes(t));

  return apps.filter((app) => {
    const id = (app.id || "").toLowerCase();
    if (id === "all" && !explicitAll) return false;

    const meta = APP_SEARCH_META[id];
    const haystack = [
      id,
      (app.label || "").toLowerCase(),
      (meta?.subtitle || "").toLowerCase(),
      ...(meta?.keywords || []),
    ];

    return tokens.every((tok) => haystack.some((entry) => entry.includes(tok)));
  });
}

/**
 * Executes parallel debounced server searches across all permitted backend modules.
 */
export async function fetchGlobalRemoteResults(
  query: string,
  options: {
    allowCustomers?: boolean;
    allowLeads?: boolean;
    allowProforma?: boolean;
    allowInventory?: boolean;
    allowCalls?: boolean;
  }
): Promise<RemoteGlobalSearchResult> {
  const q = query.trim();
  if (!q) {
    return { customers: [], leads: [], proformas: [], inventory: [], calls: [] };
  }

  const [customers, leads, proformaRes, inventoryRes, callsRes] = await Promise.all([
    options.allowCustomers !== false
      ? fetchCustomersFromApi({ search: q, page_size: 12 }).catch(() => [])
      : Promise.resolve([]),
    options.allowLeads !== false
      ? fetchLeadsFromApi({ search: q }).catch(() => [])
      : Promise.resolve([]),
    options.allowProforma !== false
      ? fetchProformasFromApi({ search: q, type: "all", page_size: 10 }).catch(() => ({
          results: [] as ProformaItem[],
        }))
      : Promise.resolve({ results: [] as ProformaItem[] }),
    options.allowInventory !== false
      ? api
          .get<any>("/inventory/items/", { params: { page: 1, page_size: 10, q } })
          .then((res) => (Array.isArray(res.data?.items) ? res.data.items : []))
          .catch(() => [])
      : Promise.resolve([]),
    options.allowCalls
      ? api
          .get<any>("/admin/call-logs/", { params: { search: q, page_size: 10 } })
          .then((res) => {
            const list = res.data?.results || res.data;
            return Array.isArray(list) ? list : [];
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const normalizedInventory: SearchInventoryItem[] = (inventoryRes || []).map((item: any) => ({
    id: String(item.id),
    name: String(item.name || "Inventory Item"),
    sku: String(item.sku || ""),
    category: String(item.category || item.category_name || "Catalog"),
    stock: Number(item.stock ?? item.quantity ?? 0),
    unit: String(item.unit || "pcs"),
    status: String(item.status || "In Stock"),
  }));

  return {
    customers: Array.isArray(customers) ? customers : [],
    leads: Array.isArray(leads) ? leads : [],
    proformas: Array.isArray(proformaRes?.results) ? proformaRes.results : [],
    inventory: normalizedInventory,
    calls: Array.isArray(callsRes) ? callsRes : [],
  };
}

function dedupeById<T extends { id: string | number }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...primary, ...secondary]) {
    const key = String(item.id);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Merges instant client-side matches with live remote search results across all modules.
 */
export function buildUnifiedSearchResults(params: {
  query: string;
  apps: SearchableAppItem[];
  localCustomers: Customer[];
  localLeads: Lead[];
  localTelephonyUsers?: SearchTelephonyUser[];
  localEmployees?: EmployeeDirectoryItem[];
  localLeaves?: PendingLeave[];
  localCalls?: SearchCallItem[];
  remote: RemoteGlobalSearchResult;
  hideLeadsAndCustomers?: boolean;
}): UnifiedSearchResults {
  const q = params.query.trim().toLowerCase();
  if (!q) {
    return {
      apps: [],
      customers: [],
      leads: [],
      proformas: [],
      inventory: [],
      telephonyUsers: [],
      employees: [],
      leaves: [],
      calls: [],
      totalCount: 0,
    };
  }

  const matchedApps = filterExploreApps(params.apps, q)
    .filter((a) => a.id !== "all")
    .map((a) => ({
      ...a,
      subtitle: getAppSearchSubtitle(a.id),
    }));

  const localCustMatches = params.hideLeadsAndCustomers
    ? []
    : params.localCustomers.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.contactPerson || "").toLowerCase().includes(q) ||
          (c.city || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").includes(q)
      );
  const customers = params.hideLeadsAndCustomers
    ? []
    : dedupeById(params.remote.customers, localCustMatches);

  const localLeadMatches = params.hideLeadsAndCustomers
    ? []
    : params.localLeads.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(q) ||
          (l.companyName || "").toLowerCase().includes(q) ||
          (l.contactPerson || "").toLowerCase().includes(q) ||
          (l.city || "").toLowerCase().includes(q) ||
          (l.stage || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q)
      );
  const leads = params.hideLeadsAndCustomers
    ? []
    : dedupeById(params.remote.leads, localLeadMatches);

  const proformas = params.remote.proformas;
  const inventory = params.remote.inventory;

  const telephonyUsers = (params.localTelephonyUsers || []).filter(
    (u) =>
      (u.username || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q) ||
      (u.device_model || "").toLowerCase().includes(q)
  );

  const employees = (params.localEmployees || []).filter(
    (e) =>
      (e.name || "").toLowerCase().includes(q) ||
      (e.employee_code || "").toLowerCase().includes(q) ||
      (e.department || "").toLowerCase().includes(q) ||
      (e.designation || "").toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      (e.phone || "").includes(q)
  );

  const leaves = (params.localLeaves || []).filter(
    (lv) =>
      (lv.employee_name || "").toLowerCase().includes(q) ||
      (lv.employee_code || "").toLowerCase().includes(q) ||
      (lv.department || "").toLowerCase().includes(q) ||
      (lv.leave_type || "").toLowerCase().includes(q) ||
      (lv.reason || "").toLowerCase().includes(q)
  );

  const localCallMatches = (params.localCalls || []).filter(
    (c) =>
      (c.username || "").toLowerCase().includes(q) ||
      (c.phone_number || "").toLowerCase().includes(q) ||
      (c.call_type || "").toLowerCase().includes(q)
  );
  const calls = dedupeById(params.remote.calls, localCallMatches);

  const totalCount =
    matchedApps.length +
    customers.length +
    leads.length +
    proformas.length +
    inventory.length +
    telephonyUsers.length +
    employees.length +
    leaves.length +
    calls.length;

  return {
    apps: matchedApps,
    customers,
    leads,
    proformas,
    inventory,
    telephonyUsers,
    employees,
    leaves,
    calls,
    totalCount,
  };
}

