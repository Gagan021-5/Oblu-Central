export type PaymentStatus = "paid" | "pending" | "overdue" | "no_payment";
export type CustomerStatus = "Active" | "Inactive" | "VIP";

export interface CustomerRemark {
  id: string;
  date: string;
  time: string;
  text: string;
  author: string;
}

export interface CustomerFollowUp {
  id: string;
  date: string;
  time: string;
  purpose: string;
  status: "scheduled" | "completed" | "cancelled";
  notes: string;
}

export interface CustomerPayment {
  id: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  expectedDate?: string;
  isDateCrossed?: boolean;
  status: "paid" | "pending" | "overdue";
  ticketStatus?: "NONE" | "RAISED" | "SOLVED";
  ticketRaisedAt?: string;
  emailSent?: boolean;
  recipient?: string;
  emailRecipient?: string;
  sentAt?: string;
  emailSentAt?: string;
}

export interface CustomerPurchase {
  product: string;
  quantity: string;
  amount: string;
  entries: Array<{ date: string; quantity: string }>;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  state?: string;
  district?: string;
  latitude?: number | null;
  longitude?: number | null;
  assignedSalesperson: string;
  customerSince: string;
  creditPeriod: string;
  outstandingPayment: string;
  lastContactTime: string;
  nextFollowUp: string;
  paymentStatus: PaymentStatus;
  status: CustomerStatus;
  remarks: CustomerRemark[];
  remarksCount?: number;
  remarks_count?: number;
  followUps: CustomerFollowUp[];
  payments: CustomerPayment[];
  purchases?: CustomerPurchase[];
  followupsDue?: number;
}
