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
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, FontSizes, Radius, Shadows } from "@/constants/theme";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterChip } from "@/components/ui/FilterChip";
import { MetricCard } from "@/components/employee/MetricCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { API_BASE_URL } from "@/services/api";
import {
  ProformaItem,
  ProformaStats,
  ProformaDetail,
  fetchProformasFromApi,
  fetchProformaDetailApi,
  handlePriceRequestActionApi,
  convertQuotationToPIApi,
} from "@/services/proformaService";

export default function AdminProformaScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
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
      const typeParam = activeFilter === "quotation" ? "quotation" : "all";
      const statusParam =
        activeFilter === "approved" || activeFilter === "pending" || activeFilter === "billed"
          ? (activeFilter as any)
          : "all";

      const res = await fetchProformasFromApi({
        search: debouncedSearch,
        type: typeParam,
        status: statusParam,
      });

      setItems(res.results);
      setStats(res.stats);
    } catch (err) {
      console.warn("[AdminProformaScreen] loadData error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Open Detail
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

  // Approve Price Change
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

  // Open web print / PDF
  const handleOpenPdf = () => {
    if (!detailData) return;
    const cleanBase = API_BASE_URL.replace(/\/api\/?$/, "");
    const webUrl = `${cleanBase}${detailData.web_url}`;
    Linking.openURL(webUrl).catch(() => {
      Alert.alert("Error", "Could not open web invoice.");
    });
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
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(admin)/users"))}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={isDark ? "#F1F7F4" : "#101513"} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.screenHeading, { color: colors.textPrimary }]}>
            Proforma & Quotations (Admin)
          </Text>
          <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
            Pricing approvals & auto-GST billing
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
          { paddingBottom: insets.bottom + 40 },
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
                placeholder="Search proforma by client, PI# or sales rep..."
                onClear={() => setSearchQuery("")}
              />
            </View>

            {/* Live Metrics */}
            <View style={styles.metricsRow}>
              <MetricCard
                label="Quotations Pipeline"
                value={stats.pipeline_value || "₹0"}
                subValue={`${stats.total_count} active orders`}
                icon="document-text-outline"
              />
              <MetricCard
                label="Pending Approvals"
                value={String(stats.pending_approvals)}
                subValue="rate clearance"
                icon="time-outline"
                isHighlight={stats.pending_approvals > 0}
              />
            </View>

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <FilterChip
                label="All Documents"
                count={stats.total_count}
                isActive={activeFilter === "all"}
                onPress={() => setActiveFilter("all")}
              />
              <FilterChip
                label="Approved"
                count={stats.approved_count}
                isActive={activeFilter === "approved"}
                onPress={() => setActiveFilter("approved")}
              />
              <FilterChip
                label="Pending"
                count={stats.pending_approvals}
                isActive={activeFilter === "pending"}
                onPress={() => setActiveFilter("pending")}
              />
              <FilterChip
                label="Billed"
                count={stats.billed_count}
                isActive={activeFilter === "billed"}
                onPress={() => setActiveFilter("billed")}
              />
              <FilterChip
                label="Quotations Only"
                isActive={activeFilter === "quotation"}
                onPress={() => setActiveFilter("quotation")}
              />
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Loading live proforma invoices...
              </Text>
            </View>
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
                maxHeight: "88%",
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
              <View style={styles.detailLoadingState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading live line items & calculations...
                </Text>
              </View>
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
    backgroundColor: "rgba(0,0,0,0.5)",
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
    marginBottom: 16,
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
});
