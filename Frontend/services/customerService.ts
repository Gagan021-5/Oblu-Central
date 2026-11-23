/**
 * Customer Service — Real REST API integration for Employee CRM with normalization.
 */

import api, { API_BASE_URL, getAccessToken } from "./api";
import { Customer, CustomerRemark, CustomerFollowUp, CustomerPayment } from "@/data/customerTypes";

export interface CustomerListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomersCount: number;
  followUpsDueCount: number;
  pendingPaymentsCount: number;
  overduePaymentsCount: number;
  totalOutstandingNum: number;
  totalOutstandingFormatted: string;
  totalLeadsCount: number;
  syncHealth: string;
  weeklyCustomerActivity: Array<{
    date: string;
    day: string;
    interactions: number;
    followups: number;
  }>;
}

export function normalizeCustomer(raw: any): Customer {
  return {
    id: String(raw.id),
    name: raw.name || "",
    contactPerson: raw.contactPerson || "",
    phone: raw.phone && raw.phone !== "nan" ? String(raw.phone) : "",
    email: raw.email || "",
    city: raw.city || raw.district || raw.state || "",
    state: raw.state || "",
    district: raw.district || "",
    latitude: raw.latitude == null ? null : Number(raw.latitude),
    longitude: raw.longitude == null ? null : Number(raw.longitude),
    assignedSalesperson: raw.assignedSalesperson || "",
    customerSince: raw.customerSince || "",
    creditPeriod: raw.creditPeriod || "",
    outstandingPayment: raw.outstandingPayment || "₹0",
    lastContactTime: raw.lastContactTime || "No recent contact",
    nextFollowUp: raw.nextFollowUp || "None scheduled",
    paymentStatus: raw.paymentStatus || "",
    status: raw.status || "",
    remarks: Array.isArray(raw.remarks) ? raw.remarks : [],
    followUps: Array.isArray(raw.followUps) ? raw.followUps : [],
    followupsDue: Number(raw.followups_due) || 0,
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
  };
}

export async function fetchCustomersFromApi(params?: {
  search?: string;
  filter?: string;
  page?: number;
  page_size?: number;
  max_pages?: number;
}): Promise<Customer[]> {
  const rawList: any[] = [];
  let page = params?.page || 1;
  const pageSize = params?.page_size || 50;
  const maxPages = params?.max_pages || 1;
  let fetchedPages = 0;
  while (fetchedPages < maxPages) {
    try {
      const res = await api.get<CustomerListResponse | any[]>("/customers/", {
        params: {
          search: params?.search || undefined,
          filter: params?.filter && params.filter !== "all" ? params.filter : undefined,
          page,
          page_size: pageSize,
        },
      });
      let data = res.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {}
      }
      if (Array.isArray(data)) {
        rawList.push(...data);
        break;
      }
      const pageResults = Array.isArray(data?.results) ? data.results : [];
      rawList.push(...pageResults);
      if (!data?.next || pageResults.length === 0) break;
      page += 1;
      fetchedPages += 1;
    } catch (err) {
      console.warn("[CustomerService] fetchCustomersFromApi error on page " + page, err);
      break;
    }
  }
  const customers: Customer[] = [];
  for (const item of rawList) {
    try {
      customers.push(normalizeCustomer(item));
    } catch (e) {
      console.warn("[CustomerService] normalization error for customer item", item?.id, e);
    }
  }
  return customers;
}

export async function fetchCustomerMapPointsFromApi(): Promise<Customer[]> {
  const response = await api.get<any[]>("/customers/map/");
  return response.data.map(normalizeCustomer);
}

export async function fetchCustomerPageFromApi(params?: {
  search?: string;
  filter?: string;
  payment_status?: string;
  has_outstanding?: boolean;
  ordering?: string;
  salesperson?: string | number;
  state?: string;
  page?: number;
  page_size?: number;
}): Promise<{ customers: Customer[]; nextPage: number | null; count: number }> {
  const pageSize = params?.page_size || 25;
  const currentPage = params?.page || 1;
  const res = await api.get<CustomerListResponse | any[]>("/customers/", {
    params: {
      search: params?.search || undefined,
      filter: params?.filter && params.filter !== "all" ? params.filter : undefined,
      payment_status: params?.payment_status && params.payment_status !== "all" ? params.payment_status : undefined,
      has_outstanding: params?.has_outstanding ? "true" : undefined,
      ordering: params?.ordering && params.ordering !== "default" ? params.ordering : undefined,
      salesperson: params?.salesperson && params.salesperson !== "all" ? params.salesperson : undefined,
      state: params?.state && params.state !== "all" ? params.state : undefined,
      page: currentPage,
      page_size: pageSize,
    },
  });

  if (!res || !res.data) {
    return { customers: [], nextPage: null, count: 0 };
  }

  let data = res.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.error("[CustomerService] Failed to parse customers response:", e);
    }
  }

  if (Array.isArray(data)) {
    const list: Customer[] = [];
    for (const item of data) {
      try {
        list.push(normalizeCustomer(item));
      } catch {}
    }
    return { customers: list, nextPage: null, count: list.length };
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  let nextPage: number | null = null;
  if (data?.next) {
    try {
      const match = String(data.next).match(/[?&]page=(\d+)/);
      nextPage = match ? Number(match[1]) : currentPage + 1;
    } catch {
      nextPage = currentPage + 1;
    }
  }

  const customers: Customer[] = [];
  for (const item of results) {
    try {
      customers.push(normalizeCustomer(item));
    } catch (e) {
      console.warn("[CustomerService] normalizeCustomer skipped invalid item:", item?.id, e);
    }
  }

  return {
    customers,
    nextPage,
    count: typeof data?.count === "number" ? data.count : (Number(data?.count) || customers.length),
  };
}

