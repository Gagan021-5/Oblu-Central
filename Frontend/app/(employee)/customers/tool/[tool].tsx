import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import { Typography } from "@/constants/theme";
import { MetricCard } from "@/components/employee/MetricCard";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";

type ToolRow = Record<string, any>;
type RsmOption = { id: number | string; name: string };
type CustomerFilterMenu = "salesperson" | "status" | "balance" | "missing_cat" | "score" | null;
type PortfolioEntry =
  | { kind: "unit"; id: string; name: string; members: ToolRow[] }
  | { kind: "customer"; row: ToolRow };

const TITLES: Record<string, string> = {
  "team-customers": "Team Customers",
  "payment-followups": "Payment Follow-ups",
  "monthly-sales": "Monthly Sales Report",
  "my-incentives": "My Paid Incentives",
  "rsm-incentives": "RSM Team Incentives",
  "sales-head-incentives": "Sales Head Incentives",
  "cross-selling": "Cross-Selling Matrix",
  "voucher-approvals": "Voucher Approvals",
  "unassigned": "Unassigned Customers",
};

const ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  "team-customers": "people-outline",
  "payment-followups": "cash-outline",
  "monthly-sales": "calendar-outline",
  "my-incentives": "wallet-outline",
  "rsm-incentives": "people-outline",
  "sales-head-incentives": "git-network-outline",
  "cross-selling": "grid-outline",
  "voucher-approvals": "checkbox-outline",
  "unassigned": "person-remove-outline",
};

const CROSS_SELLING_CATS = [
  { id: "template_sheet", name: "Template Sheet", badge: "0.6mm" },
  { id: "aligner_sheet", name: "Aligner Sheet", badge: "0.76mm / 0.8mm" },
  { id: "retainer_sheet", name: "Retainer Sheet", badge: "1.0mm" },
  { id: "resin", name: "Resin", badge: "3D Print" },
  { id: "other_consumable", name: "Other Consumables", badge: "Box/Chewies" },
];

