/**
 * Proforma Service — REST API integration for Proforma Invoices, Quotations,
 * and Warehouse Dispatch Photo Capture / Docket Workflows.
 * Connects directly to /api/proforma/ endpoints.
 */

import api from "./api";

export interface ProformaItem {
  id: string;
  doc_type: "proforma" | "quotation";
  piNumber: string;
  clientName: string;
  customerId?: number;
  amount: string;
  amountNum: number;
  gstAmount: string;
  date: string;
  rep: string;
  status: "Approved" | "Pending" | "Billed";
  dispatch_status?: string;
  items_count?: number;
}

export interface ProformaStats {
  pipeline_value: string;
  pipeline_value_num: number;
  pending_approvals: number;
  approved_count: number;
  billed_count: number;
  total_count: number;
}

export interface ProformaDetailItem {
  id: number;
  product_id?: number | null;
  product_name: string;
  sku: string;
  category: string;
  quantity: number;
  unit_price: string;
  unit_price_num: number;
  total_price: string;
  total_price_num: number;
  requested_price?: string | null;
}

export interface ProformaPriceRequest {
  id: number;
  product_name: string;
  requested_price: string;
  recommended_price: string;
  status: string;
  reason?: string;
}

export interface ProformaDetail {
  id: number;
  doc_type: "proforma" | "quotation";
  number: string;
  date: string;
  created_by: string;
  status: string;
  dispatch_status: string;
  courier_mode: string;
  customer: {
    id?: number | null;
    name: string;
    phone: string;
    email: string;
    city: string;
    state: string;
    address: string;
    gstin: string;
  };
  items: ProformaDetailItem[];
  totals: {
    taxable_total: string;
    courier_charge: string;
    courier_gst: string;
    gst_total: string;
    grand_total: string;
    grand_total_num: number;
  };
  price_requests: ProformaPriceRequest[];
  can_approve_price: boolean;
  can_convert_to_pi: boolean;
  web_url: string;
}

export interface ProformaProductLookup {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  price_formatted: string;
}

// ── Dispatch & Photo Interfaces ─────────────────────────────────────────

export interface DispatchPhotoItem {
  id: number;
  url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface DispatchRemarkItem {
  id: number;
  user: string;
  message: string;
  created_at: string;
}

export interface DispatchDocket {
  docket_number: string;
  dispatched_at: string;
  dispatched_by: string;
  photos: Array<{ id: number; url: string }>;
}

export interface DispatchInfo {
  dispatch_id: number;
  invoice_id: number;
  invoice_number: string;
  status: string;
  status_display: string;
  shipment_method: string;
  photos: DispatchPhotoItem[];
  remarks: DispatchRemarkItem[];
  docket: DispatchDocket | null;
  can_submit_packing: boolean;
  can_approve_packing: boolean;
  can_dispatch: boolean;
}

export interface PhotoAsset {
  uri: string;
  name?: string;
  type?: string;
}

// ── Document APIs ───────────────────────────────────────────────────────

export async function fetchProformasFromApi(params?: {
  search?: string;
  type?: "all" | "proforma" | "quotation";
  status?: "all" | "approved" | "pending" | "billed";
  page?: number;
  page_size?: number;
}): Promise<{
  results: ProformaItem[];
  stats: ProformaStats;
  count: number;
  next_page: number | null;
}> {
  const defaultStats: ProformaStats = {
    pipeline_value: "₹0",
    pipeline_value_num: 0,
    pending_approvals: 0,
    approved_count: 0,
    billed_count: 0,
    total_count: 0,
  };

  try {
    const res = await api.get<any>("/proforma/", {
      params: {
        search: params?.search || undefined,
        type: params?.type && params.type !== "all" ? params.type : undefined,
        status: params?.status && params.status !== "all" ? params.status : undefined,
        page: params?.page || 1,
        page_size: params?.page_size || 40,
      },
    });

    if (!res || !res.data) {
      return { results: [], stats: defaultStats, count: 0, next_page: null };
    }

    let data = res.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error("[ProformaService] Failed to parse proforma response:", e);
      }
    }

    const resultsList = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];

    return {
      results: resultsList,
      stats: data?.stats || defaultStats,
      count: Number(data?.count) || resultsList.length,
      next_page: data?.next_page ?? null,
    };
  } catch (error) {
    console.warn("[ProformaService] fetchProformasFromApi failed:", error);
    return {
      results: [],
      stats: defaultStats,
      count: 0,
      next_page: null,
    };
  }
}

export async function fetchProformaDetailApi(
  id: string | number,
  type: "proforma" | "quotation" = "proforma"
): Promise<ProformaDetail | null> {
  const numericId = String(id).replace(/[^0-9]/g, "") || String(id);
  try {
    const res = await api.get<ProformaDetail>(`/proforma/${numericId}/`, {
      params: { type },
    });
    return res.data;
  } catch (error) {
    console.warn(`[ProformaService] fetchProformaDetailApi for ${id} failed:`, error);
    return null;
  }
}

