import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Typography, Radius } from "@/constants/theme";
import { InventoryNavTab } from "./InventoryMainScreen";

interface InventoryNavDrawerProps {
  visible: boolean;
  activeTab: InventoryNavTab;
  catalogCount?: number;
  lowStockCount?: number;
  deadStockCount?: number;
  onClose: () => void;
  onSelectTab: (tab: InventoryNavTab) => void;
  onOpenAddProduct: () => void;
  onSearchSubmit?: (query: string) => void;
}

export function InventoryNavDrawer({
  visible,
  activeTab,
  catalogCount = 793,
  lowStockCount = 0,
  deadStockCount = 0,
  onClose,
  onSelectTab,
  onOpenAddProduct,
  onSearchSubmit,
}: InventoryNavDrawerProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [catalogExpanded, setCatalogExpanded] = useState(true);
  const [drawerSearch, setDrawerSearch] = useState("");

  const foreground = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#0A1310" : "#FFFFFF";
  const itemBorder = isDark ? "#1E332D" : "#E2E8F0";

  const handleSelect = (tab: InventoryNavTab) => {
    onClose();
    onSelectTab(tab);
  };

  const handleSearchCommit = () => {
    if (drawerSearch.trim() && onSearchSubmit) {
      onClose();
      onSearchSubmit(drawerSearch.trim());
      onSelectTab("catalog");
    }
  };

  const userInitials = (user?.name || user?.username || user?.email || "User")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.frame}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.drawer, { backgroundColor: bg, paddingTop: Math.max(insets.top, 16) }]}>
          {/* Brand Header */}
          <View style={[styles.brandRow, { borderBottomColor: itemBorder }]}>
            <View style={styles.logo}>
              <Image
                source={require("@/assets/images/logo.webp")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.brandTitle, { color: foreground }]}>OBLU</Text>
                <View style={styles.dot} />
                <View style={[styles.badgePill, { backgroundColor: isDark ? "rgba(0,168,121,0.2)" : "#DDF4EA" }]}>
                  <Text style={styles.badgePillText}>INVENTORY</Text>
                </View>
              </View>
              <Text style={[styles.brandSubtitle, { color: muted }]}>Warehouse Telemetry</Text>
            </View>
            <TouchableOpacity accessibilityLabel="Close menu" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Quick Search */}
          <View style={[styles.searchBox, { backgroundColor: isDark ? "#111D19" : "#F8FAFC", borderColor: itemBorder }]}>
            <Ionicons name="search" size={16} color={muted} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search catalog..."
              placeholderTextColor={muted}
              value={drawerSearch}
              onChangeText={setDrawerSearch}
              onSubmitEditing={handleSearchCommit}
              returnKeyType="search"
              style={[styles.searchInput, { color: foreground }]}
            />
            {drawerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setDrawerSearch("")}>
                <Ionicons name="close-circle" size={16} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Scrollable Navigation Sections */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* ── CORE OPERATIONS ── */}
            <Text style={[styles.sectionTitle, { color: muted }]}>CORE OPERATIONS</Text>

            {/* Executive Dashboard */}
            <TouchableOpacity
              onPress={() => handleSelect("overview")}
              style={[
                styles.navEntry,
                activeTab === "overview" && {
                  backgroundColor: isDark ? "rgba(0,168,121,0.15)" : "#DDF4EA",
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="speedometer-outline"
                size={18}
                color={activeTab === "overview" ? "#00A879" : muted}
              />
              <Text
                style={[
                  styles.navEntryText,
                  { color: activeTab === "overview" ? foreground : muted },
                  activeTab === "overview" && { fontFamily: Typography.bold },
                ]}
              >
                Executive Dashboard
              </Text>
              {activeTab === "overview" ? (
                <View style={styles.activeDot} />
              ) : (
                <Ionicons name="chevron-forward" size={14} color={muted} />
              )}
            </TouchableOpacity>

            {/* Catalog & Stock Accordion */}
            <TouchableOpacity
              onPress={() => setCatalogExpanded(!catalogExpanded)}
              style={[
                styles.navEntry,
                (activeTab === "catalog" ||
                  activeTab === "categories" ||
                  activeTab === "low_stock" ||
                  activeTab === "dead_stock") && {
                  backgroundColor: isDark ? "rgba(0,168,121,0.08)" : "#F0FDF4",
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="cube-outline" size={18} color={muted} />
              <Text style={[styles.navEntryText, { color: foreground }]}>Catalog & Stock</Text>
              <View style={[styles.countBadge, { backgroundColor: isDark ? "#1E332D" : "#E2E8F0" }]}>
                <Text style={[styles.countBadgeText, { color: muted }]}>{catalogCount}+</Text>
              </View>
              <Ionicons
                name={catalogExpanded ? "chevron-down" : "chevron-forward"}
                size={14}
                color={muted}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>

            {/* Sub-menu items under Catalog & Stock */}
            {catalogExpanded && (
              <View style={styles.subMenuList}>
                {/* All Products */}
                <TouchableOpacity
                  onPress={() => handleSelect("catalog")}
                  style={[
                    styles.subEntry,
                    activeTab === "catalog" && {
                      backgroundColor: isDark ? "rgba(0,168,121,0.15)" : "#DDF4EA",
                    },
                  ]}
                >
                  <Ionicons
                    name="albums-outline"
                    size={16}
                    color={activeTab === "catalog" ? "#00A879" : muted}
                  />
                  <Text
                    style={[
                      styles.subEntryText,
                      { color: activeTab === "catalog" ? foreground : muted },
                      activeTab === "catalog" && { fontFamily: Typography.bold },
                    ]}
                  >
                    All Products
                  </Text>
                </TouchableOpacity>

                {/* Categories */}
                <TouchableOpacity
                  onPress={() => handleSelect("categories")}
                  style={[
                    styles.subEntry,
                    activeTab === "categories" && {
                      backgroundColor: isDark ? "rgba(0,168,121,0.15)" : "#DDF4EA",
                    },
                  ]}
                >
                  <Ionicons
                    name="pricetags-outline"
                    size={16}
                    color={activeTab === "categories" ? "#00A879" : muted}
                  />
                  <Text
                    style={[
                      styles.subEntryText,
                      { color: activeTab === "categories" ? foreground : muted },
                      activeTab === "categories" && { fontFamily: Typography.bold },
                    ]}
                  >
                    Categories
                  </Text>
                </TouchableOpacity>

                {/* Add New Item */}
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onOpenAddProduct();
                  }}
                  style={styles.subEntry}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#00A879" />
                  <Text style={[styles.subEntryText, { color: "#00A879", fontFamily: Typography.semiBold }]}>
                    + Add New Item
                  </Text>
                </TouchableOpacity>

                {/* Low Stock Alerts */}
                <TouchableOpacity
                  onPress={() => handleSelect("low_stock")}
                  style={[
                    styles.subEntry,
                    activeTab === "low_stock" && {
                      backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7",
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={activeTab === "low_stock" ? "#F59E0B" : "#F59E0B"}
                  />
                  <Text
                    style={[
                      styles.subEntryText,
                      { color: activeTab === "low_stock" ? foreground : muted },
                      activeTab === "low_stock" && { fontFamily: Typography.bold },
                    ]}
                  >
                    Low Stock Alerts
                  </Text>
                  {lowStockCount > 0 && (
                    <View style={[styles.alertCountBadge, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
                      <Text style={styles.alertCountText}>{lowStockCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Dead Stock */}
                <TouchableOpacity
                  onPress={() => handleSelect("dead_stock")}
                  style={[
                    styles.subEntry,
                    activeTab === "dead_stock" && {
                      backgroundColor: isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9",
                    },
                  ]}
                >
                  <Ionicons
                    name="hourglass-outline"
                    size={16}
                    color={activeTab === "dead_stock" ? "#64748B" : muted}
                  />
                  <Text
                    style={[
                      styles.subEntryText,
                      { color: activeTab === "dead_stock" ? foreground : muted },
                      activeTab === "dead_stock" && { fontFamily: Typography.bold },
                    ]}
                  >
                    Dead Stock
                  </Text>
                  {deadStockCount > 0 && (
                    <View style={[styles.alertCountBadge, { backgroundColor: "rgba(100,116,139,0.15)" }]}>
                      <Text style={[styles.alertCountText, { color: "#64748B" }]}>
                        {deadStockCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ── PROCUREMENT & SUPPLY ── */}
            <Text style={[styles.sectionTitle, { color: muted }]}>PROCUREMENT & SUPPLY</Text>

            <TouchableOpacity
              onPress={() => handleSelect("procurement")}
              style={[
                styles.navEntry,
                activeTab === "procurement" && {
                  backgroundColor: isDark ? "rgba(0,168,121,0.15)" : "#DDF4EA",
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="cart-outline"
                size={18}
                color={activeTab === "procurement" ? "#00A879" : muted}
              />
              <Text
                style={[
                  styles.navEntryText,
                  { color: activeTab === "procurement" ? foreground : muted },
                  activeTab === "procurement" && { fontFamily: Typography.bold },
                ]}
              >
                Purchase Orders
              </Text>
              <View style={[styles.tagBadge, { backgroundColor: "rgba(59,130,246,0.12)" }]}>
                <Text style={[styles.tagBadgeText, { color: "#3B82F6" }]}>PO</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={muted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* ── INTELLIGENCE & REPORTS ── */}
            <Text style={[styles.sectionTitle, { color: muted }]}>INTELLIGENCE & REPORTS</Text>

            <TouchableOpacity
              onPress={() => handleSelect("analytics")}
              style={[
                styles.navEntry,
                activeTab === "analytics" && {
                  backgroundColor: isDark ? "rgba(0,168,121,0.15)" : "#DDF4EA",
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="bar-chart-outline"
                size={18}
                color={activeTab === "analytics" ? "#00A879" : muted}
              />
              <Text
                style={[
                  styles.navEntryText,
                  { color: activeTab === "analytics" ? foreground : muted },
                  activeTab === "analytics" && { fontFamily: Typography.bold },
                ]}
              >
                Analytics & BI
              </Text>
              <View style={[styles.tagBadge, { backgroundColor: "rgba(139,92,246,0.12)" }]}>
                <Text style={[styles.tagBadgeText, { color: "#8B5CF6" }]}>BI</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={muted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </ScrollView>

          {/* User Profile Card at Bottom (Matching Web Sidebar) */}
          <View style={[styles.userCard, { backgroundColor: isDark ? "#111D19" : "#F8FAFC", borderColor: itemBorder }]}>
            <View style={[styles.userAvatar, { backgroundColor: "#18312A" }]}>
              <Text style={styles.userAvatarText}>{userInitials || "IN"}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.userName, { color: foreground }]} numberOfLines={1}>
                {user?.name || user?.username || "infected"}
              </Text>
              <Text style={[styles.userRole, { color: muted }]} numberOfLines={1}>
                {user?.role || "Accountant"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.userActionBtn}>
              <Ionicons name="log-out-outline" size={18} color={muted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: "row" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(10,20,18,0.45)" },
  drawer: {
    width: "82%",
    maxWidth: 320,
    height: "100%",
    paddingHorizontal: 16,
    paddingBottom: 24,
    elevation: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#DDF8F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: { width: 26, height: 26 },
  brandTitle: { fontFamily: Typography.bold, fontSize: 16, letterSpacing: 0.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#00A879" },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgePillText: {
    fontSize: 9,
    fontFamily: Typography.bold,
    color: "#00A879",
    letterSpacing: 0.5,
  },
  brandSubtitle: { fontFamily: Typography.regular, fontSize: 10.5, marginTop: 2 },
  closeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.regular,
  },
  sectionTitle: {
    fontFamily: Typography.bold,
    marginTop: 18,
    marginBottom: 8,
    fontSize: 9.5,
    letterSpacing: 1.1,
  },
  navEntry: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    marginBottom: 4,
  },
  navEntryText: { fontFamily: Typography.medium, flex: 1, fontSize: 13.5 },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00A879",
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  countBadgeText: {
    fontSize: 10,
    fontFamily: Typography.semiBold,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  tagBadgeText: {
    fontSize: 9.5,
    fontFamily: Typography.bold,
  },
  subMenuList: {
    paddingLeft: 20,
    marginBottom: 6,
    gap: 2,
  },
  subEntry: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
  },
  subEntryText: {
    fontFamily: Typography.regular,
    fontSize: 12.5,
    flex: 1,
  },
  alertCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  alertCountText: {
    fontSize: 9.5,
    fontFamily: Typography.bold,
    color: "#F59E0B",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: 8,
    gap: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  userName: {
    fontFamily: Typography.bold,
    fontSize: 12,
  },
  userRole: {
    fontFamily: Typography.regular,
    fontSize: 10.5,
  },
  userActionBtn: {
    padding: 6,
  },
});