export default function CustomerToolScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user, permissionProfile } = useAuth();
  const roleText = `${user?.role || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
  const isSuperuser =
    roleText.includes("superuser") ||
    (user?.permissions || []).includes("*") ||
    (permissionProfile?.permissions || []).includes("*");
  const isFinance = roleText.includes("finance") || hasRole(permissionProfile, "finance");
  const userHasRole = (role: string) => {
    if (isSuperuser || isFinance) return true;
    return (
      hasRole(permissionProfile, role) ||
      (role === "rsm" && (roleText.includes("rsm") || roleText.includes("regional sales manager"))) ||
      (role === "sales_head" && (roleText.includes("sales head") || roleText.includes("sales_head") || roleText.includes("finance"))) ||
      (role === "business" && (roleText.includes("business") || roleText.includes("finance"))) ||
      (role === "admin" && (roleText.includes("admin") || isSuperuser))
    );
  };
  const isAdminUser = isSuperuser || isFinance || userHasRole("admin") || roleText.includes("admin");
  const isAccountant = isFinance || userHasRole("accountant") || roleText.includes("accountant");

  const accessByTool: Record<string, boolean> = {
    "team-customers": true,
    "payment-followups": isAdminUser || hasPermission(permissionProfile, "payment.view"),
    "monthly-sales": true,
    "my-incentives": true,
    "rsm-incentives": isAdminUser || isAccountant || userHasRole("rsm") || userHasRole("sales_head"),
    "sales-head-incentives": isAdminUser || userHasRole("sales_head") || userHasRole("business"),
    "cross-selling": true,
    "voucher-approvals":
      isAdminUser ||
      hasRole(permissionProfile, "accounts_operations") ||
      userHasRole("sales_head") ||
      hasPermission(permissionProfile, "customer.view_all"),
    "unassigned": isAdminUser || userHasRole("sales_head") || hasPermission(permissionProfile, "customer.view_all"),
  };
  const canOpen = Boolean(accessByTool[tool] ?? true);

  const [rows, setRows] = useState<ToolRow[]>([]);
  const [productRows, setProductRows] = useState<ToolRow[]>([]);
  const [rsmOptions, setRsmOptions] = useState<RsmOption[]>([]);
  const [selectedRsm, setSelectedRsm] = useState<string | null>(null);
  const [rsmPickerOpen, setRsmPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Filters State
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSalesperson, setCustomerSalesperson] = useState("All Salespeople");

  const [serverSalespeople, setServerSalespeople] = useState<string[]>([]);
  const [customerStatus, setCustomerStatus] = useState("All Statuses");
  const [customerBalance, setCustomerBalance] = useState("All Balances");
  const [filterMenu, setFilterMenu] = useState<CustomerFilterMenu>(null);

  // Cross-selling specific filter state
  const [csMissingCat, setCsMissingCat] = useState("All Missing Categories");
  const [csScore, setCsScore] = useState("All Scores");
  const [crossSellingStats, setCrossSellingStats] = useState<any>(null);
  const [crossSellingPage, setCrossSellingPage] = useState(1);
  const [crossSellingTotal, setCrossSellingTotal] = useState(0);
  const [crossSellingTotalPages, setCrossSellingTotalPages] = useState(1);
  const [crossSellingHasNext, setCrossSellingHasNext] = useState(false);
  const [crossSellingHasPrev, setCrossSellingHasPrev] = useState(false);
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const hasLoadedTool = useRef(false);
  const crossSellingRequestSequence = useRef(0);
  const scrollRef = useRef<any>(null);

  // Payment follow-up specific state
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All Payments");
  const [newRemarkModal, setNewRemarkModal] = useState<{ id: string | number; voucher_status_id?: string | number; customer: string; remarks?: any[]; expected_dates?: any[]; ticket_status?: string } | null>(null);
  const [newRemarkText, setNewRemarkText] = useState("");
  const [newExpectedDate, setNewExpectedDate] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  // Customer Unit state
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
  const [renameUnit, setRenameUnit] = useState<{ id: string; name: string } | null>(null);
  const [renameUnitName, setRenameUnitName] = useState("");
  const [unitActionLoading, setUnitActionLoading] = useState(false);

  // Pagination state for team-customers
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [totalAccountCount, setTotalAccountCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverStats, setServerStats] = useState<{
    total_accounts: number;
    active_clients: number;
    inactive_dormant: number;
    due_accounts: number;
    total_exposure: number;
  } | null>(null);

  // Monthly date state
  const [reportMonth, setReportMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const monthKey = `${reportMonth.getFullYear()}-${String(reportMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = reportMonth.toLocaleString("default", { month: "long", year: "numeric" });
  const isMonthlyReport = ["monthly-sales", "my-incentives", "rsm-incentives", "sales-head-incentives"].includes(tool);

  const title = TITLES[tool] || "Customer Workspace";

  const load = useCallback(async (pageToLoad = 1, append = false) => {
    if (!canOpen) return;
    const requestSequence = tool === "cross-selling" ? ++crossSellingRequestSequence.current : 0;
    setError("");
    if (pageToLoad === 1 && !append) {
      if (hasLoadedTool.current) setRefreshing(true);
      else setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      let result: any;
      if (tool === "team-customers") {
        const params: Record<string, string | number> = {
          page: pageToLoad,
          page_size: 50,
        };
        if (customerSalesperson !== "All Salespeople") {
          params.salesperson = customerSalesperson;
        }
        result = await api.get("/customers/workspace/team-customers/", { params });
        if (!result?.data || (Array.isArray(result.data) && result.data.length === 0)) {
          result = await api.get("/customers/", { params: { page: pageToLoad, page_size: 50, ...params } });
        }
      } else if (tool === "cross-selling") {
        const params: Record<string, string | number> = { page: pageToLoad, page_size: 25 };
        if (customerSalesperson !== "All Salespeople") params.salesperson = customerSalesperson;
        if (debouncedCustomerSearch.trim()) params.q = debouncedCustomerSearch.trim();
        if (csMissingCat !== "All Missing Categories") {
          const category = CROSS_SELLING_CATS.find((item) => item.name === csMissingCat);
          if (category) params.missing_cat = category.id;
        }
        if (csScore !== "All Scores") params.score = Number.parseInt(csScore, 10) || 0;
        result = await api.get(`/customers/workspace/${tool}/`, { params });
      } else {
        const reportParams = tool === "monthly-sales" ? { month: monthKey } : isMonthlyReport ? { month_picker: monthKey } : {};
        result = await api.get(`/customers/workspace/${tool}/`, {
          params: { ...reportParams, ...(tool === "rsm-incentives" && selectedRsm ? { rsm: selectedRsm } : {}) },
        });
      }

      if (tool === "cross-selling" && requestSequence !== crossSellingRequestSequence.current) return;

      let data = result?.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {}
      }

      const rawRows = Array.isArray(data) ? data : (data?.rows || data?.results || []);
      if (append) {
        setRows((prev) => [...prev, ...rawRows]);
      } else {
        setRows(rawRows);
      }

      if (tool === "team-customers" && data) {
        setCurrentPage(Number(data.page || pageToLoad));
        setTotalPages(Number(data.total_pages || 1));
        setHasNextPage(Boolean(data.has_next));
        setHasPrevPage(Boolean(data.has_prev || pageToLoad > 1));
        setTotalAccountCount(Number(data.total_count || rawRows.length));
        if (data.stats) {
          setServerStats(data.stats);
        }
      }

      if (tool === "cross-selling" && data) {
        const pageNum = Number(data.page || pageToLoad);
        const totalItems = Number(data.total_count || 0);
        const pageSize = Number(data.page_size || 25);
        const pagesCount = Number(data.total_pages || Math.ceil(totalItems / pageSize) || 1);
        setCrossSellingPage(pageNum);
        setCrossSellingTotal(totalItems);
        setCrossSellingTotalPages(pagesCount);
        setCrossSellingHasNext(Boolean(data.has_next || pageNum < pagesCount));
        setCrossSellingHasPrev(Boolean(data.has_prev || pageNum > 1));
      }

      if (Array.isArray(data?.salespersons) && data.salespersons.length > 0) {
        if (typeof data.salespersons[0] === "object") {
          setServerSalespeople(data.salespersons.map((s: any) => s.name));
        } else {
          setServerSalespeople(data.salespersons);
        }
      }

      if (tool === "cross-selling" && data?.stats) {
        setCrossSellingStats(data.stats);
      }

      setProductRows(tool === "my-incentives" && Array.isArray(data?.products) ? data.products : []);
      if (tool === "rsm-incentives") {
        const options = Array.isArray(data?.rsms) ? data.rsms : [];
        setRsmOptions(options);
        if (data?.rsm_id != null && selectedRsm !== String(data.rsm_id)) {
          setSelectedRsm(String(data.rsm_id));
        }
      }

      if (tool === "monthly-sales") {
        setSummary(`Total sales: ₹${Number(data?.total || 0).toLocaleString("en-IN")}`);
      } else if (tool === "sales-head-incentives") {
        const totals = data?.summary || {};
        setSummary(`Potential ₹${Number(totals.potential || 0).toLocaleString("en-IN")}  ·  Payable ₹${Number(totals.payable || 0).toLocaleString("en-IN")}  ·  Pending ₹${Number(totals.pending || 0).toLocaleString("en-IN")}`);
      } else if (tool === "my-incentives" || tool === "rsm-incentives") {
        const totals = data?.summary || {};
        const subject = tool === "rsm-incentives" && data?.rsm ? `${data.rsm} · ` : "";
        setSummary(`${subject}Potential ₹${Number(totals.potential || 0).toLocaleString("en-IN")}  ·  Payable ₹${Number(totals.payable || 0).toLocaleString("en-IN")}  ·  Pending ₹${Number(totals.pending || 0).toLocaleString("en-IN")}`);
      } else {
        setSummary("");
      }
    } catch (e: any) {
      if (tool === "cross-selling" && requestSequence !== crossSellingRequestSequence.current) return;
      const status = e?.response?.status;
      console.warn(`[CustomerTool:${tool}] API request failed:`, status ? `HTTP ${status}` : e?.message || "Network error");
      if (!append) {
        setRows([]);
        setProductRows([]);
        setError(
          status === 401
            ? "Your session is not valid. Sign in again to load this section."
            : status === 403
            ? "Your account does not have permission to view this section."
            : "Could not load this section. Check your connection and try again."
        );
      }
    } finally {
      hasLoadedTool.current = true;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [canOpen, customerSalesperson, csMissingCat, csScore, debouncedCustomerSearch, isMonthlyReport, monthKey, selectedRsm, tool]);

  useEffect(() => {
    crossSellingRequestSequence.current += 1;
    hasLoadedTool.current = false;
    setRows([]);
    setError("");
    setCrossSellingPage(1);
    setCrossSellingHasNext(false);
    setCrossSellingTotalPages(1);
    setCrossSellingHasPrev(false);
    setCrossSellingTotal(0);
  }, [tool]);

  useEffect(() => {
    if (tool !== "cross-selling") return;
    if (customerSearch === debouncedCustomerSearch) return;
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch, debouncedCustomerSearch, tool]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeMonth = (delta: number) => {
    setReportMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const foreground = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";
  const card = { backgroundColor: isDark ? "#111B18" : "#FFFFFF", borderColor: isDark ? "#263A32" : "#E4EAF0" };

  // Salesperson Options from server and rows
  const salespersonOptions = useMemo(() => {
    const set = new Set<string>(serverSalespeople);
    rows.forEach((r) => {
      const sp = r.assignedSalesperson || r.salesperson;
      if (sp && sp !== "None" && sp !== "null") set.add(String(sp));
    });
    return ["All Salespeople", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows, serverSalespeople]);

  // Dynamic filter for team customers & other tools
  const visibleRows = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();

    if (tool === "team-customers") {
      const units = new Map<string, ToolRow[]>();
      for (const row of rows) {
        const id = row.unitId == null ? "" : String(row.unitId);
        if (id) units.set(id, [...(units.get(id) || []), row]);
      }
      const matchesSearch = (row: ToolRow) =>
        !search ||
        [row.name, row.unitName, row.city, row.state, row.phone, row.assignedSalesperson]
          .some((val) => String(val || "").toLowerCase().includes(search));

      const keep = new Set<ToolRow>();
      for (const members of units.values()) {
        const scopedMembers = members.filter((row) => {
          const matchesSP =
            customerSalesperson === "All Salespeople" ||
            String(row.assignedSalesperson || "Unassigned") === customerSalesperson;
          const num = Number(row.outstandingPaymentNum || 0);
          const hasDue = num > 0;
          const matchesBal =
            customerBalance === "All Balances" ||
            (customerBalance === "With Dues" ? hasDue : !hasDue);
          return matchesSP && matchesBal;
        });
        const active = scopedMembers.some((row) => String(row.portfolioStatus || "").toLowerCase() === "active");
        const statusMatches =
          customerStatus === "All Statuses" ||
          (active ? "active" : "inactive") === customerStatus.toLowerCase();
        if (!statusMatches) continue;

        const unitNameMatches = !search || String(members[0]?.unitName || "").toLowerCase().includes(search);
        for (const member of scopedMembers) {
          if (unitNameMatches || matchesSearch(member)) keep.add(member);
        }
      }

      for (const row of rows) {
        if (row.unitId != null) continue;
        const status = String(row.portfolioStatus || "").toLowerCase();
        const matchesStatus = customerStatus === "All Statuses" || status === customerStatus.toLowerCase();
        const num = Number(row.outstandingPaymentNum || 0);
        const hasDue = num > 0;
        const matchesBal =
          customerBalance === "All Balances" ||
          (customerBalance === "With Dues" ? hasDue : !hasDue);
        const matchesSP =
          customerSalesperson === "All Salespeople" ||
          String(row.assignedSalesperson || "Unassigned") === customerSalesperson;
        if (matchesStatus && matchesBal && matchesSP && matchesSearch(row)) {
          keep.add(row);
        }
      }
      return rows.filter((row) => keep.has(row));
    }

    if (tool === "cross-selling") {
      // The server (/api/customers/workspace/cross-selling/) already filters by salesperson,
      // q (search), missing_cat, and score before pagination. Return rows directly to prevent dropouts.
      return rows;
    }

    if (tool === "payment-followups") {
      return rows.filter((row) => {
        const matchesSP =
          customerSalesperson === "All Salespeople" ||
          String(row.salesperson || row.sp || "Unassigned") === customerSalesperson;
        const matchesSearch =
          !search ||
          [row.customer, row.invoice, row.voucher]
            .some((val) => String(val || "").toLowerCase().includes(search));

        const isOverdue = Boolean(row.overdue || row.is_credit_period_crossed);
        const matchesPaymentStatus =
          paymentStatusFilter === "All Payments" ||
          (paymentStatusFilter === "Overdue Only" && isOverdue) ||
          (paymentStatusFilter === "Pending" && !isOverdue);

        return matchesSP && matchesSearch && matchesPaymentStatus;
      });
    }

    if (tool === "monthly-sales") {
      return rows.filter((row) => {
        const matchesSearch =
          !search ||
          [row.customer, row.product, row.voucher, row.voucher_no]
            .some((val) => String(val || "").toLowerCase().includes(search));
        return matchesSearch;
      });
    }

    return rows;
  }, [
    tool,
    rows,
    customerSearch,
    customerSalesperson,
    customerStatus,
    customerBalance,
    csScore,
    csMissingCat,
    paymentStatusFilter,
  ]);

  // Recalculate customer overview strictly from serverStats or visibleRows
  const customerOverview = useMemo(() => {
    if (tool !== "team-customers") return [];

    const hasLocalFilters = Boolean(
      customerSearch.trim() ||
      customerStatus !== "All Statuses" ||
      customerBalance !== "All Balances"
    );

    if (serverStats && !hasLocalFilters) {
      return [
        { label: "TOTAL ACCOUNTS", value: Number(serverStats.total_accounts || 0).toLocaleString("en-IN"), color: foreground, icon: "people-outline" as const },
        { label: "ACTIVE CLIENTS", value: Number(serverStats.active_clients || 0).toLocaleString("en-IN"), color: "#159A7C", icon: "checkmark-circle-outline" as const },
        { label: "INACTIVE / DORMANT", value: Number(serverStats.inactive_dormant || 0).toLocaleString("en-IN"), color: "#DF5262", icon: "alert-circle-outline" as const },
        { label: "DUE ACCOUNTS", value: Number(serverStats.due_accounts || 0).toLocaleString("en-IN"), color: "#D97706", icon: "time-outline" as const },
        { label: "TOTAL EXPOSURE", value: `₹${Number(serverStats.total_exposure || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#159A7C", icon: "cash-outline" as const },
      ];
    }

    const units = new Map<string, ToolRow[]>();
    const groups: ToolRow[][] = [];
    for (const row of visibleRows) {
      const unitId = row.unitId == null ? "" : String(row.unitId);
      if (!unitId) groups.push([row]);
      else {
        const members = units.get(unitId) || [];
        members.push(row);
        units.set(unitId, members);
      }
    }
    groups.push(...units.values());
    const isActiveGroup = (members: ToolRow[]) =>
      members.some((row) => String(row.portfolioStatus || row.status || "").toLowerCase() === "active");
    const active = groups.filter(isActiveGroup).length;
    const inactive = groups.length - active;
    const dueGroups = groups.filter((members) =>
      members.some((row) => Number(row.outstandingPaymentNum || 0) > 0)
    );
    const exposure = visibleRows.reduce(
      (total, row) => total + Math.max(0, Number(row.outstandingPaymentNum) || 0),
      0
    );

    return [
      { label: "TOTAL ACCOUNTS", value: groups.length.toLocaleString("en-IN"), color: foreground, icon: "people-outline" as const },
      { label: "ACTIVE CLIENTS", value: active.toLocaleString("en-IN"), color: "#159A7C", icon: "checkmark-circle-outline" as const },
      { label: "INACTIVE / DORMANT", value: inactive.toLocaleString("en-IN"), color: "#DF5262", icon: "alert-circle-outline" as const },
      { label: "DUE ACCOUNTS", value: dueGroups.length.toLocaleString("en-IN"), color: "#D97706", icon: "time-outline" as const },
      { label: "TOTAL EXPOSURE", value: `₹${exposure.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#159A7C", icon: "cash-outline" as const },
    ];
  }, [tool, serverStats, customerSearch, customerStatus, customerBalance, visibleRows, foreground]);

  // Portfolio entries for team-customers
  const portfolioEntries = useMemo<PortfolioEntry[]>(() => {
    if (tool !== "team-customers") return [];
    const entries: PortfolioEntry[] = [];
    for (const row of visibleRows) {
      if (row.is_unit) {
        entries.push({
          kind: "unit",
          id: String(row.unit_id || row.id),
          name: String(row.name || "Customer unit"),
          members: Array.isArray(row.members) ? row.members : [],
        });
      } else {
        entries.push({ kind: "customer", row });
      }
    }
    return entries;
  }, [tool, visibleRows]);

  const openCustomerDetail = (id: unknown, tab?: string) =>
    router.push({ pathname: "/(employee)/customers/[customerId]", params: { customerId: String(id), ...(tab ? { tab } : {}) } } as any);

  const approve = async (id: unknown, action: "approve" | "reject") => {
    try {
      await api.post(`/customers/workspace/${tool}/`, { id, action });
      setRows((current) => current.filter((row) => row.id !== id));
    } catch {
      Alert.alert("Could not update claim", "Refresh the list and try again.");
    }
  };

  // Toggle ticket status for payment-followups
  const toggleTicket = async (voucherStatusId: string | number, currentStatus: string) => {
    const nextAction = currentStatus === "RAISED" ? "solve" : "raise";
    setActionInProgress(true);
    try {
      await api.post("/customers/workspace/payment-followups/", {
        action: nextAction,
        voucher_status_id: voucherStatusId,
      });
      await load();
    } catch {
      Alert.alert("Notice", `Could not update payment ticket to ${nextAction}.`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Add Remark Action for payment follow-ups
  const submitRemark = async () => {
    if (!newRemarkModal || !newRemarkText.trim()) return;
    setActionInProgress(true);
    try {
      const res = await api.post("/customers/workspace/payment-followups/", {
        action: "remark",
        voucher_status_id: newRemarkModal.voucher_status_id || newRemarkModal.id,
        remark: newRemarkText.trim(),
      });
      if (res.data?.status === "ok") {
        setNewRemarkModal((prev) => prev ? {
          ...prev,
          remarks: [res.data, ...(prev.remarks || [])]
        } : null);
      }
      setNewRemarkText("");
      Alert.alert("Remark Saved", "Payment follow-up remark recorded successfully.");
      await load();
    } catch {
      Alert.alert("Error", "Could not submit remark. Check permissions and try again.");
    } finally {
      setActionInProgress(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER: Team Customer Portfolio Card
  // -------------------------------------------------------------
  const renderPortfolioCustomer = (row: ToolRow, index: number) => {
    const customerName = String(row.name || "Customer");
    const initials = customerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const displayStatus = String(row.portfolioStatus || row.status || "");
    const status = displayStatus.toLowerCase();
    const statusColor = status === "active" ? "#159A7C" : status === "inactive" ? "#DF5262" : "#637083";
    const location = [row.city || row.district, row.state].filter(Boolean).map(String).filter((val, i, all) => all.indexOf(val) === i).join(", ");
    const customerId = row.id;
    const balanceNum = Number(row.outstandingPaymentNum || 0);

    return (
      <View key={String(customerId ?? index)} style={[styles.customerPortfolioCard, card]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => openCustomerDetail(customerId)} activeOpacity={0.78}>
          <View style={styles.customerPortfolioHeader}>
            <View style={[styles.customerAvatar, { backgroundColor: isDark ? "#183B32" : "#E2F7F1" }]}>
              <Text style={[styles.customerAvatarText, { color: "#159A7C" }]}>{initials || "C"}</Text>
            </View>
            <View style={styles.customerIdentity}>
              <Text style={[styles.rowTitle, { color: foreground }]} numberOfLines={2}>{customerName}</Text>
              {!!location && (
                <Text style={[styles.detail, { color: muted }]} numberOfLines={1}>
                  <Ionicons name="location-outline" size={12} color={muted} /> {location}
                </Text>
              )}
              {!!row.phone && (
                <Text style={[styles.detail, { color: muted }]} numberOfLines={1}>
                  <Ionicons name="call-outline" size={12} color={muted} /> {String(row.phone)}
                </Text>
              )}
            </View>
            {!!displayStatus && (
              <View style={[styles.statusBadge, { backgroundColor: isDark ? `${statusColor}22` : `${statusColor}14` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{displayStatus}</Text>
              </View>
            )}
          </View>

          <View style={[styles.ledgerMetrics, { backgroundColor: isDark ? "#0E1714" : "#F7F9F8", borderColor: card.borderColor }]}>
            <View style={styles.metricRow}>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: muted }]}>ORDERS</Text>
                <Text style={[styles.metricValue, { color: foreground }]}>{Number(row.totalOrders || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: muted }]}>TOTAL VALUE</Text>
                <Text style={[styles.metricValue, { color: foreground }]} numberOfLines={1}>
                  ₹{Number(row.totalOrderValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: muted }]}>OUTSTANDING</Text>
                <Text style={[styles.metricValue, { color: balanceNum > 0 ? "#D94A55" : balanceNum < 0 ? "#159A7C" : foreground }]} numberOfLines={1}>
                  {balanceNum < 0 ? `-₹${Math.abs(balanceNum).toLocaleString("en-IN")} (Cr)` : String(row.outstandingPayment || "₹0")}
                </Text>
              </View>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLabel, { color: muted }]}>SALESPERSON</Text>
                <Text style={[styles.metricValue, { color: foreground }]} numberOfLines={1}>
                  {String(row.assignedSalesperson || "Unassigned")}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.customerPortfolioFooter, { borderColor: card.borderColor }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={12} color="#159A7C" />
                <Text style={[styles.detail, { color: muted }]} numberOfLines={1}>
                  Last order: <Text style={{ color: foreground, fontFamily: Typography.medium }}>{String(row.lastOrderDate || "—")}</Text>
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color="#159A7C" />
                <Text style={[styles.detail, { color: muted }]} numberOfLines={1}>
                  Last contact: <Text style={{ color: foreground, fontFamily: Typography.medium }}>{String(row.lastContactTime || "No recent contact")}</Text>
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={muted} />
          </View>
        </TouchableOpacity>

        <View style={[styles.portfolioActions, { borderTopColor: card.borderColor }]}>
          <TouchableOpacity onPress={() => openCustomerDetail(customerId, "purchases")} style={[styles.portfolioAction, { borderColor: card.borderColor }]}>
            <Ionicons name="cart-outline" size={14} color="#159A7C" />
            <Text style={[styles.portfolioActionText, { color: foreground }]}>Purchases</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openCustomerDetail(customerId, "payments")} style={[styles.portfolioAction, { borderColor: card.borderColor }]}>
            <Ionicons name="card-outline" size={14} color="#159A7C" />
            <Text style={[styles.portfolioActionText, { color: foreground }]}>Payments</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNewRemarkModal({ id: customerId, customer: customerName })} style={[styles.portfolioAction, { borderColor: card.borderColor }]}>
            <Ionicons name="chatbubble-outline" size={14} color="#159A7C" />
            <Text style={[styles.portfolioActionText, { color: foreground }]}>Remarks</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // RENDER: Cross-Selling Matrix Card (Exact Web Alignment)
  // -------------------------------------------------------------
  const renderCrossSellingCard = (row: ToolRow, index: number) => {
    const custName = String(row.customer || "Customer");
    const initials = custName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    const isActive = Boolean(row.is_active);
    const boughtCount = Number(row.bought_count || row.bought || 0);
    const missingArr: string[] = Array.isArray(row.missing) ? row.missing : [];
    const missingIds: string[] = Array.isArray(row.missing_cat_ids) ? row.missing_cat_ids : [];
    const checklist: any[] = Array.isArray(row.checklist) ? row.checklist : [];

    return (
      <View key={`cs-${row.id || index}`} style={[styles.csCard, card]}>
        {/* Customer Header */}
        <View style={styles.csHeader}>
          <View style={[styles.csAvatar, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
            <Text style={{ fontFamily: Typography.bold, color: foreground, fontSize: 13 }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => openCustomerDetail(row.customer_id)}>
              <Text style={[styles.csTitle, { color: foreground }]} numberOfLines={1}>{custName}</Text>
            </TouchableOpacity>
            <Text style={[styles.csSub, { color: muted }]}>
              {row.city || row.state ? `${[row.city, row.state].filter(Boolean).join(", ")} · ` : ""}
              SP: <Text style={{ color: foreground, fontFamily: Typography.medium }}>{row.salesperson || "Unassigned"}</Text>
            </Text>
          </View>
          <View style={[styles.csStatusBadge, { backgroundColor: isActive ? "rgba(22, 163, 74, 0.12)" : "rgba(225, 29, 72, 0.12)" }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? "#16A34A" : "#E11D48" }]} />
            <Text style={{ color: isActive ? "#16A34A" : "#E11D48", fontFamily: Typography.bold, fontSize: 10 }}>
              {isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {/* Score & Gap Banner */}
        <View style={[styles.csScoreRow, { backgroundColor: isDark ? "#0A100E" : "#F8FAF9" }]}>
          <Text style={[styles.csScoreText, { color: foreground }]}>
            Categories Bought: <Text style={{ color: boughtCount === 5 ? "#16A34A" : "#D97706", fontFamily: Typography.bold }}>{boughtCount}/5</Text>
          </Text>
          <Text style={[styles.csGapText, { color: missingArr.length > 0 ? "#E11D48" : "#16A34A" }]}>
            {missingArr.length > 0 ? `${missingArr.length} Product Gaps` : "Fully Converted"}
          </Text>
        </View>

        {/* 5-Category Checklist (Exact Match to Web Checklist) */}
        <View style={styles.csChecklist}>
          {CROSS_SELLING_CATS.map((cat) => {
            const checkItem = checklist.find((c) => c.category_id === cat.id);
            const isBought = checkItem ? checkItem.bought : !missingArr.some((m) => m.toLowerCase().includes(cat.name.toLowerCase())) && !missingIds.includes(cat.id);

            return (
              <View
                key={cat.id}
                style={[
                  styles.csCheckItem,
                  {
                    backgroundColor: isBought ? (isDark ? "#062817" : "#F0FDF4") : (isDark ? "#2A0E13" : "#FEF2F2"),
                    borderColor: isBought ? "#86EFAC" : "#FECDD3",
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <View style={[styles.csCheckIconBox, { backgroundColor: isBought ? "#DCFCE7" : "#FEE2E2" }]}>
                    <Ionicons name={isBought ? "checkmark" : "close"} size={14} color={isBought ? "#15803D" : "#DC2626"} />
                  </View>
                  <Text style={[styles.csCatName, { color: isBought ? (isDark ? "#86EFAC" : "#166534") : (isDark ? "#FECDD3" : "#991B1B") }]}>
                    {cat.name}
                  </Text>
                  <Text style={[styles.csCatBadge, { color: muted }]}>({cat.badge})</Text>
                </View>
                <Text style={{ fontFamily: Typography.bold, fontSize: 10, color: isBought ? "#15803D" : "#DC2626" }}>
                  {isBought ? (checkItem?.total_qty ? `${checkItem.total_qty} units` : "BOUGHT") : "MISSING"}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Vouchers Row (Column 3 on Web) */}
        {Array.isArray(row.vouchers) && row.vouchers.length > 0 && (
          <View style={{ gap: 4, marginTop: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="receipt-outline" size={12} color="#159A7C" />
              <Text style={{ fontFamily: Typography.bold, fontSize: 9.5, color: muted, letterSpacing: 0.5 }}>RECENT VOUCHERS</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {row.vouchers.map((v: any, vIdx: number) => (
                <View
                  key={`v-${v.id || vIdx}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3.5,
                    borderRadius: 8,
                    borderWidth: 1,
                    backgroundColor: v.is_overdue ? (isDark ? "#2A0E13" : "#FEE2E2") : (isDark ? "#062817" : "#DCFCE7"),
                    borderColor: v.is_overdue ? "#FCA5A5" : "#86EFAC",
                  }}
                >
                  <Ionicons name={v.is_overdue ? "alert-circle" : "document-text"} size={11} color={v.is_overdue ? "#DC2626" : "#15803D"} />
                  <Text style={{ fontFamily: Typography.semiBold, fontSize: 10, color: v.is_overdue ? (isDark ? "#FECDD3" : "#991B1B") : (isDark ? "#86EFAC" : "#166534") }}>
                    {v.number} {v.date ? `· ${v.date.slice(0, 10)}` : ""}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Gap Remarks Feed (Column 4 on Web) */}
          {Array.isArray(row.remarks) && row.remarks.length > 0 && (
          <View style={{ gap: 5, padding: 8, borderRadius: 10, borderWidth: 1, backgroundColor: isDark ? "#0A1410" : "#F8FAF9", borderColor: card.borderColor }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="chatbubbles-outline" size={12} color="#159A7C" />
                <Text style={{ fontFamily: Typography.bold, fontSize: 9.5, color: muted, letterSpacing: 0.5 }}>GAP REMARKS ({row.remark_count || row.remarks.length})</Text>
            </View>
            {row.remarks.slice(-2).map((rmk: any, rIdx: number) => (
              <View key={`rmk-${rmk.id || rIdx}`} style={{ padding: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, backgroundColor: card.backgroundColor, borderColor: card.borderColor }}>
                <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: foreground }}>{rmk.text}</Text>
                <Text style={{ fontFamily: Typography.regular, fontSize: 9.5, color: muted, marginTop: 2 }}>{rmk.salesperson} · {rmk.created_at}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Action Buttons */}
        <View style={[styles.csActions, { borderTopColor: card.borderColor }]}>
          <TouchableOpacity onPress={() => openCustomerDetail(row.customer_id, "purchases")} style={[styles.csActionBtn, { borderColor: card.borderColor }]}>
            <Ionicons name="cart-outline" size={14} color="#159A7C" />
            <Text style={[styles.csActionText, { color: foreground }]}>View Invoices</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNewRemarkModal({ id: row.customer_id, customer: custName })} style={[styles.csActionBtn, { borderColor: card.borderColor }]}>
            <Ionicons name="chatbubble-outline" size={14} color="#159A7C" />
            <Text style={[styles.csActionText, { color: foreground }]}>Add Gap Remark</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // RENDER: Payment Follow-up Card (Exact Web Alignment)
  // -------------------------------------------------------------
  const renderPaymentFollowupCard = (row: ToolRow, index: number) => {
    const custName = String(row.customer || "Customer");
    const isOverdue = Boolean(row.overdue || row.is_credit_period_crossed);
    const unpaidAmt = Number(row.unpaid || row.unpaid_amount || row.amount || 0);
    const invoiceNum = String(row.invoice || row.voucher || `INV-${row.id || index}`);
    const ticketStatus = String(row.ticket_status || row.ticketStatus || "NONE");

    return (
      <View key={`pf-${row.id || index}`} style={[styles.pfCard, card]}>
        <View style={styles.pfHeader}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => openCustomerDetail(row.customer_id)}>
              <Text style={[styles.pfCustomer, { color: foreground }]} numberOfLines={1}>{custName}</Text>
            </TouchableOpacity>
            <Text style={[styles.pfMeta, { color: muted }]}>
              Inv #{invoiceNum} · {row.date || "Recent"} · SP: <Text style={{ color: foreground }}>{row.salesperson || "Assigned"}</Text>
            </Text>
          </View>
          <View style={[styles.pfDueBadge, { backgroundColor: isOverdue ? "rgba(227, 75, 89, 0.12)" : "rgba(245, 158, 11, 0.12)" }]}>
            <Ionicons name={isOverdue ? "alert-circle" : "time"} size={13} color={isOverdue ? "#E34B59" : "#D97706"} />
            <Text style={[styles.pfDueText, { color: isOverdue ? "#E34B59" : "#D97706" }]}>
              {isOverdue ? "OVERDUE" : "PENDING"}
            </Text>
          </View>
        </View>

        {/* Financial Highlights */}
        <View style={[styles.pfAmountsRow, { backgroundColor: isDark ? "#0A100E" : "#F8FAF9" }]}>
          <View>
            <Text style={[styles.pfAmountLabel, { color: muted }]}>UNPAID DUE</Text>
            <Text style={[styles.pfAmountValue, { color: "#E34B59" }]}>
              ₹{unpaidAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.pfAmountLabel, { color: muted }]}>TOTAL INVOICE</Text>
            <Text style={[styles.pfAmountValue, { color: foreground }]}>
              ₹{Number(row.amount || unpaidAmt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Ticket & Actions Footer */}
        <View style={[styles.pfActions, { borderTopColor: card.borderColor }]}>
          <TouchableOpacity
            disabled={actionInProgress}
            onPress={() => toggleTicket(row.id, ticketStatus)}
            style={[styles.ticketBtn, { backgroundColor: ticketStatus === "RAISED" ? "#DC2626" : "#0D9488" }]}
          >
            <Ionicons name={ticketStatus === "RAISED" ? "checkmark-circle" : "flag"} size={13} color="white" />
            <Text style={styles.ticketBtnText}>
              {ticketStatus === "RAISED" ? "Mark Solved" : "Raise Ticket"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setNewRemarkModal({
              id: row.id,
              voucher_status_id: row.voucher_status_id || row.id,
              customer: custName,
              remarks: row.remarks || [],
              expected_dates: row.expected_dates || [],
              ticket_status: ticketStatus,
            })}
            style={[styles.pfActionBtn, { borderColor: card.borderColor }]}
          >
            <Ionicons name="chatbubble-outline" size={13} color="#159A7C" />
            <Text style={[styles.pfActionText, { color: foreground }]}>
              Discussion ({Array.isArray(row.remarks) ? row.remarks.length : 0})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // RENDER: Unassigned Customer Card
  // -------------------------------------------------------------
  const renderUnassignedCard = (row: ToolRow, index: number) => {
    const customerName = String(row.name || "Customer");
    const initials = customerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const location = [row.district, row.state].filter(Boolean).join(", ");

    return (
      <View key={`unassigned-${row.id || index}`} style={[styles.customerPortfolioCard, card]}>
        <View style={styles.customerPortfolioHeader}>
          <View style={[styles.customerAvatar, { backgroundColor: isDark ? "#2A1818" : "#FEE2E2" }]}>
            <Text style={[styles.customerAvatarText, { color: "#EF4444" }]}>{initials || "U"}</Text>
          </View>
          <View style={styles.customerIdentity}>
            <TouchableOpacity onPress={() => openCustomerDetail(row.id)}>
              <Text style={[styles.rowTitle, { color: foreground }]} numberOfLines={2}>{customerName}</Text>
            </TouchableOpacity>
            {!!location && (
              <Text style={[styles.detail, { color: muted }]}>
                <Ionicons name="location-outline" size={12} color={muted} /> {location}
              </Text>
            )}
            {!!row.phone && (
              <Text style={[styles.detail, { color: muted }]}>
                <Ionicons name="call-outline" size={12} color={muted} /> {String(row.phone)}
              </Text>
            )}
            {!!row.address && (
              <Text style={[styles.detail, { color: muted }]}>
                <Ionicons name="home-outline" size={12} color={muted} /> {String(row.address)}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }]}>
            <Text style={[styles.statusText, { color: "#EF4444" }]}>Unassigned</Text>
          </View>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // RENDER: Monthly Sales Report Row (Exact Web Alignment)
  // -------------------------------------------------------------
  const renderMonthlySalesRow = (row: ToolRow, index: number) => {
    const custName = String(row.customer || "Customer");
    const status = String(row.status || "").toLowerCase();
    const isPaid = status === "paid" || Boolean(row.is_fully_paid);
    const isUnpaid = status === "unpaid" || Boolean(row.is_unpaid);
    const hasIncentive = Boolean(row.has_incentive);
    const qty = String(row.quantity || 0);
    const amount = Number(row.amount || 0);

    return (
      <View key={`ms-${row.id || index}`} style={[styles.msRowCard, card]}>
        <View style={styles.msRowHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.msCustomer, { color: foreground }]} numberOfLines={1}>{custName}</Text>
            <Text style={[styles.msDate, { color: muted }]}>{row.date} · Voucher #{row.voucher || row.voucher_no}</Text>
          </View>
          <View style={[styles.msStatusBadge, { backgroundColor: isPaid ? "rgba(22, 163, 74, 0.12)" : isUnpaid ? "rgba(220, 38, 38, 0.12)" : "rgba(245, 158, 11, 0.12)" }]}>
            <Text style={{ fontFamily: Typography.bold, fontSize: 10, color: isPaid ? "#16A34A" : isUnpaid ? "#DC2626" : "#D97706" }}>
              {isPaid ? "PAID" : isUnpaid ? "UNPAID" : "PARTIAL"}
            </Text>
          </View>
        </View>

        <View style={[styles.msBody, { backgroundColor: isDark ? "#0A100E" : "#F8FAF9" }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.msProduct, { color: hasIncentive ? (isDark ? "#00FF99" : "#059669") : (isDark ? "#FFD54D" : "#D97706") }]}>
              {row.product}
            </Text>
            <Text style={[styles.msQty, { color: muted }]}>Qty: {qty}</Text>
          </View>
          <Text style={[styles.msAmount, { color: foreground }]}>
            ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {/* Top Header */}
        <View style={styles.top}>
          <TouchableOpacity
            accessibilityLabel="Open customer navigation menu"
            onPress={() => setDrawerVisible(true)}
            style={[styles.back, card]}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={22} color={foreground} />
          </TouchableOpacity>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>CUSTOMER WORKSPACE</Text>
            <Text style={[styles.title, { color: foreground }]}>{title}</Text>
          </View>
        </View>

        {error ? (
          <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={[styles.notice, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}>
            <Text style={{ color: foreground, fontFamily: Typography.regular }}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        {/* Monthly Date Navigator for Monthly Sales & Incentives */}
        {isMonthlyReport && (
          <View style={[styles.monthNav, card]}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={foreground} />
            </TouchableOpacity>
            <View style={styles.monthCenter}>
              <Ionicons name="calendar-outline" size={16} color="#159A7C" />
              <Text style={[styles.monthText, { color: foreground }]}>{monthLabel}</Text>
            </View>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={foreground} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── TOOL: TEAM CUSTOMERS OVERVIEW & FILTERS ── */}
        {tool === "team-customers" && !loading && (
          <View style={styles.portfolioOverview}>
            <View style={[styles.customerFilters, card]}>
              <Text style={[styles.filterLabel, { color: muted }]}>SALESPERSON</Text>
              <TouchableOpacity
                onPress={() => setFilterMenu((m) => (m === "salesperson" ? null : "salesperson"))}
                style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
              >
                <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{customerSalesperson}</Text>
                <Ionicons name={filterMenu === "salesperson" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
              </TouchableOpacity>
              {filterMenu === "salesperson" && (
                <View style={[styles.filterOptions, { borderColor: card.borderColor }]}>
                  {salespersonOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => { setCustomerSalesperson(opt); setFilterMenu(null); }}
                      style={styles.filterOption}
                    >
                      <Text style={[styles.filterOptionText, { color: foreground }]}>{opt}</Text>
                      {customerSalesperson === opt && <Ionicons name="checkmark" size={17} color="#159A7C" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.filterLabel, { color: muted, marginTop: 10 }]}>SEARCH CLIENT / UNIT / PHONE</Text>
              <View style={[styles.customerSearch, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}>
                <Ionicons name="search-outline" size={17} color="#159A7C" />
                <TextInput
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder="Search by name, city, or phone…"
                  placeholderTextColor={muted}
                  style={[styles.customerSearchInput, { color: foreground }]}
                />
                {customerSearch ? (
                  <TouchableOpacity onPress={() => setCustomerSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={17} color={muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterColumn}>
                  <Text style={[styles.filterLabel, { color: muted }]}>CLIENT STATUS</Text>
                  <TouchableOpacity
                    onPress={() => setFilterMenu((m) => (m === "status" ? null : "status"))}
                    style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
                  >
                    <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{customerStatus}</Text>
                    <Ionicons name={filterMenu === "status" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.filterColumn}>
                  <Text style={[styles.filterLabel, { color: muted }]}>OUTSTANDING</Text>
                  <TouchableOpacity
                    onPress={() => setFilterMenu((m) => (m === "balance" ? null : "balance"))}
                    style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
                  >
                    <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{customerBalance}</Text>
                    <Ionicons name={filterMenu === "balance" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
                  </TouchableOpacity>
                </View>
              </View>

              {(filterMenu === "status" || filterMenu === "balance") && (
                <View style={[styles.filterOptions, { borderColor: card.borderColor }]}>
                  {(filterMenu === "status" ? ["All Statuses", "Active", "Inactive"] : ["All Balances", "With Dues", "Settled Balances"]).map((opt) => {
                    const sel = filterMenu === "status" ? customerStatus : customerBalance;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => {
                          if (filterMenu === "status") setCustomerStatus(opt);
                          else setCustomerBalance(opt);
                          setFilterMenu(null);
                        }}
                        style={styles.filterOption}
                      >
                        <Text style={[styles.filterOptionText, { color: foreground }]}>{opt}</Text>
                        {sel === opt && <Ionicons name="checkmark" size={17} color="#159A7C" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.filterResults}>
                <Text style={[styles.detail, { color: muted }]}>
                  {portfolioEntries.length} accounts shown · {visibleRows.length} ledgers
                </Text>
                <TouchableOpacity onPress={() => { setCustomerSearch(""); setCustomerSalesperson("All Salespeople"); setCustomerStatus("All Statuses"); setCustomerBalance("All Balances"); setFilterMenu(null); }}>
                  <Text style={styles.resetFilters}>Reset filters</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.overviewGrid}>
              {customerOverview.map((metric) => (
                <View key={metric.label} style={[styles.overviewMetric, card]}>
                  <View style={styles.overviewMetricTop}>
                    <Text style={[styles.metricLabel, { color: muted }]}>{metric.label}</Text>
                    <Ionicons name={metric.icon} size={17} color={metric.color} />
                  </View>
                  <Text style={[styles.overviewValue, { color: metric.color }]} numberOfLines={1} adjustsFontSizeToFit>
                    {metric.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── TOOL: CROSS-SELLING MATRIX KPI CARDS & FILTERS ── */}
        {tool === "cross-selling" && (
          <View style={{ gap: 12, marginBottom: 4, flexDirection: "column-reverse" }}>
            {/* KPI cards reuse the shared staff dashboard card styling. */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <MetricCard
                  label="Qualifying Customers"
                  value={crossSellingStats?.total_qualifying ?? (loading ? "…" : visibleRows.length)}
                  subValue={loading && !crossSellingStats ? "Loading summary…" : `${crossSellingStats?.active_count ?? visibleRows.filter((r) => r.is_active).length} Active · ${crossSellingStats?.inactive_count ?? visibleRows.filter((r) => !r.is_active).length} Inactive`}
                  icon="people-outline"
                  isHighlight
                />
                <MetricCard
                  label="Fully Converted"
                  value={crossSellingStats?.fully_converted ?? (loading ? "…" : visibleRows.filter((r) => (r.bought_count || r.bought) === 5).length)}
                  subValue="Bought all 5 categories"
                  icon="checkmark-circle-outline"
                  isHighlight
                />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <MetricCard
                  label="Cross-Sell Gaps"
                  value={crossSellingStats?.cross_sell_opportunities ?? (loading ? "…" : visibleRows.filter((r) => (r.bought_count || r.bought) < 5).length)}
                  subValue="1–4 categories bought"
                  icon="cart-outline"
                  isHighlight
                />
                <MetricCard
                  label="Conversion Rate"
                  value={loading && !crossSellingStats ? "…" : crossSellingStats?.total_qualifying ? `${Math.round(((crossSellingStats.fully_converted || 0) / crossSellingStats.total_qualifying) * 100)}%` : "0%"}
                  subValue="Portfolio coverage"
                  icon="trending-up-outline"
                  isHighlight
                />
              </View>
            </View>

            {/* Filter Command Bar */}
            <View style={[styles.customerFilters, card]}>
              <Text style={[styles.filterLabel, { color: muted }]}>SALESPERSON</Text>
              <TouchableOpacity
                onPress={() => setFilterMenu((m) => (m === "salesperson" ? null : "salesperson"))}
                style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
              >
                <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{customerSalesperson}</Text>
                <Ionicons name={filterMenu === "salesperson" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
              </TouchableOpacity>
              {filterMenu === "salesperson" && (
                <View style={[styles.filterOptions, { borderColor: card.borderColor }]}>
                  {salespersonOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => { setCustomerSalesperson(opt); setFilterMenu(null); }}
                      style={styles.filterOption}
                    >
                      <Text style={[styles.filterOptionText, { color: foreground }]}>{opt}</Text>
                      {customerSalesperson === opt && <Ionicons name="checkmark" size={17} color="#159A7C" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.filterLabel, { color: muted, marginTop: 10 }]}>SEARCH CUSTOMER / CITY</Text>
              <View style={[styles.customerSearch, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}>
                <Ionicons name="search-outline" size={17} color="#159A7C" />
                <TextInput
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder="Search customer by name, city, phone…"
                  placeholderTextColor={muted}
                  style={[styles.customerSearchInput, { color: foreground }]}
                />
                {customerSearch ? (
                  <TouchableOpacity onPress={() => setCustomerSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={17} color={muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.filterRow}>
                <View style={styles.filterColumn}>
                  <Text style={[styles.filterLabel, { color: muted }]}>MISSING CATEGORY</Text>
                  <TouchableOpacity
                    onPress={() => setFilterMenu((m) => (m === "missing_cat" ? null : "missing_cat"))}
                    style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
                  >
                    <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{csMissingCat}</Text>
                    <Ionicons name={filterMenu === "missing_cat" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.filterColumn}>
                  <Text style={[styles.filterLabel, { color: muted }]}>SCORE (BOUGHT)</Text>
                  <TouchableOpacity
                    onPress={() => setFilterMenu((m) => (m === "score" ? null : "score"))}
                    style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
                  >
                    <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{csScore}</Text>
                    <Ionicons name={filterMenu === "score" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
                  </TouchableOpacity>
                </View>
              </View>

              {(filterMenu === "missing_cat" || filterMenu === "score") && (
                <View style={[styles.filterOptions, { borderColor: card.borderColor }]}>
                  {(filterMenu === "missing_cat"
                    ? ["All Missing Categories", "Template Sheet", "Aligner Sheet", "Retainer Sheet", "Resin", "Other Consumables"]
                    : ["All Scores", "5/5 Categories", "4 Categories", "3 Categories", "2 Categories", "1 Category"]
                  ).map((opt) => {
                    const sel = filterMenu === "missing_cat" ? csMissingCat : csScore;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => {
                          if (filterMenu === "missing_cat") setCsMissingCat(opt);
                          else setCsScore(opt);
                          setFilterMenu(null);
                        }}
                        style={styles.filterOption}
                      >
                        <Text style={[styles.filterOptionText, { color: foreground }]}>{opt}</Text>
                        {sel === opt && <Ionicons name="checkmark" size={17} color="#159A7C" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.filterResults}>
                <Text style={[styles.detail, { color: muted }]}>Showing {visibleRows.length} of {crossSellingTotal} accounts</Text>
                <TouchableOpacity onPress={() => { setCustomerSearch(""); setCustomerSalesperson("All Salespeople"); setCustomerStatus("All Statuses"); setCsMissingCat("All Missing Categories"); setCsScore("All Scores"); setFilterMenu(null); }}>
                  <Text style={styles.resetFilters}>Reset filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── TOOL: PAYMENT FOLLOW-UPS FILTERS ── */}
        {tool === "payment-followups" && !loading && (
          <View style={[styles.customerFilters, card, { marginBottom: 4 }]}>
            <Text style={[styles.filterLabel, { color: muted }]}>SEARCH INVOICE / CLIENT</Text>
            <View style={[styles.customerSearch, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}>
              <Ionicons name="search-outline" size={17} color="#159A7C" />
              <TextInput
                value={customerSearch}
                onChangeText={setCustomerSearch}
                placeholder="Search invoice number or customer…"
                placeholderTextColor={muted}
                style={[styles.customerSearchInput, { color: foreground }]}
              />
              {customerSearch ? (
                <TouchableOpacity onPress={() => setCustomerSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.filterRow}>
              <View style={styles.filterColumn}>
                <Text style={[styles.filterLabel, { color: muted }]}>SALESPERSON</Text>
                <TouchableOpacity
                  onPress={() => setFilterMenu((m) => (m === "salesperson" ? null : "salesperson"))}
                  style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
                >
                  <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{customerSalesperson}</Text>
                  <Ionicons name={filterMenu === "salesperson" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
                </TouchableOpacity>
              </View>
              <View style={styles.filterColumn}>
                <Text style={[styles.filterLabel, { color: muted }]}>PAYMENT STATUS</Text>
                <TouchableOpacity
                  onPress={() => setFilterMenu((m) => (m === "status" ? null : "status"))}
                  style={[styles.filterSelect, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}
                >
                  <Text style={[styles.filterSelectText, { color: foreground }]} numberOfLines={1}>{paymentStatusFilter}</Text>
                  <Ionicons name={filterMenu === "status" ? "chevron-up" : "chevron-down"} size={16} color={muted} />
                </TouchableOpacity>
              </View>
            </View>

            {(filterMenu === "salesperson" || filterMenu === "status") && (
              <View style={[styles.filterOptions, { borderColor: card.borderColor }]}>
                {(filterMenu === "salesperson" ? salespersonOptions : ["All Payments", "Overdue Only", "Pending"]).map((opt) => {
                  const sel = filterMenu === "salesperson" ? customerSalesperson : paymentStatusFilter;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => {
                        if (filterMenu === "salesperson") setCustomerSalesperson(opt);
                        else setPaymentStatusFilter(opt);
                        setFilterMenu(null);
                      }}
                      style={styles.filterOption}
                    >
                      <Text style={[styles.filterOptionText, { color: foreground }]}>{opt}</Text>
                      {sel === opt && <Ionicons name="checkmark" size={17} color="#159A7C" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.filterResults}>
              <Text style={[styles.detail, { color: muted }]}>{visibleRows.length} vouchers pending</Text>
              <TouchableOpacity onPress={() => { setCustomerSearch(""); setCustomerSalesperson("All Salespeople"); setPaymentStatusFilter("All Payments"); setFilterMenu(null); }}>
                <Text style={styles.resetFilters}>Reset filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── TOOL: MONTHLY SALES SUMMARY BANNER ── */}
        {tool === "monthly-sales" && summary ? (
          <View style={[styles.banner, { backgroundColor: "#0E9E83", marginBottom: 2 }]}>
            <Ionicons name="receipt-outline" size={24} color="white" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{summary}</Text>
              <Text style={styles.bannerSub}>{visibleRows.length} processed sales lines in {monthLabel}</Text>
            </View>
          </View>
        ) : null}

        {/* Main Records List / View Switching */}
        {loading ? (
          <SkeletonCardList count={5} height={96} style={{ marginTop: 12 }} />
        ) : tool === "team-customers" ? (
          portfolioEntries.map((entry, index) => {
            if (entry.kind === "customer") return renderPortfolioCustomer(entry.row, index);
            const orders = entry.members.reduce((t, m) => t + (Number(m.totalOrders) || 0), 0);
            const value = entry.members.reduce((t, m) => t + (Number(m.totalOrderValue) || 0), 0);
            const outstanding = entry.members.reduce((t, m) => t + Math.max(0, Number(m.outstandingPaymentNum) || 0), 0);
            const active = entry.members.some((m) => String(m.portfolioStatus || m.status || "").toLowerCase() === "active");
            const unitColor = active ? "#159A7C" : "#DF5262";

            return (
              <View key={`unit-${entry.id}`} style={[styles.unitCard, card]}>
                <TouchableOpacity
                  onPress={() =>
                    setExpandedUnitIds((cur) => {
                      const next = new Set(cur);
                      if (next.has(entry.id)) next.delete(entry.id);
                      else next.add(entry.id);
                      return next;
                    })
                  }
                  style={styles.unitHeader}
                >
                  <View style={[styles.unitIcon, { backgroundColor: isDark ? "#183B32" : "#E2F7F1" }]}>
                    <Ionicons name="business-outline" size={19} color="#159A7C" />
                  </View>
                  <View style={styles.customerIdentity}>
                    <Text style={[styles.rowTitle, { color: foreground }]} numberOfLines={2}>{entry.name}</Text>
                    <Text style={[styles.detail, { color: muted }]}>
                      {entry.members.length} {entry.members.length === 1 ? "ledger" : "ledgers"} · {orders} orders
                    </Text>
                    <Text style={[styles.detail, { color: muted }]}>
                      Value ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} · Due ₹{outstanding.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={{ alignItems: "center", gap: 5 }}>
                    <View style={[styles.unitStatus, { backgroundColor: isDark ? `${unitColor}22` : `${unitColor}14` }]}>
                      <Text style={[styles.statusText, { color: unitColor }]}>{active ? "Active" : "Inactive"}</Text>
                    </View>
                    <Ionicons name={expandedUnitIds.has(entry.id) ? "chevron-up" : "chevron-down"} size={19} color="#159A7C" />
                  </View>
                </TouchableOpacity>

                {expandedUnitIds.has(entry.id) && (
                  <View style={styles.unitMembers}>
                    {entry.members.map((member, mIdx) => renderPortfolioCustomer(member, mIdx))}
                  </View>
                )}
              </View>
            );
          })
        ) : tool === "cross-selling" ? (
          visibleRows.map((row, idx) => renderCrossSellingCard(row, idx))
        ) : tool === "payment-followups" ? (
          visibleRows.map((row, idx) => renderPaymentFollowupCard(row, idx))
        ) : tool === "unassigned" ? (
          visibleRows.map((row, idx) => renderUnassignedCard(row, idx))
        ) : tool === "monthly-sales" ? (
          visibleRows.map((row, idx) => renderMonthlySalesRow(row, idx))
        ) : (
          visibleRows.map((row, index) => (
            <View key={String(row.id ?? index)} style={[styles.genericRow, card]}>
              <View style={styles.iconBox}>
                <Ionicons name={ICONS[tool] || "document-text-outline"} size={19} color="#159A7C" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.rowTitle, { color: foreground }]}>
                  {String(row.customer || row.name || row.voucher || "Record")}
                </Text>
                <Text style={[styles.detail, { color: muted }]}>
                  {Object.entries(row)
                    .filter(([k, v]) => k !== "id" && v !== null && v !== undefined && v !== "" && k !== "customer")
                    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${String(v)}`)
                    .join("  ·  ")}
                </Text>
              </View>
              {tool === "voucher-approvals" && (
                <View style={{ gap: 6 }}>
                  <TouchableOpacity onPress={() => void approve(row.id, "approve")} style={styles.approveBtn}>
                    <Ionicons name="checkmark" size={17} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => void approve(row.id, "reject")} style={styles.rejectBtn}>
                    <Ionicons name="close" size={17} color="white" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

        {/* ── PAGINATION CONTROLS FOR CROSS SELLING ── */}
        {tool === "cross-selling" && !loading && crossSellingTotalPages > 1 && (
          <View style={styles.paginationContainer}>
            <Text style={[styles.paginationInfo, { color: muted }]}>
              Showing {rows.length} of {crossSellingTotal} accounts · Page {crossSellingPage} of {crossSellingTotalPages}
            </Text>
            <View style={styles.paginationBar}>
              <TouchableOpacity
                onPress={() => {
                  if (crossSellingHasPrev && !loading && !loadingMore) {
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                    void load(crossSellingPage - 1, false);
                  }
                }}
                disabled={!crossSellingHasPrev || loading || loadingMore}
                activeOpacity={0.75}
                style={[
                  styles.pageNavButton,
                  card,
                  !crossSellingHasPrev && { opacity: 0.35 },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={crossSellingHasPrev ? foreground : muted} />
                <Text style={[styles.pageNavText, { color: crossSellingHasPrev ? foreground : muted }]}>Previous</Text>
              </TouchableOpacity>

              <View style={[styles.pageIndicator, card, { backgroundColor: isDark ? "#183B32" : "#E2F7F1", borderColor: "#159A7C" }]}>
                <Text style={[styles.pageIndicatorText, { color: "#159A7C" }]}>
                  Page {crossSellingPage} of {crossSellingTotalPages}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (crossSellingHasNext && !loading && !loadingMore) {
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                    void load(crossSellingPage + 1, false);
                  }
                }}
                disabled={!crossSellingHasNext || loading || loadingMore}
                activeOpacity={0.75}
                style={[
                  styles.pageNavButton,
                  card,
                  !crossSellingHasNext && { opacity: 0.35 },
                ]}
              >
                <Text style={[styles.pageNavText, { color: crossSellingHasNext ? foreground : muted }]}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color={crossSellingHasNext ? foreground : muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── PAGINATION CONTROLS FOR TEAM CUSTOMERS ── */}
        {tool === "team-customers" && !loading && totalAccountCount > 0 && (
          <View style={styles.paginationContainer}>
            <Text style={[styles.paginationInfo, { color: muted }]}>
              Showing {visibleRows.length} of {totalAccountCount} accounts · Page {currentPage} of {totalPages}
            </Text>

            {totalPages > 1 && (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  onPress={() => {
                    if (hasPrevPage && !loading && !loadingMore) {
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                      void load(currentPage - 1, false);
                    }
                  }}
                  disabled={!hasPrevPage || loading || loadingMore}
                  activeOpacity={0.75}
                  style={[
                    styles.pageNavButton,
                    card,
                    !hasPrevPage && { opacity: 0.35 },
                  ]}
                >
                  <Ionicons name="chevron-back" size={18} color={hasPrevPage ? foreground : muted} />
                  <Text style={[styles.pageNavText, { color: hasPrevPage ? foreground : muted }]}>Previous</Text>
                </TouchableOpacity>

                <View style={[styles.pageIndicator, card, { backgroundColor: isDark ? "#183B32" : "#E2F7F1", borderColor: "#159A7C" }]}>
                  <Text style={[styles.pageIndicatorText, { color: "#159A7C" }]}>
                    Page {currentPage} of {totalPages}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (hasNextPage && !loading && !loadingMore) {
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                      void load(currentPage + 1, false);
                    }
                  }}
                  disabled={!hasNextPage || loading || loadingMore}
                  activeOpacity={0.75}
                  style={[
                    styles.pageNavButton,
                    card,
                    !hasNextPage && { opacity: 0.35 },
                  ]}
                >
                  <Text style={[styles.pageNavText, { color: hasNextPage ? foreground : muted }]}>Next</Text>
                  <Ionicons name="chevron-forward" size={18} color={hasNextPage ? foreground : muted} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {!loading && !error && visibleRows.length === 0 && (
          <View style={[styles.emptyCard, card]}>
            <Ionicons name={ICONS[tool] || "document-text-outline"} size={32} color="#159A7C" />
            <Text style={[styles.emptyTitle, { color: foreground }]}>No records match these filters</Text>
            <Text style={[styles.detail, { color: muted }]}>Try resetting filters or searching for another term.</Text>
            <TouchableOpacity
              onPress={() => {
                if (tool === "cross-selling") {
                  setCustomerSalesperson("All Salespeople");
                  setCustomerSearch("");
                  setDebouncedCustomerSearch("");
                  setCsMissingCat("All Missing Categories");
                  setCsScore("All Scores");
                }
                setLoading(true);
                void load(1);
              }}
              style={{
                marginTop: 12,
                backgroundColor: "#159A7C",
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 10,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#FFFFFF", fontFamily: Typography.semiBold, fontSize: 12 }}>
                Reset Filters & Refresh
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── MODAL: PAYMENT DISCUSSION & REMARKS HISTORY ── */}
      <Modal visible={newRemarkModal !== null} transparent animationType="fade" onRequestClose={() => setNewRemarkModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, card, { maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>Payment Discussion</Text>
              <TouchableOpacity onPress={() => { setNewRemarkModal(null); setNewRemarkText(""); }}>
                <Ionicons name="close" size={22} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.detail, { color: muted, marginBottom: 8 }]}>Account: {newRemarkModal?.customer}</Text>

            {/* Remarks History */}
            <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
              {Array.isArray(newRemarkModal?.remarks) && newRemarkModal.remarks.length > 0 ? (
                newRemarkModal.remarks.map((r: any, rIdx: number) => (
                  <View key={`rem-${r.id || rIdx}`} style={{ backgroundColor: isDark ? "#121A16" : "#F4F7F5", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: card.borderColor }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontFamily: Typography.semiBold, fontSize: 11, color: "#159A7C" }}>{r.user || "Staff"}</Text>
                      <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>{r.time || ""}</Text>
                    </View>
                    <Text style={{ fontFamily: Typography.regular, fontSize: 12, color: foreground }}>{r.text || r.remark}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: muted, fontSize: 12, fontStyle: "italic", textAlign: "center", paddingVertical: 12 }}>
                  No previous payment discussion remarks.
                </Text>
              )}
            </ScrollView>

            <TextInput
              style={[styles.modalInput, { borderColor: card.borderColor, color: foreground, minHeight: 60 }]}
              placeholder="Log follow-up discussion remark..."
              placeholderTextColor={muted}
              multiline
              value={newRemarkText}
              onChangeText={setNewRemarkText}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => { setNewRemarkModal(null); setNewRemarkText(""); }}
                style={[styles.modalCancel, { borderColor: card.borderColor }]}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void submitRemark()}
                disabled={actionInProgress || !newRemarkText.trim()}
                style={[styles.modalSave, { backgroundColor: "#159A7C" }]}
              >
                <Text style={[styles.modalBtnText, { color: "white" }]}>Post Remark</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomerNavDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        isAdmin={isAdminUser}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  back: { borderWidth: 1, width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1 },
  eyebrow: { color: "#20B99A", fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: Typography.heading, fontSize: 22, marginTop: 2 },
  notice: { padding: 12, borderRadius: 12 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14 },
  bannerTitle: { color: "white", fontFamily: Typography.headingSemi, fontSize: 15 },
  bannerSub: { color: "#D9FFF5", fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  monthNav: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthArrow: { padding: 8 },
  monthCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthText: { fontFamily: Typography.semiBold, fontSize: 14 },
  portfolioOverview: { gap: 10, marginBottom: 2 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  overviewMetric: { width: "48%", minHeight: 84, borderWidth: 1, borderRadius: 16, padding: 12, justifyContent: "space-between" },
  overviewMetricTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4 },
  overviewValue: { fontFamily: Typography.heading, fontSize: 19 },
  metricLabel: { fontFamily: Typography.bold, fontSize: 9.5, letterSpacing: 0.5 },
  metricValue: { fontFamily: Typography.semiBold, fontSize: 13 },
  customerFilters: { borderWidth: 1, borderRadius: 16, padding: 12 },
  filterLabel: { fontFamily: Typography.bold, fontSize: 9, letterSpacing: 0.55, marginBottom: 5 },
  filterSelect: { minHeight: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  filterSelectText: { flex: 1, fontFamily: Typography.regular, fontSize: 12 },
  filterOptions: { borderWidth: 1, borderRadius: 11, marginTop: 4, overflow: "hidden" },
  filterOption: { minHeight: 42, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterOptionText: { fontFamily: Typography.regular, fontSize: 12 },
  customerSearch: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  customerSearchInput: { flex: 1, paddingVertical: 8, fontFamily: Typography.regular, fontSize: 12 },
  filterRow: { flexDirection: "row", gap: 9, marginTop: 10 },
  filterColumn: { flex: 1 },
  filterResults: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resetFilters: { fontFamily: Typography.semiBold, color: "#159A7C", fontSize: 11 },
  customerPortfolioCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 9 },
  customerPortfolioHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  customerAvatar: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  customerAvatarText: { fontFamily: Typography.bold, fontSize: 13 },
  customerIdentity: { flex: 1, gap: 3 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: Typography.semiBold, fontSize: 10 },
  ledgerMetrics: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  metricCol: { flex: 1, gap: 2 },
  customerPortfolioFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  portfolioActions: { flexDirection: "row", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, marginTop: 2 },
  portfolioAction: { flex: 1, minHeight: 36, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  portfolioActionText: { fontFamily: Typography.semiBold, fontSize: 11 },
  unitCard: { borderWidth: 1, borderRadius: 17, overflow: "hidden" },
  unitHeader: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  unitIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  unitStatus: { borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  unitMembers: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  csCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  csHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  csAvatar: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  csTitle: { fontFamily: Typography.semiBold, fontSize: 14 },
  csSub: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  csStatusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3.5 },
  csScoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  csScoreText: { fontFamily: Typography.medium, fontSize: 11 },
  csGapText: { fontFamily: Typography.bold, fontSize: 11 },
  csChecklist: { gap: 6 },
  csCheckItem: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  csCheckIconBox: { width: 20, height: 20, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  csCatName: { fontFamily: Typography.semiBold, fontSize: 11 },
  csCatBadge: { fontFamily: Typography.regular, fontSize: 10 },
  csActions: { flexDirection: "row", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  csActionBtn: { flex: 1, minHeight: 34, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  csActionText: { fontFamily: Typography.medium, fontSize: 11 },
  pfCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  pfHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pfCustomer: { fontFamily: Typography.semiBold, fontSize: 14 },
  pfMeta: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  pfDueBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  pfDueText: { fontFamily: Typography.bold, fontSize: 10 },
  pfAmountsRow: { flexDirection: "row", justifyContent: "space-between", padding: 10, borderRadius: 12 },
  pfAmountLabel: { fontFamily: Typography.bold, fontSize: 9.5, letterSpacing: 0.5 },
  pfAmountValue: { fontFamily: Typography.heading, fontSize: 15, marginTop: 2 },
  pfActions: { flexDirection: "row", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  ticketBtn: { flex: 1, minHeight: 34, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  ticketBtnText: { color: "white", fontFamily: Typography.bold, fontSize: 11 },
  pfActionBtn: { flex: 1, minHeight: 34, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  pfActionText: { fontFamily: Typography.medium, fontSize: 11 },
  msRowCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  msRowHeader: { padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  msCustomer: { fontFamily: Typography.semiBold, fontSize: 13 },
  msDate: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  msStatusBadge: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3.5 },
  msBody: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  msProduct: { fontFamily: Typography.semiBold, fontSize: 12 },
  msQty: { fontFamily: Typography.regular, fontSize: 10.5, marginTop: 1 },
  msAmount: { fontFamily: Typography.bold, fontSize: 13 },
  genericRow: { minHeight: 72, borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#DDF8F0", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: Typography.semiBold, fontSize: 13 },
  detail: { fontFamily: Typography.regular, fontSize: 11, lineHeight: 16 },
  approveBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#159A7C", alignItems: "center", justifyContent: "center" },
  rejectBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#DF5262", alignItems: "center", justifyContent: "center" },
  emptyCard: { minHeight: 140, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 6, padding: 16 },
  emptyTitle: { fontFamily: Typography.semiBold, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalCard: { borderRadius: 18, padding: 18, gap: 10 },
  modalTitle: { fontFamily: Typography.headingSemi, fontSize: 16 },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: "top", fontFamily: Typography.regular, fontSize: 13 },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  modalCancel: { minHeight: 38, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  modalSave: { minHeight: 38, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  modalBtnText: { fontFamily: Typography.semiBold, fontSize: 12 },
  paginationContainer: { marginTop: 16, marginBottom: 24, gap: 12, alignItems: "stretch" },
  paginationInfo: { textAlign: "center", fontFamily: Typography.regular, fontSize: 12 },
  loadMoreButton: { minHeight: 46, borderRadius: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, gap: 8 },
  loadMoreText: { fontFamily: Typography.semiBold, fontSize: 13 },
  paginationBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pageNavButton: { minHeight: 40, flex: 1, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10 },
  pageNavText: { fontFamily: Typography.semiBold, fontSize: 12 },
  pageIndicator: { minHeight: 40, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pageIndicatorText: { fontFamily: Typography.bold, fontSize: 12 },
});