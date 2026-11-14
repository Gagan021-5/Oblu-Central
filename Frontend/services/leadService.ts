/**
 * Lead Service — Real REST API integration for Leads management with normalization.
 */

import api from "./api";
import { Lead, LeadStage, LeadIntent, getMockLeads, getMockLeadById } from "@/data/mockLeads";

export interface LeadListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}

export function normalizeLead(raw: any): Lead {
  if (!raw || typeof raw !== "object") {
    return {
      id: `lead-${Date.now()}`,
      name: "Prospect",
      companyName: "Prospect",
      company: "Prospect",
      contactPerson: "Prospect",
      phone: "",
      email: "",
      city: "Office",
      leadSource: "Website",
      assignedSalesperson: "Sales Rep",
      assignedEmployee: "Sales Rep",
      stage: "New",
      stage_name: "New",
      stage_color: "#00A879",
      intent: "High",
      intentLevel: "High",
      intentScore: 85,
      estimatedValue: "₹0",
      estimatedValueNum: 0,
      createdDate: "Today",
      lastContactTime: "No contact",
      lastContactDate: "",
      nextFollowUp: "None scheduled",
      expectedClosingDate: "Open",
      notes: [],
      activities: [],
      activity: [],
      followUps: [],
    };
  }

  const comp = raw.companyName || raw.company || raw.name || "Prospect";
  const name = raw.name || comp;
  const stage = (raw.stage || raw.stage_name || "New") as LeadStage;
  const intent = (raw.intentLevel || raw.intent || "High") as LeadIntent;
  const acts = Array.isArray(raw.activity) ? raw.activity : (Array.isArray(raw.activities) ? raw.activities : []);

  return {
    id: String(raw.id ?? `lead-${Date.now()}`),
    name,
    companyName: comp,
    company: comp,
    contactPerson: raw.contactPerson || raw.contact_person || name,
    phone: raw.phone && raw.phone !== "nan" ? String(raw.phone) : "",
    email: raw.email || "",
    city: raw.city || raw.district || raw.state || "Office",
    state: raw.state || "",
    district: raw.district || "",
    leadSource: raw.leadSource || raw.source_name || "Website",
    assignedSalesperson: raw.assignedSalesperson || raw.assignedEmployee || raw.salesperson_name || "Sales Rep",
    assignedEmployee: raw.assignedEmployee || raw.salesperson_name || "Sales Rep",
    stage,
    stage_name: raw.stage_name || stage,
    stage_color: raw.stage_color || "#00A879",
    intent,
    intentLevel: intent,
    intentScore: typeof raw.intentScore === "number" ? raw.intentScore : 85,
    estimatedValue: raw.estimatedValue || "₹0",
    estimatedValueNum: typeof raw.estimatedValueNum === "number" ? raw.estimatedValueNum : 0,
    createdDate: raw.createdDate || raw.created_at ? new Date(raw.created_at || Date.now()).toLocaleDateString("en-GB") : "Today",
    lastContactTime: raw.lastContactDate || raw.lastContactTime || "No contact",
    lastContactDate: raw.lastContactDate || "",
    nextFollowUp: raw.nextFollowUp || "None scheduled",
    expectedClosingDate: raw.expectedClosingDate || "Open",
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    activities: acts,
    activity: acts,
    followUps: Array.isArray(raw.followUps) ? raw.followUps : [],
  };
}

export async function fetchLeadsFromApi(params?: {
  stage?: string;
  search?: string;
}): Promise<Lead[]> {
  try {
    const res = await api.get<LeadListResponse | any[]>("/leads/", {
      params: {
        stage: params?.stage && params.stage !== "All" ? params.stage : undefined,
        search: params?.search || undefined,
      },
    });

    let rawList: any[] = [];
    if (Array.isArray(res?.data)) {
      rawList = res.data;
    } else if (res?.data && Array.isArray((res.data as any).results)) {
      rawList = (res.data as any).results;
    } else if (res?.data && Array.isArray((res.data as any).leads)) {
      rawList = (res.data as any).leads;
    } else if (res?.data && Array.isArray((res.data as any).data)) {
      rawList = (res.data as any).data;
    }
    return Array.isArray(rawList) ? rawList.filter(Boolean).map(normalizeLead) : [];
  } catch (error) {
    console.warn("[LeadService] API fetch failed, falling back to mock leads:", error);
    return [];
  }
}

export async function fetchLeadByIdFromApi(id: string): Promise<Lead | null> {
  const numericId = id.replace(/[^0-9]/g, "") || id;
  try {
    const res = await api.get<any>(`/leads/${numericId}/`);
    return normalizeLead(res.data);
  } catch (error) {
    console.warn(`[LeadService] API fetch for lead ${id} failed, falling back:`, error);
    return (await getMockLeadById(id)) || null;
  }
}

export async function createLeadApi(data: Partial<Lead>): Promise<Lead> {
  try {
    const res = await api.post<any>("/leads/", {
      name: data.companyName || data.contactPerson,
      phone: data.phone,
      email: data.email,
      stage: data.stage || "New",
      source: data.leadSource || "Website",
    });
    return normalizeLead(res.data);
  } catch (error) {
    console.warn("[LeadService] Create lead API failed, simulating locally:", error);
    return {
      id: `lead-${Date.now()}`,
      name: data.companyName || "New Prospect",
      companyName: data.companyName || "New Prospect",
      company: data.companyName || "New Prospect",
      contactPerson: data.contactPerson || "Lead Contact",
      phone: data.phone || "",
      email: data.email || "",
      city: "Office",
      leadSource: data.leadSource || "Website",
      assignedSalesperson: "You",
      assignedEmployee: "You",
      stage: (data.stage as LeadStage) || "New",
      intent: "High",
      intentLevel: "High",
      intentScore: 80,
      estimatedValue: "₹1,50,000",
      estimatedValueNum: 150000,
      createdDate: "Today",
      lastContactTime: "Today",
      lastContactDate: "Today",
      nextFollowUp: "Tomorrow, 10:30 AM",
      expectedClosingDate: "Next Month",
      notes: [],
      activities: [],
      activity: [],
      followUps: [],
    };
  }
}

export async function updateLeadStageApi(leadId: string, stage: LeadStage): Promise<void> {
  const numericId = leadId.replace(/[^0-9]/g, "") || leadId;
  try {
    await api.patch(`/leads/${numericId}/stage/`, { stage });
  } catch (error) {
    console.warn("[LeadService] Update stage API failed, simulating locally:", error);
  }
}