export async function fetchCustomerByIdFromApi(id: string): Promise<Customer> {
  const numericId = id.replace(/[^0-9]/g, "") || id;
  const res = await api.get<any>(`/customers/${numericId}/`);
  return normalizeCustomer(res.data);
}

export interface CustomerEditOptions {
  customer: {
    id: number | string;
    phone: string;
    email: string;
    salesperson_id: number | null;
    assignedSalesperson: string;
    credit_period_days: number;
  };
  salespersons: Array<{ id: number; name: string }>;
  can_edit_contact: boolean;
  can_edit_credit: boolean;
}

export async function fetchCustomerEditOptionsApi(id: string | number): Promise<CustomerEditOptions> {
  const numericId = String(id).replace(/[^0-9]/g, "") || String(id);
  const res = await api.get<CustomerEditOptions>(`/customers/${numericId}/edit/`);
  return res.data;
}

export async function updateCustomerEditableFieldsApi(
  id: string | number,
  data: { phone?: string; email?: string; salesperson?: number | null; credit_period_days?: number }
): Promise<{ success: boolean; customer: any; credit_period_days: number }> {
  const numericId = String(id).replace(/[^0-9]/g, "") || String(id);
  const res = await api.patch(`/customers/${numericId}/edit/`, data);
  return res.data;
}

export async function addCustomerRemarkApi(customerId: string, remarkText: string): Promise<CustomerRemark> {
  const numericId = customerId.replace(/[^0-9]/g, "") || customerId;
  const res = await api.post(`/customers/${numericId}/remarks/`, { remark: remarkText });
  return res.data;
}

export async function scheduleCustomerFollowUpApi(
  customerId: string,
  data: { date: string; time: string; purpose: string; notes: string }
): Promise<CustomerFollowUp> {
  const numericId = customerId.replace(/[^0-9]/g, "") || customerId;
  const res = await api.post(`/customers/${numericId}/followups/`, {
    followup_date: data.date,
    note: `${data.purpose}: ${data.notes}${data.time ? ` | Time: ${data.time}` : ""}`,
  });
  return res.data;
}
export async function handlePaymentTicketApi(
  customerId: string,
  paymentId: string,
  action: "raise" | "solve" | "email" | "expected" | "remark",
  extra: { expected_date?: string; remark?: string } = {}
): Promise<{ success: boolean; ticket_status: "RAISED" | "SOLVED" | "NONE"; email_sent?: boolean; payment?: any }> {
  const numericId = customerId.replace(/[^0-9]/g, "") || customerId;
  const numericPaymentId = paymentId.replace(/[^0-9]/g, "") || paymentId;
  const res = await api.post(`/customers/${numericId}/payment-ticket/`, {
    payment_id: numericPaymentId,
    action,
    ...extra,
  });
  return res.data;
}
export async function fetchDashboardStatsApi(): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>("/dashboard/stats/");
  return res.data;
}


import { isSalespersonActive } from "@/constants/salespeople";

export interface CustomerFilterOptions {
  salespersons: Array<{ id: number; name: string }>;
  states: string[];
}

export async function fetchCustomerFilterOptionsApi(): Promise<CustomerFilterOptions> {
  const res = await api.get<CustomerFilterOptions>("/customers/filter-options/");
  const data = res.data;
  return {
    ...data,
    salespersons: (data?.salespersons || []).filter((s) => isSalespersonActive(s?.name)),
  };
}

