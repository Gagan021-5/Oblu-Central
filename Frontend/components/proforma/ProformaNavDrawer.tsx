import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, Radius } from "@/constants/theme";
import { SubAppLogo } from "@/components/employee/SubAppLogo";
import type { ProformaPermissions, ProformaHubData } from "@/services/proformaService";

export type ProformaNavTab =
  | "overview"
  | "quotations"
  | "price_requests"
  | "stock_requests"
  | "dispatch_queue"
  | "warehouse_dispatch"
  | "catalog";

interface ProformaNavDrawerProps {
  visible: boolean;
  activeTab: ProformaNavTab;
  hubData: ProformaHubData | null;
  onClose: () => void;
  onSelectTab: (tab: ProformaNavTab) => void;
  onOpenCreateModal: (type: "proforma" | "quotation") => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

export function ProformaNavDrawer({
  visible,
  activeTab,
  hubData,
  onClose,
  onSelectTab,
  onOpenCreateModal,
}: ProformaNavDrawerProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase().includes("admin") || (user as any)?.is_superuser;

  const permissions: ProformaPermissions = hubData?.permissions || {
    can_create_proforma: true,
    can_create_quotation: true,
    can_view_proformas: true,
    can_view_quotations: true,
    can_view_products: true,
    can_approve_price_change: false,
    can_request_stock: true,
    can_manage_dispatch: false,
    can_warehouse_dispatch: false,
    can_manage_tiers: false,
    is_admin: false,
    is_accounts: false,
    is_warehouse: false,
  };

  const stats = hubData?.stats;

  const foreground = isDark ? "#F8FAFC" : "#101513";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#0C0E15" : "#FFFFFF";
  const itemBorder = isDark ? "rgba(255, 255, 255, 0.07)" : "#E2E8F0";
  const activeBg = isDark ? "rgba(16, 185, 129, 0.14)" : "#E6F7F0";
  const activeColor = "#10B981";

  const [modalVisible, setModalVisible] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (modalVisible) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible, modalVisible, anim]);

  const handleClose = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose, anim]);

  const handleSelect = (tab: ProformaNavTab) => {
    handleClose();
    onSelectTab(tab);
  };

  const handleCreate = (type: "proforma" | "quotation") => {
    handleClose();
    onOpenCreateModal(type);
  };

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const scrimOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!modalVisible && !visible) {
    return null;
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.frame}>
        {/* Animated Dim Glass Backdrop Overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.scrimBackdrop,
            { opacity: scrimOpacity },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="Close navigation drawer"
          />
        </Animated.View>

        {/* Drawer Panel Sliding in from the LEFT */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: bg,
              borderRightColor: itemBorder,
              paddingTop: Math.max(insets.top, 16),
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Brand Header */}
          <View style={[styles.brandRow, { borderBottomColor: itemBorder }]}>
            <SubAppLogo appId="proforma" size={42} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.brandTitle, { color: foreground }]}>OBLU</Text>
                <View style={styles.dot} />
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "#DDF4EA" },
                  ]}
                >
                  <Text style={styles.badgePillText}>PROFORMA & QUOTES</Text>
                </View>
              </View>
              <Text style={[styles.brandSubtitle, { color: muted }]}>
                Sales & Billing Workspace
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Close menu"
              onPress={handleClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Navigation Sections */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* ── 1. SALES & DOCUMENTS ── */}
            <Text style={[styles.sectionTitle, { color: muted }]}>SALES & DOCUMENTS</Text>

            {/* Main App Home */}
            <TouchableOpacity
              onPress={() => {
                handleClose();
                router.replace(isAdmin ? "/(admin)/users" : "/(employee)");
              }}
              style={styles.navEntry}
              activeOpacity={0.7}
            >
              <Ionicons name="apps-outline" size={19} color={muted} />
              <Text style={[styles.navText, { color: foreground }]}>Main Home</Text>
              <Ionicons name="chevron-forward" size={16} color={muted} />
            </TouchableOpacity>

            {/* Proforma Invoices */}
            {permissions.can_view_proformas && (
              <TouchableOpacity
                onPress={() => handleSelect("overview")}
                style={[
                  styles.navEntry,
                  activeTab === "overview" && { backgroundColor: activeBg },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="document-text-outline"
                  size={19}
                  color={activeTab === "overview" ? activeColor : muted}
                />
                <Text
                  style={[
                    styles.navText,
                    { color: activeTab === "overview" ? activeColor : foreground },
                  ]}
                >
                  Proforma Invoices
                </Text>
                {Boolean(stats?.total_proformas) && (
                  <View style={[styles.countBadge, { backgroundColor: isDark ? "#161B26" : "#F1F5F9" }]}>
                    <Text style={[styles.countText, { color: muted }]}>{stats?.total_proformas}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Quotations */}
            {permissions.can_view_quotations && (
              <TouchableOpacity
                onPress={() => handleSelect("quotations")}
                style={[
                  styles.navEntry,
                  activeTab === "quotations" && { backgroundColor: activeBg },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="receipt-outline"
                  size={19}
                  color={activeTab === "quotations" ? activeColor : muted}
                />
                <Text
                  style={[
                    styles.navText,
                    { color: activeTab === "quotations" ? activeColor : foreground },
                  ]}
                >
                  Quotations
                </Text>
                {Boolean(stats?.total_quotations) && (
                  <View style={[styles.countBadge, { backgroundColor: isDark ? "#161B26" : "#F1F5F9" }]}>
                    <Text style={[styles.countText, { color: muted }]}>{stats?.total_quotations}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Quick Actions (Create PI / Quotation) */}
            {permissions.can_create_proforma && (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: activeColor }]}
                  onPress={() => handleCreate("proforma")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={18} color="#06281E" />
                  <Text style={styles.createBtnText}>Create New PI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.createOutlineBtn,
                    {
                      borderColor: isDark ? "rgba(16, 185, 129, 0.4)" : "#10B981",
                      backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "#F0FDF4",
                    },
                  ]}
                  onPress={() => handleCreate("quotation")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="document" size={16} color={activeColor} />
                  <Text style={[styles.createOutlineText, { color: activeColor }]}>Create Quotation</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── 2. CATALOG & PRICING ── */}
            {permissions.can_view_products && (
              <>
                <Text style={[styles.sectionTitle, { color: muted, marginTop: 18 }]}>PRODUCT CATALOG</Text>
                <TouchableOpacity
                  onPress={() => handleSelect("catalog")}
                  style={[
                    styles.navEntry,
                    activeTab === "catalog" && { backgroundColor: activeBg },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="pricetags-outline"
                    size={19}
                    color={activeTab === "catalog" ? activeColor : muted}
                  />
                  <Text
                    style={[
                      styles.navText,
                      { color: activeTab === "catalog" ? activeColor : foreground },
                    ]}
                  >
                    View Products & Pricing Tiers
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── 3. APPROVALS & SHORTAGES ── */}
            <Text style={[styles.sectionTitle, { color: muted, marginTop: 18 }]}>APPROVALS & REQUESTS</Text>

            {/* Price Change Requests */}
            {permissions.can_approve_price_change && (
              <TouchableOpacity
                onPress={() => handleSelect("price_requests")}
                style={[
                  styles.navEntry,
                  activeTab === "price_requests" && { backgroundColor: activeBg },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="trending-down-outline"
                  size={19}
                  color={activeTab === "price_requests" ? activeColor : muted}
                />
                <Text
                  style={[
                    styles.navText,
                    { color: activeTab === "price_requests" ? activeColor : foreground },
                  ]}
                >
                  Price Change Requests
                </Text>
                {Boolean(stats?.pending_price_requests) && (
                  <View style={[styles.countBadge, { backgroundColor: "#F59E0B" }]}>
                    <Text style={[styles.countText, { color: "#000" }]}>{stats?.pending_price_requests}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Stock Shortage Requests */}
            {permissions.can_request_stock && (
              <TouchableOpacity
                onPress={() => handleSelect("stock_requests")}
                style={[
                  styles.navEntry,
                  activeTab === "stock_requests" && { backgroundColor: activeBg },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="cube-outline"
                  size={19}
                  color={activeTab === "stock_requests" ? activeColor : muted}
                />
                <Text
                  style={[
                    styles.navText,
                    { color: activeTab === "stock_requests" ? activeColor : foreground },
                  ]}
                >
                  Stock Qty Requests
                </Text>
                {Boolean(stats?.pending_stock_requests) && (
                  <View style={[styles.countBadge, { backgroundColor: "#EF4444" }]}>
                    <Text style={[styles.countText, { color: "#FFF" }]}>{stats?.pending_stock_requests}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* ── 4. LOGISTICS & DISPATCH ── */}
            {(permissions.can_manage_dispatch || permissions.can_warehouse_dispatch) && (
              <>
                <Text style={[styles.sectionTitle, { color: muted, marginTop: 18 }]}>LOGISTICS & WAREHOUSE</Text>

                {/* Accounts Dispatch Queue */}
                {permissions.can_manage_dispatch && (
                  <TouchableOpacity
                    onPress={() => handleSelect("dispatch_queue")}
                    style={[
                      styles.navEntry,
                      activeTab === "dispatch_queue" && { backgroundColor: activeBg },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="airplane-outline"
                      size={19}
                      color={activeTab === "dispatch_queue" ? activeColor : muted}
                    />
                    <Text
                      style={[
                        styles.navText,
                        { color: activeTab === "dispatch_queue" ? activeColor : foreground },
                      ]}
                    >
                      Dispatch Dashboard (Accounts)
                    </Text>
                    {Boolean(stats?.pending_dispatch) && (
                      <View style={[styles.countBadge, { backgroundColor: isDark ? "#1E2536" : "#E2E8F0" }]}>
                        <Text style={[styles.countText, { color: activeColor }]}>{stats?.pending_dispatch}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Warehouse Dispatch Execution */}
                {permissions.can_warehouse_dispatch && (
                  <TouchableOpacity
                    onPress={() => handleSelect("warehouse_dispatch")}
                    style={[
                      styles.navEntry,
                      activeTab === "warehouse_dispatch" && { backgroundColor: activeBg },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={19}
                      color={activeTab === "warehouse_dispatch" ? activeColor : muted}
                    />
                    <Text
                      style={[
                        styles.navText,
                        { color: activeTab === "warehouse_dispatch" ? activeColor : foreground },
                      ]}
                    >
                      Warehouse Execution & Camera
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    flexDirection: "row",
  },
  scrimBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  drawer: {
    height: "100%",
    paddingHorizontal: 16,
    borderRightWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  brandTitle: {
    fontFamily: Typography.bold,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#10B981",
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 9,
    fontFamily: Typography.bold,
    color: "#10B981",
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  navEntry: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  navText: {
    fontSize: 13,
    fontFamily: Typography.medium,
    marginLeft: 10,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 10,
    fontFamily: Typography.bold,
  },
  actionButtonGroup: {
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  createBtnText: {
    color: "#06281E",
    fontFamily: Typography.bold,
    fontSize: 13,
  },
  createOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  createOutlineText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
});
