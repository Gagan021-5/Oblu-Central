import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { Typography } from "@/constants/theme";
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
  docType?: "proforma" | "quotation";
  onClose: () => void;
  onSuccess: (createdDoc?: { id: number; doc_type: "proforma" | "quotation"; number?: string }) => void;
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
  const { isDark } = useTheme();

  // Document Type
  const [currentDocType, setCurrentDocType] = useState<"proforma" | "quotation">(docType || "proforma");

  useEffect(() => {
    if (visible && docType) {
      setCurrentDocType(docType);
    }
  }, [visible, docType]);

  // Customer & Shipping State
  const [allCustomers, setAllCustomers] = useState<ProformaCustomerLookup[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<ProformaCustomerLookup | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<ProformaCustomerLookup | null>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [activePickerTarget, setActivePickerTarget] = useState<"billing" | "shipping">("billing");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  // Courier Mode & Optional Request Fields
  const [courierMode, setCourierMode] = useState<"surface" | "air">("surface");
  const [requestedCourierCharge, setRequestedCourierCharge] = useState("");
  const [requestReason, setRequestReason] = useState("");

  // Line items
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

  // Preload customers on modal open
  useEffect(() => {
    if (visible) {
      setCustomersLoading(true);
      fetchProformaCustomersApi("").then((data) => {
        setAllCustomers(data);
        setCustomersLoading(false);
      });
    }
  }, [visible]);

  // Debounced server search fallback if query changes
  const searchTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (customerModalVisible && customerSearchQuery.trim()) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(async () => {
        const fetched = await fetchProformaCustomersApi(customerSearchQuery);
        if (fetched.length > 0) {
          setAllCustomers((prev) => {
            const map = new Map<number, ProformaCustomerLookup>();
            prev.forEach((c) => map.set(c.id, c));
            fetched.forEach((c) => map.set(c.id, c));
            return Array.from(map.values());
          });
        }
      }, 300);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [customerSearchQuery, customerModalVisible]);

  // Instant client-side filter
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return allCustomers;
    const q = customerSearchQuery.toLowerCase().trim();
    return allCustomers.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.state && c.state.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        String(c.id).includes(q)
      );
    });
  }, [allCustomers, customerSearchQuery]);

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

  const visibleCatalogProducts = useMemo(() => {
    if (!catalogSearch.trim()) return catalogProducts;
    const tokens = catalogSearch.toLowerCase().trim().split(/\s+/);
    return catalogProducts.filter((p) => {
      const target = `${p.name} ${p.category} ${p.sku || ""}`.toLowerCase();
      return tokens.every((t) => target.includes(t));
    });
  }, [catalogProducts, catalogSearch]);

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let gst = 0;

    items.forEach((item) => {
      // Find tier price if available
      let tierPrice = item.product.base_price;
      if (item.product.tiers && item.product.tiers.length > 0) {
        for (const t of item.product.tiers) {
          if (item.quantity >= t.min_qty) {
            tierPrice = t.unit_price;
            break;
          }
        }
      }
      const effectivePrice = item.requestedPrice !== undefined ? item.requestedPrice : tierPrice;
      const lineTotal = effectivePrice * item.quantity;
      subtotal += lineTotal;
      const taxRate = item.product.gst_percentage || 18;
      gst += lineTotal * (taxRate / 100);
    });

    // Approximate courier calculation
    const courierCost = courierMode === "air" ? 450 : 200;
    const courierGst = courierCost * 0.18;
    const grandTotal = subtotal + courierCost;

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

  const handleSetExactQty = (idx: number, text: string) => {
    const val = parseInt(text.replace(/[^0-9]/g, ""), 10);
    const copy = [...items];
    copy[idx].quantity = isNaN(val) || val < 1 ? 1 : val;
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

  const handleUseBillingForShipping = () => {
    triggerLightHaptic();
    setSelectedShipping(selectedBilling);
  };

  const handleSubmit = async () => {
    if (!selectedBilling) {
      Alert.alert("Missing Billing Customer", "Please select a billing customer.");
      return;
    }
    if (items.length === 0) {
      Alert.alert("No Items", "Please add at least one product item.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doc_type: currentDocType,
        customer_id: selectedBilling.id,
        shipping_customer_id: selectedShipping?.id || selectedBilling.id,
        courier_mode: courierMode,
        requested_courier_charge: requestedCourierCharge.trim() ? requestedCourierCharge.trim() : undefined,
        request_reason: requestReason.trim(),
        items: items.map((it) => ({
          product_id: it.product.id,
          quantity: it.quantity,
          requested_price: it.requestedPrice,
        })),
      };

      const res = await createProformaApi(payload);
      if (res && res.success) {
        triggerLightHaptic();
        onClose();
        onSuccess({
          id: res.id,
          doc_type: currentDocType,
          number: res.number,
        });
      } else {
        Alert.alert("Creation Failed", res?.message || "Could not generate document.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || err?.message || "An unexpected error occurred.");
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
              {currentDocType === "quotation" ? "QUOTATION MAKER" : "PROFORMA INVOICE MAKER"}
            </Text>
            <Text style={[styles.subtitle, { color: muted }]}>Create official document with live tax & tiers</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Document Type Selector Segment */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, marginBottom: 14 }]}>
            <Text style={[styles.label, { color: muted }]}>DOCUMENT TYPE</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  currentDocType === "quotation" && { backgroundColor: activeColor },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setCurrentDocType("quotation");
                }}
              >
                <Ionicons
                  name="receipt-outline"
                  size={16}
                  color={currentDocType === "quotation" ? "#06281E" : muted}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: currentDocType === "quotation" ? "#06281E" : foreground, fontFamily: Typography.bold },
                  ]}
                >
                  Quotation
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  currentDocType === "proforma" && { backgroundColor: activeColor },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setCurrentDocType("proforma");
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={currentDocType === "proforma" ? "#06281E" : muted}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: currentDocType === "proforma" ? "#06281E" : foreground, fontFamily: Typography.bold },
                  ]}
                >
                  Proforma Invoice
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 1. CUSTOMER & SHIPPING SECTION (Web Parity) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.label, { color: muted, marginBottom: 0 }]}>CUSTOMER & SHIPPING</Text>
              {selectedBilling && !selectedShipping && (
                <TouchableOpacity onPress={handleUseBillingForShipping} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={13} color={activeColor} />
                  <Text style={[styles.copyBtnText, { color: activeColor }]}>Same for Shipping</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Select Customer & Shipping Main Button */}
            <TouchableOpacity
              style={[styles.selectCustomerBigBtn, { backgroundColor: isDark ? "#1E293B" : "#0F172A" }]}
              onPress={() => {
                triggerSelectionHaptic();
                setActivePickerTarget("billing");
                setCustomerSearchQuery("");
                setCustomerModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="people" size={18} color="#FFFFFF" />
              <Text style={styles.selectCustomerBigBtnText}>Select Customer & Shipping</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Selected Billing Box */}
            <View style={[styles.partyBox, { borderColor: border, backgroundColor: isDark ? "#090B10" : "#FFFFFF" }]}>
              <View style={styles.partyHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="card-outline" size={15} color={activeColor} />
                  <Text style={[styles.partyHeaderTitle, { color: foreground }]}>Selected Billing:</Text>
                </View>
                {selectedBilling && (
                  <TouchableOpacity onPress={() => setSelectedBilling(null)} style={styles.removePartyBtn}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              {selectedBilling ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[styles.partyName, { color: foreground }]}>{selectedBilling.name}</Text>
                  {selectedBilling.address ? (
                    <Text style={[styles.partyDetail, { color: muted }]}>
                      Addr: {selectedBilling.address}
                    </Text>
                  ) : null}
                  <Text style={[styles.partyDetail, { color: muted }]}>
                    Phone: {selectedBilling.phone || "N/A"} {selectedBilling.city ? `• ${selectedBilling.city}` : ""}
                  </Text>
                  {selectedBilling.gstin ? (
                    <Text style={[styles.partyDetail, { color: muted }]}>GSTIN: {selectedBilling.gstin}</Text>
                  ) : null}
                  {selectedBilling.has_overdue && (
                    <View style={styles.overdueAlert}>
                      <Ionicons name="warning-outline" size={13} color="#F59E0B" />
                      <Text style={styles.overdueText}>Customer has overdue invoices in Tally</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={[styles.partyPlaceholder, { color: muted }]}>None selected (tap above to choose)</Text>
              )}
            </View>

            {/* Selected Shipping Box */}
            <View style={[styles.partyBox, { borderColor: border, backgroundColor: isDark ? "#090B10" : "#FFFFFF", marginTop: 10 }]}>
              <View style={styles.partyHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="location-outline" size={15} color="#3B82F6" />
                  <Text style={[styles.partyHeaderTitle, { color: foreground }]}>Selected Shipping:</Text>
                </View>
                {selectedShipping ? (
                  <TouchableOpacity onPress={() => setSelectedShipping(null)} style={styles.removePartyBtn}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                  </TouchableOpacity>
                ) : selectedBilling ? (
                  <TouchableOpacity onPress={handleUseBillingForShipping}>
                    <Text style={{ fontSize: 11, color: activeColor, fontFamily: Typography.bold }}>Copy Billing</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {selectedShipping ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[styles.partyName, { color: foreground }]}>{selectedShipping.name}</Text>
                  {selectedShipping.address ? (
                    <Text style={[styles.partyDetail, { color: muted }]}>
                      Addr: {selectedShipping.address}
                    </Text>
                  ) : null}
                  <Text style={[styles.partyDetail, { color: muted }]}>
                    Phone: {selectedShipping.phone || "N/A"} {selectedShipping.city ? `• ${selectedShipping.city}` : ""}
                  </Text>
                  {selectedShipping.gstin ? (
                    <Text style={[styles.partyDetail, { color: muted }]}>GSTIN: {selectedShipping.gstin}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.partyPlaceholder, { color: muted }]}>
                  {selectedBilling ? "Same as Billing (Default)" : "None"}
                </Text>
              )}
            </View>
          </View>

          {/* ── 2. ITEMS SECTION (Web Parity: Product, Qty, Stock, System Price, Requested Price) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.label, { color: muted }]}>
                {currentDocType === "quotation" ? "QUOTATION ITEMS" : "INVOICE ITEMS"} ({items.length})
              </Text>
              <TouchableOpacity
                onPress={() => setProductPickerOpen(true)}
                style={[styles.addItemsBtn, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#DDF4EA" }]}
              >
                <Ionicons name="add" size={16} color={activeColor} />
                <Text style={[styles.addItemsText, { color: activeColor }]}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Ionicons name="cart-outline" size={32} color={muted} />
                <Text style={[styles.emptyItemsText, { color: muted }]}>No items added yet. Tap below to add products.</Text>
                <TouchableOpacity
                  style={[styles.addFirstItemBtn, { backgroundColor: isDark ? "#1E293B" : "#0F172A" }]}
                  onPress={() => setProductPickerOpen(true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.addFirstItemText}>Add First Product</Text>
                </TouchableOpacity>
              </View>
            ) : (
              items.map((item, idx) => {
                // Tier pricing check
                let tierPrice = item.product.base_price;
                if (item.product.tiers && item.product.tiers.length > 0) {
                  for (const t of item.product.tiers) {
                    if (item.quantity >= t.min_qty) {
                      tierPrice = t.unit_price;
                      break;
                    }
                  }
                }
                const effectivePrice = item.requestedPrice !== undefined ? item.requestedPrice : tierPrice;
                const isPriceAltered = item.requestedPrice !== undefined && item.requestedPrice !== tierPrice;
                const inStock = item.product.stock > 0;

                return (
                  <View key={`${item.product.id}-${idx}`} style={[styles.itemCard, { borderColor: border, backgroundColor: isDark ? "#090B10" : "#FFFFFF" }]}>
                    {/* Item Top: Name, Category, Remove Button */}
                    <View style={styles.itemCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: foreground }]}>{item.product.name}</Text>
                        <Text style={[styles.itemSku, { color: muted }]}>
                          {item.product.category} • SKU: {item.product.sku || "N/A"}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={styles.trashBtn}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Stock & Tier badges */}
                    <View style={styles.stockRow}>
                      <View style={[styles.stockBadge, { backgroundColor: inStock ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5") : (isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2") }]}>
                        <Ionicons name={inStock ? "checkmark-circle" : "alert-circle"} size={13} color={inStock ? activeColor : "#EF4444"} />
                        <Text style={[styles.stockBadgeText, { color: inStock ? activeColor : "#EF4444" }]}>
                          {item.product.stock} in inventory
                        </Text>
                      </View>
                      <Text style={[styles.systemPriceText, { color: muted }]}>
                        System: ₹{intFormat(tierPrice)} (Tiers)
                      </Text>
                    </View>

                    {/* Quantity Stepper & Inputs */}
                    <View style={styles.itemInputsRow}>
                      {/* Order Qty */}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputSubLabel, { color: muted }]}>ORDER QTY</Text>
                        <View style={[styles.stepperContainer, { borderColor: border }]}>
                          <TouchableOpacity onPress={() => handleUpdateQty(idx, -1)} style={styles.stepperBtn}>
                            <Ionicons name="remove" size={14} color={foreground} />
                          </TouchableOpacity>
                          <TextInput
                            style={[styles.stepperInput, { color: foreground }]}
                            keyboardType="numeric"
                            value={String(item.quantity)}
                            onChangeText={(t) => handleSetExactQty(idx, t)}
                          />
                          <TouchableOpacity onPress={() => handleUpdateQty(idx, 1)} style={styles.stepperBtn}>
                            <Ionicons name="add" size={14} color={foreground} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Requested Price */}
                      <View style={{ flex: 1.2, marginLeft: 12 }}>
                        <Text style={[styles.inputSubLabel, { color: muted }]}>REQUESTED PRICE</Text>
                        <TextInput
                          style={[
                            styles.requestedPriceInput,
                            {
                              color: foreground,
                              borderColor: isPriceAltered ? "#F59E0B" : border,
                              backgroundColor: isDark ? "#12151E" : "#F8FAFC",
                            },
                          ]}
                          keyboardType="numeric"
                          placeholder={`Default (₹${intFormat(tierPrice)})`}
                          placeholderTextColor={muted}
                          defaultValue={item.requestedPrice !== undefined ? String(item.requestedPrice) : ""}
                          onChangeText={(val) => handleUpdatePrice(idx, val)}
                        />
                      </View>
                    </View>

                    {/* Line Total */}
                    <View style={[styles.lineTotalRow, { borderTopColor: border }]}>
                      <Text style={[styles.lineTotalLabel, { color: muted }]}>Line Total ({item.quantity} × ₹{intFormat(effectivePrice)}):</Text>
                      <Text style={[styles.lineTotalValue, { color: activeColor }]}>
                        ₹{intFormat(effectivePrice * item.quantity)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {items.length > 0 && (
              <TouchableOpacity
                onPress={() => setProductPickerOpen(true)}
                style={[styles.addAnotherProductBtn, { borderColor: border }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={activeColor} />
                <Text style={[styles.addAnotherProductText, { color: activeColor }]}>
                  Add Another Product
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── 3. COURIER SECTION (Surface vs Air) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>COURIER MODE</Text>
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
                <Text style={{ fontSize: 16 }}>🚚</Text>
                <Text
                  style={[
                    styles.segmentText,
                    { color: courierMode === "surface" ? "#06281E" : foreground, fontFamily: Typography.bold },
                  ]}
                >
                  Surface Cargo
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
                <Text style={{ fontSize: 16 }}>✈️</Text>
                <Text
                  style={[
                    styles.segmentText,
                    { color: courierMode === "air" ? "#06281E" : foreground, fontFamily: Typography.bold },
                  ]}
                >
                  Air Express
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 4. PRICE & COURIER REQUEST (OPTIONAL REMARKS) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>PRICE & COURIER REQUEST (OPTIONAL)</Text>

            <View style={styles.courierEstimateRow}>
              <Text style={[styles.courierEstimateLabel, { color: muted }]}>Approximate Courier:</Text>
              <Text style={[styles.courierEstimateValue, { color: activeColor }]}>
                ₹{intFormat(calculations.courier)}
              </Text>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={[styles.inputSubLabel, { color: muted }]}>REQUESTED COURIER CHARGE (₹)</Text>
              <TextInput
                style={[styles.inputBox, { color: foreground, borderColor: border, backgroundColor: isDark ? "#090B10" : "#FFFFFF" }]}
                keyboardType="numeric"
                placeholder="Leave empty for Actual"
                placeholderTextColor={muted}
                value={requestedCourierCharge}
                onChangeText={setRequestedCourierCharge}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={[styles.inputSubLabel, { color: muted }]}>REASON FOR PRICE / COURIER CHANGE</Text>
              <TextInput
                style={[styles.textAreaBox, { color: foreground, borderColor: border, backgroundColor: isDark ? "#090B10" : "#FFFFFF" }]}
                multiline
                numberOfLines={3}
                placeholder="Explain changes (volume match, client agreement, discount justification)..."
                placeholderTextColor={muted}
                value={requestReason}
                onChangeText={setRequestReason}
              />
            </View>
          </View>

          {/* ── 5. ORDER TOTALS ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>ORDER TOTALS</Text>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: muted }]}>Taxable Subtotal</Text>
              <Text style={[styles.summaryVal, { color: foreground }]}>₹{intFormat(calculations.subtotal)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: muted }]}>
                Courier ({courierMode.toUpperCase()})
              </Text>
              <Text style={[styles.summaryVal, { color: foreground }]}>
                ₹{intFormat(calculations.courier)}
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
                  {currentDocType === "quotation" ? "Save Quotation" : "Save Proforma Invoice"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── CUSTOMER & SHIPPING PICKER MODAL (WEB PARITY) ── */}
        <Modal visible={customerModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCustomerModalVisible(false)}>
          <View style={[styles.pickerModal, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
            {/* Modal Header */}
            <View style={[styles.header, { borderBottomColor: border }]}>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={muted} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.title, { color: foreground }]}>Select Customer</Text>
                <Text style={[styles.subtitle, { color: muted }]}>Billing and Shipping accounts</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCustomerModalVisible(false)}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ fontSize: 13, fontFamily: Typography.bold, color: activeColor }}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Target Tab Switcher (Billing vs Shipping) */}
            <View style={[styles.modalTabRow, { borderBottomColor: border }]}>
              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  activePickerTarget === "billing" && { borderBottomColor: activeColor, borderBottomWidth: 2 },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setActivePickerTarget("billing");
                }}
              >
                <Ionicons name="card-outline" size={16} color={activePickerTarget === "billing" ? activeColor : muted} />
                <Text
                  style={[
                    styles.modalTabText,
                    { color: activePickerTarget === "billing" ? activeColor : muted, fontFamily: Typography.bold },
                  ]}
                >
                  Billing: {selectedBilling ? selectedBilling.name.slice(0, 16) : "None"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  activePickerTarget === "shipping" && { borderBottomColor: "#3B82F6", borderBottomWidth: 2 },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setActivePickerTarget("shipping");
                }}
              >
                <Ionicons name="location-outline" size={16} color={activePickerTarget === "shipping" ? "#3B82F6" : muted} />
                <Text
                  style={[
                    styles.modalTabText,
                    { color: activePickerTarget === "shipping" ? "#3B82F6" : muted, fontFamily: Typography.bold },
                  ]}
                >
                  Shipping: {selectedShipping ? selectedShipping.name.slice(0, 16) : "None"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Helper if on Shipping */}
            {activePickerTarget === "shipping" && selectedBilling && (
              <View style={[styles.quickHelperBar, { backgroundColor: isDark ? "#12151E" : "#F1F5F9" }]}>
                <Text style={[styles.quickHelperText, { color: muted }]}>
                  Copy from billing account?
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    triggerLightHaptic();
                    setSelectedShipping(selectedBilling);
                  }}
                  style={[styles.quickHelperBtn, { backgroundColor: activeColor }]}
                >
                  <Ionicons name="copy-outline" size={13} color="#06281E" />
                  <Text style={styles.quickHelperBtnText}>Use {selectedBilling.name.slice(0, 15)}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Search Bar */}
            <View style={styles.searchBarBox}>
              <View style={[styles.searchBarInner, { backgroundColor: cardBg, borderColor: border }]}>
                <Ionicons name="search-outline" size={18} color={muted} />
                <TextInput
                  style={[styles.searchInput, { color: foreground }]}
                  placeholder={
                    activePickerTarget === "billing"
                      ? "Search billing (name, phone, city, ID)..."
                      : "Search shipping (name, phone, city, ID)..."
                  }
                  placeholderTextColor={muted}
                  value={customerSearchQuery}
                  onChangeText={setCustomerSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {customerSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCustomerSearchQuery("")} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={16} color={muted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Customer List */}
            {customersLoading && allCustomers.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={activeColor} />
            ) : filteredCustomers.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Ionicons name="search" size={32} color={muted} />
                <Text style={[styles.emptyItemsText, { color: muted }]}>
                  No customers found matching "{customerSearchQuery}"
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {filteredCustomers.map((c) => {
                  const isSelected =
                    activePickerTarget === "billing"
                      ? selectedBilling?.id === c.id
                      : selectedShipping?.id === c.id;

                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.customerPickItem,
                        {
                          borderBottomColor: border,
                          backgroundColor: isSelected ? (isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5") : "transparent",
                        },
                      ]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        if (activePickerTarget === "billing") {
                          setSelectedBilling(c);
                          if (!selectedShipping) {
                            setSelectedShipping(c);
                          }
                        } else {
                          setSelectedShipping(c);
                        }
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.customerName, { color: foreground }]}>{c.name}</Text>
                        {c.address ? (
                          <Text style={[styles.customerDetail, { color: muted }]} numberOfLines={1}>
                            Addr: {c.address}
                          </Text>
                        ) : null}
                        <Text style={[styles.customerDetail, { color: muted }]}>
                          Phone: {c.phone || "N/A"} • {c.city || c.state || "India"}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={isSelected ? activeColor : muted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Footer Confirm */}
            <View style={[styles.modalFooterConfirm, { borderTopColor: border }]}>
              <TouchableOpacity
                style={[styles.confirmCustomerBtn, { backgroundColor: isDark ? "#1E293B" : "#0F172A" }]}
                onPress={() => setCustomerModalVisible(false)}
              >
                <Text style={styles.confirmCustomerText}>Confirm Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── PRODUCT CATALOG PICKER MODAL ── */}
        <Modal visible={productPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProductPickerOpen(false)}>
          <View style={[styles.pickerModal, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
            <View style={[styles.header, { borderBottomColor: border }]}>
              <TouchableOpacity onPress={() => setProductPickerOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={muted} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: foreground }]}>Select Product</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchBarBox}>
              <View style={[styles.searchBarInner, { backgroundColor: cardBg, borderColor: border }]}>
                <Ionicons name="search-outline" size={18} color={muted} />
                <TextInput
                  style={[styles.searchInput, { color: foreground }]}
                  placeholder="Search products by name or SKU..."
                  placeholderTextColor={muted}
                  value={catalogSearch}
                  onChangeText={setCatalogSearch}
                />
              </View>
            </View>

            {catalogLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={activeColor} />
            ) : visibleCatalogProducts.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Ionicons name="cube-outline" size={32} color={muted} />
                <Text style={[styles.emptyItemsText, { color: muted }]}>No products found.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
                {visibleCatalogProducts.map((p) => {
                  const inStock = p.stock > 0;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.catalogPickItem, { borderBottomColor: border }]}
                      onPress={() => handleAddProduct(p)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: foreground }]}>{p.name}</Text>
                        <Text style={[styles.itemSku, { color: muted }]}>
                          {p.category} • SKU: {p.sku || "N/A"}
                        </Text>
                        <Text style={{ fontSize: 11, color: inStock ? activeColor : "#EF4444", marginTop: 2, fontFamily: Typography.bold }}>
                          Stock: {p.stock} In Inventory
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", marginRight: 10 }}>
                        <Text style={[styles.catalogPrice, { color: activeColor }]}>₹{intFormat(p.base_price)}</Text>
                        <Text style={[styles.catalogGst, { color: muted }]}>+18% GST</Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color={activeColor} />
                    </TouchableOpacity>
                  );
                })}
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
  scrollBody: { padding: 16, paddingBottom: 110 },
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
  selectCustomerBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  selectCustomerBigBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  partyBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  partyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  partyHeaderTitle: {
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  partyName: {
    fontSize: 14,
    fontFamily: Typography.bold,
    marginTop: 2,
  },
  partyDetail: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  partyPlaceholder: {
    fontSize: 12,
    fontFamily: Typography.regular,
    fontStyle: "italic",
    marginTop: 4,
  },
  removePartyBtn: {
    padding: 2,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  copyBtnText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  overdueAlert: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  overdueText: { fontSize: 11, color: "#F59E0B", fontFamily: Typography.medium },
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
    gap: 8,
  },
  emptyItemsText: { fontSize: 12, fontFamily: Typography.regular, textAlign: "center" },
  addFirstItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    marginTop: 4,
  },
  addFirstItemText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: { fontSize: 13, fontFamily: Typography.bold },
  itemSku: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  stockBadgeText: { fontSize: 10, fontFamily: Typography.bold },
  systemPriceText: { fontSize: 11, fontFamily: Typography.medium },
  itemInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  inputSubLabel: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
  },
  stepperBtn: {
    paddingHorizontal: 10,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  stepperInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontFamily: Typography.bold,
  },
  requestedPriceInput: {
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: Typography.medium,
  },
  lineTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  lineTotalLabel: { fontSize: 11, fontFamily: Typography.regular },
  lineTotalValue: { fontSize: 13, fontFamily: Typography.bold },
  trashBtn: { padding: 4 },
  addAnotherProductBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 6,
    marginTop: 4,
  },
  addAnotherProductText: { fontSize: 13, fontFamily: Typography.bold },
  courierEstimateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  courierEstimateLabel: { fontSize: 12, fontFamily: Typography.bold },
  courierEstimateValue: { fontSize: 14, fontFamily: Typography.bold },
  inputBox: {
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: Typography.regular,
  },
  textAreaBox: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 70,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Typography.regular,
    textAlignVertical: "top",
  },
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
  modalTabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  modalTabText: {
    fontSize: 12,
  },
  quickHelperBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickHelperText: { fontSize: 11, fontFamily: Typography.regular },
  quickHelperBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  quickHelperBtnText: {
    fontSize: 11,
    fontFamily: Typography.bold,
    color: "#06281E",
  },
  searchBarBox: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBarInner: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.regular,
  },
  customerPickItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
  },
  customerName: { fontSize: 14, fontFamily: Typography.bold },
  customerDetail: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  modalFooterConfirm: {
    padding: 16,
    borderTopWidth: 1,
  },
  confirmCustomerBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmCustomerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Typography.bold,
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
