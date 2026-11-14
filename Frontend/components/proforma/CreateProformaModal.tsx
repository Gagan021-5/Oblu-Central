import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius } from "@/constants/theme";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";
import {
  fetchProformaCustomersApi,
  fetchProformaCatalogApi,
  createProformaApi,
  ProformaCustomerLookup,
  ProformaCatalogItem,
} from "@/services/proformaService";

interface CreateProformaModalProps {
  visible: boolean;
  docType: "proforma" | "quotation";
  onClose: () => void;
  onSuccess: () => void;
}

interface DraftLineItem {
  product: ProformaCatalogItem;
  quantity: number;
  requestedPrice?: number;
}

export function CreateProformaModal({
  visible,
  docType,
  onClose,
  onSuccess,
}: CreateProformaModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // State
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<ProformaCustomerLookup[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<ProformaCustomerLookup | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const [courierMode, setCourierMode] = useState<"surface" | "air">("surface");
  const [items, setItems] = useState<DraftLineItem[]>([]);

  // Product Picker State
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<ProformaCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Theme tokens
  const bg = isDark ? "#0C0E15" : "#FFFFFF";
  const cardBg = isDark ? "#12151E" : "#F8FAFC";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0";
  const foreground = isDark ? "#F8FAFC" : "#101513";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const activeColor = "#10B981";

  // Load customers
  useEffect(() => {
    if (visible) {
      fetchProformaCustomersApi(customerSearch).then((data) => setCustomers(data));
    }
  }, [visible, customerSearch]);

  // Load catalog when product picker opens
  useEffect(() => {
    if (productPickerOpen) {
      setCatalogLoading(true);
      fetchProformaCatalogApi({ search: catalogSearch }).then((data) => {
        setCatalogProducts(data.products);
        setCatalogLoading(false);
      });
    }
  }, [productPickerOpen, catalogSearch]);

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let gst = 0;

    items.forEach((item) => {
      const price = item.requestedPrice !== undefined ? item.requestedPrice : item.product.base_price;
      const lineTotal = price * item.quantity;
      subtotal += lineTotal;
      const taxRate = item.product.gst_percentage || 18;
      gst += lineTotal * (taxRate / 100);
    });

    const courierCost = courierMode === "air" ? 450 : 200;
    const courierGst = courierCost * 0.18;
    const grandTotal = subtotal + gst + courierCost + courierGst;

    return {
      subtotal,
      gst,
      courier: courierCost,
      courierGst,
      grandTotal,
    };
  }, [items, courierMode]);

  // Handlers
  const handleAddProduct = (p: ProformaCatalogItem) => {
    triggerSelectionHaptic();
    const existingIndex = items.findIndex((it) => it.product.id === p.id);
    if (existingIndex >= 0) {
      const copy = [...items];
      copy[existingIndex].quantity += 1;
      setItems(copy);
    } else {
      setItems([...items, { product: p, quantity: 1 }]);
    }
    setProductPickerOpen(false);
  };

  const handleUpdateQty = (idx: number, delta: number) => {
    triggerLightHaptic();
    const copy = [...items];
    const newQty = copy[idx].quantity + delta;
    if (newQty <= 0) {
      copy.splice(idx, 1);
    } else {
      copy[idx].quantity = newQty;
    }
    setItems(copy);
  };

  const handleUpdatePrice = (idx: number, val: string) => {
    const copy = [...items];
    const num = parseFloat(val);
    copy[idx].requestedPrice = isNaN(num) ? undefined : num;
    setItems(copy);
  };

  const handleRemoveItem = (idx: number) => {
    triggerLightHaptic();
    const copy = [...items];
    copy.splice(idx, 1);
    setItems(copy);
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      Alert.alert("Missing Customer", "Please select a client/customer.");
      return;
    }
    if (items.length === 0) {
      Alert.alert("No Items", "Please add at least one product item.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doc_type: docType,
        customer_id: selectedCustomer.id,
        courier_mode: courierMode,
        items: items.map((it) => ({
          product_id: it.product.id,
          quantity: it.quantity,
          requested_price: it.requestedPrice,
        })),
      };

      const res = await createProformaApi(payload);
      if (res && res.success) {
        triggerLightHaptic();
        Alert.alert(
          "Success",
          `${docType === "quotation" ? "Quotation" : "Proforma"} ${res.number} generated successfully!`,
          [{ text: "OK", onPress: () => {
            onClose();
            onSuccess();
          }}]
        );
      } else {
        Alert.alert("Creation Failed", res?.message || "Could not generate document.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={muted} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.title, { color: foreground }]}>
              {docType === "quotation" ? "Create New Quotation" : "Create New Proforma"}
            </Text>
            <Text style={[styles.subtitle, { color: muted }]}>Draft invoice with tax & courier</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Customer Selection Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>CLIENT / CUSTOMER *</Text>
            {selectedCustomer ? (
              <View style={styles.selectedCustomerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.customerName, { color: foreground }]}>{selectedCustomer.name}</Text>
                  <Text style={[styles.customerDetail, { color: muted }]}>
                    {selectedCustomer.phone} • {selectedCustomer.city || "India"}
                  </Text>
                  {selectedCustomer.has_overdue && (
                    <View style={styles.overdueAlert}>
                      <Ionicons name="warning-outline" size={13} color="#F59E0B" />
                      <Text style={styles.overdueText}>Customer has overdue invoices in Tally</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)} style={styles.changeBtn}>
                  <Text style={[styles.changeText, { color: activeColor }]}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.customerPickerBtn, { borderColor: border }]}
                onPress={() => setCustomerPickerOpen(true)}
              >
                <Ionicons name="person-outline" size={18} color={muted} />
                <Text style={[styles.pickerPlaceholder, { color: muted }]}>Select Client from CRM...</Text>
                <Ionicons name="chevron-forward" size={16} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Courier Mode Selection */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>SHIPPING & COURIER MODE</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  courierMode === "surface" && { backgroundColor: activeColor },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setCourierMode("surface");
                }}
              >
                <Ionicons
                  name="bus-outline"
                  size={16}
                  color={courierMode === "surface" ? "#06281E" : muted}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: courierMode === "surface" ? "#06281E" : foreground },
                  ]}
                >
                  Surface Cargo (Standard)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  courierMode === "air" && { backgroundColor: activeColor },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setCourierMode("air");
                }}
              >
                <Ionicons
                  name="airplane-outline"
                  size={16}
                  color={courierMode === "air" ? "#06281E" : muted}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: courierMode === "air" ? "#06281E" : foreground },
                  ]}
                >
                  Air Express (Priority)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Product Items Section */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.label, { color: muted }]}>LINE ITEMS ({items.length})</Text>
              <TouchableOpacity
                onPress={() => setProductPickerOpen(true)}
                style={[styles.addItemsBtn, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#DDF4EA" }]}
              >
                <Ionicons name="add" size={16} color={activeColor} />
                <Text style={[styles.addItemsText, { color: activeColor }]}>Add Products</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Ionicons name="cart-outline" size={32} color={muted} />
                <Text style={[styles.emptyItemsText, { color: muted }]}>No items added to this invoice yet.</Text>
              </View>
            ) : (
              items.map((item, idx) => {
                const effectivePrice = item.requestedPrice !== undefined ? item.requestedPrice : item.product.base_price;
                const isPriceAltered = item.requestedPrice !== undefined && item.requestedPrice !== item.product.base_price;
                return (
                  <View key={item.product.id} style={[styles.itemRow, { borderBottomColor: border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: foreground }]}>{item.product.name}</Text>
                      <Text style={[styles.itemSku, { color: muted }]}>
                        SKU: {item.product.sku || "N/A"} • Stock: {item.product.stock}
                      </Text>

                      <View style={styles.itemPricingInputs}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={[styles.priceTag, { color: muted }]}>Unit: ₹</Text>
                          <TextInput
                            style={[
                              styles.priceInput,
                              {
                                color: foreground,
                                borderColor: isPriceAltered ? "#F59E0B" : border,
                              },
                            ]}
                            keyboardType="numeric"
                            defaultValue={String(effectivePrice)}
                            onChangeText={(val) => handleUpdatePrice(idx, val)}
                          />
                          {isPriceAltered && (
                            <Text style={styles.alteredBadge}>Custom</Text>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Stepper & Total */}
                    <View style={styles.stepperCluster}>
                      <View style={[styles.stepper, { borderColor: border }]}>
                        <TouchableOpacity onPress={() => handleUpdateQty(idx, -1)} style={styles.stepperBtn}>
                          <Ionicons name="remove" size={14} color={foreground} />
                        </TouchableOpacity>
                        <Text style={[styles.stepperVal, { color: foreground }]}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => handleUpdateQty(idx, 1)} style={styles.stepperBtn}>
                          <Ionicons name="add" size={14} color={foreground} />
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.lineTotal, { color: activeColor }]}>
                        ₹{intFormat(effectivePrice * item.quantity)}
                      </Text>

                      <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={styles.trashBtn}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Pricing Breakdown Summary */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>TOTALS & ESTIMATE</Text>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: muted }]}>Taxable Subtotal</Text>
              <Text style={[styles.summaryVal, { color: foreground }]}>₹{intFormat(calculations.subtotal)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: muted }]}>Estimated GST (18%)</Text>
              <Text style={[styles.summaryVal, { color: foreground }]}>₹{intFormat(calculations.gst)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: muted }]}>
                Estimated Courier ({courierMode.toUpperCase()})
              </Text>
              <Text style={[styles.summaryVal, { color: foreground }]}>
                ₹{intFormat(calculations.courier + calculations.courierGst)}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: border }]} />

            <View style={styles.summaryRow}>
              <Text style={[styles.grandLabel, { color: foreground }]}>Grand Total</Text>
              <Text style={[styles.grandVal, { color: activeColor }]}>₹{intFormat(calculations.grandTotal)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Submit Footer Bar */}
        <View style={[styles.footerBar, { borderTopColor: border, paddingBottom: Math.max(insets.bottom, 14) }]}>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: activeColor }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#06281E" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#06281E" />
                <Text style={styles.submitBtnText}>
                  Generate {docType === "quotation" ? "Quotation" : "Proforma Invoice"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── CUSTOMER PICKER MODAL ── */}
        <Modal visible={customerPickerOpen} animationType="slide">
          <View style={[styles.pickerModal, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
            <View style={[styles.header, { borderBottomColor: border }]}>
              <TouchableOpacity onPress={() => setCustomerPickerOpen(false)} style={styles.closeBtn}>
                <Ionicons name="arrow-back" size={22} color={foreground} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: foreground }]}>Select Customer</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchBarBox}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: cardBg, color: foreground, borderColor: border }]}
                placeholder="Search customers by name, phone..."
                placeholderTextColor={muted}
                value={customerSearch}
                onChangeText={setCustomerSearch}
              />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
              {customers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.customerPickItem, { borderBottomColor: border }]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setSelectedCustomer(c);
                    setCustomerPickerOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.customerName, { color: foreground }]}>{c.name}</Text>
                    <Text style={[styles.customerDetail, { color: muted }]}>
                      {c.phone} • {c.city || "India"}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={20} color={activeColor} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* ── PRODUCT CATALOG PICKER MODAL ── */}
        <Modal visible={productPickerOpen} animationType="slide">
          <View style={[styles.pickerModal, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
            <View style={[styles.header, { borderBottomColor: border }]}>
              <TouchableOpacity onPress={() => setProductPickerOpen(false)} style={styles.closeBtn}>
                <Ionicons name="arrow-back" size={22} color={foreground} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: foreground }]}>Add Products</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchBarBox}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: cardBg, color: foreground, borderColor: border }]}
                placeholder="Search product name or SKU..."
                placeholderTextColor={muted}
                value={catalogSearch}
                onChangeText={setCatalogSearch}
              />
            </View>

            {catalogLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={activeColor} />
            ) : (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
                {catalogProducts.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.catalogPickItem, { borderBottomColor: border }]}
                    onPress={() => handleAddProduct(p)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: foreground }]}>{p.name}</Text>
                      <Text style={[styles.itemSku, { color: muted }]}>
                        {p.category} • SKU: {p.sku || "N/A"} • Stock: {p.stock}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                      <Text style={[styles.catalogPrice, { color: activeColor }]}>₹{intFormat(p.base_price)}</Text>
                      <Text style={[styles.catalogGst, { color: muted }]}>+{p.gst_percentage}% GST</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color={activeColor} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function intFormat(num: number): string {
  return Math.round(num).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 16, fontFamily: Typography.bold },
  subtitle: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  scrollBody: { padding: 16, paddingBottom: 100 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  label: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  selectedCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customerName: { fontSize: 14, fontFamily: Typography.bold },
  customerDetail: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  overdueAlert: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  overdueText: { fontSize: 11, color: "#F59E0B", fontFamily: Typography.medium },
  changeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  changeText: { fontSize: 12, fontFamily: Typography.bold },
  customerPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  pickerPlaceholder: { flex: 1, fontSize: 13, fontFamily: Typography.regular },
  segmentedRow: { flexDirection: "row", gap: 10 },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  segmentText: { fontSize: 11, fontFamily: Typography.semiBold },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addItemsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  addItemsText: { fontSize: 12, fontFamily: Typography.bold },
  emptyItemsBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 6,
  },
  emptyItemsText: { fontSize: 12, fontFamily: Typography.regular },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemName: { fontSize: 13, fontFamily: Typography.bold },
  itemSku: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  itemPricingInputs: { marginTop: 6 },
  priceTag: { fontSize: 12, fontFamily: Typography.medium },
  priceInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 12,
    fontFamily: Typography.bold,
    minWidth: 70,
  },
  alteredBadge: {
    fontSize: 9,
    fontFamily: Typography.bold,
    color: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  stepperCluster: {
    alignItems: "flex-end",
    gap: 6,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
  },
  stepperBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  stepperVal: { fontSize: 13, fontFamily: Typography.bold, paddingHorizontal: 4 },
  lineTotal: { fontSize: 13, fontFamily: Typography.bold },
  trashBtn: { padding: 4 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 12, fontFamily: Typography.regular },
  summaryVal: { fontSize: 12, fontFamily: Typography.medium },
  divider: { height: 1, marginVertical: 8 },
  grandLabel: { fontSize: 14, fontFamily: Typography.bold },
  grandVal: { fontSize: 16, fontFamily: Typography.bold },
  footerBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "transparent",
    borderTopWidth: 1,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: Typography.bold,
    color: "#06281E",
  },
  pickerModal: { flex: 1 },
  searchBarBox: { padding: 16 },
  searchInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: Typography.regular,
  },
  customerPickItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  catalogPickItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  catalogPrice: { fontSize: 13, fontFamily: Typography.bold },
  catalogGst: { fontSize: 10, fontFamily: Typography.regular },
});
