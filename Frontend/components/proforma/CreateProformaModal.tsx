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
  const [sameAsBilling, setSameAsBilling] = useState(true);

  // Picker Modal State
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

  // Theme tokens - True Oblu Emerald / Mint palette
  const bg = isDark ? "#090B10" : "#F4F6FA";
  const cardBg = isDark ? "#12151E" : "#FFFFFF";
  const surfaceAlt = isDark ? "#1A1E2B" : "#F1F5F9";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0";
  const foreground = isDark ? "#F8FAFC" : "#101513";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const emeraldPrimary = "#10B981";
  const emeraldDark = "#159A7C";
  const mintSurface = isDark ? "rgba(16, 185, 129, 0.12)" : "#EBF7F3";
  const mintBorder = isDark ? "#2D493F" : "#D1EBE2";
  const amberAccent = "#F59E0B";

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

  // Live Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let gst = 0;

    items.forEach((item) => {
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

  const handleOpenPicker = (target: "billing" | "shipping") => {
    triggerSelectionHaptic();
    setActivePickerTarget(target);
    setCustomerSearchQuery("");
    setCustomerModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!selectedBilling) {
      Alert.alert("Missing Billing Customer", "Please select a billing customer.");
      return;
    }
    if (items.length === 0) {
      Alert.alert("No Line Items", "Please add at least one product item.");
      return;
    }

    setSubmitting(true);
    try {
      const shippingCust = sameAsBilling ? selectedBilling : (selectedShipping || selectedBilling);
      const payload = {
        doc_type: currentDocType,
        customer_id: selectedBilling.id,
        shipping_customer_id: shippingCust.id,
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
              {currentDocType === "quotation" ? "Create Quotation" : "Create Proforma Invoice"}
            </Text>
            <Text style={[styles.subtitle, { color: muted }]}>Customer billing, shipping & products</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Document Type Switcher */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>DOCUMENT TYPE</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  currentDocType === "quotation" && { backgroundColor: emeraldPrimary },
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
                  currentDocType === "proforma" && { backgroundColor: emeraldPrimary },
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

          {/* ── 1. CUSTOMER & SHIPPING CARDS (Mobile Theme) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>CUSTOMER & SHIPPING</Text>

            {/* Billing Customer Row */}
            <Text style={[styles.inputSubLabel, { color: muted }]}>BILLING CUSTOMER *</Text>
            {selectedBilling ? (
              <View style={[styles.partyCard, { backgroundColor: mintSurface, borderColor: mintBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partyName, { color: foreground }]}>{selectedBilling.name}</Text>
                  {selectedBilling.address ? (
                    <Text style={[styles.partyDetail, { color: muted }]}>Addr: {selectedBilling.address}</Text>
                  ) : null}
                  <Text style={[styles.partyDetail, { color: muted }]}>
                    Phone: {selectedBilling.phone || "N/A"} {selectedBilling.city ? `• ${selectedBilling.city}` : ""}
                  </Text>
                  {selectedBilling.gstin ? (
                    <Text style={[styles.partyDetail, { color: muted }]}>GSTIN: {selectedBilling.gstin}</Text>
                  ) : null}
                  {selectedBilling.has_overdue && (
                    <View style={styles.overdueAlert}>
                      <Ionicons name="warning-outline" size={13} color={amberAccent} />
                      <Text style={styles.overdueText}>Customer has overdue invoices in Tally</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleOpenPicker("billing")} style={styles.changeActionBtn}>
                  <Text style={[styles.changeActionText, { color: emeraldDark }]}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.partyPickerEmptyBtn, { borderColor: mintBorder, backgroundColor: mintSurface }]}
                onPress={() => handleOpenPicker("billing")}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#D1EBE2" }]}>
                  <Ionicons name="card-outline" size={18} color={emeraldDark} />
                </View>
                <Text style={[styles.partyPickerEmptyText, { color: emeraldDark }]}>Select Billing Customer...</Text>
                <Ionicons name="chevron-forward" size={16} color={emeraldDark} />
              </TouchableOpacity>
            )}

            {/* Shipping Customer Row */}
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={[styles.inputSubLabel, { color: muted, marginBottom: 0 }]}>SHIPPING DESTINATION</Text>
                {selectedBilling && (
                  <TouchableOpacity
                    onPress={() => {
                      triggerLightHaptic();
                      setSameAsBilling(!sameAsBilling);
                      if (!sameAsBilling) {
                        setSelectedShipping(selectedBilling);
                      }
                    }}
                    style={[
                      styles.togglePill,
                      {
                        backgroundColor: sameAsBilling ? mintSurface : surfaceAlt,
                        borderColor: sameAsBilling ? mintBorder : border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={sameAsBilling ? "checkbox" : "square-outline"}
                      size={14}
                      color={sameAsBilling ? emeraldDark : muted}
                    />
                    <Text style={[styles.togglePillText, { color: sameAsBilling ? emeraldDark : muted }]}>
                      Same as Billing
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {sameAsBilling && selectedBilling ? (
                <View style={[styles.partyCard, { backgroundColor: surfaceAlt, borderColor: border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.partyName, { color: foreground }]}>{selectedBilling.name}</Text>
                    <Text style={[styles.partyDetail, { color: muted }]}>
                      Using primary billing address for shipping & courier dispatch.
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={emeraldPrimary} />
                </View>
              ) : selectedShipping ? (
                <View style={[styles.partyCard, { backgroundColor: mintSurface, borderColor: mintBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.partyName, { color: foreground }]}>{selectedShipping.name}</Text>
                    {selectedShipping.address ? (
                      <Text style={[styles.partyDetail, { color: muted }]}>Addr: {selectedShipping.address}</Text>
                    ) : null}
                    <Text style={[styles.partyDetail, { color: muted }]}>
                      Phone: {selectedShipping.phone || "N/A"} {selectedShipping.city ? `• ${selectedShipping.city}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleOpenPicker("shipping")} style={styles.changeActionBtn}>
                    <Text style={[styles.changeActionText, { color: emeraldDark }]}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.partyPickerEmptyBtn, { borderColor: border, backgroundColor: surfaceAlt }]}
                  onPress={() => handleOpenPicker("shipping")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? "#242938" : "#E2E8F0" }]}>
                    <Ionicons name="location-outline" size={18} color={muted} />
                  </View>
                  <Text style={[styles.partyPickerEmptyText, { color: muted }]}>Select Shipping Destination...</Text>
                  <Ionicons name="chevron-forward" size={16} color={muted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── 2. LINE ITEMS (Mobile Theme) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.label, { color: muted, marginBottom: 0 }]}>
                {currentDocType === "quotation" ? "QUOTATION ITEMS" : "INVOICE ITEMS"} ({items.length})
              </Text>
              <TouchableOpacity
                onPress={() => setProductPickerOpen(true)}
                style={[styles.addItemsPill, { backgroundColor: mintSurface, borderColor: mintBorder }]}
              >
                <Ionicons name="add" size={16} color={emeraldDark} />
                <Text style={[styles.addItemsPillText, { color: emeraldDark }]}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Ionicons name="cart-outline" size={32} color={muted} />
                <Text style={[styles.emptyItemsText, { color: muted }]}>No products added yet.</Text>
                <TouchableOpacity
                  style={[styles.addFirstBtn, { backgroundColor: emeraldPrimary }]}
                  onPress={() => setProductPickerOpen(true)}
                >
                  <Ionicons name="add-circle" size={16} color="#06281E" />
                  <Text style={styles.addFirstBtnText}>Add Product</Text>
                </TouchableOpacity>
              </View>
            ) : (
              items.map((item, idx) => {
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
                const isCustomPrice = item.requestedPrice !== undefined && item.requestedPrice !== tierPrice;
                const inStock = item.product.stock > 0;

                return (
                  <View key={`${item.product.id}-${idx}`} style={[styles.itemCard, { borderColor: border, backgroundColor: surfaceAlt }]}>
                    <View style={styles.itemTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: foreground }]}>{item.product.name}</Text>
                        <Text style={[styles.itemSku, { color: muted }]}>
                          {item.product.category} • SKU: {item.product.sku || "N/A"}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={styles.trashBtn}>
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Stock & System Price Status */}
                    <View style={styles.itemMetaRow}>
                      <View style={[styles.stockPill, { backgroundColor: inStock ? mintSurface : "rgba(239, 68, 68, 0.12)" }]}>
                        <Ionicons name={inStock ? "checkmark-circle" : "alert-circle"} size={12} color={inStock ? emeraldDark : "#EF4444"} />
                        <Text style={[styles.stockPillText, { color: inStock ? emeraldDark : "#EF4444" }]}>
                          {item.product.stock} in inventory
                        </Text>
                      </View>
                      <Text style={[styles.systemPriceText, { color: muted }]}>
                        Tier Price: ₹{intFormat(tierPrice)}
                      </Text>
                    </View>

                    {/* Qty Stepper & Requested Price */}
                    <View style={styles.inputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputSubLabel, { color: muted }]}>ORDER QTY</Text>
                        <View style={[styles.stepperContainer, { borderColor: border, backgroundColor: cardBg }]}>
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

                      <View style={{ flex: 1.2, marginLeft: 10 }}>
                        <Text style={[styles.inputSubLabel, { color: muted }]}>REQUESTED PRICE</Text>
                        <TextInput
                          style={[
                            styles.priceInputBox,
                            {
                              color: foreground,
                              borderColor: isCustomPrice ? amberAccent : border,
                              backgroundColor: cardBg,
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
                      <Text style={[styles.lineTotalLabel, { color: muted }]}>Total ({item.quantity} × ₹{intFormat(effectivePrice)}):</Text>
                      <Text style={[styles.lineTotalValue, { color: emeraldPrimary }]}>
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
                style={[styles.addAnotherBtn, { borderColor: mintBorder, backgroundColor: mintSurface }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={emeraldDark} />
                <Text style={[styles.addAnotherBtnText, { color: emeraldDark }]}>
                  Add Another Product
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── 3. COURIER MODE (Mobile Theme) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>COURIER MODE</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  courierMode === "surface" && { backgroundColor: emeraldPrimary },
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
                  courierMode === "air" && { backgroundColor: emeraldPrimary },
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

          {/* ── 4. PRICE & COURIER REQUEST (REMARKS) ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>PRICE & COURIER REQUEST (OPTIONAL)</Text>

            <View style={styles.courierRow}>
              <Text style={[styles.courierRowLabel, { color: muted }]}>Approximate Courier:</Text>
              <Text style={[styles.courierRowVal, { color: emeraldPrimary }]}>
                ₹{intFormat(calculations.courier)}
              </Text>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={[styles.inputSubLabel, { color: muted }]}>REQUESTED COURIER CHARGE (₹)</Text>
              <TextInput
                style={[styles.inputField, { color: foreground, borderColor: border, backgroundColor: surfaceAlt }]}
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
                style={[styles.textAreaField, { color: foreground, borderColor: border, backgroundColor: surfaceAlt }]}
                multiline
                numberOfLines={3}
                placeholder="Explain discount, volume deal, client agreement..."
                placeholderTextColor={muted}
                value={requestReason}
                onChangeText={setRequestReason}
              />
            </View>
          </View>

          {/* ── 5. ORDER SUMMARY ── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.label, { color: muted }]}>ORDER SUMMARY</Text>

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
              <Text style={[styles.grandVal, { color: emeraldPrimary }]}>₹{intFormat(calculations.grandTotal)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Floating Submit Footer */}
        <View style={[styles.footerBar, { borderTopColor: border, paddingBottom: Math.max(insets.bottom, 14) }]}>
          <TouchableOpacity
            style={[styles.submitActionBtn, { backgroundColor: emeraldPrimary }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#06281E" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#06281E" />
                <Text style={styles.submitActionBtnText}>
                  {currentDocType === "quotation" ? "Save Quotation" : "Save Proforma Invoice"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── CUSTOMER PICKER MODAL (Mobile Theme) ── */}
        <Modal visible={customerModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCustomerModalVisible(false)}>
          <View style={[styles.pickerModal, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
            <View style={[styles.header, { borderBottomColor: border }]}>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={muted} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.title, { color: foreground }]}>
                  {activePickerTarget === "billing" ? "Select Billing Customer" : "Select Shipping Destination"}
                </Text>
                <Text style={[styles.subtitle, { color: muted }]}>Choose from CRM account directory</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCustomerModalVisible(false)}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ fontSize: 13, fontFamily: Typography.bold, color: emeraldDark }}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Target Tab Switcher */}
            <View style={[styles.modalTabRow, { borderBottomColor: border }]}>
              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  activePickerTarget === "billing" && { borderBottomColor: emeraldDark, borderBottomWidth: 2 },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setActivePickerTarget("billing");
                }}
              >
                <Ionicons name="card-outline" size={15} color={activePickerTarget === "billing" ? emeraldDark : muted} />
                <Text
                  style={[
                    styles.modalTabText,
                    { color: activePickerTarget === "billing" ? emeraldDark : muted, fontFamily: Typography.bold },
                  ]}
                >
                  Billing: {selectedBilling ? selectedBilling.name.slice(0, 14) : "None"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  activePickerTarget === "shipping" && { borderBottomColor: emeraldDark, borderBottomWidth: 2 },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setActivePickerTarget("shipping");
                }}
              >
                <Ionicons name="location-outline" size={15} color={activePickerTarget === "shipping" ? emeraldDark : muted} />
                <Text
                  style={[
                    styles.modalTabText,
                    { color: activePickerTarget === "shipping" ? emeraldDark : muted, fontFamily: Typography.bold },
                  ]}
                >
                  Shipping: {selectedShipping ? selectedShipping.name.slice(0, 14) : "None"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View style={styles.searchBarBox}>
              <View style={[styles.searchBarInner, { backgroundColor: surfaceAlt, borderColor: border }]}>
                <Ionicons name="search-outline" size={18} color={muted} />
                <TextInput
                  style={[styles.searchInput, { color: foreground }]}
                  placeholder="Search by name, phone, city, ID..."
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

            {/* List */}
            {customersLoading && allCustomers.length === 0 ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={emeraldPrimary} />
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
                          backgroundColor: isSelected ? mintSurface : "transparent",
                        },
                      ]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        if (activePickerTarget === "billing") {
                          setSelectedBilling(c);
                          if (sameAsBilling || !selectedShipping) {
                            setSelectedShipping(c);
                          }
                        } else {
                          setSelectedShipping(c);
                          setSameAsBilling(false);
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
                        color={isSelected ? emeraldPrimary : muted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={[styles.modalFooterConfirm, { borderTopColor: border }]}>
              <TouchableOpacity
                style={[styles.confirmCustomerBtn, { backgroundColor: emeraldPrimary }]}
                onPress={() => setCustomerModalVisible(false)}
              >
                <Text style={styles.confirmCustomerText}>Confirm Customer Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── PRODUCT CATALOG PICKER MODAL (Mobile Theme) ── */}
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
              <View style={[styles.searchBarInner, { backgroundColor: surfaceAlt, borderColor: border }]}>
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
              <ActivityIndicator style={{ marginTop: 40 }} color={emeraldPrimary} />
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
                        <Text style={{ fontSize: 11, color: inStock ? emeraldDark : "#EF4444", marginTop: 2, fontFamily: Typography.bold }}>
                          Stock: {p.stock} In Inventory
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", marginRight: 10 }}>
                        <Text style={[styles.catalogPrice, { color: emeraldDark }]}>₹{intFormat(p.base_price)}</Text>
                        <Text style={[styles.catalogGst, { color: muted }]}>+18% GST</Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color={emeraldPrimary} />
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
    backgroundColor: "rgba(128, 128, 128, 0.08)",
  },
  segmentText: { fontSize: 11, fontFamily: Typography.semiBold },
  inputSubLabel: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  partyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  partyName: { fontSize: 14, fontFamily: Typography.bold },
  partyDetail: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  changeActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeActionText: { fontSize: 12, fontFamily: Typography.bold },
  partyPickerEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  partyPickerEmptyText: { flex: 1, fontSize: 13, fontFamily: Typography.medium },
  togglePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  togglePillText: { fontSize: 11, fontFamily: Typography.bold },
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
  addItemsPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  addItemsPillText: { fontSize: 12, fontFamily: Typography.bold },
  emptyItemsBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyItemsText: { fontSize: 12, fontFamily: Typography.regular, textAlign: "center" },
  addFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    marginTop: 4,
  },
  addFirstBtnText: {
    color: "#06281E",
    fontSize: 12,
    fontFamily: Typography.bold,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: { fontSize: 13, fontFamily: Typography.bold },
  itemSku: { fontSize: 11, fontFamily: Typography.regular, marginTop: 2 },
  itemMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  stockPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  stockPillText: { fontSize: 10, fontFamily: Typography.bold },
  systemPriceText: { fontSize: 11, fontFamily: Typography.medium },
  inputsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
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
  priceInputBox: {
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
  addAnotherBtn: {
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
  addAnotherBtnText: { fontSize: 13, fontFamily: Typography.bold },
  courierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  courierRowLabel: { fontSize: 12, fontFamily: Typography.bold },
  courierRowVal: { fontSize: 14, fontFamily: Typography.bold },
  inputField: {
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: Typography.regular,
  },
  textAreaField: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 65,
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
  submitActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  submitActionBtnText: {
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
  modalTabText: { fontSize: 12 },
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
    paddingHorizontal: 10,
    borderRadius: 10,
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
    color: "#06281E",
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
