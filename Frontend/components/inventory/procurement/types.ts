export interface CategoryOption {
  id: number;
  name: string;
  item_count: number;
}

export interface TrackingDetail {
  po_number: string;
  arrived_qty: number;
  incoming_qty: number;
  stage: string | null;
  days_in_stage: number | null;
  remaining_days: number | null;
  eta: string | null;
  type: string;
}

export interface VoucherHistoryRow {
  date: string | null;
  qty: number;
  voucher_number: string;
  party: string;
}

export interface MonthlySaleRow {
  month: string;
  qty: number;
}

export interface DailySaleRow {
  date: string;
  party: string;
  qty: number;
  status: "Included" | "Excluded";
  reason: string;
}

export interface GraphPoint {
  day: number;
  stock: number;
  buffer_line: number;
  demand: number;
  reorder_day?: boolean;
  new_order_arrival?: boolean;
  events: {
    po: string;
    qty: number;
    stage: string | null;
    eta: string | null;
    type?: string;
  }[];
}

export interface POPlannerProduct {
  id: number;
  name: string;
  unit: string;
  category: string;
  is_new_product: boolean;
  landing_date: string | null;
  current_stock: number;
  avg_daily: number;
  growth_1y: number | null;
  growth_3m: number | null;
  monthly_growth_rate_pct: number;
  pred_m1: number | null;
  pred_m2: number | null;
  pred_m3: number | null;
  is_dead: boolean;
  monthly_sales: MonthlySaleRow[];
  daily_sales: Record<string, DailySaleRow[]>;
  po_rows: VoucherHistoryRow[];
  latest_po_qty: number | null;
  latest_po_date: string | null;
  latest_po_number: string | null;
  gst_rows: VoucherHistoryRow[];
  latest_gst_qty: number | null;
  latest_gst_date: string | null;
  incoming_qty: number;
  incoming_date: string | null;
  tracking_details: TrackingDetail[];
  expected_delivery_days: number | null;
  order_recommended: number;
  order_final: number;
  order_urgency: "ok" | "warn" | "urgent" | "dead";
  moq_note: number | null;
  moq: number | null;
  order_lasts_months: number | null;
  runway_days: number | null;
  runway_months: number | null;
  reorder_point_days: number | null;
  graph_data: GraphPoint[];
  graph_meta: {
    delivery_days: number;
    reorder_point: number | null;
    stockout_day: number | null;
    today: number;
  };
  calc_steps: Record<string, any>;
  months_of_stock: number | null;
  is_overstocked: boolean;
}

export interface POPlannerSummary {
  total_products: number;
  urgent_count: number;
  warn_count: number;
  dead_count: number;
  overstocked_count: number;
  ok_count: number;
}

export interface TrackedItem {
  id: number;
  inventory_item_id: number | null;
  item_name: string;
  ordered_quantity: number;
  arrived_quantity: number;
  is_fully_arrived: boolean;
  remarks: string;
}

export interface StageLogItem {
  id: number;
  stage_id: number;
  stage_name: string;
  estimated_days: number;
  is_final_stage: boolean;
  entered_at: string | null;
  entered_at_display: string;
  exit_datetime: string | null;
  exit_datetime_display: string | null;
  days_at_stage: number;
  manual_days_at_stage: number | null;
  is_overdue: boolean;
  is_current: boolean;
  remarks: string;
}

export interface TrackedPO {
  id: number;
  voucher_id: number | null;
  voucher_number: string;
  party_name: string;
  order_date: string | null;
  order_date_display: string;
  status: string;
  status_display: string;
  arrival_datetime: string | null;
  arrival_datetime_display: string | null;
  manual_eta: string | null;
  system_eta: string | null;
  expected_delivery: string;
  remaining_days: number | null;
  total_days_taken: number | null;
  current_stage_name: string | null;
  days_in_current_stage: number;
  remarks: string;
  total_ordered: number;
  total_arrived: number;
  completion_pct: number;
  items: TrackedItem[];
  stage_history: StageLogItem[];
}

export interface TallyPO {
  id: number;
  voucher_number: string;
  party_name: string;
  date: string;
  date_iso: string | null;
  total_value: number;
  total_value_display: string;
  total_quantity: number;
  item_count: number;
  items: { id: number; name: string; quantity: number }[];
  is_tracked: boolean;
  tracking_id: number | null;
  tracking_status: string | null;
}

export interface PipelineStage {
  id: number;
  name: string;
  estimated_days: number;
  is_final_stage: boolean;
  sort_order: number;
  is_active: boolean;
  active_pos_count?: number;
}
