/**
 * Admin — Customer Directory Screen (Real Database Data)
 * Fetches live customer data from the backend API.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Linking,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { StatusPill } from "@/components/ui/StatusPill";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { Customer } from "@/data/customerTypes";
import {
  CustomerEditOptions,
  fetchCustomerEditOptionsApi,
  fetchCustomerPageFromApi,
  fetchCustomersFromApi,
  updateCustomerEditableFieldsApi,
} from "@/services/customerService";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";
import { CustomerBalanceFilter, CustomerFilterSheet, CustomerPaymentFilter, CustomerSortOption } from "@/components/ui/CustomerFilterSheet";

function getOutstandingAmount(value: string): number {
  const normalized = (value || "").replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

interface CustomerEditFormState {
  phone: string;
  email: string;
  salespersonId: number | null;
  creditPeriodDays: string;
}

type CustomerEditMode = "contact" | "credit";

function getCreditDays(value?: string): number {
  const days = Number(String(value || "").match(/\d+/)?.[0]);
  return Number.isFinite(days) && days >= 0 ? days : 7;
}

export default function CustomersScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<CustomerPaymentFilter>("all");
  const [balanceFilter, setBalanceFilter] = useState<CustomerBalanceFilter>("all");
  const [sortOption, setSortOption] = useState<CustomerSortOption>("default");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editMode, setEditMode] = useState<CustomerEditMode | null>(null);
  const [editForm, setEditForm] = useState<CustomerEditFormState | null>(null);
  const [salespersonOptions, setSalespersonOptions] = useState<CustomerEditOptions["salespersons"]>([]);
  const [editPermissions, setEditPermissions] = useState({ contact: false, credit: false });
  const [editLoading, setEditLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [salespersonPickerOpen, setSalespersonPickerOpen] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async (isPull = false, page = 1, append = false) => {
    if (page === 1 && !isPull) setLoading(true);
    if (page > 1) setLoadingMore(true);
    if (page === 1) setLoadError("");
    try {
      const result = await fetchCustomerPageFromApi({
        search: debouncedSearch,
        payment_status: paymentFilter,
        has_outstanding: balanceFilter === "outstanding",
        ordering: sortOption,
        page,
        page_size: 25,
      });
      let customerList = result?.customers || [];
      if (customerList.length === 0 && !debouncedSearch && page === 1 && paymentFilter === "all" && balanceFilter === "all") {
        try {
          const fallback = await fetchCustomersFromApi({ page: 1, page_size: 25 });
          if (fallback.length > 0) customerList = fallback;
        } catch {}
      }
      setCustomers((previous) => append ? [...previous, ...customerList] : customerList);
      setNextPage(result?.nextPage ?? null);
    } catch (error: any) {
      if (!append) setCustomers([]);
      if (page === 1) setLoadError(error?.response?.status === 403
        ? "This account does not have permission to view the customer directory."
        : "Could not load customer records from the server. Check the connection and retry.");
    } finally {
      if (page === 1) setLoading(false);
      if (page > 1) setLoadingMore(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, paymentFilter, balanceFilter, sortOption]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData(true);
  };

  const loadNextPage = useCallback(() => {
    if (nextPage && !loadingMore && !loading && !loadError) {
      void loadData(false, nextPage, true);
    }
  }, [nextPage, loadingMore, loading, loadError, loadData]);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = customers.filter(
      (c) =>
        !q ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.contactPerson || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
    );

    if (paymentFilter !== "all") {
      list = list.filter((customer) => customer.paymentStatus === paymentFilter);
    }
    if (balanceFilter === "outstanding") {
      list = list.filter((customer) => getOutstandingAmount(customer.outstandingPayment) > 0);
    }

    if (sortOption === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === "name_desc") {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortOption === "outstanding_high") {
      list.sort((a, b) => getOutstandingAmount(b.outstandingPayment) - getOutstandingAmount(a.outstandingPayment));
    } else if (sortOption === "outstanding_low") {
      list.sort((a, b) => getOutstandingAmount(a.outstandingPayment) - getOutstandingAmount(b.outstandingPayment));
    }
    return list;
  }, [customers, search, paymentFilter, balanceFilter, sortOption]);

  const filtersActive = paymentFilter !== "all" || balanceFilter !== "all" || sortOption !== "default";

  const resetDirectoryFilters = () => {
    setPaymentFilter("all");
    setBalanceFilter("all");
    setSortOption("default");
  };

  const closeCustomerEditor = () => {
    if (savingEdit) return;
    setEditingCustomer(null);
    setEditMode(null);
    setEditForm(null);
    setSalespersonPickerOpen(false);
    setEditError("");
  };

  const openCustomerEditor = async (customer: Customer, mode: CustomerEditMode) => {
    setEditingCustomer(customer);
    setEditMode(mode);
    setEditForm(null);
    setEditError("");
    setEditLoading(true);
    setSalespersonPickerOpen(false);
    try {
      const options = await fetchCustomerEditOptionsApi(customer.id);
      const allowed = mode === "contact" ? options.can_edit_contact : options.can_edit_credit;
      if (!allowed) {
        setEditingCustomer(null);
        setEditMode(null);
        Alert.alert("Edit not available", mode === "contact"
          ? "You don’t have permission to edit this customer’s contact or salesperson."
          : "You don’t have permission to edit this customer’s credit period.");
        return;
      }
      setSalespersonOptions(options.salespersons || []);
      setEditPermissions({ contact: options.can_edit_contact, credit: options.can_edit_credit });
      setEditForm({
        phone: options.customer.phone || "",
        email: options.customer.email || "",
        salespersonId: options.customer.salesperson_id ?? null,
        creditPeriodDays: String(options.customer.credit_period_days ?? getCreditDays(customer.creditPeriod)),
      });
    } catch (error: any) {
      setEditingCustomer(null);
      setEditMode(null);
      const message = error?.response?.data?.detail || error?.response?.data?.error ||
        (error?.response?.status === 403 ? "You don’t have permission to edit this customer." : "Could not load customer edit options. Please try again.");
      Alert.alert("Unable to edit customer", message);
    } finally {
      setEditLoading(false);
    }
  };

  const saveCustomerEditor = async () => {
    if (!editingCustomer || !editForm || savingEdit) return;
    setEditError("");
    const payload: { phone?: string; email?: string; salesperson?: number | null; credit_period_days?: number } = {};
    if (editMode === "contact" && editPermissions.contact) {
      payload.phone = editForm.phone.trim();
      payload.email = editForm.email.trim();
      payload.salesperson = editForm.salespersonId;
    }
    if (editMode === "credit" && editPermissions.credit) {
      const creditDays = Number(editForm.creditPeriodDays);
      if (!Number.isInteger(creditDays) || creditDays < 0) {
        setEditError("Enter a whole number of credit days (0 or more).");
        return;
      }
      payload.credit_period_days = creditDays;
    }

    setSavingEdit(true);
    try {
      const result = await updateCustomerEditableFieldsApi(editingCustomer.id, payload);
      const updated = result.customer || {};
      setCustomers((previous) => previous.map((row) => String(row.id) === String(editingCustomer.id)
        ? {
            ...row,
            ...(editMode === "contact" ? {
              phone: updated.phone ?? editForm.phone.trim(),
              email: updated.email ?? editForm.email.trim(),
              assignedSalesperson: updated.assignedSalesperson ?? salespersonOptions.find((option) => option.id === editForm.salespersonId)?.name ?? "Unassigned",
            } : {}),
            ...(editMode === "credit" ? { creditPeriod: `${result.credit_period_days ?? Number(editForm.creditPeriodDays)} Days` } : {}),
          }
        : row));
      setEditingCustomer(null);
      setEditMode(null);
      setEditForm(null);
      setSalespersonPickerOpen(false);
      Alert.alert("Customer updated", "The customer details have been saved.");
    } catch (error: any) {
      const responseData = error?.response?.data;
      const detail = responseData?.detail || responseData?.error || responseData?.errors;
      setEditError(typeof detail === "string" ? detail : "Could not save these changes. Check the fields and try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VIP": return { bg: "rgba(239, 68, 68, 0.1)", text: "#EF4444", border: "rgba(239, 68, 68, 0.3)" };
      case "Active": return { bg: colors.mintTintedSurface, text: colors.primary, border: colors.primaryBorder };
      case "Inactive": return { bg: "rgba(156, 163, 175, 0.1)", text: "#9CA3AF", border: "rgba(156, 163, 175, 0.3)" };
      default: return { bg: colors.mintTintedSurface, text: colors.primary, border: colors.primaryBorder };
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status) {
      case "overdue": return "#EF4444";
      case "pending": return "#F59E0B";
      case "paid": return "#10B981";
      default: return colors.textMuted;
    }
  };

  const renderCustomerCard = ({ item }: { item: Customer }) => {
    const paymentColor = getPaymentColor(item.paymentStatus);
    const initials = (item.name || "Customer")
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CU";

    const paymentVariant =
      item.paymentStatus === "paid"
        ? "paid"
        : item.paymentStatus === "pending"
        ? "pending"
        : item.paymentStatus === "overdue"
        ? "overdue"
        : "neutral";

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/(employee)/customers/${item.id}`)}
        style={[
          styles.clientCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        {/* Top Row: Circular Avatar + Identity + Status Pill */}
        <View style={styles.clientTopRow}>
          <View style={styles.clientHeaderLeft}>
            <View
              style={[
                styles.avatarBox,
                {
                  backgroundColor: isDark
                    ? "rgba(53, 214, 160, 0.14)"
                    : "rgba(0, 168, 121, 0.12)",
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: isDark ? "#35D6A0" : "#00A879" },
                ]}
              >
                {initials}
              </Text>
            </View>

            <View style={styles.clientIdentity}>
              <Text
                style={[styles.clientName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[styles.clientSub, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.contactPerson || "Contact"} • {item.city || "Headquarters"}
              </Text>
            </View>
          </View>

          <StatusPill
            label={item.paymentStatus || item.status || "active"}
            variant={paymentVariant as any}
            size="small"
          />
        </View>

        {/* Middle Row: Soft RGBA Surface for Metrics */}
        <View
          style={[
            styles.metaContainer,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.03)"
                : "rgba(16, 21, 19, 0.03)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : "rgba(16, 21, 19, 0.06)",
            },
          ]}
        >
          <View style={styles.metaCol}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              OUTSTANDING
            </Text>
            <Text style={[styles.fieldValue, { color: paymentColor }]}>
              {item.outstandingPayment || "₹0.00"}
            </Text>
          </View>

          <View
            style={[
              styles.metaDivider,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(16, 21, 19, 0.08)",
              },
            ]}
          />

          <View style={styles.metaCol}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              SALESPERSON
            </Text>
            <Text
              style={[styles.fieldValueSmall, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.assignedSalesperson || "Assigned Rep"}
            </Text>
          </View>
        </View>

        {/* Footer Row: Last Contact / Credit & Quick Action Pill */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.lastContactTime
                ? `Last contact: ${item.lastContactTime}`
                : `Credit: ${item.creditPeriod || "30 Days"}`}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.callPillBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(53, 214, 160, 0.12)"
                    : "rgba(0, 168, 121, 0.10)",
                  borderColor: isDark
                    ? "rgba(53, 214, 160, 0.25)"
                    : "rgba(0, 168, 121, 0.20)",
                },
              ]}
              onPress={() => {
                const cleaned = (item.phone || "").replace(/[^0-9+]/g, "");
                if (cleaned) {
                  Linking.openURL(`tel:${cleaned}`).catch(() => {
                    Alert.alert("Error", "Could not open dialer.");
                  });
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="call"
                size={12}
                color={isDark ? "#35D6A0" : "#00A879"}
              />
              <Text
                style={[
                  styles.callPillText,
                  { color: isDark ? "#35D6A0" : "#00A879" },
                ]}
              >
                Call
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.editPillBtn,
                {
                  backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#FFFFFF",
                  borderColor: isDark ? "rgba(53, 214, 160, 0.25)" : "rgba(0, 168, 121, 0.25)",
                },
              ]}
              onPress={(event) => {
                event.stopPropagation?.();
                void openCustomerEditor(item, "credit");
              }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name} credit period`}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={12} color={isDark ? "#35D6A0" : "#00A879"} />
              <Text style={[styles.callPillText, { color: isDark ? "#35D6A0" : "#00A879" }]}>Credit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.editPillBtn,
                {
                  backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#FFFFFF",
                  borderColor: isDark ? "rgba(53, 214, 160, 0.25)" : "rgba(0, 168, 121, 0.25)",
                },
              ]}
              onPress={(event) => {
                event.stopPropagation?.();
                void openCustomerEditor(item, "contact");
              }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name} phone, email, and assigned salesperson`}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={12} color={isDark ? "#35D6A0" : "#00A879"} />
              <Text style={[styles.callPillText, { color: isDark ? "#35D6A0" : "#00A879" }]}>Salesperson</Text>
            </TouchableOpacity>

            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setDrawerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open customer navigation"
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={21} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.screenHeading, { color: colors.textPrimary }]} numberOfLines={1}>
          Customer Directory
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholders={[
            'Search "company name"',
            'Search "contact person"',
            'Search "city"',
            'Search "phone number"',
          ]}
          intervalMs={2000}
          onClear={() => setSearch("")}
          onFilterPress={() => setFilterVisible(true)}
          filterActive={filtersActive}
        />
      </View>

      {loading ? (
        <SkeletonCardList count={5} height={112} style={{ paddingHorizontal: 16, paddingTop: 6 }} />
      ) : filteredCustomers.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Ionicons name={loadError ? "cloud-offline-outline" : "people-outline"} size={48} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          {loadError || (search || filtersActive ? "No customers match these search and filter options" : "No customers found")}
          </Text>
          <TouchableOpacity onPress={() => { void loadData(true); }} style={styles.retryButton}>
            <Text style={styles.retryText}>{loadError ? "Retry" : "Refresh Directory"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCustomerCard}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={colors.primary} /> : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Spacing.screenPadding,
            paddingBottom: Math.max(insets.bottom, 16) + 90,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
      <Modal
        visible={!!editingCustomer}
        transparent
        animationType="fade"
        onRequestClose={closeCustomerEditor}
        statusBarTranslucent
      >
        <View style={styles.editModalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.editModalKeyboard}
          >
            <View style={[styles.editModalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.editModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editModalTitle, { color: colors.textPrimary }]}>
                    {editMode === "credit" ? "Edit credit period" : "Edit salesperson"}
                  </Text>
                  <Text style={[styles.editModalSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {editingCustomer?.name || (editMode === "credit" ? "Credit terms" : "Contact details")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeCustomerEditor}
                  disabled={savingEdit}
                  accessibilityRole="button"
                  accessibilityLabel="Close customer editor"
                  style={styles.editModalClose}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {editLoading ? (
                <View style={styles.editLoadingState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.editModalSubtitle, { color: colors.textSecondary }]}>Loading edit access…</Text>
                </View>
              ) : editForm ? (
                <View style={styles.editFormContainer}>
                  {editMode === "contact" && editPermissions.contact && (
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      style={styles.editContactScroll}
                    >
                      <Text style={[styles.editSectionTitle, { color: colors.textSecondary }]}>CONTACT & SALESPERSON</Text>
                      <Text style={[styles.editFieldLabel, { color: colors.textSecondary }]}>PHONE</Text>
                      <TextInput
                        value={editForm.phone}
                        onChangeText={(phone) => setEditForm((previous) => previous ? { ...previous, phone } : previous)}
                        keyboardType="phone-pad"
                        placeholder="Phone number"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.background }]}
                        accessibilityLabel="Customer phone"
                      />
                      <Text style={[styles.editFieldLabel, { color: colors.textSecondary }]}>EMAIL</Text>
                      <TextInput
                        value={editForm.email}
                        onChangeText={(email) => setEditForm((previous) => previous ? { ...previous, email } : previous)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="Email address"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.background }]}
                        accessibilityLabel="Customer email"
                      />
                      <Text style={[styles.editFieldLabel, { color: colors.textSecondary }]}>ASSIGNED SALESPERSON</Text>
                      <TouchableOpacity
                        onPress={() => setSalespersonPickerOpen((open) => !open)}
                        accessibilityRole="button"
                        accessibilityLabel="Choose assigned salesperson"
                        accessibilityState={{ expanded: salespersonPickerOpen }}
                        style={[styles.editSelect, { borderColor: colors.cardBorder, backgroundColor: colors.background }]}
                      >
                        <Text style={[styles.editSelectText, { color: colors.textPrimary }]}>
                          {salespersonOptions.find((option) => option.id === editForm.salespersonId)?.name || "Unassigned"}
                        </Text>
                        <Ionicons name={salespersonPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {salespersonPickerOpen && (
                        <View style={[styles.editSalespersonList, { borderColor: colors.cardBorder, backgroundColor: colors.background }]}>
                          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                            <TouchableOpacity
                              onPress={() => { setEditForm((previous) => previous ? { ...previous, salespersonId: null } : previous); setSalespersonPickerOpen(false); }}
                              style={styles.editSalespersonOption}
                            >
                              <Text style={[styles.editSelectText, { color: colors.textPrimary }]}>Unassigned</Text>
                            </TouchableOpacity>
                            {salespersonOptions.map((option) => (
                              <TouchableOpacity
                                key={option.id}
                                onPress={() => { setEditForm((previous) => previous ? { ...previous, salespersonId: option.id } : previous); setSalespersonPickerOpen(false); }}
                                style={styles.editSalespersonOption}
                              >
                                <Text style={[styles.editSelectText, { color: colors.textPrimary }]}>{option.name}</Text>
                                {editForm.salespersonId === option.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </ScrollView>
                  )}

                  {editMode === "credit" && editPermissions.credit && (
                    <View style={styles.editCreditBlock}>
                      <Text style={[styles.editSectionTitle, { color: colors.textSecondary }]}>CREDIT TERMS</Text>
                      <Text style={[styles.editFieldLabel, { color: colors.textSecondary }]}>CREDIT PERIOD (DAYS)</Text>
                      <TextInput
                        value={editForm.creditPeriodDays}
                        onChangeText={(creditPeriodDays) => setEditForm((previous) => previous ? { ...previous, creditPeriodDays: creditPeriodDays.replace(/[^0-9]/g, "") } : previous)}
                        keyboardType="number-pad"
                        placeholder="7"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.background }]}
                        accessibilityLabel="Credit period in days"
                        autoFocus
                      />
                    </View>
                  )}

                  {!!editError && <Text style={styles.editErrorText}>{editError}</Text>}

                  {/* Fixed footer: Cancel & Save Changes buttons always visible without scrolling */}
                  <View style={styles.editModalActions}>
                    <TouchableOpacity onPress={closeCustomerEditor} disabled={savingEdit} style={[styles.editCancelButton, { borderColor: colors.cardBorder }]}>
                      <Text style={[styles.editCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void saveCustomerEditor()} disabled={savingEdit} style={[styles.editSaveButton, { backgroundColor: colors.primary, opacity: savingEdit ? 0.65 : 1 }]}>
                      {savingEdit ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.editSaveText}>Save changes</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <CustomerFilterSheet
        visible={filterVisible}
        paymentFilter={paymentFilter}
        balanceFilter={balanceFilter}
        sortOption={sortOption}
        onPaymentFilterChange={setPaymentFilter}
        onBalanceFilterChange={setBalanceFilter}
        onSortOptionChange={setSortOption}
        onClose={() => setFilterVisible(false)}
        onReset={resetDirectoryFilters}
      />
      <CustomerNavDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} isAdmin />
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
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  screenHeading: {
    flex: 1,
    fontFamily: Typography.headingSemi,
    fontSize: FontSizes.screenTitle,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  menuBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSpacer: {
    width: 34,
    height: 34,
  },
  searchWrap: {
    paddingHorizontal: Spacing.screenPadding,
    marginVertical: Spacing.md,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.regular,
    fontSize: FontSizes.bodySmall,
  },
  filterButton: {
    width: 32,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  clientCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  clientTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  clientHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    fontFamily: Typography.bold,
    fontSize: 14,
  },
  clientIdentity: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    fontFamily: Typography.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  clientSub: {
    fontFamily: Typography.medium,
    fontSize: 13,
  },
  metaContainer: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  metaCol: {
    flex: 1,
    gap: 2,
  },
  metaDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 10,
  },
  fieldLabel: {
    fontFamily: Typography.semiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldValue: {
    fontFamily: Typography.bold,
    fontSize: 15,
  },
  fieldValueSmall: {
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  footerRow: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 9,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: "100%",
    minWidth: 0,
  },
  footerText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Typography.medium,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  callPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    gap: 4,
  },
  callPillText: {
    fontFamily: Typography.bold,
    fontSize: 11,
  },
  editPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    gap: 4,
  },
  editModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    backgroundColor: "rgba(5, 15, 12, 0.48)",
  },
  editModalKeyboard: {
    width: "100%",
    maxWidth: 480,
  },
  editModalCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    width: "100%",
    maxWidth: 440,
    ...Shadows.card,
  },
  editFormContainer: {
    width: "100%",
  },
  editContactScroll: {
    maxHeight: 320,
  },
  editCreditBlock: {
    paddingVertical: 2,
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  editModalTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: 19,
  },
  editModalSubtitle: {
    fontFamily: Typography.regular,
    fontSize: 12,
    marginTop: 2,
  },
  editModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  editLoadingState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 28,
  },
  editSectionTitle: {
    fontFamily: Typography.semiBold,
    fontSize: 10,
    letterSpacing: 0.7,
    marginBottom: 12,
  },
  editFieldLabel: {
    fontFamily: Typography.semiBold,
    fontSize: 10,
    letterSpacing: 0.55,
    marginBottom: 6,
  },
  editInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontFamily: Typography.medium,
    fontSize: 14,
    marginBottom: 14,
  },
  editSelect: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  editSelectText: {
    fontFamily: Typography.medium,
    fontSize: 14,
  },
  editSalespersonList: {
    borderWidth: 1,
    borderRadius: 11,
    overflow: "hidden",
    marginBottom: 14,
  },
  editSalespersonOption: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(120, 140, 130, 0.22)",
  },
  editErrorText: {
    color: "#D94A55",
    fontFamily: Typography.medium,
    fontSize: 12,
    marginBottom: 12,
  },
  editModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 18,
    paddingTop: 6,
  },
  editCancelButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelText: {
    fontFamily: Typography.semiBold,
    fontSize: 13,
  },
  editSaveButton: {
    minHeight: 44,
    minWidth: 130,
    borderRadius: Radius.pill,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveText: {
    color: "#FFFFFF",
    fontFamily: Typography.semiBold,
    fontSize: 13,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: Typography.regular,
    fontSize: 14,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: "#00A879",
  },
  retryText: {
    color: "#FFFFFF",
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
});
