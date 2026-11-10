import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";

interface CategoryOption {
  id: number;
  name: string;
}

interface AddProductModalProps {
  visible: boolean;
  onClose: () => void;
  onProductCreated: (item?: any) => void;
}

const COMMON_UNITS = ["PCS", "NOS", "BOX", "ROLL", "KG", "SET", "LTR"];

export function AddProductModal({ visible, onClose, onProductCreated }: AddProductModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [unit, setUnit] = useState("PCS");
  const [quantity, setQuantity] = useState("0");
  const [minThreshold, setMinThreshold] = useState("10");
  const [deliveryDays, setDeliveryDays] = useState("7");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load available categories when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadCategories();
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setName("");
    setSelectedCategoryId(null);
    setCustomCategory("");
    setUnit("PCS");
    setQuantity("0");
    setMinThreshold("10");
    setDeliveryDays("7");
    setMinOrderQty("1");
    setErrorMsg(null);
  };

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await api.get("/inventory/categories/");
      if (res.data?.status === "success" && Array.isArray(res.data.categories)) {
        setCategories(
          res.data.categories.map((c: any) => ({
            id: c.id,
            name: c.name,
          }))
        );
      }
    } catch {
      // Non-critical, fallback to empty
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter a valid product name.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload = {
        name: trimmedName,
        category_id: selectedCategoryId || null,
        category_name: customCategory.trim() || undefined,
        unit: unit.trim().toUpperCase() || "PCS",
        quantity: parseFloat(quantity) || 0,
        min_quantity: parseFloat(minThreshold) || 0,
        expected_delivery_days: parseInt(deliveryDays, 10) || 7,
        minimum_order_quantity: parseFloat(minOrderQty) || 1,
      };

      const res = await api.post("/inventory/items/", payload);
      if (res.data?.status === "success" || res.status === 201) {
        Alert.alert("Success", "Product created successfully!");
        onProductCreated(res.data?.item);
        onClose();
      } else {
        setErrorMsg(res.data?.message || "Failed to create product");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || "An error occurred";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const cardBorder = isDark ? "#1E332D" : "#E2E8F0";
  const inputBg = isDark ? "#0A1310" : "#F8FAFC";
  const inputBorder = isDark ? "#1E332D" : "#E2E8F0";
  const foreground = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: cardBorder, backgroundColor: cardBg }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? "rgba(0,168,121,0.15)" : "#DDF4EA" }]}>
                <Ionicons name="cube-outline" size={20} color="#00A879" />
              </View>
              <View>
                <Text style={[styles.title, { color: foreground }]}>Add New Product</Text>
                <Text style={[styles.subtitle, { color: muted }]}>Create a tracked inventory item</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? "#1E332D" : "#F1F5F9" }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={foreground} />
            </TouchableOpacity>
          </View>

          {/* Form Scroll */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Product Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: foreground }]}>
                Product Name <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: foreground }]}
                placeholder="e.g. Anycubic Photon Mono M5s"
                placeholderTextColor={muted}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Category Selection */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: foreground }]}>Category</Text>
              {loadingCategories ? (
                <ActivityIndicator size="small" color="#00A879" style={{ marginVertical: 8 }} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  <TouchableOpacity
                    onPress={() => setSelectedCategoryId(null)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selectedCategoryId === null ? "#00A879" : inputBg,
                        borderColor: selectedCategoryId === null ? "#00A879" : inputBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selectedCategoryId === null ? "#FFFFFF" : foreground },
                      ]}
                    >
                      None / Unassigned
                    </Text>
                  </TouchableOpacity>

                  {categories.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setSelectedCategoryId(cat.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? "#00A879" : inputBg,
                            borderColor: isSelected ? "#00A879" : inputBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? "#FFFFFF" : foreground },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Unit Selection */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: foreground }]}>Unit of Measurement</Text>
              <View style={styles.unitRow}>
                {COMMON_UNITS.map((u) => {
                  const isSelected = unit === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[
                        styles.unitPill,
                        {
                          backgroundColor: isSelected ? "#00A879" : inputBg,
                          borderColor: isSelected ? "#00A879" : inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitPillText,
                          { color: isSelected ? "#FFFFFF" : foreground },
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Current Stock & Min Threshold */}
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: foreground }]}>Current Stock</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: foreground }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={muted}
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: foreground }]}>Min Threshold</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: foreground }]}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={muted}
                  value={minThreshold}
                  onChangeText={setMinThreshold}
                />
              </View>
            </View>

            {/* Expected Delivery & Min Order Qty */}
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: foreground }]}>Lead Time (Days)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: foreground }]}
                  keyboardType="numeric"
                  placeholder="7"
                  placeholderTextColor={muted}
                  value={deliveryDays}
                  onChangeText={setDeliveryDays}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: foreground }]}>Min Order Qty</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: foreground }]}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={muted}
                  value={minOrderQty}
                  onChangeText={setMinOrderQty}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.submitBtn,
                { opacity: submitting ? 0.7 : 1 },
              ]}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Create Product</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "85%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Typography.regular,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 18,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontFamily: Typography.medium,
    flex: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: Typography.semiBold,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Typography.regular,
  },
  categoryScroll: {
    flexDirection: "row",
    marginVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  unitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  unitPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  unitPillText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  submitBtn: {
    backgroundColor: "#00A879",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: Radius.md,
    marginTop: 8,
    ...Shadows.card,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: Typography.bold,
  },
});