export async function createProformaApi(payload: {
  doc_type: "proforma" | "quotation";
  customer_id: number;
  courier_mode?: string;
  items: Array<{
    product_id: number;
    quantity: number;
    requested_price?: number;
  }>;
}): Promise<{ success: boolean; id: number; number: string; message: string }> {
  const res = await api.post("/proforma/", payload);
  return res.data;
}

export async function handlePriceRequestActionApi(
  requestId: number,
  action: "approve" | "reject",
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.post(`/proforma/price-requests/${requestId}/`, {
    action,
    reason,
  });
  return res.data;
}

export async function convertQuotationToPIApi(
  quotationId: number | string
): Promise<{ success: boolean; proforma_id: number; proforma_number: string; message: string }> {
  const numericId = String(quotationId).replace(/[^0-9]/g, "") || String(quotationId);
  const res = await api.post(`/proforma/quotations/${numericId}/convert/`);
  return res.data;
}

export async function fetchProformaProductsApi(
  search?: string,
  categoryId?: string
): Promise<ProformaProductLookup[]> {
  try {
    const res = await api.get<{ products: ProformaProductLookup[] }>("/proforma/products/", {
      params: { search, category: categoryId },
    });
    return res.data?.products || [];
  } catch (error) {
    console.warn("[ProformaService] fetchProformaProductsApi failed:", error);
    return [];
  }
}

// ── Dispatch & Photo Capture APIs ───────────────────────────────────────

export async function fetchDispatchDetailApi(
  invoiceId: number | string
): Promise<DispatchInfo | null> {
  const numericId = String(invoiceId).replace(/[^0-9]/g, "") || String(invoiceId);
  try {
    const res = await api.get<DispatchInfo>(`/proforma/dispatch/${numericId}/`);
    return res.data;
  } catch (error) {
    console.warn(`[ProformaService] fetchDispatchDetailApi for ${invoiceId} failed:`, error);
    return null;
  }
}

