import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import { Typography } from "@/constants/theme";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { Customer } from "@/data/customerTypes";
import { fetchCustomerMapPointsFromApi } from "@/services/customerService";
import { CustomerNavDrawer } from "@/components/CustomerNavDrawer";

let WebViewComponent: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WebViewComponent = require("react-native-webview").WebView;
  } catch {
    WebViewComponent = null;
  }
}

type DistrictCluster = {
  district: string;
  state: string;
  lat: number;
  lon: number;
  count: number;
  customers: Customer[];
};

export default function CustomerMapScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user, permissionProfile } = useAuth();
  const roleText = `${user?.role || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
  const isSuperuser = Boolean((user as any)?.is_superuser || roleText.includes("superuser"));
  const userHasRole = (role: string) =>
    hasRole(permissionProfile, role) || roleText.includes(role);
  const isAdminUser = isSuperuser || userHasRole("admin") || roleText.includes("admin");
  const canOpen =
    isSuperuser ||
    isAdminUser ||
    userHasRole("sales_head") ||
    userHasRole("buss_mgr") ||
    userHasRole("business") ||
    userHasRole("rsm") ||
    userHasRole("finance") ||
    userHasRole("accounts") ||
    hasPermission(permissionProfile, "customer.view_all") ||
    hasPermission(permissionProfile, "customer.view");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<DistrictCluster | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const load = useCallback(async () => {
    if (!canOpen) return;
    setError("");
    try {
      const data = await fetchCustomerMapPointsFromApi();
      setCustomers(data);
    } catch (err: any) {
      const status = err?.response?.status;
      console.warn("[CustomerMap] Map API request failed:", status ? `HTTP ${status}` : err?.message || "Network error");
      setCustomers([]);
      setError("Customer locations could not be loaded from the server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canOpen]);

  useEffect(() => {
    if (!canOpen) {
      router.replace("/(employee)/customers/dashboard");
      return;
    }
    void load();
  }, [canOpen, load]);

  const foreground = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";
  const card = { backgroundColor: isDark ? "#111B18" : "#FFFFFF", borderColor: isDark ? "#263A32" : "#E4EAF0" };

  const locatedCustomers = useMemo(() => {
    return customers.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }, [customers]);

  // Aggregate into district clusters matching detailed_map.html
  const districtClusters = useMemo<DistrictCluster[]>(() => {
    const map = new Map<string, DistrictCluster>();
    for (const c of locatedCustomers) {
      const dist = (c.district || c.city || "Unknown").trim();
      const state = ((c as any).state || "").trim();
      const key = `${dist}__${state}`.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.customers.push(c);
      } else {
        map.set(key, {
          district: dist,
          state: state,
          lat: Number(c.latitude),
          lon: Number(c.longitude),
          count: 1,
          customers: [c],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [locatedCustomers]);

  const filteredClusters = useMemo(() => {
    if (!searchQuery.trim()) return districtClusters;
    const q = searchQuery.toLowerCase().trim();
    return districtClusters.filter(
      (dc) =>
        dc.district.toLowerCase().includes(q) ||
        dc.state.toLowerCase().includes(q) ||
        dc.customers.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [districtClusters, searchQuery]);

  // Generate Leaflet Interactive Map HTML with Esri World Street Map Tiles (real globe & streets)
  const mapHtml = useMemo(() => {
    const clustersPayload = filteredClusters.map((c) => ({
      district: c.district,
      state: c.state,
      lat: c.lat,
      lon: c.lon,
      count: c.count,
    }));

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map {
      width: 100%;
      height: 100%;
      background: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      padding: 4px;
      border: 1px solid #e2e8f0;
    }
    .custom-popup {
      font-size: 13px;
      padding: 6px;
      min-width: 170px;
    }
    .popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .popup-state {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .popup-count-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 11px;
      background: #ecfdf5;
      color: #047857;
      margin-bottom: 8px;
    }
    .popup-btn {
      display: block;
      width: 100%;
      text-align: center;
      padding: 7px 10px;
      background: #159A7C;
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 11px;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([22.5, 79.0], 5);

    // 1. High-resolution Esri World Street Map Layer (Globe, Terrain, Streets)
    const esriStreets = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18
    }).addTo(map);

    const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18
    });

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    });

    L.control.layers({
      "🗺️ Streets": esriStreets,
      "🏔️ Terrain": esriTopo,
      "🌐 OpenStreet": osm
    }, null, { position: 'topright' }).addTo(map);

    const clusters = ${JSON.stringify(clustersPayload)};

    clusters.forEach(c => {
      if (!c.lat || !c.lon) return;

      const count = c.count || 1;
      const color = count > 10 ? '#0EA5E9' : count > 3 ? '#6366F1' : '#159A7C';
      const radius = Math.min(20, Math.max(8, Math.sqrt(count) * 4));

      const marker = L.circleMarker([c.lat, c.lon], {
        radius: radius,
        fillColor: color,
        color: '#FFFFFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.88
      }).addTo(map);

      marker.bindTooltip(c.district + ' (' + count + ')', { direction: 'top', offset: [0, -radius] });

      const popupHtml = \`
        <div class="custom-popup">
          <div class="popup-title">\${c.district}</div>
          <div class="popup-state">\${c.state || 'India'}</div>
          <div class="popup-count-badge">\${count} \${count === 1 ? 'Account' : 'Accounts'}</div>
          <button class="popup-btn" onclick="selectDistrict('\${c.district}', '\${c.state}')">Inspect Details</button>
        </div>
      \`;
      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        sendToNative({ type: 'SELECT_DISTRICT', district: c.district, state: c.state });
      });
    });

    function selectDistrict(district, state) {
      sendToNative({ type: 'SELECT_DISTRICT', district: district, state: state });
    }

    function sendToNative(data) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        } else if (window.parent) {
          window.parent.postMessage(JSON.stringify(data), '*');
        }
      } catch (e) {}
    }

    window.addEventListener('message', function(e) {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'FLY_TO' && d.lat && d.lon) {
          map.flyTo([d.lat, d.lon], 9, { duration: 1.2 });
        }
      } catch (err) {}
    });
  </script>
</body>
</html>`;
  }, [filteredClusters]);

  const handleWebMessage = useCallback(
    (event: any) => {
      try {
        const data = typeof event.nativeEvent?.data === "string" ? JSON.parse(event.nativeEvent.data) : event.data;
        if (data?.type === "SELECT_DISTRICT") {
          const match = districtClusters.find(
            (dc) => dc.district.toLowerCase() === String(data.district).toLowerCase()
          );
          if (match) {
            setSelectedCluster(match);
          }
        }
      } catch {
        // ignore
      }
    },
    [districtClusters]
  );

  const openMapApp = async (lat: number, lon: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  if (!canOpen) return null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <View style={styles.top}>
          <TouchableOpacity
            accessibilityLabel="Open customer navigation menu"
            onPress={() => setDrawerVisible(true)}
            style={[styles.back, card]}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={22} color={foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CUSTOMER WORKSPACE</Text>
            <Text style={[styles.title, { color: foreground }]}>Distribution Map</Text>
          </View>
        </View>

        {error ? (
          <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={[styles.banner, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}>
            <Text style={{ color: foreground, fontFamily: Typography.regular }}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        {/* Top Summary Banner */}
        <View style={[styles.banner, { backgroundColor: "#0E9E83" }]}>
          <Ionicons name="map" size={24} color="white" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Interactive Customer Distribution Map</Text>
            <Text style={styles.bannerSub}>
              {locatedCustomers.length} accounts mapped across {districtClusters.length} districts in India
            </Text>
          </View>
        </View>

        {/* Search District / Client */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholders={[
            'Search "district"',
            'Search "state"',
            'Search "client name"',
          ]}
          intervalMs={2000}
          onClear={() => setSearchQuery("")}
        />

        {/* Interactive Marked Map Container */}
        <View style={[styles.mapContainer, card]}>
          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderContent}>
              <View style={styles.mapTitleRow}>
                <View style={styles.mapDotLive} />
                <Text style={[styles.mapHeaderTitle, { color: foreground }]} numberOfLines={1}>
                  India Geographic Map
                </Text>
              </View>
              <Text style={[styles.mapHeaderHint, { color: muted }]}>
                Pinch to zoom · Tap pin for details
              </Text>
            </View>
            <View style={[styles.mapLiveBadge, { backgroundColor: isDark ? "#142820" : "#E6F7F2" }]}>
              <Text style={styles.mapLiveBadgeText}>LIVE</Text>
            </View>
          </View>

          {loading ? (
            <SkeletonBlock height={360} borderRadius={16} />
          ) : (
            <View style={styles.canvasWrapper}>
              {Platform.OS === "web" ? (
                // Web rendering via standard DOM iframe
                <View style={{ width: "100%", height: 380, overflow: "hidden" }}>
                  {React.createElement("iframe", {
                    srcDoc: mapHtml,
                    title: "Customer Map",
                    style: { width: "100%", height: "100%", border: "none" },
                  })}
                </View>
              ) : WebViewComponent ? (
                // Native iOS/Android WebView (when native module is linked)
                <View style={{ width: "100%", height: 380, overflow: "hidden" }}>
                  <WebViewComponent
                    originWhitelist={["*"]}
                    source={{ html: mapHtml }}
                    style={{ width: "100%", height: 380, backgroundColor: "transparent" }}
                    onMessage={handleWebMessage}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    scrollEnabled={false}
                  />
                </View>
              ) : (
                // Native Fallback for Expo Go (safe, native React Native views with zero crashes)
                <View style={[styles.nativeMapCanvas, { backgroundColor: isDark ? "#0E1815" : "#F0FAF7" }]}>
                  <View style={styles.nativeMapIconWrap}>
                    <Ionicons name="map" size={32} color="#159A7C" />
                  </View>
                  <Text style={[styles.nativeMapTitle, { color: foreground }]}>
                    Interactive District Clusters
                  </Text>
                  <Text style={[styles.nativeMapSub, { color: muted }]}>
                    {filteredClusters.length} district clusters mapped across India. Select any district below to inspect accounts.
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.clusterPillRow}
                  >
                    {filteredClusters.slice(0, 12).map((c: DistrictCluster) => {
                      const isSelected = selectedCluster?.district === c.district;
                      return (
                        <TouchableOpacity
                          key={`pill-${c.district}`}
                          style={[
                            styles.clusterPill,
                            {
                              backgroundColor: isSelected ? "#159A7C" : isDark ? "#142820" : "#E2F7F1",
                              borderColor: isSelected ? "#159A7C" : isDark ? "#1F3B32" : "#BFE7DD",
                            },
                          ]}
                          onPress={() => setSelectedCluster(c)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.clusterPillText,
                              { color: isSelected ? "#FFFFFF" : isDark ? "#35D6A0" : "#159A7C" },
                            ]}
                          >
                            {c.district} ({c.count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {selectedCluster ? (
                    <TouchableOpacity
                      style={styles.nativeLaunchBtn}
                      onPress={() => openMapApp(selectedCluster.lat, selectedCluster.lon)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.nativeLaunchBtnText}>Open {selectedCluster.district} in Google Maps</Text>
                    </TouchableOpacity>
                  ) : filteredClusters.length > 0 ? (
                    <TouchableOpacity
                      style={styles.nativeLaunchBtn}
                      onPress={() => setSelectedCluster(filteredClusters[0])}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="location-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.nativeLaunchBtnText}>Select Top District ({filteredClusters[0].district})</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* Interactive Legend */}
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#159A7C" }]} />
              <Text style={[styles.legendText, { color: muted }]}>1-3 Accounts</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#6366F1" }]} />
              <Text style={[styles.legendText, { color: muted }]}>4-10 Accounts</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#0EA5E9" }]} />
              <Text style={[styles.legendText, { color: muted }]}>10+ Cluster</Text>
            </View>
          </View>
        </View>

        {/* Selected District Inspector Card */}
        {selectedCluster ? (
          <View style={[styles.selectedCard, card]}>
            <View style={styles.selectedHeader}>
              <View style={styles.selectedAvatar}>
                <Ionicons name="location" size={20} color="#159A7C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedTitle, { color: foreground }]}>
                  {selectedCluster.district}, {selectedCluster.state}
                </Text>
                <Text style={[styles.selectedSub, { color: muted }]}>
                  {selectedCluster.count} {selectedCluster.count === 1 ? "customer account" : "customer accounts"} in this district
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCluster(null)} hitSlop={8}>
                <Ionicons name="close" size={20} color={muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.customerList}>
              {selectedCluster.customers.map((c) => (
                <TouchableOpacity
                  key={`sel-cust-${c.id}`}
                  style={[styles.customerItem, { borderColor: card.borderColor }]}
                  onPress={() => router.push(`/(employee)/customers/${c.id}` as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.custName, { color: foreground }]}>{c.name}</Text>
                    {c.assignedSalesperson ? (
                      <Text style={[styles.custMeta, { color: muted }]}>SP: {c.assignedSalesperson}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={muted} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.openMapsBtn}
              onPress={() => openMapApp(selectedCluster.lat, selectedCluster.lon)}
            >
              <Ionicons name="navigate-outline" size={16} color="white" />
              <Text style={styles.openMapsBtnText}>Open {selectedCluster.district} in Google Maps</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* District Directory Listing */}
        <View style={styles.directorySection}>
          <Text style={[styles.sectionTitle, { color: foreground }]}>
            All Districts ({filteredClusters.length})
          </Text>

          {filteredClusters.map((dc) => (
            <TouchableOpacity
              key={`dir-${dc.district}-${dc.state}`}
              style={[styles.districtRow, card]}
              onPress={() => setSelectedCluster(dc)}
              activeOpacity={0.75}
            >
              <View style={[styles.badgeCount, { backgroundColor: isDark ? "rgba(32, 185, 154, 0.15)" : "#E2F7F1" }]}>
                <Text style={{ color: "#159A7C", fontFamily: Typography.bold, fontSize: 13 }}>{dc.count}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.distName, { color: foreground }]}>
                  {dc.district}
                </Text>
                <Text style={[styles.distState, { color: muted }]}>{dc.state || "India"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={muted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <CustomerNavDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        isAdmin={isAdminUser}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  back: { borderWidth: 1, width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#20B99A", fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: Typography.heading, fontSize: 24, marginTop: 2 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 16 },
  bannerTitle: { color: "white", fontFamily: Typography.headingSemi, fontSize: 15 },
  bannerSub: { color: "#D9FFF5", fontFamily: Typography.regular, fontSize: 11, marginTop: 3 },
  searchBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, fontFamily: Typography.regular, fontSize: 13, paddingVertical: 8 },
  mapContainer: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  mapHeaderContent: { flex: 1, gap: 3 },
  mapTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mapDotLive: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#20B99A" },
  mapHeaderTitle: { fontFamily: Typography.semiBold, fontSize: 14, flexShrink: 1 },
  mapHeaderHint: { fontFamily: Typography.regular, fontSize: 11, paddingLeft: 16 },
  mapLiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mapLiveBadgeText: {
    color: "#159A7C",
    fontFamily: Typography.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  mapLoading: { height: 380, alignItems: "center", justifyContent: "center" },
  canvasWrapper: { width: "100%", height: 380, overflow: "hidden" },
  mapLegend: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E2E8F0" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: Typography.regular, fontSize: 11 },
  selectedCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  selectedHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#E2F7F1", alignItems: "center", justifyContent: "center" },
  selectedTitle: { fontFamily: Typography.headingSemi, fontSize: 16 },
  selectedSub: { fontFamily: Typography.regular, fontSize: 12, marginTop: 2 },
  customerList: { gap: 8, maxHeight: 180 },
  customerItem: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  custName: { fontFamily: Typography.semiBold, fontSize: 13 },
  custMeta: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  openMapsBtn: { backgroundColor: "#159A7C", borderRadius: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  openMapsBtnText: { color: "white", fontFamily: Typography.semiBold, fontSize: 13 },
  directorySection: { gap: 10, marginTop: 4 },
  sectionTitle: { fontFamily: Typography.headingSemi, fontSize: 16 },
  districtRow: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  badgeCount: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  distName: { fontFamily: Typography.semiBold, fontSize: 13 },
  distState: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  nativeMapCanvas: {
    height: 380,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  nativeMapIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(32, 185, 154, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  nativeMapTitle: {
    fontFamily: Typography.headingSemi,
    fontSize: 16,
    textAlign: "center",
  },
  nativeMapSub: {
    fontFamily: Typography.regular,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
    maxWidth: 290,
    lineHeight: 16,
  },
  clusterPillRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 14,
    maxHeight: 44,
  },
  clusterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clusterPillText: {
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
  nativeLaunchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#159A7C",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  nativeLaunchBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.semiBold,
    fontSize: 12,
  },
});
