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
import {
  ProformaFilterSheet,
  ProformaDocTypeFilter,
  ProformaStatusFilter,
  ProformaSortOption,
} from "@/components/ui/ProformaFilterSheet";
import { MetricCard } from "@/components/employee/MetricCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { FloatingTabBar } from "@/components/employee/FloatingTabBar";
import { API_BASE_URL } from "@/services/api";
import {
  ProformaItem,
  ProformaStats,
  ProformaDetail,
  DispatchInfo,
  PhotoAsset,
  fetchProformasFromApi,
  fetchProformaDetailApi,
  handlePriceRequestActionApi,
  convertQuotationToPIApi,
  fetchDispatchDetailApi,
  submitPackingPhotosApi,
  approvePackingApi,
  rejectPackingApi,
  sendWarehouseDispatchApi,
} from "@/services/proformaService";

export default function ProformaScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState<ProformaDocTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ProformaStatusFilter>("all");
  const [sortOption, setSortOption] = useState<ProformaSortOption>("newest");

  const isFilterActive = docTypeFilter !== "all" || statusFilter !== "all" || sortOption !== "newest";

  const handleResetFilters = () => {
    setDocTypeFilter("all");
    setStatusFilter("all");
    setSortOption("newest");
  };
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

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState<ProformaItem | null>(null);
  const [detailData, setDetailData] = useState<ProformaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Dispatch Hub Modal State
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [selectedPackingPhotos, setSelectedPackingPhotos] = useState<PhotoAsset[]>([]);
  const [packingRemark, setPackingRemark] = useState("");
  const [docketNumber, setDocketNumber] = useState("");
  const [selectedDocketPhotos, setSelectedDocketPhotos] = useState<PhotoAsset[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const isAdmin = (user?.role || "").toLowerCase().includes("admin");

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async (isPull = false) => {
    if (!isPull) setLoading(true);
    try {
      const res = await fetchProformasFromApi({
        search: debouncedSearch,
        type: docTypeFilter,
        status: statusFilter,
      });

      if (res && Array.isArray(res.results)) {
        let list = [...res.results];
        if (sortOption === "amount_high") {
          list.sort((a, b) => (b.amountNum || 0) - (a.amountNum || 0));
        } else if (sortOption === "amount_low") {
          list.sort((a, b) => (a.amountNum || 0) - (b.amountNum || 0));
        } else if (sortOption === "client_asc") {
          list.sort((a, b) => (a.clientName || "").localeCompare(b.clientName || ""));
        } else if (sortOption === "oldest") {
          list.reverse();
        }
        setItems(list);
      } else {
        setItems([]);
      }
      if (res?.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.warn("[ProformaScreen] loadData error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, docTypeFilter, statusFilter, sortOption]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Open Document Detail
  const handleOpenDetail = async (item: ProformaItem) => {
    setSelectedItem(item);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const detail = await fetchProformaDetailApi(item.id, item.doc_type);
      setDetailData(detail);
    } catch (err) {
      console.warn("Error fetching proforma detail:", err);
      Alert.alert("Error", "Could not load document details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setDetailData(null);
  };

  // Convert Quotation Action
  const handleConvert = async () => {
    if (!detailData) return;
    Alert.alert(
      "Convert to Proforma",
      `Convert quotation ${detailData.number} to a live Proforma Invoice?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert",
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await convertQuotationToPIApi(detailData.id);
              if (res.success) {
                Alert.alert("Success", res.message || "Converted to Proforma Invoice!");
                closeDetail();
                loadData(true);
              }
            } catch (err: any) {
              const msg = err?.response?.data?.error || "Conversion failed. Check permissions.";
              Alert.alert("Error", msg);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Approve / Reject Price Change
  const handlePriceApproval = async (requestId: number, action: "approve" | "reject") => {
    setActionLoading(true);
    try {
      const res = await handlePriceRequestActionApi(requestId, action);
      if (res.success) {
        Alert.alert("Success", res.message);
        if (selectedItem) {
          const updated = await fetchProformaDetailApi(selectedItem.id, selectedItem.doc_type);
          setDetailData(updated);
        }
        loadData(true);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || `Could not ${action} price request.`;
      Alert.alert("Error", msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Web PDF / Print
  const handleOpenPdf = () => {
    if (!detailData) return;
    const cleanBase = API_BASE_URL.replace(/\/api\/?$/, "");
    const webUrl = `${cleanBase}${detailData.web_url}`;
    Linking.openURL(webUrl).catch(() => {
      Alert.alert("Error", "Could not open web invoice.");
    });
  };

  // ── Dispatch Hub Functions ─────────────────────────────────────────────

  const handleOpenDispatch = async (invoiceId: string | number) => {
    setDispatchModalVisible(true);
    setDispatchLoading(true);
    setSelectedPackingPhotos([]);
    setPackingRemark("");
    setDocketNumber("");
    setSelectedDocketPhotos([]);
    try {
      const info = await fetchDispatchDetailApi(invoiceId);
      setDispatchInfo(info);
      if (info?.docket?.docket_number) {
        setDocketNumber(info.docket.docket_number);
      }
    } catch (err) {
      console.warn("Error fetching dispatch info:", err);
      Alert.alert("Error", "Could not load dispatch details.");
    } finally {
      setDispatchLoading(false);
    }
  };

  const closeDispatch = () => {
    setDispatchModalVisible(false);
    setDispatchInfo(null);
    setSelectedPackingPhotos([]);
    setSelectedDocketPhotos([]);
    setEnlargedImage(null);
  };

  // Camera Picker for Packing Photos
  const handleCapturePackingPhoto = async () => {
    const photo = await capturePhotoAsync();
    if (photo) {
      setSelectedPackingPhotos((prev) => [...prev, photo]);
    }
  };

  // Gallery Picker for Packing Photos
  const handlePickPackingGallery = async () => {
    const photos = await pickImagesFromLibraryAsync(true);
    if (photos.length > 0) {
      setSelectedPackingPhotos((prev) => [...prev, ...photos]);
    }
  };

  // Submit Packing Photos
  const handleSubmitPacking = async () => {
    if (!dispatchInfo || selectedPackingPhotos.length === 0) {
      Alert.alert("Photos Required", "Please take or choose at least one packing photo.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await submitPackingPhotosApi(
        dispatchInfo.invoice_id,
        selectedPackingPhotos,
        packingRemark
      );
      if (res.success) {
        Alert.alert("Success", res.message);
        setSelectedPackingPhotos([]);
        setPackingRemark("");
        const refreshed = await fetchDispatchDetailApi(dispatchInfo.invoice_id);
        setDispatchInfo(refreshed);
        loadData(true);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to submit packing photos.";
      Alert.alert("Error", msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Packing (Accounts)
  const handleApprovePacking = async () => {
    if (!dispatchInfo) return;
    setActionLoading(true);
    try {
      const res = await approvePackingApi(dispatchInfo.invoice_id);
      if (res.success) {
        Alert.alert("Approved", res.message);
        const refreshed = await fetchDispatchDetailApi(dispatchInfo.invoice_id);
        setDispatchInfo(refreshed);
        loadData(true);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Approval failed.";
      Alert.alert("Error", msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Packing (Accounts)
  const handleRejectPacking = () => {
    if (!dispatchInfo) return;
    Alert.prompt
      ? Alert.prompt(
          "Reject Packaging",
          "Enter rejection reason for warehouse:",
          async (remark) => {
            if (!remark) return;
            setActionLoading(true);
            try {
              const res = await rejectPackingApi(dispatchInfo.invoice_id, remark);
              if (res.success) {
                Alert.alert("Rejected", res.message);
                const refreshed = await fetchDispatchDetailApi(dispatchInfo.invoice_id);
                setDispatchInfo(refreshed);
                loadData(true);
              }
            } catch (err: any) {
              const msg = err?.response?.data?.error || "Rejection failed.";
              Alert.alert("Error", msg);
            } finally {
              setActionLoading(false);
            }
          }
        )
      : Alert.alert(
          "Reject Packaging",
          "Send packaging back to warehouse for re-packing?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Reject",
              style: "destructive",
              onPress: async () => {
                setActionLoading(true);
                try {
                  const res = await rejectPackingApi(dispatchInfo.invoice_id, "Packaging quality rejected.");
                  if (res.success) {
                    Alert.alert("Rejected", res.message);
                    const refreshed = await fetchDispatchDetailApi(dispatchInfo.invoice_id);
                    setDispatchInfo(refreshed);
                    loadData(true);
                  }
                } catch (err: any) {
                  const msg = err?.response?.data?.error || "Rejection failed.";
                  Alert.alert("Error", msg);
                } finally {
                  setActionLoading(false);
                }
              },
            },
          ]
        );
  };

  // Camera Picker for Docket Photo
  const handleCaptureDocketPhoto = async () => {
    const photo = await capturePhotoAsync();
    if (photo) {
      setSelectedDocketPhotos((prev) => [...prev, photo]);
    }
  };

  // Submit Courier Dispatch (Docket Number + Receipt Photo)
  const handleSubmitDispatch = async () => {
    if (!dispatchInfo) return;
    if (!docketNumber.trim()) {
      Alert.alert("Docket Required", "Please enter the courier tracking / docket number.");
      return;
    }
    if (selectedDocketPhotos.length === 0) {
      Alert.alert("Receipt Photo Required", "Please take a photo of the physical courier receipt / slip.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await sendWarehouseDispatchApi(
        dispatchInfo.invoice_id,
        docketNumber.trim(),
        selectedDocketPhotos
      );
      if (res.success) {
        Alert.alert("Dispatch Completed!", res.message);
        setSelectedDocketPhotos([]);
        const refreshed = await fetchDispatchDetailApi(dispatchInfo.invoice_id);
        setDispatchInfo(refreshed);
        loadData(true);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Dispatch failed. Check fields.";
      Alert.alert("Error", msg);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(isAdmin ? "/(admin)/users" : "/(employee)"))}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={isDark ? "#F1F7F4" : "#101513"} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.screenHeading, { color: colors.textPrimary }]}>
            Proforma & Quotations
          </Text>
          <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
            Pricing approvals, dispatch & photo capture
          </Text>
        </View>

        <View style={styles.topBarRightPlaceholder} />
      </View>

      {/* Main List */}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.doc_type}-${item.id}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.searchWrapper}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholders={[
                  'Search "client name"',
                  'Search "PI number"',
                  'Search "quotation#"',
                  'Search "sales rep"',
                ]}
                intervalMs={2000}
                onClear={() => setSearchQuery("")}
                onFilterPress={() => setFilterSheetVisible(true)}
                filterActive={isFilterActive}
              />
            </View>

            {/* Live Metrics */}
            <View style={styles.metricsRow}>
              <MetricCard
                label="Quotations Pipeline"
                value={stats.pipeline_value || "₹0"}
                subValue={`${stats.total_count} active orders`}
                icon="document-text-outline"
                loading={loading && items.length === 0}
              />
              <MetricCard
                label="Pending Approvals"
                value={String(stats.pending_approvals)}
                subValue="rate clearance"
                icon="time-outline"
                isHighlight={stats.pending_approvals > 0}
                loading={loading && items.length === 0}
              />
            </View>

            {/* Active Filter Pill */}
            {isFilterActive && (
              <View style={styles.activeFilterPillRow}>
                <View
                  style={[
                    styles.activeFilterPill,
                    {
                      backgroundColor: isDark ? "rgba(53, 214, 160, 0.15)" : "#E6F8F2",
                      borderColor: isDark ? "#35D6A0" : "#00A879",
                    },
                  ]}
                >
                  <Ionicons name="funnel" size={12} color={isDark ? "#35D6A0" : "#00A879"} />
                  <Text style={[styles.activeFilterPillText, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                    Filtered: {docTypeFilter !== "all" ? (docTypeFilter === "quotation" ? "Quotations" : "Proformas") : ""}
                    {docTypeFilter !== "all" && statusFilter !== "all" ? " • " : ""}
                    {statusFilter !== "all" ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : ""}
                    {sortOption !== "newest" ? " • Sorted" : ""}
                  </Text>
                  <TouchableOpacity onPress={handleResetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={15} color={isDark ? "#35D6A0" : "#00A879"} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonCardList count={5} height={116} style={{ paddingTop: 4 }} />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No proforma records found.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const pillVariant =
            item.status === "Approved"
              ? "paid"
              : item.status === "Pending"
              ? "pending"
              : "neutral";

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleOpenDetail(item)}
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={styles.itemTopRow}>
                <View
                  style={[
                    styles.itemAvatar,
                    {
                      backgroundColor:
                        item.status === "Approved"
                          ? isDark ? "rgba(53, 214, 160, 0.14)" : "rgba(0, 168, 121, 0.12)"
                          : item.status === "Pending"
                          ? isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(245, 158, 11, 0.12)"
                          : isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(16, 21, 19, 0.05)",
                    },
                  ]}
                >
                  <Ionicons
                    name={item.doc_type === "quotation" ? "reader-outline" : "document-text"}
                    size={18}
                    color={
                      item.status === "Approved"
                        ? isDark ? "#35D6A0" : "#00A879"
                        : item.status === "Pending"
                        ? "#D97706"
                        : isDark ? "#8FA09A" : "#5E6964"
                    }
                  />
                </View>

                <View style={styles.itemIdentity}>
                  <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.clientName}
                  </Text>
                  <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                    {item.piNumber} • {item.date} • {item.rep}
                  </Text>
                </View>

                <StatusPill label={item.status} variant={pillVariant as any} size="small" />
              </View>

              <View
                style={[
                  styles.metaContainer,
                  {
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(16, 21, 19, 0.03)",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(16, 21, 19, 0.06)",
                  },
                ]}
              >
                <View style={styles.metaCol}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>TOTAL INVOICED</Text>
                  <Text style={[styles.metaValueHighlight, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                    {item.amount}
                  </Text>
                </View>
                <View style={[styles.metaDivider, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(16, 21, 19, 0.08)" }]} />
                <View style={styles.metaCol}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>COURIER GST</Text>
                  <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                    {item.gstAmount}
                  </Text>
                </View>
              </View>

              {/* Quick Dispatch Status pill if Proforma */}
              {item.doc_type === "proforma" && (
                <View style={styles.cardFooterDispatchRow}>
                  <Ionicons name="cube-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.cardFooterDispatchText, { color: colors.textSecondary }]}>
                    Dispatch: {item.dispatch_status?.replace("_", " ").toUpperCase() || "PROCESSING"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Proforma Detail Modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                maxHeight: "90%",
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {selectedItem?.piNumber || "Document Detail"}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {selectedItem?.clientName}
                </Text>
              </View>
              <TouchableOpacity onPress={closeDetail} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <SkeletonCardList count={3} height={88} style={{ padding: 16 }} />
            ) : detailData ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                {/* Customer Contact Banner */}
                <View style={[styles.customerBanner, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(16, 21, 19, 0.03)", borderColor: colors.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.custName, { color: colors.textPrimary }]}>
                      {detailData.customer.name}
                    </Text>
                    <Text style={[styles.custMeta, { color: colors.textSecondary }]}>
                      {detailData.customer.city || "Headquarters"} • Rep: {detailData.created_by}
                    </Text>
                    {!!detailData.customer.gstin && (
                      <Text style={[styles.custGstin, { color: colors.textMuted }]}>
                        GSTIN: {detailData.customer.gstin}
                      </Text>
                    )}
                  </View>
                  {!!detailData.customer.phone && (
                    <TouchableOpacity
                      style={[styles.callBtn, { backgroundColor: isDark ? "rgba(53, 214, 160, 0.15)" : "rgba(0, 168, 121, 0.12)" }]}
                      onPress={() => Linking.openURL(`tel:${detailData.customer.phone}`)}
                    >
                      <Ionicons name="call" size={16} color={isDark ? "#35D6A0" : "#00A879"} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dispatch Hub Banner (Proformas only) */}
                {detailData.doc_type === "proforma" && (
                  <TouchableOpacity
                    style={[styles.dispatchHubBanner, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.08)", borderColor: isDark ? "rgba(59, 130, 246, 0.3)" : "rgba(37, 99, 235, 0.2)" }]}
                    onPress={() => handleOpenDispatch(detailData.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dispatchHubLeft}>
                      <Ionicons name="cube" size={20} color="#3B82F6" />
                      <View>
                        <Text style={[styles.dispatchHubTitle, { color: colors.textPrimary }]}>
                          Dispatch & Packing Hub
                        </Text>
                        <Text style={[styles.dispatchHubSub, { color: colors.textSecondary }]}>
                          Photos, packing verification & docket receipt
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
                  </TouchableOpacity>
                )}

                {/* Line Items Section */}
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  ORDERED LINE ITEMS ({detailData.items.length})
                </Text>
                {detailData.items.map((itm, idx) => (
                  <View key={itm.id || idx} style={[styles.lineItemRow, { borderBottomColor: colors.borderLight }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.lineItemName, { color: colors.textPrimary }]} numberOfLines={2}>
                        {itm.product_name}
                      </Text>
                      <Text style={[styles.lineItemSub, { color: colors.textSecondary }]}>
                        Qty: {itm.quantity} × {itm.unit_price}
                      </Text>
                    </View>
                    <Text style={[styles.lineItemTotal, { color: colors.textPrimary }]}>
                      {itm.total_price}
                    </Text>
                  </View>
                ))}

                {/* Financial Summary */}
                <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 16 }]}>
                  FINANCIAL SUMMARY
                </Text>
                <View style={[styles.financialCard, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(16, 21, 19, 0.03)", borderColor: colors.cardBorder }]}>
                  <View style={styles.finRow}>
                    <Text style={[styles.finLabel, { color: colors.textSecondary }]}>Taxable Subtotal</Text>
                    <Text style={[styles.finVal, { color: colors.textPrimary }]}>{detailData.totals.taxable_total}</Text>
                  </View>
                  <View style={styles.finRow}>
                    <Text style={[styles.finLabel, { color: colors.textSecondary }]}>Courier Charge</Text>
                    <Text style={[styles.finVal, { color: colors.textPrimary }]}>{detailData.totals.courier_charge}</Text>
                  </View>
                  <View style={styles.finRow}>
                    <Text style={[styles.finLabel, { color: colors.textSecondary }]}>Total GST</Text>
                    <Text style={[styles.finVal, { color: colors.textPrimary }]}>{detailData.totals.gst_total}</Text>
                  </View>
                  <View style={[styles.finDivider, { backgroundColor: colors.borderLight }]} />
                  <View style={styles.finRow}>
                    <Text style={[styles.finGrandLabel, { color: colors.textPrimary }]}>Grand Total</Text>
                    <Text style={[styles.finGrandVal, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                      {detailData.totals.grand_total}
                    </Text>
                  </View>
                </View>

                {/* Pending Price Change Requests (Approval Authority) */}
                {detailData.price_requests && detailData.price_requests.length > 0 && (
                  <View style={styles.priceRequestBlock}>
                    <Text style={[styles.sectionHeading, { color: "#D97706", marginTop: 16 }]}>
                      SPECIAL PRICE CLEARANCE
                    </Text>
                    {detailData.price_requests.map((pr) => (
                      <View key={pr.id} style={[styles.prCard, { borderColor: "#F59E0B" }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.prTitle, { color: colors.textPrimary }]}>{pr.product_name}</Text>
                          <Text style={[styles.prDetail, { color: colors.textSecondary }]}>
                            Req: ₹{pr.requested_price} • Rec: ₹{pr.recommended_price}
                          </Text>
                          {!!pr.reason && (
                            <Text style={[styles.prReason, { color: colors.textMuted }]}>
                              Note: {pr.reason}
                            </Text>
                          )}
                        </View>
                        {detailData.can_approve_price && pr.status === "pending" && (
                          <View style={styles.prActions}>
                            <TouchableOpacity
                              style={[styles.prBtn, { backgroundColor: "#10B981" }]}
                              onPress={() => handlePriceApproval(pr.id, "approve")}
                              disabled={actionLoading}
                            >
                              <Text style={styles.prBtnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.prBtn, { backgroundColor: "#EF4444" }]}
                              onPress={() => handlePriceApproval(pr.id, "reject")}
                              disabled={actionLoading}
                            >
                              <Text style={styles.prBtnText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.modalActionButtons}>
                  {/* Convert to PI Button if Quotation */}
                  {detailData.can_convert_to_pi && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                      onPress={handleConvert}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>Convert to Proforma</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Open Official Web PDF */}
                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: colors.primary }]}
                    onPress={handleOpenPdf}
                  >
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    <Text style={[styles.outlineBtnText, { color: colors.primary }]}>
                      View Official PDF / Print
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Dispatch & Photo Capture Hub Modal */}
      <Modal
        visible={dispatchModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDispatch}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                maxHeight: "92%",
              },
            ]}
          >
            {/* Dispatch Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Dispatch & Photo Verification
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {dispatchInfo?.invoice_number} • Status: {dispatchInfo?.status_display}
                </Text>
              </View>
              <TouchableOpacity onPress={closeDispatch} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {dispatchLoading ? (
              <SkeletonCardList count={2} height={96} style={{ padding: 16 }} />
            ) : dispatchInfo ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                {/* Step Progress Bar */}
                <View style={styles.dispatchStepProgress}>
                  <View style={[styles.stepDot, dispatchInfo.status !== "requested" ? styles.stepActive : {}]}>
                    <Text style={styles.stepNum}>1</Text>
                  </View>
                  <View style={styles.stepLine} />
                  <View style={[styles.stepDot, dispatchInfo.status === "packed_awaiting_approval" || dispatchInfo.status === "packing_approved" || dispatchInfo.status === "dispatched_by_warehouse" ? styles.stepActive : {}]}>
                    <Text style={styles.stepNum}>2</Text>
                  </View>
                  <View style={styles.stepLine} />
                  <View style={[styles.stepDot, dispatchInfo.status === "packing_approved" || dispatchInfo.status === "dispatched_by_warehouse" ? styles.stepActive : {}]}>
                    <Text style={styles.stepNum}>3</Text>
                  </View>
                  <View style={styles.stepLine} />
                  <View style={[styles.stepDot, dispatchInfo.status === "dispatched_by_warehouse" ? styles.stepActive : {}]}>
                    <Text style={styles.stepNum}>4</Text>
                  </View>
                </View>
                <View style={styles.stepLabelsRow}>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>Request</Text>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>Packing</Text>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>Approval</Text>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>Dispatch</Text>
                </View>

                {/* 1. Existing Uploaded Packing Photos */}
                <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 12 }]}>
                  PACKING PHOTOS ({dispatchInfo.photos.length})
                </Text>
                {dispatchInfo.photos.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGalleryScroll}>
                    {dispatchInfo.photos.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setEnlargedImage(p.url)}
                        style={styles.galleryThumbWrap}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: p.url }} style={styles.galleryThumb} />
                        <Text style={[styles.photoUploaderText, { color: colors.textMuted }]}>
                          {p.uploaded_by}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={[styles.noPhotosText, { color: colors.textMuted }]}>
                    No packaging photos uploaded yet.
                  </Text>
                )}

                {/* 2. Warehouse Packing Photo Capture Form */}
                {dispatchInfo.can_submit_packing && (dispatchInfo.status === "waiting_for_packing" || dispatchInfo.status === "requested") && (
                  <View style={[styles.dispatchSectionCard, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(16, 21, 19, 0.03)", borderColor: colors.cardBorder }]}>
                    <Text style={[styles.dispatchSectionTitle, { color: colors.textPrimary }]}>
                      Capture Box Packaging
                    </Text>
                    <Text style={[styles.dispatchSectionDesc, { color: colors.textSecondary }]}>
                      Snap photos of goods packed inside carton box before sealing.
                    </Text>

                    <View style={styles.cameraBtnRow}>
                      <TouchableOpacity
                        style={[styles.cameraActionBtn, { backgroundColor: colors.primary }]}
                        onPress={handleCapturePackingPhoto}
                      >
                        <Ionicons name="camera" size={18} color="#FFFFFF" />
                        <Text style={styles.cameraActionBtnText}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cameraActionBtnOutline, { borderColor: colors.primary }]}
                        onPress={handlePickPackingGallery}
                      >
                        <Ionicons name="images-outline" size={18} color={colors.primary} />
                        <Text style={[styles.cameraActionBtnOutlineText, { color: colors.primary }]}>
                          Gallery
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Selected Photos Preview Strip */}
                    {selectedPackingPhotos.length > 0 && (
                      <View style={styles.selectedStripWrap}>
                        <Text style={[styles.selectedCountText, { color: colors.textPrimary }]}>
                          {selectedPackingPhotos.length} photo(s) selected:
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {selectedPackingPhotos.map((item, idx) => (
                            <View key={idx} style={styles.selectedThumbWrap}>
                              <Image source={{ uri: item.uri }} style={styles.selectedThumb} />
                              <TouchableOpacity
                                style={styles.removePhotoBtn}
                                onPress={() => setSelectedPackingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                <Ionicons name="close" size={12} color="#FFFFFF" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    <TextInput
                      style={[styles.remarkInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                      placeholder="Add packing notes (box count, tape condition)..."
                      placeholderTextColor={colors.textMuted}
                      value={packingRemark}
                      onChangeText={setPackingRemark}
                    />

                    <TouchableOpacity
                      style={[styles.submitPackingBtn, { backgroundColor: colors.primary }]}
                      onPress={handleSubmitPacking}
                      disabled={actionLoading || selectedPackingPhotos.length === 0}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.submitPackingBtnText}>Submit Packing for Clearance</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3. Accounts Packing Approval / Rejection */}
                {dispatchInfo.can_approve_packing && dispatchInfo.status === "packed_awaiting_approval" && (
                  <View style={[styles.dispatchSectionCard, { backgroundColor: "rgba(245, 158, 11, 0.08)", borderColor: "#F59E0B" }]}>
                    <Text style={[styles.dispatchSectionTitle, { color: "#D97706" }]}>
                      Accounts Packaging Clearance
                    </Text>
                    <Text style={[styles.dispatchSectionDesc, { color: colors.textSecondary }]}>
                      Inspect warehouse packaging photos above before clearing for carrier handover.
                    </Text>

                    <View style={styles.approvalBtnRow}>
                      <TouchableOpacity
                        style={[styles.approveBtn, { backgroundColor: "#10B981" }]}
                        onPress={handleApprovePacking}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.approveBtnText}>Approve Packaging</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectBtn, { backgroundColor: "#EF4444" }]}
                        onPress={handleRejectPacking}
                        disabled={actionLoading}
                      >
                        <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.approveBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 4. Courier Handover & Docket Photo Capture */}
                {dispatchInfo.can_dispatch && (dispatchInfo.status === "packing_approved" || dispatchInfo.status === "dispatched_by_warehouse") && (
                  <View style={[styles.dispatchSectionCard, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(16, 21, 19, 0.03)", borderColor: colors.cardBorder }]}>
                    <Text style={[styles.dispatchSectionTitle, { color: colors.textPrimary }]}>
                      Courier Handover & Docket Receipt
                    </Text>
                    <Text style={[styles.dispatchSectionDesc, { color: colors.textSecondary }]}>
                      Enter courier tracking/docket number and take a photo of the courier slip.
                    </Text>

                    <TextInput
                      style={[styles.docketInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                      placeholder="Enter Docket / Tracking Number (e.g. DTDC123456)"
                      placeholderTextColor={colors.textMuted}
                      value={docketNumber}
                      onChangeText={setDocketNumber}
                      editable={dispatchInfo.status !== "dispatched_by_warehouse"}
                    />

                    {dispatchInfo.status !== "dispatched_by_warehouse" ? (
                      <>
                        <TouchableOpacity
                          style={[styles.cameraActionBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
                          onPress={handleCaptureDocketPhoto}
                        >
                          <Ionicons name="camera" size={18} color="#FFFFFF" />
                          <Text style={styles.cameraActionBtnText}>Snap Courier Slip / Receipt</Text>
                        </TouchableOpacity>

                        {selectedDocketPhotos.length > 0 && (
                          <View style={styles.selectedStripWrap}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              {selectedDocketPhotos.map((item, idx) => (
                                <View key={idx} style={styles.selectedThumbWrap}>
                                  <Image source={{ uri: item.uri }} style={styles.selectedThumb} />
                                  <TouchableOpacity
                                    style={styles.removePhotoBtn}
                                    onPress={() => setSelectedDocketPhotos((prev) => prev.filter((_, i) => i !== idx))}
                                  >
                                    <Ionicons name="close" size={12} color="#FFFFFF" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </ScrollView>
                          </View>
                        )}

                        <TouchableOpacity
                          style={[styles.submitPackingBtn, { backgroundColor: "#10B981", marginTop: 12 }]}
                          onPress={handleSubmitDispatch}
                          disabled={actionLoading || !docketNumber.trim() || selectedDocketPhotos.length === 0}
                        >
                          {actionLoading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.submitPackingBtnText}>Confirm Handover & Complete Dispatch</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.dispatchedConfirmedBanner}>
                        <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dispatchedTitle, { color: "#10B981" }]}>
                            Dispatched with Docket #{dispatchInfo.docket?.docket_number}
                          </Text>
                          <Text style={[styles.dispatchedDate, { color: colors.textSecondary }]}>
                            {dispatchInfo.docket?.dispatched_at} • Handled by {dispatchInfo.docket?.dispatched_by}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Existing Docket Photos */}
                    {dispatchInfo.docket?.photos && dispatchInfo.docket.photos.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                          COURIER SLIP RECEIPT
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {dispatchInfo.docket.photos.map((dp) => (
                            <TouchableOpacity
                              key={dp.id}
                              onPress={() => setEnlargedImage(dp.url)}
                              style={styles.galleryThumbWrap}
                              activeOpacity={0.8}
                            >
                              <Image source={{ uri: dp.url }} style={styles.galleryThumb} />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Proforma Filter Sheet Modal */}
      <ProformaFilterSheet
        visible={filterSheetVisible}
        docTypeFilter={docTypeFilter}
        statusFilter={statusFilter}
        sortOption={sortOption}
        stats={stats}
        onDocTypeChange={setDocTypeFilter}
        onStatusChange={setStatusFilter}
        onSortChange={setSortOption}
        onClose={() => setFilterSheetVisible(false)}
        onReset={handleResetFilters}
      />

      {/* Full Size Image Viewer Modal */}
      <Modal visible={!!enlargedImage} transparent animationType="fade" onRequestClose={() => setEnlargedImage(null)}>
        <View style={styles.enlargedModalBackdrop}>
          <TouchableOpacity style={styles.enlargedCloseBtn} onPress={() => setEnlargedImage(null)}>
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          {!!enlargedImage && (
            <Image source={{ uri: enlargedImage }} style={styles.enlargedImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
  },
  screenHeading: {
    fontFamily: Typography.bold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  screenSub: {
    fontFamily: Typography.medium,
    fontSize: 12,
    marginTop: 1,
  },
  topBarRightPlaceholder: {
    width: 38,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerBlock: {
    marginBottom: 8,
  },
  searchWrapper: {
    marginBottom: 12,
  },
  activeFilterPillRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  activeFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  activeFilterPillText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  itemAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  itemIdentity: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontFamily: Typography.bold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  itemSub: {
    fontFamily: Typography.medium,
    fontSize: 12,
    marginTop: 2,
  },
  metaContainer: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  metaCol: {
    flex: 1,
    gap: 2,
  },
  metaDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  metaLabel: {
    fontFamily: Typography.semiBold,
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metaValue: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  metaValueHighlight: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  cardFooterDispatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(150, 150, 150, 0.12)",
  },
  cardFooterDispatchText: {
    fontFamily: Typography.semiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontFamily: Typography.medium,
    fontSize: 14,
    marginTop: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.15)",
  },
  modalTitle: {
    fontFamily: Typography.bold,
    fontSize: 18,
  },
  modalSubtitle: {
    fontFamily: Typography.medium,
    fontSize: 13,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  detailLoadingState: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontFamily: Typography.medium,
    fontSize: 13,
  },
  modalBody: {
    paddingVertical: 14,
    paddingBottom: 30,
  },
  customerBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  custName: {
    fontFamily: Typography.bold,
    fontSize: 15,
  },
  custMeta: {
    fontFamily: Typography.medium,
    fontSize: 12,
    marginTop: 2,
  },
  custGstin: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  dispatchHubBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  dispatchHubLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dispatchHubTitle: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  dispatchHubSub: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeading: {
    fontFamily: Typography.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  lineItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  lineItemName: {
    fontFamily: Typography.semiBold,
    fontSize: 13,
  },
  lineItemSub: {
    fontFamily: Typography.regular,
    fontSize: 12,
    marginTop: 2,
  },
  lineItemTotal: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  financialCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  finRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  finLabel: {
    fontFamily: Typography.medium,
    fontSize: 12,
  },
  finVal: {
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  finDivider: {
    height: 1,
    marginVertical: 4,
  },
  finGrandLabel: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  finGrandVal: {
    fontFamily: Typography.bold,
    fontSize: 16,
  },
  priceRequestBlock: {
    marginTop: 8,
  },
  prCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  prTitle: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  prDetail: {
    fontFamily: Typography.medium,
    fontSize: 12,
    marginTop: 2,
  },
  prReason: {
    fontFamily: Typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  prActions: {
    flexDirection: "row",
    gap: 6,
  },
  prBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  prBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 11,
  },
  modalActionButtons: {
    marginTop: 20,
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  outlineBtnText: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },

  // Dispatch Hub Styles
  dispatchStepProgress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
    paddingHorizontal: 14,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
  },
  stepActive: {
    backgroundColor: "#10B981",
  },
  stepNum: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
    marginHorizontal: 4,
  },
  stepLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  stepLabel: {
    fontFamily: Typography.medium,
    fontSize: 10,
  },
  photoGalleryScroll: {
    marginVertical: 8,
  },
  galleryThumbWrap: {
    marginRight: 10,
    alignItems: "center",
  },
  galleryThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  photoUploaderText: {
    fontFamily: Typography.regular,
    fontSize: 9,
    marginTop: 3,
  },
  noPhotosText: {
    fontFamily: Typography.medium,
    fontSize: 12,
    marginVertical: 8,
  },
  dispatchSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  dispatchSectionTitle: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  dispatchSectionDesc: {
    fontFamily: Typography.regular,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  cameraBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  cameraActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  cameraActionBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  cameraActionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  cameraActionBtnOutlineText: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  selectedStripWrap: {
    marginTop: 10,
  },
  selectedCountText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
    marginBottom: 6,
  },
  selectedThumbWrap: {
    position: "relative",
    marginRight: 8,
  },
  selectedThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removePhotoBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  remarkInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: Typography.regular,
    fontSize: 13,
    marginTop: 10,
  },
  submitPackingBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  submitPackingBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  approvalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  approveBtn: {
    flex: 2,
    flexDirection: "row",
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  approveBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  docketInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Typography.semiBold,
    fontSize: 14,
  },
  dispatchedConfirmedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  dispatchedTitle: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  dispatchedDate: {
    fontFamily: Typography.medium,
    fontSize: 11,
    marginTop: 2,
  },
  enlargedModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  enlargedCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  enlargedImage: {
    width: "92%",
    height: "80%",
  },
});