export async function submitPackingPhotosApi(
  invoiceId: number | string,
  photos: PhotoAsset[],
  remark?: string
): Promise<{ success: boolean; message: string; status: string }> {
  const numericId = String(invoiceId).replace(/[^0-9]/g, "") || String(invoiceId);
  const formData = new FormData();

  photos.forEach((p, idx) => {
    formData.append("photos", {
      uri: p.uri,
      name: p.name || `packing_photo_${idx + 1}.jpg`,
      type: p.type || "image/jpeg",
    } as any);
  });

  if (remark) {
    formData.append("remark", remark);
  }

  const res = await api.post(`/proforma/dispatch/${numericId}/packing/`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
}

export async function approvePackingApi(
  invoiceId: number | string
): Promise<{ success: boolean; message: string; status: string }> {
  const numericId = String(invoiceId).replace(/[^0-9]/g, "") || String(invoiceId);
  const res = await api.post(`/proforma/dispatch/${numericId}/approve-packing/`);
  return res.data;
}

export async function rejectPackingApi(
  invoiceId: number | string,
  remark?: string
): Promise<{ success: boolean; message: string; status: string }> {
  const numericId = String(invoiceId).replace(/[^0-9]/g, "") || String(invoiceId);
  const res = await api.post(`/proforma/dispatch/${numericId}/reject-packing/`, {
    remark,
  });
  return res.data;
}

export async function sendWarehouseDispatchApi(
  invoiceId: number | string,
  docketNumber: string,
  docketPhotos: PhotoAsset[]
): Promise<{ success: boolean; message: string; status: string }> {
  const numericId = String(invoiceId).replace(/[^0-9]/g, "") || String(invoiceId);
  const formData = new FormData();
  formData.append("docket_number", docketNumber);

  docketPhotos.forEach((p, idx) => {
    formData.append("docket_photos", {
      uri: p.uri,
      name: p.name || `docket_photo_${idx + 1}.jpg`,
      type: p.type || "image/jpeg",
    } as any);
  });

  const res = await api.post(`/proforma/dispatch/${numericId}/send/`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
}

// ── RBAC Hub & Operational Subsystem APIs ─────────────────────────────────

export interface ProformaPermissions {
  can_create_proforma: boolean;
  can_create_quotation: boolean;
  can_view_proformas: boolean;
  can_view_quotations: boolean;
  can_view_products: boolean;
  can_approve_price_change: boolean;
  can_request_stock: boolean;
  can_manage_dispatch: boolean;
  can_warehouse_dispatch: boolean;
  can_manage_tiers: boolean;
  is_admin: boolean;
  is_accounts: boolean;
  is_warehouse: boolean;
}

export interface ProformaHubData {
  permissions: ProformaPermissions;
  stats: {
    total_proformas: number;
    total_quotations: number;
    pending_price_requests: number;
    pending_stock_requests: number;
    pending_dispatch: number;
  };
  user: {
    id: number;
    username: string;
    name: string;
    role: string;
    is_superuser: boolean;
  };
}

export interface ProformaCustomerLookup {
  id: number;
  name: string;
  phone: string;
  city: string;
  state: string;
  gstin: string;
  has_overdue: boolean;
}

export interface PriceChangeRequestItem {
  id: number;
  doc_type: "proforma" | "quotation";
  doc_id: number;
  doc_number: string;
  customer_name: string;
  product_name: string;
  product_sku: string;
  current_price: number;
  requested_price: number;
  recommended_price: number;
  difference: number;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  sp_remark?: string;
  requested_by: string;
  reviewed_by?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface StockShortageRequestItem {
  id: number;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  product_name: string;
  product_sku: string;
  requested_quantity: number;
  available_quantity: number;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  reviewed_by?: string | null;
  duration?: string | null;
  created_at: string;
}

export interface DispatchQueueItem {
  id: number;
  invoice_id: number | null;
  invoice_number: string;
  customer_name: string;
  status: string;
  status_display: string;
  shipment_method: string;
  photos_count: number;
  items_count: number;
  time_in_stage: string;
  created_at: string;
}

export interface ProformaCatalogItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  category_id?: number;
  base_price: number;
  gst_percentage: number;
  stock: number;
  price_display: string;
  tiers?: Array<{
    min_qty: number;
    discount_pct: number;
    unit_price: number;
  }>;
}

export async function fetchProformaHubApi(): Promise<ProformaHubData | null> {
  try {
    const res = await api.get<ProformaHubData>("/proforma/hub/");
    return res.data;
  } catch (error) {
    console.warn("[ProformaService] fetchProformaHubApi failed:", error);
    return null;
  }
}

export async function fetchProformaCustomersApi(search?: string): Promise<ProformaCustomerLookup[]> {
  try {
    const res = await api.get<{ success: boolean; customers: ProformaCustomerLookup[] }>("/proforma/customers/", {
      params: { search },
    });
    return res.data?.customers || [];
  } catch (error) {
    console.warn("[ProformaService] fetchProformaCustomersApi failed:", error);
    return [];
  }
}

export async function fetchPriceChangeRequestsApi(params?: {
  status?: string;
  search?: string;
}): Promise<PriceChangeRequestItem[]> {
  try {
    const res = await api.get<{ success: boolean; results: PriceChangeRequestItem[] }>("/proforma/price-requests/", {
      params,
    });
    return res.data?.results || [];
  } catch (error) {
    console.warn("[ProformaService] fetchPriceChangeRequestsApi failed:", error);
    return [];
  }
}

export async function actionPriceChangeRequestApi(
  id: number,
  action: "approve" | "reject",
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.post(`/proforma/price-requests/${id}/`, { action, reason });
  return res.data;
}

export async function fetchStockShortageRequestsApi(params?: {
  status?: string;
  search?: string;
}): Promise<StockShortageRequestItem[]> {
  try {
    const res = await api.get<{ success: boolean; results: StockShortageRequestItem[] }>("/proforma/stock-requests/", {
      params,
    });
    return res.data?.results || [];
  } catch (error) {
    console.warn("[ProformaService] fetchStockShortageRequestsApi failed:", error);
    return [];
  }
}

export async function actionStockShortageRequestApi(
  id: number,
  action: "approve" | "reject"
): Promise<{ success: boolean; message: string }> {
  const res = await api.post(`/proforma/stock-requests/${id}/action/`, { action });
  return res.data;
}

export async function fetchDispatchQueueApi(params?: {
  type?: "all" | "accounts" | "warehouse";
  search?: string;
}): Promise<DispatchQueueItem[]> {
  try {
    const res = await api.get<{ success: boolean; results: DispatchQueueItem[] }>("/proforma/dispatch-queue/", {
      params,
    });
    return res.data?.results || [];
  } catch (error) {
    console.warn("[ProformaService] fetchDispatchQueueApi failed:", error);
    return [];
  }
}

export async function fetchProformaCatalogApi(params?: {
  category_id?: string;
  search?: string;
}): Promise<{ categories: Array<{ id: number; name: string }>; products: ProformaCatalogItem[] }> {
  try {
    const res = await api.get<{
      success: boolean;
      categories: Array<{ id: number; name: string }>;
      products: ProformaCatalogItem[];
    }>("/proforma/catalog/", {
      params,
    });
    return {
      categories: res.data?.categories || [],
      products: res.data?.products || [],
    };
  } catch (error) {
    console.warn("[ProformaService] fetchProformaCatalogApi failed:", error);
    return { categories: [], products: [] };
  }
}

