import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  Image,
  Share,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { capturePhotoAsync, pickImagesFromLibraryAsync } from "@/services/imagePickerService";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes, Radius, Shadows } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { SubAppLogo } from "@/components/employee/SubAppLogo";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import { API_BASE_URL } from "@/services/api";

import {
  ProformaItem,
  ProformaStats,
  ProformaDetail,
  ProformaDetailItem,
  DispatchInfo,
  PhotoAsset,
  ProformaHubData,
  fetchProformasFromApi,
  fetchProformaDetailApi,
  handlePriceRequestActionApi,
  convertQuotationToPIApi,
  requestDispatchApi,
  createPriceChangeRequestApi,
  fetchDispatchDetailApi,
  submitPackingPhotosApi,
  approvePackingApi,
  rejectPackingApi,
  sendWarehouseDispatchApi,
  fetchProformaHubApi,
} from "@/services/proformaService";

import { ProformaNavDrawer, ProformaNavTab } from "./ProformaNavDrawer";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";
import { CreateProformaModal } from "./CreateProformaModal";
import { PriceRequestsTab } from "./PriceRequestsTab";
import { StockRequestsTab } from "./StockRequestsTab";
import { DispatchQueueTab } from "./DispatchQueueTab";
import { ProformaCatalogTab } from "./ProformaCatalogTab";

