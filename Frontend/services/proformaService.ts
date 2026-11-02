/**
 * Proforma Service — REST API integration for Proforma Invoices & Quotations.
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

    const data = res.data || {};
    return {
      results: Array.isArray(data.results) ? data.results : [],
      stats: data.stats || {
        pipeline_value: "₹0",
        pipeline_value_num: 0,
        pending_approvals: 0,
        approved_count: 0,
        billed_count: 0,
        total_count: 0,
      },
      count: Number(data.count) || 0,
      next_page: data.next_page ?? null,
    };
  } catch (error) {
    console.warn("[ProformaService] fetchProformasFromApi failed:", error);
    return {
      results: [],
      stats: {
        pipeline_value: "₹0",
        pipeline_value_num: 0,
        pending_approvals: 0,
        approved_count: 0,
        billed_count: 0,
        total_count: 0,
      },
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