export async function getCustomerExportUrl(params: {
  state?: string;
  salesperson?: string | number;
  search?: string;
}): Promise<string> {
  const token = await getAccessToken();
  const query = new URLSearchParams();
  if (token) query.set("token", token);
  if (params.state && params.state !== "all") query.set("state", params.state);
  if (params.salesperson && params.salesperson !== "all") query.set("salesperson", String(params.salesperson));
  if (params.search) query.set("search", params.search);
  return `${API_BASE_URL}/customers/export/?${query.toString()}`;
}

export interface CustomerChartsData {
  totalCustomers: number;
  salespersonsCount?: number;
  statesCount?: number;
  activeCustomers?: number;
  inactiveCustomers?: number;
  salespersonDistribution: Array<{ name: string; customers: number; active?: number; inactive?: number }>;
  stateDistribution: Array<{ state: string; count: number; active?: number; inactive?: number }>;
  vouchers: {
    total: number;
    overdue: number;
    pending: number;
    paid: number;
  };
  totalOutstanding: number;
  totalOutstandingFormatted: string;
}

export async function fetchCustomerChartsApi(): Promise<CustomerChartsData> {
  const res = await api.get<CustomerChartsData>("/customers/charts/");
  return res.data;
}

export interface StateDistrictsData {
  state: string;
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  districtCount: number;
  districtDistribution: Array<{
    district: string;
    count: number;
    active: number;
    inactive: number;
  }>;
}

export async function fetchStateDistrictsApi(state: string): Promise<StateDistrictsData> {
  try {
    const res = await api.get<StateDistrictsData>("/customers/state-districts/", {
      params: { state },
    });
    if (res.data && Array.isArray(res.data.districtDistribution) && res.data.districtDistribution.length > 0) {
      return res.data;
    }
  } catch (err) {
    // If remote endpoint isn't deployed yet on AWS server, fallback gracefully
    console.warn("fetchStateDistrictsApi backend request failed, computing fallback from customer list:", err);
  }

  // Graceful fallback: fetch customers for this state specifically
  const stateCusts: Customer[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    const pageData = await fetchCustomerPageFromApi({ page, state, page_size: 100 });
    stateCusts.push(...pageData.customers);
    if (!pageData.nextPage || pageData.customers.length === 0) {
      hasMore = false;
    } else {
      page = pageData.nextPage;
    }
  }

  const districtMap = new Map<string, { count: number; active: number; inactive: number }>();
  let activeTotal = 0;
  let matchingStateCustomers = 0;
  const stateNormalized = state.trim().toLowerCase();

  for (const c of stateCusts) {
    // Strictly match target state
    const custState = (c.state || "").trim().toLowerCase();
    if (custState !== stateNormalized) continue;

    matchingStateCustomers++;
    const rawDist = (c.district || c.city || "").trim();
    const isInvalid = !rawDist || rawDist.toLowerCase() === "nan" || rawDist.toLowerCase() === "null" || rawDist.toLowerCase() === "undefined";
    const distName = isInvalid ? "Unassigned / Other" : rawDist;
    const isActive = c.status === "Active" || c.paymentStatus === "paid";
    if (isActive) activeTotal++;

    const entry = districtMap.get(distName) || { count: 0, active: 0, inactive: 0 };
    entry.count++;
    if (isActive) {
      entry.active++;
    } else {
      entry.inactive++;
    }
    districtMap.set(distName, entry);
  }

  const districtDistribution = Array.from(districtMap.entries())
    .map(([district, stats]) => ({
      district,
      count: stats.count,
      active: stats.active,
      inactive: stats.inactive,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    state,
    totalCustomers: matchingStateCustomers,
    activeCustomers: activeTotal,
    inactiveCustomers: Math.max(0, matchingStateCustomers - activeTotal),
    districtCount: districtDistribution.length,
    districtDistribution,
  };
}

export async function updatePaymentExpectedDateApi(
  customerId: string,
  paymentId: string,
  expectedDate: string
): Promise<{ success: boolean; payment?: any }> {
  return handlePaymentTicketApi(customerId, paymentId, "expected", { expected_date: expectedDate });
}
export async function addPaymentThreadRemarkApi(
  customerId: string,
  paymentId: string,
  remark: string
): Promise<{ success: boolean; payment?: any }> {
  return handlePaymentTicketApi(customerId, paymentId, "remark", { remark });
}

export async function assignUnassignedCustomerApi(
  customerIds: number | number[],
  salespersonId: number
): Promise<{
  status: string;
  customer_id?: number;
  customer_ids?: number[];
  updated_count?: number;
  salesperson?: string;
  salesperson_id?: number;
}> {
  const payload = Array.isArray(customerIds)
    ? { customer_ids: customerIds, salesperson_id: salespersonId }
    : { customer_id: customerIds, salesperson_id: salespersonId };

  const res = await api.post("/customers/workspace/unassigned/", payload);
  return res.data;
}

