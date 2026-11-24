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
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import { Typography } from "@/constants/theme";
import { MetricCard } from "@/components/employee/MetricCard";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";
import { assignUnassignedCustomerApi, fetchCustomerFilterOptionsApi } from "@/services/customerService";
import { isSalespersonActive } from "@/constants/salespeople";

type ToolRow = Record<string, any>;
type RsmOption = { id: number | string; name: string };
type CustomerFilterMenu = "salesperson" | "status" | "balance" | "missing_cat" | "score" | null;
type PortfolioEntry =
  | { kind: "unit"; id: string; unit_id?: string | number; name: string; members: ToolRow[]; rawRow?: ToolRow }
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
  const { t } = useEmployeeTheme();
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

  // Strict RBAC: Only Business Manager (vibhuti_), Sales Head (bhavya), and Admins can assign customers
  const canAssignCustomers = useMemo(() => {
    const u = (user?.username || "").toLowerCase().trim();
    const r = `${user?.role || ""} ${user?.roleKey || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
    const allRoles = (user?.roles || []).map((item) => (item.key || item.name || "").toLowerCase());

    const isVibhuti = u.includes("vibhuti") || r.includes("business") || allRoles.some((rk) => rk.includes("business"));
    const isBhavya = u.includes("bhavya") || r.includes("sales_head") || allRoles.some((rk) => rk.includes("sales_head"));
    const isAdmin =
      isAdminUser ||
      isSuperuser ||
      r.includes("admin") ||
      u === "infected" ||
      u === "admin" ||
      (user?.permissions || []).includes("*");

    return isVibhuti || isBhavya || isAdmin;
  }, [user, permissionProfile, isAdminUser, isSuperuser]);

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
    "unassigned":
      canAssignCustomers ||
      isAdminUser ||
      userHasRole("sales_head") ||
      hasPermission(permissionProfile, "customer.view_all"),
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

  // Incentive states
  const [incentiveSummary, setIncentiveSummary] = useState<any>(null);
  const [incentiveSalespersons, setIncentiveSalespersons] = useState<{ id: number | string; name: string }[]>([]);
  const [selectedIncentiveSp, setSelectedIncentiveSp] = useState<string | null>(null);
  const [arrearsRows, setArrearsRows] = useState<any[]>([]);
  const [incentiveCats, setIncentiveCats] = useState<Record<string, number>>({});

  // RSM specific state
  const [rsmSummary, setRsmSummary] = useState<any>(null);
  const [rsmTeamReport, setRsmTeamReport] = useState<any[]>([]);
  const [teamCategorySummary, setTeamCategorySummary] = useState<Record<string, number>>({});
  const [expandedAsmNames, setExpandedAsmNames] = useState<Record<string, boolean>>({});

  // Sales Head specific state
  const [salesHeadSummary, setSalesHeadSummary] = useState<any>(null);
  const [salesHeadReport, setSalesHeadReport] = useState<any[]>([]);
  const [salesHeadCats, setSalesHeadCats] = useState<Record<string, number>>({});
  const [salesHeadName, setSalesHeadName] = useState<string>("Sales Head");
  const [expandedRepNames, setExpandedRepNames] = useState<Record<string, boolean>>({});

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
  const [paymentViewMode, setPaymentViewMode] = useState<"table" | "cards">("table");
  const [newRemarkModal, setNewRemarkModal] = useState<{ id: string | number; voucher_status_id?: string | number; customer: string; remarks?: any[]; expected_dates?: any[]; ticket_status?: string } | null>(null);
  const [newRemarkText, setNewRemarkText] = useState("");
  const [newExpectedDate, setNewExpectedDate] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);
  const [expectedDateModal, setExpectedDateModal] = useState<{ voucherStatusId: string | number; customer: string; currentDate?: string } | null>(null);
  const [expectedDateInput, setExpectedDateInput] = useState("");

  // Unassigned customer assignment state (strictly for vibhuti_, bhavya, and admins)
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<number[]>([]);
  const [unassignedViewMode, setUnassignedViewMode] = useState<"table" | "cards">("table");
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTargetCustomers, setAssignTargetCustomers] = useState<Array<{ id: number; name: string }>>([]);
  const [availableSalespersons, setAvailableSalespersons] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<number | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [salespersonSearch, setSalespersonSearch] = useState("");

  // Customer Unit state & modals
  const [allUnits, setAllUnits] = useState<Array<{ id: number; name: string; salesperson?: string }>>([]);
  const [createUnitModal, setCreateUnitModal] = useState<{ visible: boolean; preselectedCustomerId?: number | string; preselectedCustomerName?: string } | null>(null);
  const [createUnitName, setCreateUnitName] = useState("");
  const [createUnitSalespersonId, setCreateUnitSalespersonId] = useState<number | null>(null);
  const [renameUnitModal, setRenameUnitModal] = useState<{ id: string | number; currentName: string } | null>(null);
  const [renameUnitName, setRenameUnitName] = useState("");
  const [addToUnitModal, setAddToUnitModal] = useState<{ customerId: number | string; customerName: string } | null>(null);
  const [selectedUnitIdForAdd, setSelectedUnitIdForAdd] = useState<number | null>(null);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
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
      if (tool === "cross-selling") setCrossSellingStats(null);
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
        const reportParams = tool === "monthly-sales"
          ? { month: monthKey }
          : isMonthlyReport
          ? {
              month_picker: monthKey,
              ...(tool === "rsm-incentives" && selectedRsm ? { rsm: selectedRsm } : {}),
              ...(tool === "my-incentives" && selectedIncentiveSp ? { salesperson: selectedIncentiveSp } : {}),
            }
          : {};
        result = await api.get(`/customers/workspace/${tool}/`, {
          params: reportParams,
        });
      }

      if (tool === "cross-selling" && requestSequence !== crossSellingRequestSequence.current) return;

      let data = result?.data;
      console.log(`[INCENTIVES_DEBUG] tool=${tool} month=${monthKey}`, JSON.stringify(data));
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
        if (Array.isArray(data.all_units)) {
          setAllUnits(data.all_units);
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
          const activeList = data.salespersons.filter((s: any) => isSalespersonActive(s?.name));
          setServerSalespeople(activeList.map((s: any) => s.name));
          setAvailableSalespersons(
            activeList.map((s: any) => ({
              id: Number(s.id),
              name: String(s.name),
            }))
          );
        } else {
          setServerSalespeople(data.salespersons.filter((n: any) => isSalespersonActive(String(n))).map(String));
        }
      }

      if (tool === "cross-selling" && data?.stats) {
        setCrossSellingStats(data.stats);
      }

      setProductRows(tool === "my-incentives" && Array.isArray(data?.products) ? data.products : []);
      if (tool === "my-incentives") {
        setIncentiveSummary(data?.summary || null);
        if (Array.isArray(data?.salespersons)) {
          const activeSps = data.salespersons.filter((s: any) => isSalespersonActive(s?.name));
          setIncentiveSalespersons(activeSps);
          if (data?.selected_salesperson?.id != null && selectedIncentiveSp !== String(data.selected_salesperson.id)) {
            setSelectedIncentiveSp(String(data.selected_salesperson.id));
          } else if (!selectedIncentiveSp && activeSps.length > 0) {
            setSelectedIncentiveSp(String(activeSps[0].id));
          }
        }
        setArrearsRows(Array.isArray(data?.arrears) ? data.arrears : []);
        setIncentiveCats(data?.category_summary || {});
      }
      if (tool === "rsm-incentives") {
        const options = Array.isArray(data?.rsms) ? data.rsms.filter((r: any) => isSalespersonActive(r?.name)) : [];
        setRsmOptions(options);
        if (data?.rsm_id != null && selectedRsm !== String(data.rsm_id)) {
          setSelectedRsm(String(data.rsm_id));
        } else if (!selectedRsm && options.length > 0) {
          setSelectedRsm(String(options[0].id));
        }
        setRsmSummary(data?.summary || null);
        setRsmTeamReport(Array.isArray(data?.team_report) ? data.team_report : []);
        setTeamCategorySummary(data?.team_category_summary || {});
      }
      if (tool === "sales-head-incentives") {
        setSalesHeadSummary(data?.summary || null);
        setSalesHeadReport(Array.isArray(data?.report) ? data.report : []);
        setSalesHeadCats(data?.cats || {});
        setSalesHeadName(data?.sh_name || "Sales Head");
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
  }, [canOpen, customerSalesperson, csMissingCat, csScore, debouncedCustomerSearch, isMonthlyReport, monthKey, selectedRsm, selectedIncentiveSp, tool]);

  useEffect(() => {
    crossSellingRequestSequence.current += 1;
    hasLoadedTool.current = false;
    setRows([]);
    setError("");
    setSelectedUnassignedIds([]);
    setAssignModalVisible(false);
    setAssignTargetCustomers([]);
    setCrossSellingPage(1);
    setCrossSellingHasNext(false);
    setCrossSellingTotalPages(1);
    setCrossSellingHasPrev(false);
    setCrossSellingTotal(0);
  }, [tool]);

  useEffect(() => {
    if (tool === "unassigned" && availableSalespersons.length === 0) {
      fetchCustomerFilterOptionsApi()
        .then((opts) => {
          if (Array.isArray(opts?.salespersons) && opts.salespersons.length > 0) {
            const activeList = opts.salespersons.filter((s: any) => isSalespersonActive(s?.name || s));
            setAvailableSalespersons(
              activeList.map((s: any) => ({
                id: Number(s.id),
                name: String(s.name || s),
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [tool, availableSalespersons.length]);

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
  const card = { backgroundColor: t.surface, borderColor: t.border };

  // Salesperson Options from server and rows (only active salespeople)
  const salespersonOptions = useMemo(() => {
    const set = new Set<string>();
    serverSalespeople.forEach((sp) => {
      if (sp && isSalespersonActive(sp)) set.add(sp);
    });
    rows.forEach((r) => {
      const sp = r.assignedSalesperson || r.salesperson;
      if (sp && sp !== "None" && sp !== "null" && isSalespersonActive(String(sp))) {
        set.add(String(sp));
      }
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

    if (tool === "unassigned") {
      return rows.filter((row) => {
        if (!search) return true;
        return [row.name, row.state, row.district, row.phone, row.address]
          .some((val) => String(val || "").toLowerCase().includes(search));
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
          unit_id: row.unit_id || (String(row.id).startsWith("unit-") ? String(row.id).replace("unit-", "") : row.id),
          name: String(row.name || "Customer unit"),
          members: Array.isArray(row.members) ? row.members : [],
          rawRow: row,
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

  // Expected Date Submission Handler
  const handleSaveExpectedDate = async () => {
    if (!expectedDateModal || !expectedDateInput.trim()) {
      Alert.alert("Date Required", "Please choose or enter an expected payment date (YYYY-MM-DD).");
      return;
    }
    setActionInProgress(true);
    try {
      await api.post("/customers/workspace/payment-followups/", {
        action: "expected",
        voucher_status_id: expectedDateModal.voucherStatusId,
        expected_date: expectedDateInput.trim(),
      });
      Alert.alert("Expected Date Set", `Expected payment date recorded as ${expectedDateInput.trim()}.`);
      setExpectedDateModal(null);
      setExpectedDateInput("");
      await load();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Could not set expected payment date.");
    } finally {
      setActionInProgress(false);
    }
  };

  // Customer Unit Management Handlers
  const handleCreateUnit = async () => {
    if (!createUnitName.trim()) {
      Alert.alert("Unit Name Required", "Please enter a name for the new unit.");
      return;
    }
    setUnitActionLoading(true);
    try {
      await api.post("/customers/workspace/team-customers/", {
        action: "create_unit",
        unit_name: createUnitName.trim(),
        ...(createUnitModal?.preselectedCustomerId ? { customer_id: createUnitModal.preselectedCustomerId } : {}),
        ...(createUnitSalespersonId ? { salesperson_id: createUnitSalespersonId } : {}),
      });
      Alert.alert("Unit Created", `Unit "${createUnitName.trim()}" created successfully.`);
      setCreateUnitModal(null);
      setCreateUnitName("");
      setCreateUnitSalespersonId(null);
      await load();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Could not create unit.");
    } finally {
      setUnitActionLoading(false);
    }
  };

  const handleRenameUnit = async () => {
    if (!renameUnitModal || !renameUnitName.trim()) {
      Alert.alert("Name Required", "Please enter a new name for the unit.");
      return;
    }
    setUnitActionLoading(true);
    try {
      await api.post("/customers/workspace/team-customers/", {
        action: "rename_unit",
        unit_id: renameUnitModal.id,
        unit_name: renameUnitName.trim(),
      });
      Alert.alert("Renamed", `Unit renamed to "${renameUnitName.trim()}".`);
      setRenameUnitModal(null);
      setRenameUnitName("");
      await load();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Could not rename unit.");
    } finally {
      setUnitActionLoading(false);
    }
  };

  const handleDeleteUnit = (unitId: number | string, unitName: string) => {
    Alert.alert(
      "Delete Unit",
      `Are you sure you want to delete unit "${unitName}"? The accounts inside will become standalone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUnitActionLoading(true);
            try {
              await api.post("/customers/workspace/team-customers/", {
                action: "delete_unit",
                unit_id: unitId,
              });
              Alert.alert("Deleted", "Unit deleted successfully.");
              await load();
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error || "Could not delete unit.");
            } finally {
              setUnitActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddToUnit = async () => {
    if (!addToUnitModal || !selectedUnitIdForAdd) {
      Alert.alert("Select Unit", "Please select a target unit.");
      return;
    }
    setUnitActionLoading(true);
    try {
      await api.post("/customers/workspace/team-customers/", {
        action: "add_to_unit",
        unit_id: selectedUnitIdForAdd,
        customer_id: addToUnitModal.customerId,
      });
      Alert.alert("Added to Unit", "Customer has been added to the unit.");
      setAddToUnitModal(null);
      setSelectedUnitIdForAdd(null);
      await load();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Could not add customer to unit.");
    } finally {
      setUnitActionLoading(false);
    }
  };

  const handleLeaveUnit = (customerId: number | string, customerName: string) => {
    Alert.alert(
      "Leave Unit",
      `Remove "${customerName}" from this unit? It will become a standalone customer.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave Unit",
          style: "destructive",
          onPress: async () => {
            setUnitActionLoading(true);
            try {
              await api.post("/customers/workspace/team-customers/", {
                action: "leave_unit",
                customer_id: customerId,
              });
              Alert.alert("Removed", "Customer removed from unit.");
              await load();
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error || "Could not remove customer from unit.");
            } finally {
              setUnitActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Reassign Unassigned Customer(s) to a Salesperson (strictly vibhuti_, bhavya, admins)
  const handleAssignCustomers = async () => {
    if (!canAssignCustomers) {
      Alert.alert("Access Denied", "Only Business Manager (Vibhuti), Sales Head (Bhavya), and Admins can assign customers.");
      return;
    }

    if (!selectedSalespersonId) {
      Alert.alert("Select Salesperson", "Please select a salesperson to assign the customer(s) to.");
      return;
    }

    const targetIds =
      assignTargetCustomers.length > 0
        ? assignTargetCustomers.map((c) => Number(c.id))
        : selectedUnassignedIds.map(Number);

    if (targetIds.length === 0) {
      Alert.alert("Select Customers", "Please select at least one unassigned customer to assign.");
      return;
    }

    const sp = availableSalespersons.find((s) => s.id === selectedSalespersonId);
    const spName = sp ? sp.name : "the selected salesperson";

    setAssignSubmitting(true);
    try {
      await assignUnassignedCustomerApi(targetIds, selectedSalespersonId);

      // Remove assigned customers from local list
      setRows((prev) => prev.filter((r) => !targetIds.includes(Number(r.id))));
      setSelectedUnassignedIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      setAssignModalVisible(false);
      setAssignTargetCustomers([]);
      setSelectedSalespersonId(null);

      Alert.alert(
        "Assignment Complete",
        `Successfully assigned ${targetIds.length} customer${targetIds.length > 1 ? "s" : ""} to ${spName}.`
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Could not assign customer. Verify your account role and try again.";
      Alert.alert("Assignment Failed", String(msg));
    } finally {
      setAssignSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER: Team Customer Portfolio Card
  // -------------------------------------------------------------
  const renderPortfolioCustomer = (
    row: ToolRow,
    index: number,
    isMemberOfUnit = false,
    parentUnitId?: string | number
  ) => {
    const customerName = String(row.name || "Customer");
    const initials = customerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const displayStatus = String(row.portfolioStatus || row.status || "");
    const status = displayStatus.toLowerCase();
    const statusColor = status === "active" ? "#159A7C" : status === "inactive" ? "#DF5262" : "#637083";
    const location = [row.city || row.district, row.state].filter(Boolean).map(String).filter((val, i, all) => all.indexOf(val) === i).join(", ");
    const customerId = row.id;
    const balanceNum = Number(row.outstandingPaymentNum || 0);
    const remarksCount = Number(row.remarks_count ?? row.remarksCount ?? row.remark_count ?? (Array.isArray(row.remarks) ? row.remarks.length : 0));

    return (
      <View key={String(customerId ?? index)} style={[styles.customerPortfolioCard, card, isMemberOfUnit && { marginLeft: 10, borderLeftWidth: 3.5, borderLeftColor: "#159A7C" }]}>
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

        {/* Action Pills */}
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
            <Text style={[styles.portfolioActionText, { color: foreground }]}>
              Remarks{remarksCount > 0 ? ` (${remarksCount})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Unit Actions (Start Unit / Add to Unit / Leave Unit) */}
        <View style={[styles.portfolioActions, { borderTopColor: card.borderColor, paddingTop: 4 }]}>
          {isMemberOfUnit ? (
            <TouchableOpacity
              onPress={() => handleLeaveUnit(customerId, customerName)}
              style={[styles.portfolioAction, { borderColor: "#EF4444", backgroundColor: isDark ? "#281214" : "#FEF2F2" }]}
            >
              <Ionicons name="exit-outline" size={13} color="#EF4444" />
              <Text style={[styles.portfolioActionText, { color: "#EF4444" }]}>Leave Unit</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => {
                  setCreateUnitModal({
                    visible: true,
                    preselectedCustomerId: customerId,
                    preselectedCustomerName: customerName,
                  });
                  setCreateUnitName(`${customerName} Unit`);
                }}
                style={[styles.portfolioAction, { borderColor: card.borderColor, backgroundColor: isDark ? "#12201B" : "#ECFDF5" }]}
              >
                <Ionicons name="add-circle-outline" size={13} color="#159A7C" />
                <Text style={[styles.portfolioActionText, { color: "#159A7C" }]}>Start Unit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAddToUnitModal({ customerId, customerName })}
                style={[styles.portfolioAction, { borderColor: card.borderColor }]}
              >
                <Ionicons name="arrow-forward-circle-outline" size={13} color="#159A7C" />
                <Text style={[styles.portfolioActionText, { color: "#159A7C" }]}>Add to Unit</Text>
              </TouchableOpacity>
            </>
          )}
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
          <View style={[styles.csAvatar, { backgroundColor: t.surfaceAlt }]}>
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
    const unpaidAmt = Number(row.unpaid || row.unpaid_amount || row.pending || 0);
    const totalAmt = Number(row.amount || row.total || unpaidAmt);
    const invoiceNum = String(row.invoice || row.voucher || `INV-${row.id || index}`);
    const ticketStatus = String(row.ticket_status || row.ticketStatus || "NONE");
    const creditStatus = String(row.credit_status || row.credit || "");

    return (
      <View key={`pf-${row.id || index}`} style={[styles.pfCard, card]}>
        <View style={styles.pfHeader}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => openCustomerDetail(row.customer_id)}>
              <Text style={[styles.pfCustomer, { color: foreground }]} numberOfLines={1}>{custName}</Text>
            </TouchableOpacity>
            <Text style={[styles.pfMeta, { color: muted }]}>
              {row.state ? `${row.state} · ` : ""}Inv #{invoiceNum} · {row.date || "Recent"} · SP: <Text style={{ color: foreground }}>{row.salesperson || row.sp || "Assigned"}</Text>
            </Text>
          </View>
          <View style={[styles.pfDueBadge, { backgroundColor: isOverdue ? "rgba(227, 75, 89, 0.12)" : "rgba(245, 158, 11, 0.12)" }]}>
            <Ionicons name={isOverdue ? "alert-circle" : "time"} size={13} color={isOverdue ? "#E34B59" : "#D97706"} />
            <Text style={[styles.pfDueText, { color: isOverdue ? "#E34B59" : "#D97706" }]}>
              {isOverdue ? "OVERDUE" : "PENDING"}
            </Text>
          </View>
        </View>

        {/* Credit Status Reference Banner */}
        {!!creditStatus && (
          <View style={[styles.pfCreditBanner, { backgroundColor: isDark ? "#121A16" : "#F1F5F9" }]}>
            <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted }}>
              credit period : {row.credit_period || 30}
            </Text>
            <Text style={{ fontFamily: Typography.semiBold, fontSize: 11, color: isOverdue ? "#DC2626" : "#059669" }}>
              {creditStatus}
            </Text>
          </View>
        )}

        {/* Expected Date Reference Badge */}
        {!!row.latest_expected_date && (
          <View style={[styles.pfExpBadge, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.12)" : "#EBF7F3", borderColor: isDark ? "rgba(21, 154, 124, 0.25)" : "rgba(21, 154, 124, 0.18)" }]}>
            <Ionicons name="calendar-outline" size={14} color="#159A7C" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Typography.semiBold, fontSize: 11.5, color: "#159A7C" }}>
                Exp: {row.latest_expected_date}
              </Text>
              {!!row.latest_expected_user && (
                <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>
                  Set by {row.latest_expected_user}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Latest Remark Reference Badge (Green) */}
        {!!row.latest_remark_text && (
          <View style={[styles.pfRemarkBadge, { backgroundColor: isDark ? "#0A261D" : "#ECFDF5", borderColor: isDark ? "#134E39" : "#A7F3D0" }]}>
            <Ionicons name="chatbubble-ellipses" size={14} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Typography.medium, fontSize: 11.5, color: isDark ? "#6EE7B7" : "#065F46" }}>
                {row.latest_remark_text}
              </Text>
              {!!row.latest_remark_user && (
                <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: isDark ? "#A7F3D0" : "#047857" }}>
                  {row.latest_remark_user} · {row.latest_remark_time || ""}
                </Text>
              )}
            </View>
          </View>
        )}

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
              ₹{totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Ticket & Actions Footer */}
        <View style={[styles.pfActions, { borderTopColor: card.borderColor }]}>
          <TouchableOpacity
            disabled={actionInProgress}
            onPress={() => toggleTicket(row.id, ticketStatus)}
            style={[styles.ticketBtn, { backgroundColor: ticketStatus === "RAISED" ? "#D97706" : "#0D9488" }]}
          >
            <Ionicons name={ticketStatus === "RAISED" ? "checkmark-circle" : "flag"} size={13} color="white" />
            <Text style={styles.ticketBtnText}>
              {ticketStatus === "RAISED" ? "SOLVE" : "RAISE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setExpectedDateModal({
                voucherStatusId: row.voucher_status_id || row.id,
                customer: custName,
                currentDate: row.latest_expected_date,
              });
              setExpectedDateInput(row.latest_expected_date || "");
            }}
            style={[styles.pfActionBtn, { borderColor: card.borderColor }]}
          >
            <Ionicons name="calendar-outline" size={13} color="#159A7C" />
            <Text style={[styles.pfActionText, { color: foreground }]}>
              {row.latest_expected_date ? "Update Date" : "Set Date"}
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
              History ({Array.isArray(row.remarks) ? row.remarks.length : 0})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // RENDER: Payment Follow-ups Table View (Exact Web Alignment Image 3)
  // Columns: S.NO. | CUSTOMER / VOUCHER | DATE | CREDIT STATUS | TOTAL AMOUNT | PENDING | REMARK | EXPECTED DATE | TICKET | HISTORY
  // -------------------------------------------------------------
  const renderPaymentFollowupsTable = () => {
    return (
      <View style={[styles.tableContainer, card]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled>
          <View style={styles.tableWrapper}>
            {/* Table Header Row matching web Image 3 */}
            <View
              style={[
                styles.tableHeaderRow,
                {
                  backgroundColor: isDark ? "#15201C" : "#F1F5F9",
                  borderBottomColor: isDark ? "#23332D" : "#E2E8F0",
                },
              ]}
            >
              <View style={[styles.pfColSno, { justifyContent: "center" }]}>
                <Text style={[styles.tableHeaderCell, { color: foreground, textAlign: "center" }]}>S.NO.</Text>
              </View>
              <View style={styles.pfColCustVoucher}>
                <Text style={[styles.tableHeaderCell, { color: foreground }]}>CUSTOMER / VOUCHER</Text>
              </View>
              <View style={styles.pfColDate}>
                <Text style={[styles.tableHeaderCell, { color: foreground }]}>DATE</Text>
              </View>
              <View style={styles.pfColCredit}>
                <Text style={[styles.tableHeaderCell, { color: foreground }]}>CREDIT STATUS</Text>
              </View>
              <View style={styles.pfColAmount}>
                <Text style={[styles.tableHeaderCell, { color: foreground, textAlign: "right" }]}>TOTAL AMOUNT</Text>
              </View>
              <View style={styles.pfColPending}>
                <Text style={[styles.tableHeaderCell, { color: foreground, textAlign: "right" }]}>PENDING</Text>
              </View>
              <View style={styles.pfColRemark}>
                <Text style={[styles.tableHeaderCell, { color: foreground }]}>REMARK</Text>
              </View>
              <View style={styles.pfColExpected}>
                <Text style={[styles.tableHeaderCell, { color: foreground }]}>EXPECTED DATE</Text>
              </View>
              <View style={[styles.pfColTicket, { justifyContent: "center" }]}>
                <Text style={[styles.tableHeaderCell, { color: foreground, textAlign: "center" }]}>TICKET</Text>
              </View>
              <View style={[styles.pfColHistory, { justifyContent: "center" }]}>
                <Text style={[styles.tableHeaderCell, { color: foreground, textAlign: "center" }]}>HISTORY</Text>
              </View>
            </View>

            {/* Table Data Rows */}
            {visibleRows.map((row, idx) => {
              const custName = String(row.customer || "Customer");
              const isOverdue = Boolean(row.overdue || row.is_credit_period_crossed);
              const unpaidAmt = Number(row.unpaid || row.unpaid_amount || row.pending || 0);
              const totalAmt = Number(row.amount || row.total || unpaidAmt);
              const invoiceNum = String(row.invoice || row.voucher || `INV-${row.id || idx}`);
              const ticketStatus = String(row.ticket_status || row.ticketStatus || "NONE");
              const isTicketRaised = ticketStatus === "RAISED";
              const rowBg = idx % 2 === 0
                ? isDark ? t.surface : "#FFFFFF"
                : isDark ? "#141F1B" : "#F8FAFC";

              return (
                <View
                  key={`pf-row-${row.id || idx}`}
                  style={[
                    styles.tableDataRow,
                    {
                      backgroundColor: rowBg,
                      borderBottomColor: isDark ? "#23332D" : "#EDF2F0",
                    },
                  ]}
                >
                  {/* 1. S.NO. */}
                  <View style={[styles.pfColSno, { justifyContent: "center" }]}>
                    <Text style={{ fontFamily: Typography.medium, fontSize: 12, color: muted, textAlign: "center" }}>
                      {idx + 1}
                    </Text>
                  </View>

                  {/* 2. CUSTOMER / VOUCHER */}
                  <View style={styles.pfColCustVoucher}>
                    <TouchableOpacity onPress={() => openCustomerDetail(row.customer_id)}>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 13, color: foreground }} numberOfLines={1}>
                        {custName}
                      </Text>
                    </TouchableOpacity>
                    {!!row.state && (
                      <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted }} numberOfLines={1}>
                        {row.state}
                      </Text>
                    )}
                    <Text style={{ fontFamily: Typography.semiBold, fontSize: 11.5, color: muted }} numberOfLines={1}>
                      {invoiceNum}
                    </Text>
                    <Text style={{ fontFamily: Typography.bold, fontSize: 10, color: muted }}>
                      SP: {String(row.salesperson || row.sp || "Unassigned").toUpperCase()}
                    </Text>
                  </View>

                  {/* 3. DATE */}
                  <View style={styles.pfColDate}>
                    <Text style={{ fontFamily: Typography.regular, fontSize: 12, color: foreground }}>
                      {row.date || "—"}
                    </Text>
                  </View>

                  {/* 4. CREDIT STATUS */}
                  <View style={styles.pfColCredit}>
                    <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted }}>
                      credit period : {row.credit_period || 30}
                    </Text>
                    <Text
                      style={{
                        fontFamily: Typography.semiBold,
                        fontSize: 11.5,
                        color: isOverdue ? "#DC2626" : "#059669",
                        marginTop: 2,
                      }}
                    >
                      {row.credit_status || (isOverdue ? "Overdue" : "On schedule")}
                    </Text>
                  </View>

                  {/* 5. TOTAL AMOUNT */}
                  <View style={styles.pfColAmount}>
                    <Text style={{ fontFamily: Typography.semiBold, fontSize: 12.5, color: foreground, textAlign: "right" }}>
                      {totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                    </Text>
                  </View>

                  {/* 6. PENDING */}
                  <View style={styles.pfColPending}>
                    <Text style={{ fontFamily: Typography.bold, fontSize: 12.5, color: "#DC2626", textAlign: "right" }}>
                      {unpaidAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>

                  {/* 7. REMARK */}
                  <View style={styles.pfColRemark}>
                    {row.latest_remark_text ? (
                      <View style={[styles.tableBadgeGreen, { backgroundColor: isDark ? "#0A261D" : "#ECFDF5", borderColor: isDark ? "#134E39" : "#A7F3D0" }]}>
                        <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: isDark ? "#6EE7B7" : "#065F46" }} numberOfLines={2}>
                          {row.latest_remark_text}
                        </Text>
                        <Text style={{ fontFamily: Typography.regular, fontSize: 9.5, color: isDark ? "#A7F3D0" : "#047857", marginTop: 2 }}>
                          {row.latest_remark_user || "staff"} · {row.latest_remark_time || ""}
                        </Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => setNewRemarkModal({
                        id: row.id,
                        voucher_status_id: row.voucher_status_id || row.id,
                        customer: custName,
                        remarks: row.remarks || [],
                        expected_dates: row.expected_dates || [],
                        ticket_status: ticketStatus,
                      })}
                      style={[styles.tableInlineBtn, { borderColor: card.borderColor, backgroundColor: isDark ? "#121A16" : "#F8FAFC", marginTop: row.latest_remark_text ? 4 : 0 }]}
                    >
                      <Ionicons name="add" size={12} color="#159A7C" />
                      <Text style={{ fontFamily: Typography.semiBold, fontSize: 10.5, color: foreground }}>
                        {row.latest_remark_text ? "Add note…" : "+ Note"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 8. EXPECTED DATE */}
                  <View style={styles.pfColExpected}>
                    {row.latest_expected_date ? (
                      <View style={[styles.tableBadgeGreen, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.12)" : "#EBF7F3", borderColor: isDark ? "rgba(21, 154, 124, 0.25)" : "rgba(21, 154, 124, 0.18)" }]}>
                        <Text style={{ fontFamily: Typography.semiBold, fontSize: 11, color: "#159A7C" }}>
                          Exp: {row.latest_expected_date}
                        </Text>
                        <Text style={{ fontFamily: Typography.regular, fontSize: 9.5, color: muted, marginTop: 1 }}>
                          Set by {row.latest_expected_user || "system"}
                        </Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => {
                        setExpectedDateModal({
                          voucherStatusId: row.voucher_status_id || row.id,
                          customer: custName,
                          currentDate: row.latest_expected_date,
                        });
                        setExpectedDateInput(row.latest_expected_date || "");
                      }}
                      style={[styles.tableInlineBtn, { borderColor: card.borderColor, backgroundColor: isDark ? "#121A16" : "#F8FAFC", marginTop: row.latest_expected_date ? 4 : 0 }]}
                    >
                      <Ionicons name="calendar-outline" size={12} color="#159A7C" />
                      <Text style={{ fontFamily: Typography.semiBold, fontSize: 10.5, color: "#159A7C" }}>
                        {row.latest_expected_date ? "Update Date" : "Set Date"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 9. TICKET */}
                  <View style={[styles.pfColTicket, { justifyContent: "center", alignItems: "center" }]}>
                    <TouchableOpacity
                      disabled={actionInProgress}
                      onPress={() => toggleTicket(row.id, ticketStatus)}
                      style={[
                        styles.tableTicketBtn,
                        { backgroundColor: isTicketRaised ? "#F59E0B" : "#0D9488" },
                      ]}
                    >
                      <Text style={{ fontFamily: Typography.bold, fontSize: 11, color: "white" }}>
                        {isTicketRaised ? "SOLVE" : "RAISE"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 10. HISTORY */}
                  <View style={[styles.pfColHistory, { justifyContent: "center", alignItems: "center" }]}>
                    <TouchableOpacity
                      onPress={() => setNewRemarkModal({
                        id: row.id,
                        voucher_status_id: row.voucher_status_id || row.id,
                        customer: custName,
                        remarks: row.remarks || [],
                        expected_dates: row.expected_dates || [],
                        ticket_status: ticketStatus,
                      })}
                      style={[styles.tableHistoryBtn, { borderColor: card.borderColor }]}
                    >
                      <Text style={{ fontFamily: Typography.bold, fontSize: 11, color: "#159A7C" }}>
                        VIEW
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
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
    const isSelected = selectedUnassignedIds.includes(Number(row.id));

    return (
      <View
        key={`unassigned-${row.id || index}`}
        style={[
          styles.customerPortfolioCard,
          card,
          isSelected && {
            borderColor: "#059669",
            borderWidth: 1.5,
            backgroundColor: isDark ? "#0A1F18" : "#F0FDF4",
          },
        ]}
      >
        <View style={styles.customerPortfolioHeader}>
          {canAssignCustomers && (
            <TouchableOpacity
              onPress={() => {
                const idNum = Number(row.id);
                setSelectedUnassignedIds((prev) =>
                  prev.includes(idNum) ? prev.filter((id) => id !== idNum) : [...prev, idNum]
                );
              }}
              style={{ marginRight: 6, padding: 4 }}
              hitSlop={8}
            >
              <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={22}
                color={isSelected ? "#059669" : muted}
              />
            </TouchableOpacity>
          )}
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
              <Text style={[styles.detail, { color: muted }]} numberOfLines={1}>
                <Ionicons name="home-outline" size={12} color={muted} /> {String(row.address)}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }]}>
              <Text style={[styles.statusText, { color: "#EF4444" }]}>Unassigned</Text>
            </View>
            {canAssignCustomers && (
              <TouchableOpacity
                onPress={() => {
                  setAssignTargetCustomers([{ id: Number(row.id), name: customerName }]);
                  setSelectedSalespersonId(null);
                  setSalespersonSearch("");
                  setAssignModalVisible(true);
                }}
                style={[styles.quickAssignBtn, { borderColor: "#059669" }]}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={12} color="#059669" />
                <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: "#059669" }}>Assign</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // RENDER: Unassigned Customers Table View (Exact Web Alignment)
  // Matching columns: Selection | Name | State | District | Address | Action
  // -------------------------------------------------------------
  const renderUnassignedTable = () => {
    return (
      <View style={[styles.tableContainer, card]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled>
          <View style={styles.tableWrapper}>
            {/* Table Header matching web screenshot with warm cream styling */}
            <View
              style={[
                styles.tableHeaderRow,
                {
                  backgroundColor: isDark ? "#282315" : "#FEF3C7",
                  borderBottomColor: isDark ? "#3F3722" : "#FDE68A",
                },
              ]}
            >
              {canAssignCustomers && (
                <View style={styles.tableColCheck}>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedUnassignedIds.length === visibleRows.length) {
                        setSelectedUnassignedIds([]);
                      } else {
                        setSelectedUnassignedIds(visibleRows.map((r) => Number(r.id)));
                      }
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={
                        selectedUnassignedIds.length > 0 && selectedUnassignedIds.length === visibleRows.length
                          ? "checkbox"
                          : selectedUnassignedIds.length > 0
                          ? "remove-circle"
                          : "square-outline"
                      }
                      size={18}
                      color="#B45309"
                    />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.tableColName}>
                <Text style={[styles.tableHeaderCell, { color: isDark ? "#FDE68A" : "#78350F" }]}>Name</Text>
              </View>
              <View style={styles.tableColState}>
                <Text style={[styles.tableHeaderCell, { color: isDark ? "#FDE68A" : "#78350F" }]}>State</Text>
              </View>
              <View style={styles.tableColDistrict}>
                <Text style={[styles.tableHeaderCell, { color: isDark ? "#FDE68A" : "#78350F" }]}>District</Text>
              </View>
              <View style={styles.tableColAddress}>
                <Text style={[styles.tableHeaderCell, { color: isDark ? "#FDE68A" : "#78350F" }]}>Address</Text>
              </View>
              {canAssignCustomers && (
                <View style={styles.tableColAction}>
                  <Text style={[styles.tableHeaderCell, { color: isDark ? "#FDE68A" : "#78350F", textAlign: "center" }]}>
                    Action
                  </Text>
                </View>
              )}
            </View>

            {/* Table Rows */}
            {visibleRows.map((row, idx) => {
              const isSelected = selectedUnassignedIds.includes(Number(row.id));
              const rowBg = isSelected
                ? isDark
                  ? "#0A281E"
                  : "#ECFDF5"
                : idx % 2 === 0
                ? isDark
                  ? t.surface
                  : "#FFFFFF"
                : isDark
                ? "#141F1B"
                : "#F9FAFB";

              return (
                <View
                  key={`table-unassigned-${row.id || idx}`}
                  style={[
                    styles.tableDataRow,
                    {
                      backgroundColor: rowBg,
                      borderBottomColor: isDark ? "#23332D" : "#EDF2F0",
                    },
                    isSelected && {
                      borderLeftWidth: 3,
                      borderLeftColor: "#059669",
                    },
                  ]}
                >
                  {canAssignCustomers && (
                    <TouchableOpacity
                      onPress={() => {
                        const idNum = Number(row.id);
                        setSelectedUnassignedIds((prev) =>
                          prev.includes(idNum) ? prev.filter((id) => id !== idNum) : [...prev, idNum]
                        );
                      }}
                      style={styles.tableColCheck}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={18}
                        color={isSelected ? "#059669" : muted}
                      />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => openCustomerDetail(row.id)}
                    style={styles.tableColName}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.tableDataCellBold, { color: foreground }]}
                      numberOfLines={2}
                    >
                      {String(row.name || "Customer")}
                    </Text>
                    {!!row.phone && (
                      <Text style={[styles.tableDataCellMuted, { color: muted }]}>
                        {String(row.phone)}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.tableColState}>
                    <Text style={[styles.tableDataCell, { color: foreground }]}>
                      {String(row.state || "—")}
                    </Text>
                  </View>

                  <View style={styles.tableColDistrict}>
                    <Text style={[styles.tableDataCell, { color: foreground }]}>
                      {String(row.district || "—")}
                    </Text>
                  </View>

                  <View style={styles.tableColAddress}>
                    <Text
                      style={[styles.tableDataCell, { color: muted }]}
                      numberOfLines={3}
                    >
                      {String(row.address || "—")}
                    </Text>
                  </View>

                  {canAssignCustomers && (
                    <View style={styles.tableColAction}>
                      <TouchableOpacity
                        onPress={() => {
                          setAssignTargetCustomers([{ id: Number(row.id), name: String(row.name) }]);
                          setSelectedSalespersonId(null);
                          setSalespersonSearch("");
                          setAssignModalVisible(true);
                        }}
                        style={[styles.tableQuickAssignBtn, { borderColor: "#059669" }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="person-add-outline" size={11} color="#059669" />
                        <Text style={{ fontSize: 10, fontFamily: Typography.bold, color: "#059669" }}>Assign</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
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

  const renderMyIncentivesView = () => {
    const payable = Number(incentiveSummary?.payable || 0);
    const potential = Number(incentiveSummary?.potential || 0);
    const pending = Number(incentiveSummary?.pending || 0);
    const totalSales = Number(incentiveSummary?.total_sales || 0);
    const arrearsTotal = Number(incentiveSummary?.arrears_total || 0);
    const grandPayable = Number(incentiveSummary?.grand_payable || payable);
    const pct = potential > 0 ? Math.min(Math.round((payable / potential) * 100), 100) : 0;
    const remaining = Math.max(potential - payable, 0);

    return (
      <View style={{ gap: 14 }}>
        {/* Salesperson Selector for privileged accounts */}
        {incentiveSalespersons.length > 1 && (
          <View style={[styles.filterSelectorCard, card]}>
            <View style={styles.filterSelectorHeader}>
              <View style={styles.filterSelectorTitleRow}>
                <View style={[styles.filterIconBadge, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.16)" : "rgba(21, 154, 124, 0.1)" }]}>
                  <Ionicons name="person-circle-outline" size={18} color="#159A7C" />
                </View>
                <Text style={[styles.filterSelectorLabel, { color: muted }]}>SALESPERSON</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterMenu((m) => (m === "salesperson" ? null : "salesperson"))}
                style={[styles.filterPillButton, { backgroundColor: isDark ? "#14251F" : "#EBF7F3", borderColor: isDark ? "rgba(21, 154, 124, 0.3)" : "rgba(21, 154, 124, 0.2)" }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterPillButtonText, { color: "#159A7C" }]} numberOfLines={1}>
                  {incentiveSalespersons.find((s) => String(s.id) === selectedIncentiveSp)?.name || "Select Salesperson"}
                </Text>
                <Ionicons name={filterMenu === "salesperson" ? "chevron-up" : "chevron-down"} size={14} color="#159A7C" />
              </TouchableOpacity>
            </View>
            {filterMenu === "salesperson" && (
              <View style={[styles.filterDropdownList, { borderColor: card.borderColor }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {incentiveSalespersons.map((sp) => {
                    const isSelected = selectedIncentiveSp === String(sp.id);
                    return (
                      <TouchableOpacity
                        key={sp.id}
                        onPress={() => {
                          setSelectedIncentiveSp(String(sp.id));
                          setFilterMenu(null);
                        }}
                        style={[
                          styles.filterDropdownItem,
                          isSelected && { backgroundColor: isDark ? "rgba(21, 154, 124, 0.12)" : "#EDF8F4" },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          <View style={[styles.spAvatarMini, { backgroundColor: isSelected ? "#159A7C" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0" }]}>
                            <Text style={{ fontFamily: Typography.bold, fontSize: 10, color: isSelected ? "#FFFFFF" : muted }}>
                              {sp.name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.filterOptionText, { color: foreground, fontFamily: isSelected ? Typography.bold : Typography.regular }]}>
                            {sp.name}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color="#159A7C" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* 4-Card Tactile Mobile Summary Grid */}
        <View style={styles.incentiveOverviewGrid}>
          {/* READY TO RECEIVE */}
          <View style={[styles.incentiveCard, card]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBadge, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.18)" : "rgba(21, 154, 124, 0.12)" }]}>
                <Ionicons name="wallet-outline" size={18} color="#159A7C" />
              </View>
              <View style={[styles.cardTagPill, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.16)" : "#E8F8F2" }]}>
                <Text style={[styles.cardTagText, { color: "#159A7C" }]}>EARNED</Text>
              </View>
            </View>
            <View style={{ marginVertical: 6 }}>
              <Text style={[styles.incentiveCardVal, { color: "#159A7C" }]}>
                ₹{payable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.incentiveCardLabel, { color: muted }]}>READY TO RECEIVE</Text>
            </View>
            <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }} numberOfLines={1}>
              Customer-paid invoices
            </Text>
          </View>

          {/* TOTAL POTENTIAL */}
          <View style={[styles.incentiveCard, card]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBadge, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.18)" : "rgba(14, 165, 233, 0.12)" }]}>
                <Ionicons name="trending-up-outline" size={18} color="#0EA5E9" />
              </View>
              <View style={[styles.cardTagPill, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.16)" : "#E0F2FE" }]}>
                <Text style={[styles.cardTagText, { color: "#0EA5E9" }]}>MAX</Text>
              </View>
            </View>
            <View style={{ marginVertical: 6 }}>
              <Text style={[styles.incentiveCardVal, { color: foreground }]}>
                ₹{potential.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.incentiveCardLabel, { color: muted }]}>TOTAL POTENTIAL</Text>
            </View>
            <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }} numberOfLines={1}>
              Gross calculated volume
            </Text>
          </View>

          {/* PENDING COLLECTION */}
          <View style={[styles.incentiveCard, card]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBadge, { backgroundColor: isDark ? "rgba(227, 75, 89, 0.18)" : "rgba(227, 75, 89, 0.12)" }]}>
                <Ionicons name="time-outline" size={18} color="#E34B59" />
              </View>
              <View style={[styles.cardTagPill, { backgroundColor: isDark ? "rgba(227, 75, 89, 0.16)" : "#FEE2E2" }]}>
                <Text style={[styles.cardTagText, { color: "#E34B59" }]}>LOCKED</Text>
              </View>
            </View>
            <View style={{ marginVertical: 6 }}>
              <Text style={[styles.incentiveCardVal, { color: "#E34B59" }]}>
                ₹{pending.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.incentiveCardLabel, { color: muted }]}>PENDING COLLECTION</Text>
            </View>
            <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }} numberOfLines={1}>
              Awaiting payment
            </Text>
          </View>

          {/* TOTAL SALES */}
          <View style={[styles.incentiveCard, card]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBadge, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.18)" : "rgba(245, 158, 11, 0.12)" }]}>
                <Ionicons name="bar-chart-outline" size={18} color="#F59E0B" />
              </View>
              <View style={[styles.cardTagPill, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.16)" : "#FEF3C7" }]}>
                <Text style={[styles.cardTagText, { color: "#D97706" }]}>VOLUME</Text>
              </View>
            </View>
            <View style={{ marginVertical: 6 }}>
              <Text style={[styles.incentiveCardVal, { color: foreground }]}>
                ₹{totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.incentiveCardLabel, { color: muted }]}>TOTAL SALES</Text>
            </View>
            <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }} numberOfLines={1}>
              Gross monthly revenue
            </Text>
          </View>
        </View>

        {/* Cleared Arrears Banner if exists */}
        {arrearsTotal > 0 && (
          <View style={[styles.arrearsBannerMobile, { backgroundColor: isDark ? "#173024" : "#E8F8F2", borderColor: "#159A7C" }]}>
            <View style={styles.arrearsIconCircle}>
              <Ionicons name="gift-outline" size={22} color="#159A7C" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.bannerTitle, { color: isDark ? "#34D399" : "#0D6D56" }]}>
                Cleared Prior Arrears: ₹{arrearsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.bannerSub, { color: isDark ? "#A7F3D0" : "#2D5A4C" }]}>
                Grand Total Payable this cycle: ₹{grandPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}

        {/* Milestone Unlock Bar (Native Mobile Theme) */}
        <View style={[styles.milestoneBox, card]}>
          <View style={styles.milestoneTopRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.flameIconCircle, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.2)" : "#DDF4EA" }]}>
                <Ionicons name="flame" size={16} color="#159A7C" />
              </View>
              <Text style={[styles.milestoneHeading, { color: foreground }]}>
                MILESTONE UNLOCK SLAB
              </Text>
            </View>
            <View style={[styles.milestonePctBadge, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.2)" : "#DDF4EA" }]}>
              <Text style={[styles.milestonePctText, { color: "#159A7C" }]}>{pct}% Unlocked</Text>
            </View>
          </View>

          {/* Smooth rounded progress track */}
          <View style={[styles.milestoneTrackBar, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#E4ECE8" }]}>
            <View style={[styles.milestoneFillBar, { width: `${pct}%`, backgroundColor: "#159A7C" }]} />
          </View>

          <View style={styles.milestoneFooter}>
            <Text style={[styles.milestoneSubtext, { color: muted }]} numberOfLines={1}>
              {remaining > 0
                ? `₹${remaining.toLocaleString("en-IN", { maximumFractionDigits: 0 })} more to unlock 100% potential payout`
                : potential > 0
                ? "All eligible customer-paid incentives unlocked!"
                : "No eligible sales recorded for this period."}
            </Text>
            <Text style={[styles.milestoneTierLabel, { color: "#159A7C" }]}>
              {pct >= 80 ? "Top Performer" : pct > 0 ? "Active Cycle" : "Base Tier"}
            </Text>
          </View>
        </View>

        {/* Products Breakdown Card */}
        {productRows.length > 0 && (
          <View style={[styles.productsBox, card]}>
            <View style={styles.productsBoxHeader}>
              <View style={[styles.flameIconCircle, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.2)" : "#E0F2FE" }]}>
                <Ionicons name="pricetags-outline" size={16} color="#0EA5E9" />
              </View>
              <Text style={[styles.productsBoxTitle, { color: foreground }]}>
                Incentive by Product ({productRows.length})
              </Text>
            </View>
            {productRows.map((p, idx) => (
              <View key={`prod-${idx}`} style={[styles.productItemRow, { borderTopWidth: idx > 0 ? 1 : 0, borderColor: card.borderColor }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.productItemName, { color: foreground }]}>{p.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <View style={[styles.productMiniTag, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }]}>
                      <Text style={[styles.productMiniTagText, { color: muted }]}>Qty: {p.quantity}</Text>
                    </View>
                    <View style={[styles.productMiniTag, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }]}>
                      <Text style={[styles.productMiniTagText, { color: muted }]}>Rate: ₹{p.rate}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.productItemPayable, { color: "#159A7C" }]}>
                    ₹{Number(p.payable || 0).toLocaleString("en-IN")}
                  </Text>
                  <Text style={[styles.productItemPotential, { color: muted }]}>
                    Pot: ₹{Number(p.potential || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Voucher Transactions List */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.flameIconCircle, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.18)" : "#EBF7F3" }]}>
                <Ionicons name="receipt-outline" size={15} color="#159A7C" />
              </View>
              <Text style={[styles.sectionHeading, { color: foreground }]}>
                Voucher Transactions ({visibleRows.length})
              </Text>
            </View>
          </View>

          {visibleRows.length === 0 ? (
            <View style={[styles.cleanEmptyCard, card]}>
              <View style={[styles.cleanEmptyIconBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9" }]}>
                <Ionicons name="receipt-outline" size={28} color={muted} />
              </View>
              <Text style={[styles.cleanEmptyTitle, { color: foreground }]}>No Invoices This Month</Text>
              <Text style={[styles.cleanEmptySub, { color: muted }]}>
                No eligible incentive transactions recorded for this period.
              </Text>
            </View>
          ) : (
            visibleRows.map((row, idx) => (
              <View key={String(row.id || idx)} style={[styles.transactionCard, card]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.txCustomerName, { color: foreground }]} numberOfLines={1}>
                      {row.customer || "Customer"}
                    </Text>
                    <Text style={[styles.txDateVoucher, { color: muted }]}>
                      {row.date} · #{row.voucher}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <View style={[styles.txPill, { backgroundColor: row.paid ? (isDark ? "rgba(21, 154, 124, 0.2)" : "#E6F7F2") : (isDark ? "rgba(227, 75, 89, 0.2)" : "#FEE2E2") }]}>
                      <Text style={[styles.txPillText, { color: row.paid ? "#159A7C" : "#E34B59" }]}>
                        {row.paid ? "PAID" : "UNPAID"}
                      </Text>
                    </View>
                    {!row.is_trigger_on && (
                      <View style={[styles.txPill, { backgroundColor: isDark ? "rgba(227, 75, 89, 0.2)" : "#FEE2E2" }]}>
                        <Text style={[styles.txPillText, { color: "#E34B59" }]}>TRIGGER OFF</Text>
                      </View>
                    )}
                    {!row.is_above_msp && (
                      <View style={[styles.txPill, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7" }]}>
                        <Text style={[styles.txPillText, { color: "#D97706" }]}>BELOW MSP</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={[styles.txProductRow, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F8FAF9" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.txProductName, { color: row.has_incentive ? "#159A7C" : foreground }]}>
                      {row.product}
                    </Text>
                    <Text style={[styles.txProductQty, { color: muted }]}>Qty: {row.quantity}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: foreground }]}>
                    ₹{Number(row.amount || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderRsmIncentivesView = () => {
    const potential = Number(rsmSummary?.potential || 0);
    const payable = Number(rsmSummary?.payable || 0);
    const pending = Number(rsmSummary?.pending || 0);
    const blocked = Number(rsmSummary?.blocked || 0);
    const selectedRsmName = rsmOptions.find((r) => String(r.id) === selectedRsm)?.name || rsmSummary?.rsm || "RSM";

    return (
      <View style={{ gap: 14 }}>
        {/* RSM Selector Dropdown */}
        {rsmOptions.length > 1 && (
          <View style={[styles.filterSelectorCard, card]}>
            <View style={styles.filterSelectorHeader}>
              <View style={styles.filterSelectorTitleRow}>
                <View style={[styles.filterIconBadge, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.16)" : "rgba(14, 165, 233, 0.1)" }]}>
                  <Ionicons name="people-circle-outline" size={18} color="#0EA5E9" />
                </View>
                <Text style={[styles.filterSelectorLabel, { color: muted }]}>RSM AUDIT</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRsmPickerOpen(!rsmPickerOpen)}
                style={[styles.filterPillButton, { backgroundColor: isDark ? "#10232E" : "#E0F2FE", borderColor: isDark ? "rgba(14, 165, 233, 0.3)" : "rgba(14, 165, 233, 0.2)" }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterPillButtonText, { color: "#0EA5E9" }]} numberOfLines={1}>
                  {selectedRsmName}
                </Text>
                <Ionicons name={rsmPickerOpen ? "chevron-up" : "chevron-down"} size={14} color="#0EA5E9" />
              </TouchableOpacity>
            </View>
            {rsmPickerOpen && (
              <View style={[styles.filterDropdownList, { borderColor: card.borderColor }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {rsmOptions.map((r) => {
                    const isSelected = selectedRsm === String(r.id);
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => {
                          setSelectedRsm(String(r.id));
                          setRsmPickerOpen(false);
                        }}
                        style={[
                          styles.filterDropdownItem,
                          isSelected && { backgroundColor: isDark ? "rgba(14, 165, 233, 0.12)" : "#EDF8FD" },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          <View style={[styles.spAvatarMini, { backgroundColor: isSelected ? "#0EA5E9" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0" }]}>
                            <Text style={{ fontFamily: Typography.bold, fontSize: 10, color: isSelected ? "#FFFFFF" : muted }}>
                              {r.name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.filterOptionText, { color: foreground, fontFamily: isSelected ? Typography.bold : Typography.regular }]}>
                            {r.name}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color="#0EA5E9" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Grand Potential Summary Hero Card */}
        <View style={[styles.heroSummaryCard, card]}>
          <View style={styles.heroSummaryTopRow}>
            <View style={[styles.heroBadgePill, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.16)" : "#E0F2FE" }]}>
              <Ionicons name="people-outline" size={13} color="#0EA5E9" />
              <Text style={[styles.heroBadgeText, { color: "#0EA5E9" }]}>REGIONAL SALES MANAGER</Text>
            </View>
            <Text style={[styles.heroSubtitle, { color: muted }]}>{selectedRsmName}</Text>
          </View>

          <View style={{ marginVertical: 8 }}>
            <Text style={[styles.heroAmount, { color: foreground }]}>
              ₹{potential.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.heroLabel, { color: muted }]}>Grand Potential Incentive</Text>
          </View>

          {/* 3 Horizontal Metric Chips */}
          <View style={styles.heroChipsGrid}>
            <View style={[styles.heroChip, { backgroundColor: isDark ? "rgba(21, 154, 124, 0.12)" : "#EBF7F3", borderColor: isDark ? "rgba(21, 154, 124, 0.25)" : "rgba(21, 154, 124, 0.18)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#159A7C" />
                <Text style={[styles.heroChipLabel, { color: "#159A7C" }]}>PAYABLE</Text>
              </View>
              <Text style={[styles.heroChipVal, { color: "#159A7C" }]}>
                ₹{payable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.heroChip, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7", borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.18)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="time-outline" size={13} color="#D97706" />
                <Text style={[styles.heroChipLabel, { color: "#D97706" }]}>PENDING</Text>
              </View>
              <Text style={[styles.heroChipVal, { color: "#D97706" }]}>
                ₹{pending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.heroChip, { backgroundColor: isDark ? "rgba(227, 75, 89, 0.12)" : "#FEE2E2", borderColor: isDark ? "rgba(227, 75, 89, 0.25)" : "rgba(227, 75, 89, 0.18)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="alert-circle-outline" size={13} color="#E34B59" />
                <Text style={[styles.heroChipLabel, { color: "#E34B59" }]}>BLOCKED</Text>
              </View>
              <Text style={[styles.heroChipVal, { color: "#E34B59" }]}>
                ₹{blocked.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Team Category Summary */}
        {Object.keys(teamCategorySummary).length > 0 && (
          <View style={[styles.productsBox, card]}>
            <View style={styles.productsBoxHeader}>
              <View style={[styles.flameIconCircle, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.2)" : "#E0F2FE" }]}>
                <Ionicons name="layers-outline" size={16} color="#0EA5E9" />
              </View>
              <Text style={[styles.productsBoxTitle, { color: foreground }]}>
                Team-wide Category Summary
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {Object.entries(teamCategorySummary).map(([cat, qty]) => (
                <View key={cat} style={[styles.productMiniTag, { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6" }]}>
                  <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: foreground }}>
                    {cat}: <Text style={{ fontFamily: Typography.bold, color: "#159A7C" }}>{Number(qty).toLocaleString("en-IN")} Items</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Per-ASM Team Cards */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 2 }}>
            <View style={[styles.flameIconCircle, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.18)" : "#E0F2FE" }]}>
              <Ionicons name="people-outline" size={15} color="#0EA5E9" />
            </View>
            <Text style={[styles.sectionHeading, { color: foreground }]}>
              ASM Team Members ({rsmTeamReport.length})
            </Text>
          </View>

          {rsmTeamReport.length === 0 ? (
            <View style={[styles.cleanEmptyCard, card]}>
              <View style={[styles.cleanEmptyIconBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9" }]}>
                <Ionicons name="people-outline" size={28} color={muted} />
              </View>
              <Text style={[styles.cleanEmptyTitle, { color: foreground }]}>No Team Members Found</Text>
              <Text style={[styles.cleanEmptySub, { color: muted }]}>
                No active team activity recorded for this period.
              </Text>
            </View>
          ) : (
            rsmTeamReport.map((asm, idx) => {
              const isExpanded = expandedAsmNames[asm.asm_name] ?? false;
              return (
                <View key={`asm-${idx}`} style={[styles.asmCard, card]}>
                  <TouchableOpacity
                    onPress={() => setExpandedAsmNames((prev) => ({ ...prev, [asm.asm_name]: !isExpanded }))}
                    activeOpacity={0.8}
                    style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View style={[styles.asmAvatar, { backgroundColor: isDark ? "rgba(14, 165, 233, 0.16)" : "#E0F2FE" }]}>
                        <Text style={{ fontFamily: Typography.bold, fontSize: 13, color: "#0EA5E9" }}>
                          {asm.asm_name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.asmNameText, { color: "#0EA5E9" }]}>
                          {asm.asm_name}
                        </Text>
                        <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted, marginTop: 1 }}>
                          Total Volume: {Number(asm.total_sheets || 0).toLocaleString("en-IN")} Sheets
                        </Text>
                      </View>
                    </View>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={muted} />
                  </TouchableOpacity>

                  {/* ASM Category Pills */}
                  {asm.asm_categories && Object.keys(asm.asm_categories).length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {Object.entries(asm.asm_categories).map(([c, q]) => (
                        <View key={c} style={[styles.productMiniTag, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F1F5F9" }]}>
                          <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>
                            {c}: <Text style={{ fontFamily: Typography.bold, color: foreground }}>{Number(q)}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Payout Breakdown */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F8FAF9", padding: 10, borderRadius: 12 }}>
                    <View>
                      <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>RSM Paid</Text>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 12.5, color: "#159A7C" }}>₹{Number(asm.rsm_paid || 0).toFixed(2)}</Text>
                    </View>
                    <View>
                      <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>RSM Pending</Text>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 12.5, color: "#D97706" }}>₹{Number(asm.rsm_pending || 0).toFixed(2)}</Text>
                    </View>
                    <View>
                      <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>RSM Blocked</Text>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 12.5, color: "#E34B59" }}>₹{Number(asm.rsm_triggered_off || 0).toFixed(2)}</Text>
                    </View>
                    <View>
                      <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>ASM Earned</Text>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 12.5, color: foreground }}>₹{Number(asm.asm_paid || 0).toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Expanded Itemized List */}
                  {isExpanded && Array.isArray(asm.items) && (
                    <View style={{ borderTopWidth: 1, borderColor: card.borderColor, paddingTop: 10, gap: 6 }}>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 11, color: muted, textTransform: "uppercase" }}>
                        Product Line Items ({asm.items.length})
                      </Text>
                      {asm.items.map((it: any, iIdx: number) => (
                        <View key={`it-${iIdx}`} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: iIdx < asm.items.length - 1 ? 1 : 0, borderColor: card.borderColor }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={{ fontFamily: Typography.semiBold, fontSize: 12, color: foreground }}>{it.name}</Text>
                            <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>
                              Qty: {it.quantity || it.qty} · ASM: ₹{Number(it.asm_incentive || 0).toFixed(2)}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 2 }}>
                            <Text style={{ fontFamily: Typography.bold, fontSize: 12, color: it.paid ? "#159A7C" : "#D97706" }}>
                              RSM: ₹{Number(it.rsm_incentive || 0).toFixed(2)}
                            </Text>
                            <View style={[styles.productMiniTag, { backgroundColor: it.paid ? (isDark ? "rgba(21, 154, 124, 0.16)" : "#E6F7F2") : (isDark ? "rgba(245, 158, 11, 0.16)" : "#FEF3C7") }]}>
                              <Text style={{ fontFamily: Typography.bold, fontSize: 9, color: it.paid ? "#159A7C" : "#D97706" }}>
                                {it.paid ? "PAID" : "PENDING"}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  const renderSalesHeadIncentivesView = () => {
    const potential = Number(salesHeadSummary?.potential || 0);
    const payable = Number(salesHeadSummary?.payable || 0);
    const pending = Number(salesHeadSummary?.pending || 0);
    const blocked = Number(salesHeadSummary?.blocked || 0);

    return (
      <View style={{ gap: 14 }}>
        {/* Executive Summary Hero Card */}
        <View style={[styles.heroSummaryCard, card]}>
          <View style={styles.heroSummaryTopRow}>
            <View style={[styles.heroBadgePill, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#D1FAE5" }]}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#10B981" />
              <Text style={[styles.heroBadgeText, { color: "#10B981" }]}>EXECUTIVE COMMAND</Text>
            </View>
            <Text style={[styles.heroSubtitle, { color: muted }]}>{salesHeadName}</Text>
          </View>

          <View style={{ marginVertical: 8 }}>
            <Text style={[styles.heroAmount, { color: foreground }]}>
              ₹{potential.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.heroLabel, { color: muted }]}>Executive Command Summary</Text>
          </View>

          {/* 3 Horizontal Metric Chips */}
          <View style={styles.heroChipsGrid}>
            <View style={[styles.heroChip, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5", borderColor: isDark ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.18)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" />
                <Text style={[styles.heroChipLabel, { color: "#10B981" }]}>PAYABLE</Text>
              </View>
              <Text style={[styles.heroChipVal, { color: "#10B981" }]}>
                ₹{payable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.heroChip, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7", borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.18)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="time-outline" size={13} color="#D97706" />
                <Text style={[styles.heroChipLabel, { color: "#D97706" }]}>PENDING</Text>
              </View>
              <Text style={[styles.heroChipVal, { color: "#D97706" }]}>
                ₹{pending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.heroChip, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEE2E2", borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.18)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
                <Text style={[styles.heroChipLabel, { color: "#EF4444" }]}>BLOCKED</Text>
              </View>
              <Text style={[styles.heroChipVal, { color: "#EF4444" }]}>
                ₹{blocked.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Company Category Volume */}
        {Object.keys(salesHeadCats).length > 0 && (
          <View style={[styles.productsBox, card]}>
            <View style={styles.productsBoxHeader}>
              <View style={[styles.flameIconCircle, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#D1FAE5" }]}>
                <Ionicons name="stats-chart-outline" size={16} color="#10B981" />
              </View>
              <Text style={[styles.productsBoxTitle, { color: foreground }]}>
                Company-Wide Category Volume
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {Object.entries(salesHeadCats).map(([c, count]) => (
                <View key={c} style={[styles.productMiniTag, { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6" }]}>
                  <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: foreground }}>
                    {c}: <Text style={{ fontFamily: Typography.bold, color: "#10B981" }}>{Number(count).toLocaleString("en-IN")}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Sales Representatives & Hierarchy Performance */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 2 }}>
            <View style={[styles.flameIconCircle, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.18)" : "#D1FAE5" }]}>
              <Ionicons name="git-network-outline" size={15} color="#10B981" />
            </View>
            <Text style={[styles.sectionHeading, { color: foreground }]}>
              Salesforce Performance & Overrides ({salesHeadReport.length})
            </Text>
          </View>

          {salesHeadReport.length === 0 ? (
            <View style={[styles.cleanEmptyCard, card]}>
              <View style={[styles.cleanEmptyIconBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9" }]}>
                <Ionicons name="git-network-outline" size={28} color={muted} />
              </View>
              <Text style={[styles.cleanEmptyTitle, { color: foreground }]}>No Reports Found</Text>
              <Text style={[styles.cleanEmptySub, { color: muted }]}>
                No sales hierarchy performance recorded for this month.
              </Text>
            </View>
          ) : (
            salesHeadReport.map((sp, idx) => {
              const isExpanded = expandedRepNames[sp.name] ?? false;
              const rev = Number(sp.rev || 0);
              const target = Number(sp.target || 0);
              const progressPct = target > 0 ? Math.min(Math.round((rev / target) * 100), 100) : 100;
              const combinedOverride = Number(sp.paid || 0) + Number(sp.pending || 0);

              return (
                <View key={`sh-sp-${idx}`} style={[styles.asmCard, card]}>
                  <TouchableOpacity
                    onPress={() => setExpandedRepNames((prev) => ({ ...prev, [sp.name]: !isExpanded }))}
                    activeOpacity={0.8}
                    style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontFamily: Typography.heading, fontSize: 16, color: foreground }}>
                          {sp.name}
                        </Text>
                        <View style={[styles.productMiniTag, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0" }]}>
                          <Text style={{ fontFamily: Typography.bold, fontSize: 9.5, color: muted }}>{sp.role || "REP"}</Text>
                        </View>
                      </View>

                      {/* Revenue vs Target */}
                      <Text style={{ fontFamily: Typography.semiBold, fontSize: 12, color: rev >= target ? "#10B981" : "#EF4444", marginTop: 4 }}>
                        ₹{rev.toLocaleString("en-IN")} <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted }}>/ Target ₹{target.toLocaleString("en-IN")}</Text>
                      </Text>
                      <View style={{ height: 6, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                        <View style={{ width: `${progressPct}%`, height: "100%", backgroundColor: rev >= target ? "#10B981" : "#F59E0B", borderRadius: 3 }} />
                      </View>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontFamily: Typography.bold, fontSize: 15, color: "#10B981" }}>
                        ₹{combinedOverride.toFixed(2)}
                      </Text>
                      <Text style={{ fontFamily: Typography.regular, fontSize: 9.5, color: muted }}>Override</Text>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={muted} style={{ marginTop: 4 }} />
                    </View>
                  </TouchableOpacity>

                  {/* Override Buckets */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F8FAF9", padding: 10, borderRadius: 12 }}>
                    <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: "#10B981" }}>Paid: ₹{Number(sp.paid || 0).toFixed(2)}</Text>
                    <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: "#F59E0B" }}>Pending: ₹{Number(sp.pending || 0).toFixed(2)}</Text>
                    <Text style={{ fontFamily: Typography.medium, fontSize: 11, color: muted }}>ASM: ₹{Number(sp.asm_earned || 0).toFixed(2)}</Text>
                  </View>

                  {/* Itemized Table if expanded */}
                  {isExpanded && Array.isArray(sp.items) && (
                    <View style={{ borderTopWidth: 1, borderColor: card.borderColor, paddingTop: 8, gap: 6 }}>
                      {sp.items.map((item: any, iIdx: number) => (
                        <View key={`sh-item-${iIdx}`} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderBottomWidth: iIdx < sp.items.length - 1 ? 1 : 0, borderColor: card.borderColor }}>
                          <View style={{ flex: 1, paddingRight: 6 }}>
                            <Text style={{ fontFamily: Typography.medium, fontSize: 12, color: foreground }}>{item.product}</Text>
                            <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }}>
                              {item.customer} · Qty {item.quantity || item.qty}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={{ fontFamily: Typography.bold, fontSize: 12, color: item.status === "payable" ? "#10B981" : item.status === "pending" ? "#F59E0B" : "#EF4444" }}>
                              ₹{Number(item.amount || item.head || 0).toFixed(2)}
                            </Text>
                            <Text style={{ fontFamily: Typography.regular, fontSize: 9.5, color: muted, textTransform: "capitalize" }}>
                              {item.status}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          <SubAppHomeButton style={{ marginLeft: "auto" }} />
        </View>

        {error ? (
          <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={[styles.notice, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}>
            <Text style={{ color: foreground, fontFamily: Typography.regular }}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        {/* Performance & Incentive Suite Navigation Bar */}
        {["my-incentives", "rsm-incentives", "sales-head-incentives", "cross-selling"].includes(tool) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
          >
            <TouchableOpacity
              onPress={() => {
                if (tool !== "my-incentives") router.replace("/(employee)/customers/tool/my-incentives" as any);
              }}
              style={[
                styles.incentiveNavPill,
                tool === "my-incentives"
                  ? { backgroundColor: "#159A7C" }
                  : [card, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }],
              ]}
              activeOpacity={0.75}
            >
              <Ionicons
                name="wallet-outline"
                size={14}
                color={tool === "my-incentives" ? "#FFFFFF" : muted}
              />
              <Text
                style={[
                  styles.incentiveNavPillText,
                  { color: tool === "my-incentives" ? "#FFFFFF" : foreground },
                ]}
              >
                My Paid
              </Text>
            </TouchableOpacity>

            {Boolean(accessByTool["rsm-incentives"]) && (
              <TouchableOpacity
                onPress={() => {
                  if (tool !== "rsm-incentives") router.replace("/(employee)/customers/tool/rsm-incentives" as any);
                }}
                style={[
                  styles.incentiveNavPill,
                  tool === "rsm-incentives"
                    ? { backgroundColor: "#0EA5E9" }
                    : [card, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }],
                ]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={tool === "rsm-incentives" ? "#FFFFFF" : muted}
                />
                <Text
                  style={[
                    styles.incentiveNavPillText,
                    { color: tool === "rsm-incentives" ? "#FFFFFF" : foreground },
                  ]}
                >
                  RSM Team
                </Text>
              </TouchableOpacity>
            )}

            {Boolean(accessByTool["sales-head-incentives"]) && (
              <TouchableOpacity
                onPress={() => {
                  if (tool !== "sales-head-incentives") router.replace("/(employee)/customers/tool/sales-head-incentives" as any);
                }}
                style={[
                  styles.incentiveNavPill,
                  tool === "sales-head-incentives"
                    ? { backgroundColor: "#10B981" }
                    : [card, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }],
                ]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="git-network-outline"
                  size={14}
                  color={tool === "sales-head-incentives" ? "#FFFFFF" : muted}
                />
                <Text
                  style={[
                    styles.incentiveNavPillText,
                    { color: tool === "sales-head-incentives" ? "#FFFFFF" : foreground },
                  ]}
                >
                  Sales Head
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                if (tool !== "cross-selling") router.replace("/(employee)/customers/tool/cross-selling" as any);
              }}
              style={[
                styles.incentiveNavPill,
                tool === "cross-selling"
                  ? { backgroundColor: "#159A7C" }
                  : [card, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }],
              ]}
              activeOpacity={0.75}
            >
              <Ionicons
                name="grid-outline"
                size={14}
                color={tool === "cross-selling" ? "#FFFFFF" : muted}
              />
              <Text
                style={[
                  styles.incentiveNavPillText,
                  { color: tool === "cross-selling" ? "#FFFFFF" : foreground },
                ]}
              >
                Cross-Selling
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

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
              {/* Unit Controls Header matching web Image 1 */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="folder-outline" size={17} color="#159A7C" />
                  <Text style={{ fontFamily: Typography.bold, fontSize: 15, color: foreground }}>
                    Client & Unit Portfolios
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setCreateUnitModal({ visible: true });
                    setCreateUnitName("");
                    setCreateUnitSalespersonId(null);
                  }}
                  style={[styles.newUnitBtn, { backgroundColor: "#159A7C" }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={15} color="white" />
                  <Text style={{ fontFamily: Typography.bold, fontSize: 11.5, color: "white" }}>
                    + New Unit
                  </Text>
                </TouchableOpacity>
              </View>

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
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }} showsVerticalScrollIndicator={true}>
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
                  </ScrollView>
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
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }} showsVerticalScrollIndicator={true}>
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
                  </ScrollView>
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
            {/* Payment Follow-ups Header with Table / Cards View Switcher */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={{ fontFamily: Typography.bold, fontSize: 16, color: foreground }}>
                  Payment Follow-ups
                </Text>
                <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted }}>
                  ({visibleRows.length})
                </Text>
              </View>

              {/* View Switcher: Table vs Cards */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setPaymentViewMode("table")}
                  style={[
                    styles.viewSwitchBtn,
                    {
                      backgroundColor: paymentViewMode === "table" ? (isDark ? "#064E3B" : "#D1FAE5") : "transparent",
                      borderColor: paymentViewMode === "table" ? "#059669" : card.borderColor,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="grid-outline"
                    size={13}
                    color={paymentViewMode === "table" ? "#059669" : muted}
                  />
                  <Text
                    style={[
                      styles.viewSwitchText,
                      { color: paymentViewMode === "table" ? "#059669" : muted, fontFamily: Typography.semiBold },
                    ]}
                  >
                    Table
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPaymentViewMode("cards")}
                  style={[
                    styles.viewSwitchBtn,
                    {
                      backgroundColor: paymentViewMode === "cards" ? (isDark ? "#064E3B" : "#D1FAE5") : "transparent",
                      borderColor: paymentViewMode === "cards" ? "#059669" : card.borderColor,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="albums-outline"
                    size={13}
                    color={paymentViewMode === "cards" ? "#059669" : muted}
                  />
                  <Text
                    style={[
                      styles.viewSwitchText,
                      { color: paymentViewMode === "cards" ? "#059669" : muted, fontFamily: Typography.semiBold },
                    ]}
                  >
                    Cards
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

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

        {/* ── TOOL: UNASSIGNED CUSTOMERS CONTROLS ── */}
        {tool === "unassigned" && !loading && (
          <View style={[styles.customerFilters, card, { marginBottom: 4 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={{ fontFamily: Typography.bold, fontSize: 16, color: foreground }}>
                  Total: {visibleRows.length}
                </Text>
                {visibleRows.length !== rows.length && (
                  <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted }}>
                    (of {rows.length})
                  </Text>
                )}
              </View>

              {/* View Switcher: Table vs Cards */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setUnassignedViewMode("table")}
                  style={[
                    styles.viewSwitchBtn,
                    {
                      backgroundColor: unassignedViewMode === "table" ? (isDark ? "#064E3B" : "#D1FAE5") : "transparent",
                      borderColor: unassignedViewMode === "table" ? "#059669" : card.borderColor,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="grid-outline"
                    size={13}
                    color={unassignedViewMode === "table" ? "#059669" : muted}
                  />
                  <Text
                    style={[
                      styles.viewSwitchText,
                      { color: unassignedViewMode === "table" ? "#059669" : muted, fontFamily: Typography.semiBold },
                    ]}
                  >
                    Table
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setUnassignedViewMode("cards")}
                  style={[
                    styles.viewSwitchBtn,
                    {
                      backgroundColor: unassignedViewMode === "cards" ? (isDark ? "#064E3B" : "#D1FAE5") : "transparent",
                      borderColor: unassignedViewMode === "cards" ? "#059669" : card.borderColor,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="albums-outline"
                    size={13}
                    color={unassignedViewMode === "cards" ? "#059669" : muted}
                  />
                  <Text
                    style={[
                      styles.viewSwitchText,
                      { color: unassignedViewMode === "cards" ? "#059669" : muted, fontFamily: Typography.semiBold },
                    ]}
                  >
                    Cards
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.customerSearch, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor }]}>
              <Ionicons name="search-outline" size={17} color="#059669" />
              <TextInput
                value={customerSearch}
                onChangeText={setCustomerSearch}
                placeholder="Search name, phone, district, state..."
                placeholderTextColor={muted}
                style={[styles.customerSearchInput, { color: foreground }]}
              />
              {customerSearch ? (
                <TouchableOpacity onPress={() => setCustomerSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {canAssignCustomers && visibleRows.length > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: card.borderColor }}>
                <TouchableOpacity
                  onPress={() => {
                    if (selectedUnassignedIds.length === visibleRows.length) {
                      setSelectedUnassignedIds([]);
                    } else {
                      setSelectedUnassignedIds(visibleRows.map((r) => Number(r.id)));
                    }
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons
                    name={selectedUnassignedIds.length > 0 && selectedUnassignedIds.length === visibleRows.length ? "checkbox" : selectedUnassignedIds.length > 0 ? "remove-circle" : "square-outline"}
                    size={18}
                    color="#059669"
                  />
                  <Text style={{ fontFamily: Typography.medium, fontSize: 12, color: foreground }}>
                    {selectedUnassignedIds.length === visibleRows.length ? "Deselect All" : `Select All (${visibleRows.length})`}
                  </Text>
                </TouchableOpacity>

                {selectedUnassignedIds.length > 0 && (
                  <TouchableOpacity onPress={() => setSelectedUnassignedIds([])}>
                    <Text style={{ fontFamily: Typography.semiBold, fontSize: 11, color: "#EF4444" }}>
                      Clear ({selectedUnassignedIds.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

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

            const unitIdVal = (entry as any).unit_id || entry.id;

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
                  activeOpacity={0.8}
                >
                  <View style={[styles.unitIcon, { backgroundColor: isDark ? "#183B32" : "#E2F7F1" }]}>
                    <Ionicons name="folder-outline" size={19} color="#159A7C" />
                  </View>
                  <View style={styles.customerIdentity}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={[styles.unitBadgePill, { backgroundColor: isDark ? "#064E3B" : "#D1FAE5" }]}>
                        <Text style={{ fontFamily: Typography.bold, fontSize: 9.5, color: "#059669" }}>UNIT</Text>
                      </View>
                      <Text style={[styles.rowTitle, { color: foreground, flex: 1 }]} numberOfLines={1}>{entry.name}</Text>
                    </View>
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

                {/* Quick Unit Actions Bar: Rename & Delete (Matching Web Image 1) */}
                <View style={[styles.unitActionsBar, { borderTopColor: card.borderColor }]}>
                  <TouchableOpacity
                    onPress={() => setRenameUnitModal({ id: unitIdVal, currentName: entry.name })}
                    style={[styles.unitActionBtn, { borderColor: card.borderColor }]}
                  >
                    <Ionicons name="pencil-outline" size={13} color="#159A7C" />
                    <Text style={[styles.unitActionText, { color: foreground }]}>Rename</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteUnit(unitIdVal, entry.name)}
                    style={[styles.unitActionBtn, { borderColor: card.borderColor }]}
                  >
                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    <Text style={[styles.unitActionText, { color: "#EF4444" }]}>Delete Unit</Text>
                  </TouchableOpacity>
                </View>

                {expandedUnitIds.has(entry.id) && (
                  <View style={styles.unitMembers}>
                    {entry.members.map((member, mIdx) => renderPortfolioCustomer(member, mIdx, true, unitIdVal))}
                  </View>
                )}
              </View>
            );
          })
        ) : tool === "cross-selling" ? (
          visibleRows.map((row, idx) => renderCrossSellingCard(row, idx))
        ) : tool === "payment-followups" ? (
          paymentViewMode === "table" ? (
            renderPaymentFollowupsTable()
          ) : (
            visibleRows.map((row, idx) => renderPaymentFollowupCard(row, idx))
          )
        ) : tool === "unassigned" ? (
          unassignedViewMode === "table" ? (
            renderUnassignedTable()
          ) : (
            visibleRows.map((row, idx) => renderUnassignedCard(row, idx))
          )
        ) : tool === "monthly-sales" ? (
          visibleRows.map((row, idx) => renderMonthlySalesRow(row, idx))
        ) : tool === "my-incentives" ? (
          renderMyIncentivesView()
        ) : tool === "rsm-incentives" ? (
          renderRsmIncentivesView()
        ) : tool === "sales-head-incentives" ? (
          renderSalesHeadIncentivesView()
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

        {!loading && !error && visibleRows.length === 0 && !["my-incentives", "rsm-incentives", "sales-head-incentives"].includes(tool) && (
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

      {/* ── BOTTOM CENTER FLOATING ACTION: ASSIGN CUSTOMER ── */}
      {tool === "unassigned" && canAssignCustomers && visibleRows.length > 0 && (
        <View
          style={[
            styles.bottomCenterFloatingContainer,
            { bottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.bottomCenterAssignBtn,
              {
                backgroundColor: "#059669",
                shadowColor: "#059669",
              },
            ]}
            activeOpacity={0.88}
            onPress={() => {
              if (selectedUnassignedIds.length > 0) {
                const targets = rows
                  .filter((r) => selectedUnassignedIds.includes(Number(r.id)))
                  .map((r) => ({ id: Number(r.id), name: String(r.name) }));
                setAssignTargetCustomers(targets);
              } else {
                setAssignTargetCustomers([]);
              }
              setSelectedSalespersonId(null);
              setSalespersonSearch("");
              setAssignModalVisible(true);
            }}
          >
            <View style={styles.bottomCenterAssignIconBadge}>
              <Ionicons name="person-add" size={17} color="#059669" />
            </View>
            <Text style={styles.bottomCenterAssignBtnText}>
              {selectedUnassignedIds.length > 0
                ? `Assign (${selectedUnassignedIds.length}) Customer${selectedUnassignedIds.length > 1 ? "s" : ""}`
                : "Assign Customer"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── MODAL: ASSIGN CUSTOMER TO SALESPERSON ── */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!assignSubmitting) setAssignModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, card, { maxHeight: "88%", paddingBottom: 16 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: foreground }]}>Assign Customer</Text>
                <Text style={[styles.detail, { color: muted, marginTop: 2 }]}>
                  {assignTargetCustomers.length > 0
                    ? `Assigning ${assignTargetCustomers.length} selected customer${assignTargetCustomers.length > 1 ? "s" : ""}`
                    : selectedUnassignedIds.length > 0
                    ? `Assigning ${selectedUnassignedIds.length} selected customer${selectedUnassignedIds.length > 1 ? "s" : ""}`
                    : "Select customers & choose salesperson"}
                </Text>
              </View>
              <TouchableOpacity
                disabled={assignSubmitting}
                onPress={() => setAssignModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={22} color={muted} />
              </TouchableOpacity>
            </View>

            {/* Target Customers Overview / Selector */}
            {assignTargetCustomers.length === 0 && selectedUnassignedIds.length === 0 ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.filterLabel, { color: muted }]}>CHOOSE CUSTOMERS TO ASSIGN</Text>
                <ScrollView style={{ maxHeight: 130, borderWidth: 1, borderColor: card.borderColor, borderRadius: 12, padding: 8, backgroundColor: isDark ? "#0A1410" : "#F8FAF9" }}>
                  {rows.map((cust) => {
                    const idNum = Number(cust.id);
                    const isPicked = selectedUnassignedIds.includes(idNum);
                    return (
                      <TouchableOpacity
                        key={`pick-cust-${cust.id}`}
                        onPress={() => {
                          setSelectedUnassignedIds((prev) =>
                            prev.includes(idNum) ? prev.filter((id) => id !== idNum) : [...prev, idNum]
                          );
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingVertical: 7,
                          paddingHorizontal: 8,
                          borderRadius: 8,
                          backgroundColor: isPicked ? (isDark ? "#122E23" : "#DCFCE7") : "transparent",
                        }}
                      >
                        <Ionicons
                          name={isPicked ? "checkbox" : "square-outline"}
                          size={18}
                          color={isPicked ? "#059669" : muted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: Typography.medium, fontSize: 13, color: foreground }} numberOfLines={1}>
                            {cust.name}
                          </Text>
                          <Text style={{ fontFamily: Typography.regular, fontSize: 10, color: muted }} numberOfLines={1}>
                            {[cust.district, cust.state].filter(Boolean).join(", ") || "No location"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <View style={{ marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: isDark ? "#0A1F18" : "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Ionicons name="people" size={14} color="#059669" />
                  <Text style={{ fontFamily: Typography.bold, fontSize: 11, color: "#059669" }}>
                    ASSIGNING {(assignTargetCustomers.length || selectedUnassignedIds.length)} CUSTOMER{(assignTargetCustomers.length || selectedUnassignedIds.length) > 1 ? "S" : ""}
                  </Text>
                </View>
                <Text style={{ fontFamily: Typography.regular, fontSize: 12, color: foreground }} numberOfLines={2}>
                  {assignTargetCustomers.length > 0
                    ? assignTargetCustomers.map((c) => c.name).join(", ")
                    : rows.filter((r) => selectedUnassignedIds.includes(Number(r.id))).map((r) => r.name).join(", ")}
                </Text>
              </View>
            )}

            {/* Salesperson Picker Header & Search */}
            <Text style={[styles.filterLabel, { color: muted, marginBottom: 6 }]}>SELECT SALESPERSON TO ASSIGN</Text>
            <View style={[styles.customerSearch, { backgroundColor: isDark ? "#0E1714" : "#F7F9FC", borderColor: card.borderColor, marginBottom: 10 }]}>
              <Ionicons name="search-outline" size={16} color="#059669" />
              <TextInput
                value={salespersonSearch}
                onChangeText={setSalespersonSearch}
                placeholder="Search salesperson by name..."
                placeholderTextColor={muted}
                style={[styles.customerSearchInput, { color: foreground }]}
              />
              {salespersonSearch ? (
                <TouchableOpacity onPress={() => setSalespersonSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Salesperson List */}
            <ScrollView style={{ maxHeight: 220, marginBottom: 14 }}>
              {availableSalespersons
                .filter((sp) => !salespersonSearch.trim() || sp.name.toLowerCase().includes(salespersonSearch.trim().toLowerCase()))
                .map((sp) => {
                  const isSelected = selectedSalespersonId === sp.id;
                  const initials = sp.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
                  return (
                    <TouchableOpacity
                      key={`sp-${sp.id}`}
                      onPress={() => setSelectedSalespersonId(sp.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 10,
                        borderRadius: 12,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: isSelected ? "#059669" : card.borderColor,
                        backgroundColor: isSelected ? (isDark ? "#062817" : "#DCFCE7") : card.backgroundColor,
                        gap: 10,
                      }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isSelected ? "#059669" : (isDark ? "#1C2723" : "#E2E8F0"), alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: Typography.bold, fontSize: 12, color: isSelected ? "#FFFFFF" : foreground }}>
                          {initials || "SP"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Typography.semiBold, fontSize: 13, color: foreground }}>
                          {sp.name}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={isSelected ? "#059669" : muted}
                      />
                    </TouchableOpacity>
                  );
                })}
              {availableSalespersons.length === 0 && (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={{ fontFamily: Typography.regular, fontSize: 11, color: muted, marginTop: 6 }}>
                    Loading available salespersons...
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                disabled={assignSubmitting}
                onPress={() => setAssignModalVisible(false)}
                style={[styles.modalCancel, { borderColor: card.borderColor }]}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={assignSubmitting || !selectedSalespersonId || (assignTargetCustomers.length === 0 && selectedUnassignedIds.length === 0)}
                onPress={() => void handleAssignCustomers()}
                style={[
                  styles.modalSave,
                  {
                    backgroundColor: "#059669",
                    opacity: (assignSubmitting || !selectedSalespersonId || (assignTargetCustomers.length === 0 && selectedUnassignedIds.length === 0)) ? 0.45 : 1,
                  },
                ]}
              >
                {assignSubmitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "white", fontFamily: Typography.bold }]}>
                    Assign Now
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* ── MODAL: CREATE CUSTOMER UNIT ── */}
      <Modal visible={createUnitModal !== null} transparent animationType="fade" onRequestClose={() => setCreateUnitModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, card]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>Create Customer Unit</Text>
              <TouchableOpacity onPress={() => setCreateUnitModal(null)}>
                <Ionicons name="close" size={22} color={muted} />
              </TouchableOpacity>
            </View>
            {createUnitModal?.preselectedCustomerName ? (
              <Text style={[styles.detail, { color: muted }]}>
                Starting with customer: <Text style={{ color: foreground, fontFamily: Typography.bold }}>{createUnitModal.preselectedCustomerName}</Text>
              </Text>
            ) : (
              <Text style={[styles.detail, { color: muted }]}>Group sister companies or branch ledgers under one parent unit.</Text>
            )}

            <Text style={[styles.filterLabel, { color: muted, marginTop: 8 }]}>UNIT PORTFOLIO NAME</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: card.borderColor, color: foreground, minHeight: 46 }]}
              placeholder="e.g. A1 Aligners Portfolio / 32 Watts Dental"
              placeholderTextColor={muted}
              value={createUnitName}
              onChangeText={setCreateUnitName}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setCreateUnitModal(null)}
                style={[styles.modalCancel, { borderColor: card.borderColor }]}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleCreateUnit()}
                disabled={unitActionLoading || !createUnitName.trim()}
                style={[styles.modalSave, { backgroundColor: "#159A7C", opacity: (!createUnitName.trim() || unitActionLoading) ? 0.5 : 1 }]}
              >
                {unitActionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "white" }]}>Create Unit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: RENAME UNIT ── */}
      <Modal visible={renameUnitModal !== null} transparent animationType="fade" onRequestClose={() => setRenameUnitModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, card]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>Rename Unit</Text>
              <TouchableOpacity onPress={() => setRenameUnitModal(null)}>
                <Ionicons name="close" size={22} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.detail, { color: muted }]}>
              Current: <Text style={{ color: foreground, fontFamily: Typography.bold }}>{renameUnitModal?.currentName}</Text>
            </Text>

            <Text style={[styles.filterLabel, { color: muted, marginTop: 8 }]}>NEW UNIT NAME</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: card.borderColor, color: foreground, minHeight: 46 }]}
              placeholder="Enter new unit name..."
              placeholderTextColor={muted}
              value={renameUnitName}
              onChangeText={setRenameUnitName}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setRenameUnitModal(null)}
                style={[styles.modalCancel, { borderColor: card.borderColor }]}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleRenameUnit()}
                disabled={unitActionLoading || !renameUnitName.trim()}
                style={[styles.modalSave, { backgroundColor: "#159A7C", opacity: (!renameUnitName.trim() || unitActionLoading) ? 0.5 : 1 }]}
              >
                {unitActionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "white" }]}>Save Name</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: ADD CUSTOMER TO UNIT ── */}
      <Modal visible={addToUnitModal !== null} transparent animationType="fade" onRequestClose={() => setAddToUnitModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, card, { maxHeight: "75%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>Add to Unit</Text>
              <TouchableOpacity onPress={() => setAddToUnitModal(null)}>
                <Ionicons name="close" size={22} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.detail, { color: muted }]}>
              Assign <Text style={{ color: foreground, fontFamily: Typography.bold }}>{addToUnitModal?.customerName}</Text> to an existing unit:
            </Text>

            <ScrollView style={{ maxHeight: 240, marginVertical: 8 }}>
              {allUnits.length > 0 ? (
                allUnits.map((u) => {
                  const isSelected = selectedUnitIdForAdd === u.id;
                  return (
                    <TouchableOpacity
                      key={`unit-opt-${u.id}`}
                      onPress={() => setSelectedUnitIdForAdd(u.id)}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor: isSelected ? (isDark ? "#064E3B" : "#D1FAE5") : "transparent",
                          borderWidth: 1,
                          borderColor: isSelected ? "#059669" : card.borderColor,
                          borderRadius: 10,
                          marginBottom: 6,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Ionicons name="folder-outline" size={16} color={isSelected ? "#059669" : "#159A7C"} />
                        <Text style={[styles.filterOptionText, { color: foreground, fontFamily: isSelected ? Typography.bold : Typography.regular }]}>
                          {u.name}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color="#059669" />}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: muted, fontStyle: "italic", textAlign: "center", paddingVertical: 16 }}>
                  No units created yet. Create a new unit first.
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setAddToUnitModal(null)}
                style={[styles.modalCancel, { borderColor: card.borderColor }]}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleAddToUnit()}
                disabled={unitActionLoading || !selectedUnitIdForAdd}
                style={[styles.modalSave, { backgroundColor: "#159A7C", opacity: (!selectedUnitIdForAdd || unitActionLoading) ? 0.5 : 1 }]}
              >
                {unitActionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "white" }]}>Add to Unit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: SET EXPECTED PAYMENT DATE ── */}
      <Modal visible={expectedDateModal !== null} transparent animationType="fade" onRequestClose={() => setExpectedDateModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, card]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>Expected Payment Date</Text>
              <TouchableOpacity onPress={() => setExpectedDateModal(null)}>
                <Ionicons name="close" size={22} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.detail, { color: muted }]}>
              Account: <Text style={{ color: foreground, fontFamily: Typography.bold }}>{expectedDateModal?.customer}</Text>
            </Text>

            {/* Quick date shortcuts */}
            <Text style={[styles.filterLabel, { color: muted, marginTop: 8 }]}>QUICK SELECTION</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {[
                { label: "Tomorrow", days: 1 },
                { label: "In 3 Days", days: 3 },
                { label: "In 7 Days", days: 7 },
                { label: "In 15 Days", days: 15 },
                { label: "In 30 Days", days: 30 },
              ].map((chip) => {
                const target = new Date();
                target.setDate(target.getDate() + chip.days);
                const isoStr = target.toISOString().split("T")[0];
                const isSelected = expectedDateInput === isoStr;
                return (
                  <TouchableOpacity
                    key={chip.label}
                    onPress={() => setExpectedDateInput(isoStr)}
                    style={[
                      styles.quickDateChip,
                      {
                        backgroundColor: isSelected ? (isDark ? "rgba(21, 154, 124, 0.18)" : "#EBF7F3") : (isDark ? "#121A16" : "#F1F5F9"),
                        borderColor: isSelected ? "#159A7C" : card.borderColor,
                      },
                    ]}
                  >
                    <Text style={{ fontFamily: isSelected ? Typography.bold : Typography.medium, fontSize: 11, color: isSelected ? "#159A7C" : foreground }}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.filterLabel, { color: muted }]}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: card.borderColor, color: foreground, minHeight: 46 }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={muted}
              value={expectedDateInput}
              onChangeText={setExpectedDateInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setExpectedDateModal(null)}
                style={[styles.modalCancel, { borderColor: card.borderColor }]}
              >
                <Text style={[styles.modalBtnText, { color: muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleSaveExpectedDate()}
                disabled={actionInProgress || !expectedDateInput.trim()}
                style={[styles.modalSave, { backgroundColor: "#159A7C", opacity: (!expectedDateInput.trim() || actionInProgress) ? 0.5 : 1 }]}
              >
                {actionInProgress ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "white" }]}>Set Date</Text>
                )}
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
    </View>
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
  // Floating bottom center assign button
  bottomCenterFloatingContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    elevation: 25,
  },
  bottomCenterAssignBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 30,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  bottomCenterAssignIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomCenterAssignBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  quickAssignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "transparent",
  },
  // Table View styles for Unassigned Customers (exact web match)
  tableContainer: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    marginVertical: 4,
  },
  tableWrapper: {
    minWidth: 860,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
  },
  tableHeaderCell: {
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    minHeight: 56,
    alignItems: "center",
  },
  tableColCheck: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tableColName: {
    width: 200,
    paddingHorizontal: 12,
    justifyContent: "center",
    gap: 2,
  },
  tableColState: {
    width: 130,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  tableColDistrict: {
    width: 130,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  tableColAddress: {
    width: 260,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  tableColAction: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 8,
  },
  tableDataCell: {
    fontFamily: Typography.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  tableDataCellBold: {
    fontFamily: Typography.semiBold,
    fontSize: 12.5,
    lineHeight: 16,
  },
  tableDataCellMuted: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  tableQuickAssignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: "rgba(5, 150, 105, 0.08)",
  },
  viewSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewSwitchText: {
    fontSize: 11,
  },
  // Unit Management & Actions Styles
  newUnitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  unitHeaderContainer: {
    width: "100%",
  },
  unitBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unitActionsBar: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unitActionBtn: {
    flex: 1,
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  unitActionText: {
    fontFamily: Typography.medium,
    fontSize: 11,
  },
  // Payment Follow-ups Table Columns
  pfColSno: { width: 50, paddingHorizontal: 6, alignItems: "center" },
  pfColCustVoucher: { width: 190, paddingHorizontal: 8, justifyContent: "center", gap: 2 },
  pfColDate: { width: 95, paddingHorizontal: 8, justifyContent: "center" },
  pfColCredit: { width: 150, paddingHorizontal: 8, justifyContent: "center" },
  pfColAmount: { width: 105, paddingHorizontal: 8, justifyContent: "center" },
  pfColPending: { width: 105, paddingHorizontal: 8, justifyContent: "center" },
  pfColRemark: { width: 200, paddingHorizontal: 8, justifyContent: "center" },
  pfColExpected: { width: 190, paddingHorizontal: 8, justifyContent: "center" },
  pfColTicket: { width: 85, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  pfColHistory: { width: 75, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  tableBadgeGreen: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
  },
  tableBadgeBlue: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
  },
  tableInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tableTicketBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tableHistoryBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pfCreditBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pfExpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  pfRemarkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  quickDateChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    marginRight: 6,
  },
  incentiveOverviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 2,
  },
  incentiveCard: {
    width: "48%",
    minHeight: 112,
    borderWidth: 1.2,
    borderRadius: 20,
    padding: 13,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  cardIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardTagText: {
    fontFamily: Typography.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  incentiveCardVal: {
    fontFamily: Typography.heading,
    fontSize: 18.5,
    letterSpacing: -0.3,
  },
  incentiveCardLabel: {
    fontFamily: Typography.bold,
    fontSize: 9.5,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  filterSelectorCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 12,
    gap: 8,
  },
  filterSelectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterSelectorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  filterSelectorLabel: {
    fontFamily: Typography.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  filterPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillButtonText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
  filterDropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  filterDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  spAvatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  arrearsBannerMobile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.2,
  },
  arrearsIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(21, 154, 124, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneBox: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    gap: 10,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    shadowOpacity: 0.05,
    elevation: 2,
  },
  milestoneTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flameIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneHeading: {
    fontFamily: Typography.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  milestonePctBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  milestonePctText: {
    fontFamily: Typography.bold,
    fontSize: 11,
  },
  milestoneTrackBar: {
    height: 9,
    borderRadius: 5,
    overflow: "hidden",
  },
  milestoneFillBar: {
    height: "100%",
    borderRadius: 5,
  },
  milestoneFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  milestoneSubtext: {
    fontFamily: Typography.regular,
    fontSize: 11,
    flex: 1,
  },
  milestoneTierLabel: {
    fontFamily: Typography.semiBold,
    fontSize: 11,
  },
  productsBox: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    gap: 10,
  },
  productsBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  productsBoxTitle: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  productItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  productItemName: {
    fontFamily: Typography.semiBold,
    fontSize: 13,
  },
  productMiniTag: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  productMiniTagText: {
    fontFamily: Typography.regular,
    fontSize: 10.5,
  },
  productItemPayable: {
    fontFamily: Typography.bold,
    fontSize: 13.5,
  },
  productItemPotential: {
    fontFamily: Typography.regular,
    fontSize: 10,
  },
  cleanEmptyCard: {
    minHeight: 140,
    borderRadius: 20,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 20,
  },
  cleanEmptyIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  cleanEmptyTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: 15,
  },
  cleanEmptySub: {
    fontFamily: Typography.regular,
    fontSize: 11.5,
    textAlign: "center",
    maxWidth: 260,
  },
  transactionCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 14,
    gap: 10,
  },
  txCustomerName: {
    fontFamily: Typography.bold,
    fontSize: 13.5,
  },
  txDateVoucher: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  txPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  txPillText: {
    fontFamily: Typography.bold,
    fontSize: 9.5,
  },
  txProductRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
  },
  txProductName: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
  txProductQty: {
    fontFamily: Typography.regular,
    fontSize: 10.5,
    marginTop: 1,
  },
  txAmount: {
    fontFamily: Typography.bold,
    fontSize: 13.5,
  },
  heroSummaryCard: {
    borderRadius: 22,
    borderWidth: 1.2,
    padding: 18,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    shadowOpacity: 0.06,
    elevation: 3,
  },
  heroSummaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroBadgeText: {
    fontFamily: Typography.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontFamily: Typography.medium,
    fontSize: 12,
  },
  heroAmount: {
    fontFamily: Typography.heading,
    fontSize: 27,
    letterSpacing: -0.5,
  },
  heroLabel: {
    fontFamily: Typography.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  heroChipsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  heroChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  heroChipLabel: {
    fontFamily: Typography.bold,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  heroChipVal: {
    fontFamily: Typography.bold,
    fontSize: 12.5,
  },
  asmCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 14,
    gap: 10,
  },
  asmAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  asmNameText: {
    fontFamily: Typography.headingSemi,
    fontSize: 15,
  },
  sectionHeading: {
    fontFamily: Typography.bold,
    fontSize: 14.5,
  },
  incentiveNavPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  incentiveNavPillText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
});