export function ProformaMainScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  // Navigation & Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ProformaNavTab>("overview");
  const [hubData, setHubData] = useState<ProformaHubData | null>(null);

  // Search & Filters for Document List
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [items, setItems] = useState<ProformaItem[]>([]);
  const [stats, setStats] = useState<ProformaStats>({
    pipeline_value: "₹0",
    pipeline_value_num: 0,
    pending_approvals: 0,
    approved_count: 0,
    billed_count: 0,
    total_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Creation Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDocType, setCreateDocType] = useState<"proforma" | "quotation">("proforma");

  // Document Detail Modal State
  const [selectedItem, setSelectedItem] = useState<ProformaItem | null>(null);
  const [detailData, setDetailData] = useState<ProformaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Price Change Request Modal State
  const [priceChangeModalOpen, setPriceChangeModalOpen] = useState(false);
  const [selectedProductForPriceChange, setSelectedProductForPriceChange] = useState<ProformaDetailItem | null>(null);
  const [requestedPriceInput, setRequestedPriceInput] = useState("");
  const [priceChangeReason, setPriceChangeReason] = useState("");
  const [priceChangeSubmitting, setPriceChangeSubmitting] = useState(false);

  // Dispatch Hub Modal State
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [selectedPackingPhotos, setSelectedPackingPhotos] = useState<PhotoAsset[]>([]);
  const [packingRemark, setPackingRemark] = useState("");
  const [docketNumber, setDocketNumber] = useState("");
  const [selectedDocketPhotos, setSelectedDocketPhotos] = useState<PhotoAsset[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Theme tokens
  const bg = isDark ? "#090B10" : "#F8FAFC";
  const cardBg = isDark ? "#12151E" : "#FFFFFF";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0";
  const foreground = isDark ? "#F8FAFC" : "#101513";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const activeColor = "#10B981";

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load RBAC Hub on Mount
  const loadHub = useCallback(async () => {
    const data = await fetchProformaHubApi();
    if (data) {
      setHubData(data);
      // Auto-switch to warehouse dispatch if user is warehouse staff without proforma create access
      if (data.permissions.is_warehouse && !data.permissions.can_create_proforma) {
        setActiveTab("warehouse_dispatch");
      }
    }
  }, []);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  // Load Documents List
  const loadDocuments = useCallback(async (isPull = false) => {
    console.log("[ProformaMainScreen] loadDocuments START, activeTab:", activeTab, "statusFilter:", statusFilter, "search:", debouncedSearch);
    if (!isPull) setLoading(true);
    try {
      const docTypeParam = activeTab === "quotations" ? "quotation" : "all";
      const res = await fetchProformasFromApi({
        search: debouncedSearch,
        type: docTypeParam,
        status: statusFilter !== "all" ? (statusFilter as any) : undefined,
      });

      console.log("[ProformaMainScreen] loadDocuments GOT res:", {
        resultsLen: res?.results?.length,
        stats: res?.stats,
      });

      if (res && Array.isArray(res.results)) {
        setItems(res.results);
        setStats(res.stats);
      }
    } catch (e) {
      console.error("[ProformaMainScreen] loadDocuments CATCH:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, activeTab, statusFilter]);

  useEffect(() => {
    if (activeTab === "overview" || activeTab === "quotations") {
      loadDocuments();
    }
  }, [activeTab, loadDocuments]);

  // Open Document Detail
  const handleOpenDetail = async (item: ProformaItem) => {
    triggerLightHaptic();
    setSelectedItem(item);
    setDetailLoading(true);
    try {
      const data = await fetchProformaDetailApi(item.id, item.doc_type);
      setDetailData(data);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Dispatch Modal
  const handleOpenDispatch = async (invoiceId: number) => {
    triggerLightHaptic();
    setDispatchModalVisible(true);
    setDispatchLoading(true);
    try {
      const info = await fetchDispatchDetailApi(invoiceId);
      setDispatchInfo(info);
      setSelectedPackingPhotos([]);
      setSelectedDocketPhotos([]);
      setPackingRemark("");
      setDocketNumber(info?.docket?.docket_number || "");
    } finally {
      setDispatchLoading(false);
    }
  };

  // Convert Quotation to PI
  const handleConvertQuotation = async (qId: number | string) => {
    triggerLightHaptic();
    Alert.alert(
      "Convert to Proforma",
      "Convert this Quotation into an official Proforma Invoice?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert Now",
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await convertQuotationToPIApi(qId);
              if (res && res.success) {
                triggerSelectionHaptic();
                Alert.alert(
                  "Quotation Converted!",
                  `Successfully converted to Proforma Invoice ${res.proforma_number}!`,
                  [
                    {
                      text: "View Proforma Invoice",
                      onPress: () => {
                        setActiveTab("overview");
                        loadDocuments(true);
                        handleOpenDetail({
                          id: String(res.proforma_id),
                          doc_type: "proforma",
                          piNumber: res.proforma_number,
                        } as any);
                      },
                    },
                    {
                      text: "Done",
                      onPress: () => {
                        setSelectedItem(null);
                        setDetailData(null);
                        loadDocuments(true);
                      },
                    },
                  ]
                );
              } else {
                Alert.alert("Error", res?.message || "Failed to convert quotation.");
              }
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Conversion failed.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Open Price Change Modal for an item
  const handleOpenPriceChange = (item?: ProformaDetailItem) => {
    if (!detailData || detailData.items.length === 0) return;
    triggerLightHaptic();
    const targetItem = item || detailData.items[0];
    setSelectedProductForPriceChange(targetItem);
    setRequestedPriceInput(String(targetItem.unit_price_num || ""));
    setPriceChangeReason("");
    setPriceChangeModalOpen(true);
  };

  // Submit Price Change Request
  const handleSubmitPriceChange = async () => {
    if (!detailData || !selectedProductForPriceChange) return;
    const priceNum = parseFloat(requestedPriceInput);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid requested price per unit.");
      return;
    }
    const targetProductId = selectedProductForPriceChange.product_id ?? selectedProductForPriceChange.id;
    if (!targetProductId) {
      Alert.alert("Invalid Product", "Selected product does not have a valid ID.");
      return;
    }
    setPriceChangeSubmitting(true);
    try {
      const res = await createPriceChangeRequestApi({
        doc_id: detailData.id,
        doc_type: detailData.doc_type,
        product_id: targetProductId,
        requested_price: priceNum,
        reason: priceChangeReason.trim(),
      });
      if (res && res.success) {
        triggerSelectionHaptic();
        Alert.alert("Request Submitted", "Price change request has been submitted for review.");
        setPriceChangeModalOpen(false);
        const updated = await fetchProformaDetailApi(detailData.id, detailData.doc_type);
        setDetailData(updated);
        loadDocuments(true);
      } else {
        Alert.alert("Error", res?.message || "Failed to submit price change request.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || err?.message || "Failed to submit price change request.");
    } finally {
      setPriceChangeSubmitting(false);
    }
  };

  // Request Dispatch
  const handleRequestDispatch = async (invoiceId: number) => {
    triggerLightHaptic();
    Alert.alert(
      "Request Dispatch",
      "Raise a dispatch request for Accounts & Logistics teams?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Dispatch",
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await requestDispatchApi(invoiceId);
              if (res && res.success) {
                triggerSelectionHaptic();
                Alert.alert("Dispatch Requested", res.message);
                const updated = await fetchProformaDetailApi(invoiceId, "proforma");
                setDetailData(updated);
                loadDocuments(true);
              } else {
                Alert.alert("Error", res?.message || "Failed to request dispatch.");
              }
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error || err?.message || "Could not request dispatch.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Share / Export Document
  const handleShareDocument = async () => {
    if (!detailData) return;
    triggerLightHaptic();
    try {
      const isQuotation = detailData.doc_type === "quotation";
      const docTitle = isQuotation ? "Quotation" : "Proforma Invoice";
      const lines = [
        `*${docTitle.toUpperCase()} - OBLU HEALTHCARE LLP*`,
        `Doc Number: ${detailData.number}`,
        `Date: ${detailData.date}`,
        `Customer: ${detailData.customer.name}`,
        `Phone: ${detailData.customer.phone || "N/A"}`,
        `City/State: ${detailData.customer.city || "India"}`,
        detailData.customer.gstin ? `GSTIN: ${detailData.customer.gstin}` : "",
        `----------------------------------------`,
        `*ORDERED ITEMS:*`,
        ...detailData.items.map(
          (it, idx) =>
            `${idx + 1}. ${it.product_name} (${it.category})\n   Qty: ${it.quantity} × ${it.unit_price} = ${it.total_price}`
        ),
        `----------------------------------------`,
        `Taxable Total: ${detailData.totals.taxable_total}`,
        `Courier (${detailData.courier_mode.toUpperCase()}): ${detailData.totals.courier_charge}`,
        `*Grand Total: ${detailData.totals.grand_total}*`,
        `----------------------------------------`,
        `*BANK DETAILS:*`,
        `A/c Holder: ${detailData.bank_details?.account_holder || "OBLU HEALTHCARE LLP"}`,
        `Bank: ${detailData.bank_details?.bank || "Axis Bank Limited"}`,
        `A/c No: ${detailData.bank_details?.account_no || "926030003897014"}`,
        `IFSC: ${detailData.bank_details?.ifsc || "UTIB0000588"}`,
        `Branch: ${detailData.bank_details?.branch || "Lok Vihar, New Delhi"}`,
        `----------------------------------------`,
        `*TERMS & CONDITIONS:*`,
        `1. Prices inclusive of GST.`,
        `2. 100% advance payment required.`,
        `3. Delivery within 2-3 weeks from confirmed order.`,
      ]
        .filter(Boolean)
        .join("\n");

      await Share.share({
        title: `${docTitle} #${detailData.number}`,
        message: lines,
      });
    } catch (err: any) {
      console.warn("Share failed:", err);
    }
  };

  // Handle Photo Capture for Dispatch
  const handleCapturePhoto = async (type: "packing" | "docket") => {
    triggerLightHaptic();
    const photo = await capturePhotoAsync();
    if (photo) {
      triggerSelectionHaptic();
      if (type === "packing") {
        setSelectedPackingPhotos((prev) => [...prev, photo]);
      } else {
        setSelectedDocketPhotos((prev) => [...prev, photo]);
      }
    }
  };

  const handlePickPhotos = async (type: "packing" | "docket") => {
    triggerLightHaptic();
    const picked = await pickImagesFromLibraryAsync(true);
    if (picked.length > 0) {
      triggerSelectionHaptic();
      if (type === "packing") {
        setSelectedPackingPhotos((prev) => [...prev, ...picked]);
      } else {
        setSelectedDocketPhotos((prev) => [...prev, ...picked]);
      }
    }
  };

  const handleSubmitPackingPhotos = async () => {
    if (!dispatchInfo) return;
    if (selectedPackingPhotos.length === 0) {
      Alert.alert("Photos Required", "Please capture at least one packing photo.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await submitPackingPhotosApi(dispatchInfo.invoice_id, selectedPackingPhotos, packingRemark);
      if (res && res.success) {
        triggerSelectionHaptic();
        Alert.alert("Packing Submitted", "Packing photos submitted to Accounts for review.");
        handleOpenDispatch(dispatchInfo.invoice_id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to upload packing photos.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePacking = async () => {
    if (!dispatchInfo) return;
    setActionLoading(true);
    try {
      const res = await approvePackingApi(dispatchInfo.invoice_id);
      if (res && res.success) {
        triggerSelectionHaptic();
        Alert.alert("Approved", "Packing approved! Warehouse can now dispatch the parcel.");
        handleOpenDispatch(dispatchInfo.invoice_id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to approve packing.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendDispatch = async () => {
    if (!dispatchInfo) return;
    if (!docketNumber.trim()) {
      Alert.alert("Docket Number Required", "Please enter the courier docket/AWB number.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await sendWarehouseDispatchApi(dispatchInfo.invoice_id, docketNumber.trim(), selectedDocketPhotos);
      if (res && res.success) {
        triggerSelectionHaptic();
        Alert.alert("Dispatched", "Shipment marked as Dispatched with tracking docket!");
        handleOpenDispatch(dispatchInfo.invoice_id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to record dispatch.");
    } finally {
      setActionLoading(false);
    }
  };

  // Render Document Card
  const renderDocumentItem = ({ item }: { item: ProformaItem }) => {
    const isQuotation = item.doc_type === "quotation";
    return (
      <TouchableOpacity
        style={[styles.docCard, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => handleOpenDetail(item)}
        activeOpacity={0.7}
      >
        <View style={styles.docCardHeader}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.piNumber, { color: activeColor }]}>{item.piNumber}</Text>
              <View style={[styles.docTypePill, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#EBF7F3" }]}>
                <Text style={[styles.docTypeText, { color: activeColor }]}>
                  {isQuotation ? "QUOTATION" : "PROFORMA"}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.clientName, { color: foreground }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {item.clientName}
            </Text>
          </View>
          <StatusPill
            label={item.status || "Pending"}
            variant={(item.status || "").toLowerCase() === "approved" ? "paid" : "pending"}
            size="small"
          />
        </View>

        <View style={styles.docCardDivider} />

        <View style={styles.docCardFooter}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.amountLabel, { color: muted }]}>Grand Total</Text>
            <Text
              style={[styles.amountVal, { color: foreground }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {item.amount}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", flexShrink: 1, minWidth: 0 }}>
            <Text style={[styles.dateText, { color: muted }]} numberOfLines={1}>{item.date}</Text>
            <Text style={[styles.repText, { color: muted }]} numberOfLines={1}>{item.rep}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case "quotations":
        return "Quotations";
      case "price_requests":
        return "Price Approvals";
      case "stock_requests":
        return "Stock Requests";
      case "dispatch_queue":
        return "Dispatch Queue";
      case "warehouse_dispatch":
        return "Warehouse Execution";
      case "catalog":
        return "Product Catalog";
      default:
        return "Proforma & Quotations";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: Math.max(insets.top, 10) }]}>
      {/* ── Top Header Bar ── */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            setDrawerOpen(true);
          }}
          style={[styles.menuBtn, { backgroundColor: cardBg, borderColor: border }]}
          accessibilityLabel="Open Navigation Menu"
        >
          <Ionicons name="menu" size={22} color={foreground} />
        </TouchableOpacity>

        <View style={styles.titleCluster}>
          <Text
            style={[styles.headerTitle, { color: foreground }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {getTabTitle()}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {hubData?.permissions.can_create_proforma ? (
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                setCreateDocType(activeTab === "quotations" ? "quotation" : "proforma");
                setCreateModalOpen(true);
              }}
              style={[styles.addBtn, { backgroundColor: activeColor }]}
              accessibilityLabel="Create Document"
            >
              <Ionicons name="add" size={22} color="#06281E" />
            </TouchableOpacity>
          ) : null}
          <SubAppHomeButton size={38} />
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholders={[
            'Search "customer name"',
            'Search "PI-2026-..."',
            'Search "product name or SKU"',
          ]}
          onClear={() => setSearchQuery("")}
        />
      </View>

      {/* ── KPI Stat Banner (Overview Tab Only) ── */}
      {activeTab === "overview" && (
        <View style={styles.statsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
          >
            <View style={[styles.statTile, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.statTileLabel, { color: muted }]}>PIPELINE VALUE</Text>
              <Text style={[styles.statTileVal, { color: activeColor }]}>{stats.pipeline_value}</Text>
              <Text style={[styles.statTileSub, { color: muted }]}>{stats.total_count} documents</Text>
            </View>

            <View style={[styles.statTile, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.statTileLabel, { color: muted }]}>PENDING REVIEW</Text>
              <Text style={[styles.statTileVal, { color: "#F59E0B" }]}>{stats.pending_approvals}</Text>
              <Text style={[styles.statTileSub, { color: muted }]}>Price / credit approvals</Text>
            </View>

            <View style={[styles.statTile, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.statTileLabel, { color: muted }]}>APPROVED & BILLED</Text>
              <Text style={[styles.statTileVal, { color: activeColor }]}>
                {stats.approved_count + stats.billed_count}
              </Text>
              <Text style={[styles.statTileSub, { color: muted }]}>Ready for dispatch</Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── Tab Content Rendering ── */}
      {activeTab === "overview" || activeTab === "quotations" ? (
        <View style={{ flex: 1 }}>
          {/* Document Type Switcher (All Documents vs Quotations) */}
          <View style={[styles.docTypeSegmentRow, { backgroundColor: isDark ? "#12151E" : "#EFF6F3", borderColor: border }]}>
            <TouchableOpacity
              style={[
                styles.docTypeSegmentBtn,
                activeTab === "overview" && { backgroundColor: activeColor },
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                setActiveTab("overview");
              }}
            >
              <Ionicons
                name="albums-outline"
                size={14}
                color={activeTab === "overview" ? "#06281E" : muted}
              />
              <Text
                style={[
                  styles.docTypeSegmentText,
                  { color: activeTab === "overview" ? "#06281E" : foreground, fontFamily: Typography.bold },
                ]}
              >
                All Documents
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.docTypeSegmentBtn,
                activeTab === "quotations" && { backgroundColor: activeColor },
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                setActiveTab("quotations");
              }}
            >
              <Ionicons
                name="receipt-outline"
                size={14}
                color={activeTab === "quotations" ? "#06281E" : muted}
              />
              <Text
                style={[
                  styles.docTypeSegmentText,
                  { color: activeTab === "quotations" ? "#06281E" : foreground, fontFamily: Typography.bold },
                ]}
              >
                Quotations ({hubData?.stats.total_quotations ?? "•"})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status Quick Filter Bar */}
          <View style={styles.filterPillsRow}>
            {["all", "approved", "pending", "billed"].map((st) => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.filterPill,
                  statusFilter === st && { backgroundColor: activeColor },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setStatusFilter(st);
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: statusFilter === st ? "#06281E" : muted },
                  ]}
                >
                  {st.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && !refreshing ? (
            <SkeletonCardList count={4} height={110} style={{ paddingHorizontal: 16 }} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => `${item.doc_type}-${item.id}`}
              renderItem={renderDocumentItem}
              contentContainerStyle={styles.docListContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadDocuments(true);
                  }}
                  tintColor={activeColor}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={42} color={muted} />
                  <Text style={[styles.emptyTitle, { color: foreground }]}>No Documents Found</Text>
                  <Text style={[styles.emptySubtitle, { color: muted }]}>
                    {searchQuery
                      ? `No documents matching "${searchQuery}".`
                      : "Create your first Proforma Invoice or Quotation using the + button above."}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      ) : activeTab === "price_requests" ? (
        <PriceRequestsTab
          canApprove={Boolean(hubData?.permissions.can_approve_price_change)}
          searchQuery={debouncedSearch}
        />
      ) : activeTab === "stock_requests" ? (
        <StockRequestsTab
          canApprove={Boolean(hubData?.permissions.can_request_stock)}
          searchQuery={debouncedSearch}
        />
      ) : activeTab === "dispatch_queue" ? (
        <DispatchQueueTab
          queueType="accounts"
          searchQuery={debouncedSearch}
          onOpenDispatchDetail={handleOpenDispatch}
        />
      ) : activeTab === "warehouse_dispatch" ? (
        <DispatchQueueTab
          queueType="warehouse"
          searchQuery={debouncedSearch}
          onOpenDispatchDetail={handleOpenDispatch}
        />
      ) : activeTab === "catalog" ? (
        <ProformaCatalogTab searchQuery={debouncedSearch} />
      ) : null}

      {/* ── Slide-Out Navigation Drawer ── */}
      <ProformaNavDrawer
        visible={drawerOpen}
        activeTab={activeTab}
        hubData={hubData}
        onClose={() => setDrawerOpen(false)}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenCreateModal={(type) => {
          setCreateDocType(type);
          setCreateModalOpen(true);
        }}
      />

      {/* ── Document Creation Modal ── */}
      <CreateProformaModal
        visible={createModalOpen}
        docType={createDocType}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(created) => {
          loadHub();
          loadDocuments(true);
          if (created) {
            if (created.doc_type === "quotation") {
              setActiveTab("quotations");
            } else {
              setActiveTab("overview");
            }
            handleOpenDetail({
              id: String(created.id),
              doc_type: created.doc_type,
              piNumber: created.number || (created.doc_type === "quotation" ? `QT-${created.id}` : `PI-${created.id}`),
            } as any);
          }
        }}
      />

      {/* ── Proforma / Quotation Detail Modal ── */}
      <Modal visible={Boolean(selectedItem)} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.detailModalFrame, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: border }]}>
            <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={muted} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>{detailData?.number || selectedItem?.piNumber}</Text>
              <Text style={[styles.modalSub, { color: muted }]}>
                {selectedItem?.doc_type === "quotation" ? "Quotation Details" : "Proforma Invoice Details"}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {detailLoading ? (
            <ActivityIndicator style={{ marginTop: 60 }} color={activeColor} />
          ) : detailData ? (
            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {/* Converted to PI Banner */}
              {detailData.doc_type === "quotation" && detailData.is_converted_to_proforma && (
                <View style={[styles.convertedBanner, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#ECFDF5", borderColor: "#10B981" }]}>
                  <Ionicons name="checkmark-done-circle" size={22} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.convertedBannerTitle, { color: foreground }]}>Converted to Proforma Invoice</Text>
                    <Text style={[styles.convertedBannerSub, { color: muted }]}>This quotation has been officially converted to a Proforma Invoice.</Text>
                  </View>
                </View>
              )}

              {/* Customer Box (Billing & Shipping) */}
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.detailCardLabel, { color: muted }]}>CUSTOMER & SHIPPING</Text>

                {/* Billing Address */}
                <View style={{ marginBottom: detailData.shipping_customer ? 10 : 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="card-outline" size={14} color={activeColor} />
                    <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: foreground }}>BILLING TO</Text>
                  </View>
                  <Text style={[styles.detailClientName, { color: foreground, marginTop: 4 }]}>{detailData.customer.name}</Text>
                  {Boolean(detailData.customer.address) && (
                    <Text style={[styles.detailClientSub, { color: muted }]}>
                      Addr: {detailData.customer.address}
                    </Text>
                  )}
                  <Text style={[styles.detailClientSub, { color: muted }]}>
                    Phone: {detailData.customer.phone || "N/A"} • {detailData.customer.city || "India"}
                  </Text>
                  {Boolean(detailData.customer.gstin) && (
                    <Text style={[styles.detailGstin, { color: muted }]}>GSTIN: {detailData.customer.gstin}</Text>
                  )}
                </View>

                {/* Shipping Address */}
                {detailData.shipping_customer && (
                  <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="location-outline" size={14} color={activeColor} />
                      <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: foreground }}>SHIP TO</Text>
                    </View>
                    <Text style={[styles.detailClientName, { color: foreground, marginTop: 4 }]}>
                      {detailData.shipping_customer.name}
                    </Text>
                    {Boolean(detailData.shipping_customer.address) && (
                      <Text style={[styles.detailClientSub, { color: muted }]}>
                        Addr: {detailData.shipping_customer.address}
                      </Text>
                    )}
                    <Text style={[styles.detailClientSub, { color: muted }]}>
                      Phone: {detailData.shipping_customer.phone || "N/A"} • {detailData.shipping_customer.city || "India"}
                    </Text>
                    {Boolean(detailData.shipping_customer.gstin) && (
                      <Text style={[styles.detailGstin, { color: muted }]}>
                        GSTIN: {detailData.shipping_customer.gstin}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Items Table */}
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.detailCardLabel, { color: muted }]}>ORDERED ITEMS ({detailData.items.length})</Text>
                {detailData.items.map((it) => (
                  <View key={it.id} style={[styles.detailItemRow, { borderBottomColor: border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailItemName, { color: foreground }]}>{it.product_name}</Text>
                      <Text style={[styles.detailItemSku, { color: muted }]}>
                        {it.category} • SKU: {it.sku || "N/A"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <Text style={[styles.detailItemQty, { color: activeColor }]}>
                          {it.quantity} × {it.unit_price}
                        </Text>
                        {detailData.can_request_price_change && (
                          <TouchableOpacity
                            onPress={() => handleOpenPriceChange(it)}
                            style={[styles.itemPriceTagBtn, { borderColor: border }]}
                          >
                            <Ionicons name="pricetag-outline" size={11} color="#F59E0B" />
                            <Text style={styles.itemPriceTagText}>Request Price</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.detailItemTotal, { color: foreground }]}>{it.total_price}</Text>
                  </View>
                ))}
              </View>

              {/* Active Price Requests Banner */}
              {detailData.price_requests && detailData.price_requests.length > 0 && (
                <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: "#F59E0B" }]}>
                  <Text style={[styles.detailCardLabel, { color: "#F59E0B" }]}>PRICE APPROVAL REQUESTS ({detailData.price_requests.length})</Text>
                  {detailData.price_requests.map((pr) => (
                    <View key={pr.id} style={{ paddingVertical: 4 }}>
                      <Text style={[styles.bankLine, { color: foreground }]}>
                        {pr.product_name}: Requested ₹{pr.requested_price} (Status: <Text style={{ fontFamily: Typography.bold, color: pr.status === "approved" ? activeColor : pr.status === "pending" ? "#F59E0B" : "#EF4444" }}>{pr.status.toUpperCase()}</Text>)
                      </Text>
                      {Boolean(pr.reason) && (
                        <Text style={{ fontSize: 11, color: muted, fontStyle: "italic" }}>Reason: {pr.reason}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Pricing Totals */}
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.detailCardLabel, { color: muted }]}>INVOICE SUMMARY</Text>
                <View style={styles.summaryLine}>
                  <Text style={[styles.summaryLineLabel, { color: muted }]}>Taxable Total</Text>
                  <Text style={[styles.summaryLineVal, { color: foreground }]}>{detailData.totals.taxable_total}</Text>
                </View>
                <View style={styles.summaryLine}>
                  <Text style={[styles.summaryLineLabel, { color: muted }]}>
                    Courier Charges ({detailData.courier_mode.toUpperCase()})
                  </Text>
                  <Text style={[styles.summaryLineVal, { color: foreground }]}>{detailData.totals.courier_charge}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: border }]} />
                <View style={styles.summaryLine}>
                  <Text style={[styles.grandTotalLabel, { color: foreground }]}>Grand Total</Text>
                  <Text style={[styles.grandTotalVal, { color: activeColor }]}>{detailData.totals.grand_total}</Text>
                </View>
              </View>

              {/* Bank Details Box */}
              {detailData.bank_details && (
                <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Ionicons name="card-outline" size={15} color={activeColor} />
                    <Text style={[styles.detailCardLabel, { color: muted, marginBottom: 0 }]}>BANK DETAILS</Text>
                  </View>
                  <Text style={[styles.bankLine, { color: foreground }]}>
                    A/c Holder: <Text style={{ fontFamily: Typography.bold }}>{detailData.bank_details.account_holder}</Text>
                  </Text>
                  <Text style={[styles.bankLine, { color: foreground }]}>
                    Bank: <Text style={{ fontFamily: Typography.semiBold }}>{detailData.bank_details.bank}</Text>
                  </Text>
                  <Text style={[styles.bankLine, { color: foreground }]}>
                    A/c No: <Text style={{ fontFamily: Typography.bold }}>{detailData.bank_details.account_no}</Text>
                  </Text>
                  <Text style={[styles.bankLine, { color: foreground }]}>
                    IFSC: <Text style={{ fontFamily: Typography.bold }}>{detailData.bank_details.ifsc}</Text> • Branch: {detailData.bank_details.branch}
                  </Text>
                </View>
              )}

              {/* Terms and Conditions */}
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Ionicons name="document-text-outline" size={15} color={activeColor} />
                  <Text style={[styles.detailCardLabel, { color: muted, marginBottom: 0 }]}>TERMS & CONDITIONS</Text>
                </View>
                <Text style={[styles.termItem, { color: muted }]}>1. Prices: Quoted on F.O.R Destination and inclusive of GST.</Text>
                <Text style={[styles.termItem, { color: muted }]}>2. Payment: 100% advance payment in our favor.</Text>
                <Text style={[styles.termItem, { color: muted }]}>3. Delivery: 2-3 weeks from receipt of confirmed order.</Text>
                <Text style={[styles.termItem, { color: muted }]}>4. Validity: 30 days from date of issuance.</Text>

                <View style={[styles.signatoryRow, { borderTopColor: border }]}>
                  <View style={{ flex: 1 }} />
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.signatoryLabel, { color: muted }]}>Authorized Signatory</Text>
                    <Text style={[styles.signatoryOrg, { color: foreground }]}>OBLU HEALTHCARE LLP</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.detailActionCol}>
                {/* 1. Convert to PI (Quotations only, if not converted) */}
                {detailData.doc_type === "quotation" && !detailData.is_converted_to_proforma && (
                  <TouchableOpacity
                    style={[styles.convertBtn, { backgroundColor: activeColor }]}
                    onPress={() => handleConvertQuotation(detailData.id)}
                    disabled={actionLoading}
                  >
                    <Ionicons name="swap-horizontal" size={18} color="#06281E" />
                    <Text style={styles.convertBtnText}>Convert to Proforma Invoice</Text>
                  </TouchableOpacity>
                )}

                {/* 2. Request Price Change */}
                {detailData.can_request_price_change && (
                  <TouchableOpacity
                    style={[styles.priceRequestBtn, { borderColor: "#F59E0B", backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7" }]}
                    onPress={() => handleOpenPriceChange()}
                  >
                    <Ionicons name="pricetag-outline" size={18} color="#D97706" />
                    <Text style={[styles.priceRequestBtnText, { color: "#D97706" }]}>Request Price Change</Text>
                  </TouchableOpacity>
                )}

                {/* 3. Request Dispatch (Proforma Invoices in processing) */}
                {detailData.doc_type === "proforma" && detailData.can_request_dispatch && (
                  <TouchableOpacity
                    style={[styles.requestDispatchBtn, { backgroundColor: activeColor }]}
                    onPress={() => handleRequestDispatch(detailData.id)}
                    disabled={actionLoading}
                  >
                    <Ionicons name="paper-plane-outline" size={18} color="#06281E" />
                    <Text style={styles.requestDispatchBtnText}>Request Dispatch</Text>
                  </TouchableOpacity>
                )}

                {/* 4. Open Dispatch Camera & Logistics Hub (Proforma Invoices) */}
                {detailData.doc_type === "proforma" && !detailData.can_request_dispatch && (
                  <TouchableOpacity
                    style={[styles.dispatchHubBtn, { borderColor: activeColor }]}
                    onPress={() => handleOpenDispatch(detailData.id)}
                  >
                    <Ionicons name="camera-outline" size={18} color={activeColor} />
                    <Text style={[styles.dispatchHubText, { color: activeColor }]}>
                      Open Dispatch Camera & Logistics Hub
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 5. Share / Export Document */}
                <TouchableOpacity
                  style={[styles.shareBtn, { borderColor: border }]}
                  onPress={handleShareDocument}
                >
                  <Ionicons name="share-social-outline" size={18} color={foreground} />
                  <Text style={[styles.shareBtnText, { color: foreground }]}>
                    Share / Export {detailData.doc_type === "quotation" ? "Quotation" : "Invoice"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      {/* ── Price Change Request Modal ── */}
      <Modal visible={priceChangeModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPriceChangeModalOpen(false)}>
        <View style={[styles.detailModalFrame, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
          <View style={[styles.modalHeader, { borderBottomColor: border }]}>
            <TouchableOpacity onPress={() => setPriceChangeModalOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={muted} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>Request Price Change</Text>
              <Text style={[styles.modalSub, { color: muted }]}>{detailData?.number || ""}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            {/* Select Product Item */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.detailCardLabel, { color: muted }]}>SELECT ITEM *</Text>
              {detailData?.items.map((it) => {
                const isSelected = selectedProductForPriceChange?.id === it.id;
                return (
                  <TouchableOpacity
                    key={it.id}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setSelectedProductForPriceChange(it);
                      setRequestedPriceInput(String(it.unit_price_num || ""));
                    }}
                    style={[
                      styles.productOptionRow,
                      { borderColor: isSelected ? activeColor : border, backgroundColor: isSelected ? (isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5") : "transparent" },
                    ]}
                  >
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={isSelected ? activeColor : muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.productOptionName, { color: foreground }]}>{it.product_name}</Text>
                      <Text style={[styles.productOptionSub, { color: muted }]}>Current Price: {it.unit_price} • Qty: {it.quantity}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Requested Price Input */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.detailCardLabel, { color: muted }]}>NEW REQUESTED PRICE PER UNIT (₹) *</Text>
              <TextInput
                style={[styles.textInput, { color: foreground, borderColor: border, backgroundColor: isDark ? "#090B10" : "#FFFFFF" }]}
                keyboardType="numeric"
                value={requestedPriceInput}
                onChangeText={setRequestedPriceInput}
                placeholder="Enter requested price..."
                placeholderTextColor={muted}
              />
            </View>

            {/* Reason */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.detailCardLabel, { color: muted }]}>REASON FOR PRICE CHANGE</Text>
              <TextInput
                style={[styles.textArea, { color: foreground, borderColor: border, backgroundColor: isDark ? "#090B10" : "#FFFFFF" }]}
                multiline
                numberOfLines={3}
                value={priceChangeReason}
                onChangeText={setPriceChangeReason}
                placeholder="Client discount justification, competitive match, volume deal..."
                placeholderTextColor={muted}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitPriceRequestBtn, { backgroundColor: activeColor, opacity: priceChangeSubmitting ? 0.6 : 1 }]}
              onPress={handleSubmitPriceChange}
              disabled={priceChangeSubmitting}
            >
              {priceChangeSubmitting ? (
                <ActivityIndicator color="#06281E" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#06281E" />
                  <Text style={styles.submitPriceRequestText}>Submit Price Request</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Dispatch Photo Capture & Logistics Modal ── */}
      <Modal visible={dispatchModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.detailModalFrame, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
          <View style={[styles.modalHeader, { borderBottomColor: border }]}>
            <TouchableOpacity onPress={() => setDispatchModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={muted} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={[styles.modalTitle, { color: foreground }]}>Dispatch Logistics</Text>
              <Text style={[styles.modalSub, { color: muted }]}>PI #{dispatchInfo?.invoice_id || ""}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {dispatchLoading ? (
            <ActivityIndicator style={{ marginTop: 60 }} color={activeColor} />
          ) : dispatchInfo ? (
            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {/* Status Header */}
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.detailCardLabel, { color: muted }]}>STATUS</Text>
                  <StatusPill
                    label={dispatchInfo.status_display || dispatchInfo.status}
                    variant={dispatchInfo.status === "packing_approved" || dispatchInfo.status === "completed" ? "paid" : "pending"}
                    size="small"
                  />
                </View>
                <Text style={[styles.shipmentText, { color: foreground }]}>
                  Method: {dispatchInfo.shipment_method}
                </Text>
              </View>

              {/* Warehouse Packing Photos Section */}
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.detailCardLabel, { color: muted }]}>PACKING PHOTOS ({dispatchInfo.photos.length})</Text>

                {/* Existing uploaded photos */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                  {dispatchInfo.photos.map((ph) => (
                    <Image
                      key={ph.id}
                      source={{ uri: `${API_BASE_URL.replace("/api", "")}${ph.url}` }}
                      style={styles.photoThumb}
                    />
                  ))}
                  {dispatchInfo.photos.length === 0 && (
                    <Text style={[styles.noPhotosText, { color: muted }]}>No packing photos uploaded yet.</Text>
                  )}
                </ScrollView>

                {/* Warehouse Camera Capture Actions */}
                {dispatchInfo.can_submit_packing && (
                  <View style={{ marginTop: 10 }}>
                    <View style={styles.cameraBtnRow}>
                      <TouchableOpacity
                        style={[styles.camBtn, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#DDF4EA" }]}
                        onPress={() => handleCapturePhoto("packing")}
                      >
                        <Ionicons name="camera" size={16} color={activeColor} />
                        <Text style={[styles.camBtnText, { color: activeColor }]}>Take Photo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.camBtn, { backgroundColor: isDark ? "#161B26" : "#F1F5F9" }]}
                        onPress={() => handlePickPhotos("packing")}
                      >
                        <Ionicons name="images" size={16} color={muted} />
                        <Text style={[styles.camBtnText, { color: foreground }]}>Gallery</Text>
                      </TouchableOpacity>
                    </View>

                    {selectedPackingPhotos.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={[styles.selectedCountText, { color: activeColor }]}>
                          {selectedPackingPhotos.length} new photos ready to submit
                        </Text>
                        <TouchableOpacity
                          style={[styles.uploadSubmitBtn, { backgroundColor: activeColor }]}
                          onPress={handleSubmitPackingPhotos}
                          disabled={actionLoading}
                        >
                          <Text style={styles.uploadSubmitText}>Upload Packing Photos</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Accounts Approval Buttons */}
                {dispatchInfo.can_approve_packing && (
                  <View style={styles.accountsActionRow}>
                    <TouchableOpacity
                      style={[styles.approvePackingBtn, { backgroundColor: activeColor }]}
                      onPress={handleApprovePacking}
                      disabled={actionLoading}
                    >
                      <Ionicons name="checkmark-done" size={18} color="#06281E" />
                      <Text style={styles.approvePackingText}>Approve Packing</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Courier Docket Section */}
              <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.detailCardLabel, { color: muted }]}>COURIER DOCKET & AWB</Text>

                {dispatchInfo.can_dispatch ? (
                  <View style={{ marginTop: 6 }}>
                    <TextInput
                      style={[styles.docketInput, { backgroundColor: isDark ? "#161B26" : "#F1F5F9", color: foreground, borderColor: border }]}
                      placeholder="Enter Docket Number (e.g. SF1294857)..."
                      placeholderTextColor={muted}
                      value={docketNumber}
                      onChangeText={setDocketNumber}
                    />

                    <TouchableOpacity
                      style={[styles.sendDispatchBtn, { backgroundColor: activeColor }]}
                      onPress={handleSendDispatch}
                      disabled={actionLoading}
                    >
                      <Ionicons name="paper-plane" size={18} color="#06281E" />
                      <Text style={styles.sendDispatchText}>Confirm Parcel Dispatched</Text>
                    </TouchableOpacity>
                  </View>
                ) : dispatchInfo.docket ? (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[styles.docketNumDisplay, { color: activeColor }]}>
                      Docket: {dispatchInfo.docket.docket_number}
                    </Text>
                    <Text style={[styles.docketDateDisplay, { color: muted }]}>
                      Dispatched by {dispatchInfo.docket.dispatched_by} on {dispatchInfo.docket.dispatched_at}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.noDocketText, { color: muted }]}>Awaiting packing approval before docket assignment.</Text>
                )}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleCluster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    marginHorizontal: 8,
  },
  headerTitle: { fontSize: 17, fontFamily: Typography.bold },
  headerRole: { fontSize: 11, fontFamily: Typography.regular, marginTop: 1 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  statsContainer: {
    height: 76,
    marginBottom: 6,
  },
  statsScroll: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: "center",
  },
  statTile: {
    height: 68,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 136,
    justifyContent: "center",
  },
  statTileLabel: { fontSize: 9.5, fontFamily: Typography.bold, letterSpacing: 0.5 },
  statTileVal: { fontSize: 16, fontFamily: Typography.bold, marginVertical: 1 },
  statTileSub: { fontSize: 10, fontFamily: Typography.regular },
  filterPillsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  filterPillText: { fontSize: 10, fontFamily: Typography.bold, letterSpacing: 0.5 },
  docListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 100,
  },
  docCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  docCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  piNumber: { fontSize: 13, fontFamily: Typography.bold },
  docTypePill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  docTypeText: { fontSize: 9, fontFamily: Typography.bold },
  clientName: { fontSize: 14, fontFamily: Typography.bold, marginTop: 4 },
  docCardDivider: { height: 1, backgroundColor: "rgba(128, 128, 128, 0.08)", marginVertical: 10 },
  docCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  amountLabel: { fontSize: 10, fontFamily: Typography.regular },
  amountVal: { fontSize: 15, fontFamily: Typography.bold, marginTop: 1 },
  dateText: { fontSize: 11, fontFamily: Typography.regular },
  repText: { fontSize: 10, fontFamily: Typography.regular, marginTop: 1 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: Typography.bold },
  emptySubtitle: { fontSize: 12, fontFamily: Typography.regular, textAlign: "center", paddingHorizontal: 24 },
  detailModalFrame: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  modalTitle: { fontSize: 16, fontFamily: Typography.bold },
  modalSub: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  detailScroll: { padding: 16, paddingBottom: 60 },
  detailCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  detailCardLabel: { fontSize: 10, fontFamily: Typography.bold, letterSpacing: 0.8, marginBottom: 8 },
  detailClientName: { fontSize: 15, fontFamily: Typography.bold },
  detailClientSub: { fontSize: 12, fontFamily: Typography.regular, marginTop: 2 },
  detailGstin: { fontSize: 11, fontFamily: Typography.regular, marginTop: 4 },
  detailItemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  detailItemName: { fontSize: 13, fontFamily: Typography.bold },
  detailItemSku: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  detailItemQty: { fontSize: 11, fontFamily: Typography.semiBold, marginTop: 4 },
  detailItemTotal: { fontSize: 13, fontFamily: Typography.bold },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLineLabel: { fontSize: 12, fontFamily: Typography.regular },
  summaryLineVal: { fontSize: 12, fontFamily: Typography.medium },
  summaryDivider: { height: 1, marginVertical: 6 },
  grandTotalLabel: { fontSize: 14, fontFamily: Typography.bold },
  grandTotalVal: { fontSize: 16, fontFamily: Typography.bold },
  detailActionCol: { gap: 10, marginTop: 8 },
  convertBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  convertBtnText: { color: "#06281E", fontFamily: Typography.bold, fontSize: 13 },
  dispatchHubBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  dispatchHubText: { fontFamily: Typography.bold, fontSize: 13 },
  shipmentText: { fontSize: 13, fontFamily: Typography.medium, marginTop: 6 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  noPhotosText: { fontSize: 12, fontFamily: Typography.regular, paddingVertical: 10 },
  cameraBtnRow: { flexDirection: "row", gap: 8 },
  camBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  camBtnText: { fontSize: 12, fontFamily: Typography.bold },
  selectedCountText: { fontSize: 12, fontFamily: Typography.bold, marginBottom: 6 },
  uploadSubmitBtn: { alignItems: "center", paddingVertical: 10, borderRadius: 10 },
  uploadSubmitText: { color: "#06281E", fontFamily: Typography.bold, fontSize: 12 },
  accountsActionRow: { marginTop: 12 },
  approvePackingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  approvePackingText: { color: "#06281E", fontFamily: Typography.bold, fontSize: 12 },
  docketInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Typography.regular,
    marginBottom: 10,
  },
  sendDispatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  sendDispatchText: { color: "#06281E", fontFamily: Typography.bold, fontSize: 12 },
  docketNumDisplay: { fontSize: 14, fontFamily: Typography.bold },
  docketDateDisplay: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  noDocketText: { fontSize: 12, fontFamily: Typography.regular },
  docTypeSegmentRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  docTypeSegmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 9,
    gap: 6,
  },
  docTypeSegmentText: { fontSize: 12 },
  convertedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  convertedBannerTitle: { fontFamily: Typography.bold, fontSize: 13 },
  convertedBannerSub: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  itemPriceTagBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  itemPriceTagText: { fontSize: 10.5, fontFamily: Typography.bold, color: "#D97706" },
  bankLine: { fontSize: 12, fontFamily: Typography.regular, marginVertical: 2 },
  termItem: { fontSize: 11.5, fontFamily: Typography.regular, marginVertical: 2, lineHeight: 17 },
  signatoryRow: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  signatoryLabel: { fontSize: 10, fontFamily: Typography.regular },
  signatoryOrg: { fontSize: 12, fontFamily: Typography.bold, marginTop: 2 },
  priceRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  priceRequestBtnText: { fontFamily: Typography.bold, fontSize: 13 },
  requestDispatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  requestDispatchBtnText: { color: "#06281E", fontFamily: Typography.bold, fontSize: 13 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  shareBtnText: { fontFamily: Typography.bold, fontSize: 13 },
  productOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 4,
  },
  productOptionName: { fontSize: 13, fontFamily: Typography.bold },
  productOptionSub: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Typography.semiBold,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Typography.regular,
    minHeight: 70,
    textAlignVertical: "top",
  },
  submitPriceRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  submitPriceRequestText: { color: "#06281E", fontFamily: Typography.bold, fontSize: 13 },
});
