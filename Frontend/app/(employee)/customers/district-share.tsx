import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PieChart } from "react-native-chart-kit";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasRole } from "@/services/permissionService";
import { Typography } from "@/constants/theme";
import { SkeletonBlock } from "@/components/ui/SkeletonCard";
import { StateDistrictsData, fetchStateDistrictsApi } from "@/services/customerService";
import { SubAppHomeButton } from "@/components/navigation/SubAppHomeButton";

const PIE_COLORS = [
  "#20B99A",
  "#0EA5E9",
  "#6366F1",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#14B8A6",
  "#F97316",
  "#10B981",
  "#64748B",
  "#A855F7",
  "#06B6D4",
  "#3B82F6",
  "#E11D48",
  "#D97706",
];

export default function DistrictShareScreen() {
  const { state: routeState } = useLocalSearchParams<{ state?: string }>();
  const targetState = (routeState || "Unknown").trim();

  const insets = useSafeAreaInsets();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();
  const { user, permissionProfile, isLoading } = useAuth();

  const roleText = `${user?.role || ""} ${permissionProfile?.user.role || ""}`.toLowerCase();
  const isSuperuser = Boolean(
    (user as any)?.is_superuser ||
    roleText.includes("superuser") ||
    user?.username?.toLowerCase() === "infected" ||
    (user?.permissions || []).includes("*") ||
    (permissionProfile?.permissions || []).includes("*")
  );
  const userHasRole = (role: string) =>
    hasRole(permissionProfile, role) || roleText.includes(role);
  const isAdminUser =
    isSuperuser || userHasRole("admin") || roleText.includes("admin") || user?.username?.toLowerCase() === "infected";

  const [data, setData] = useState<StateDistrictsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!targetState) return;
    setError("");
    try {
      const result = await fetchStateDistrictsApi(targetState);
      setData(result);
    } catch {
      setData(null);
      setError(`District data for ${targetState} could not be loaded. Please refresh.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetState]);

  useEffect(() => {
    if (isLoading) return;
    void load();
  }, [isLoading, load]);

  const foreground = isDark ? "#F1F7F4" : "#101827";
  const muted = isDark ? "#9AA9A3" : "#637083";
  const card = { backgroundColor: t.surface, borderColor: t.border };
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(260, screenWidth - 72);

  const maxDistrict = Math.max(1, ...(data?.districtDistribution.map((x) => x.count) || [1]));

  const districtPieData = (data?.districtDistribution || [])
    .filter((item) => item.district && item.district.toLowerCase() !== "nan" && item.count > 0)
    .slice(0, 10)
    .map((item, idx) => ({
      name: item.district ? (item.district.length > 12 ? `${item.district.slice(0, 10)}…` : item.district) : "Other",
      count: item.count,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      legendFontColor: isDark ? "#D1D5DB" : "#374151",
      legendFontSize: 11,
    }));

  const chartConfig = {
    backgroundGradientFrom: t.surface,
    backgroundGradientTo: t.surface,
    color: (opacity = 1) => `rgba(32, 185, 154, ${opacity})`,
    labelColor: () => muted,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) + 6 }}>
      {/* Fixed Top Header Row */}
      <View style={[styles.top, { paddingHorizontal: 18 }]}>
        <TouchableOpacity
          accessibilityLabel="Back to Customer Analytics"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/(employee)/customers/analytics" as any);
            }
          }}
          style={[styles.back, card]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={foreground} />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: "#20B99A" }]}>DISTRICT SHARE</Text>
          <Text
            style={[styles.title, { color: foreground }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {targetState}
          </Text>
        </View>

        <SubAppHomeButton size={38} isAdmin={isAdminUser} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 110 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >

      {error ? (
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            void load();
          }}
          style={[styles.notice, { backgroundColor: isDark ? "#33251A" : "#FFF4E5" }]}
        >
          <Text style={{ color: foreground, fontFamily: Typography.regular }}>{error}</Text>
        </TouchableOpacity>
      ) : null}

      {/* State Overview KPI Grid */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiItem, card]}>
          <Ionicons name="people" size={17} color="#20B99A" />
          <Text style={[styles.kpiValue, { color: foreground }]} numberOfLines={1}>
            {data?.totalCustomers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Total Accounts</Text>
        </View>

        <View style={[styles.kpiItem, card]}>
          <Ionicons name="business" size={17} color="#0EA5E9" />
          <Text style={[styles.kpiValue, { color: foreground }]} numberOfLines={1}>
            {data?.districtCount ?? (data?.districtDistribution?.length || 0)}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Districts</Text>
        </View>

        <View style={[styles.kpiItem, card]}>
          <Ionicons name="checkmark-circle" size={17} color="#10B981" />
          <Text style={[styles.kpiValue, { color: isDark ? "#35D6A0" : "#00A879" }]} numberOfLines={1}>
            {data?.activeCustomers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Active Accounts</Text>
        </View>

        <View style={[styles.kpiItem, card]}>
          <Ionicons name="time" size={17} color="#E34B59" />
          <Text style={[styles.kpiValue, { color: "#E34B59" }]} numberOfLines={1}>
            {data?.inactiveCustomers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: muted }]}>Inactive</Text>
        </View>
      </View>

      {/* District Pie Chart & Share Section */}
      <View style={[styles.section, card]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: foreground }]}>District Distribution</Text>
          <Text style={[styles.sectionSubtitle, { color: muted }]}>
            Customer volume share across {targetState}
          </Text>
        </View>

        {loading ? (
          <SkeletonBlock height={200} borderRadius={16} />
        ) : districtPieData.length > 0 ? (
          <>
            <View style={styles.chartBox}>
              <PieChart
                data={districtPieData}
                width={chartWidth}
                height={200}
                chartConfig={chartConfig}
                accessor="count"
                backgroundColor="transparent"
                paddingLeft="10"
                absolute
              />
            </View>

            {/* Detailed District Breakdown List */}
            <View style={{ gap: 10, marginTop: 8 }}>
              {(data?.districtDistribution || [])
                .filter((x) => x.district && x.district.toLowerCase() !== "nan" && x.count > 0)
                .map((x) => (
                <View
                  key={x.district}
                  style={[
                    styles.districtRowCard,
                    {
                      borderColor: isDark ? "#2D493F" : "#E2EBE6",
                      backgroundColor: isDark ? "rgba(32, 185, 154, 0.04)" : "#F8FCFA",
                    },
                  ]}
                >
                  <View style={styles.districtLabelLine}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                      <Ionicons name="location" size={14} color="#20B99A" />
                      <Text numberOfLines={1} style={[styles.districtName, { color: foreground, flex: 1 }]}>
                        {x.district}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {typeof x.active === "number" && x.active > 0 && (
                        <Text style={[styles.activeBadge, { color: isDark ? "#35D6A0" : "#00A879" }]}>
                          {x.active} active
                        </Text>
                      )}
                      <Text style={[styles.districtCount, { color: foreground }]}>
                        {x.count} {x.count === 1 ? "customer" : "customers"}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.track, { backgroundColor: isDark ? "#23322D" : "#EDF2F5", marginTop: 7 }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.max(x.count ? 4 : 0, (x.count / maxDistrict) * 100)}%`,
                          backgroundColor: "#20B99A",
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={{ color: muted, fontFamily: Typography.regular, marginTop: 8 }}>
            No district distribution data available for {targetState}.
          </Text>
        )}
      </View>

      {/* Quick Link to Customer Directory */}
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: "/(employee)/customers" as any,
          });
        }}
        activeOpacity={0.8}
        style={[
          styles.directoryLinkBtn,
          {
            backgroundColor: isDark ? "#20B99A" : "#149B80",
          },
        ]}
      >
        <Ionicons name="people" size={18} color="#FFFFFF" />
        <Text style={styles.directoryLinkText}>
          View {targetState} Customers in Directory
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  back: { borderWidth: 1, width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#20B99A", fontFamily: Typography.bold, fontSize: 10, letterSpacing: 1 },
  title: { fontFamily: Typography.heading, fontSize: 24, marginTop: 2 },
  notice: { padding: 12, borderRadius: 12 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiItem: { width: "48%", flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  kpiValue: { fontFamily: Typography.bold, fontSize: 20, marginTop: 6 },
  kpiLabel: { fontFamily: Typography.regular, fontSize: 11, marginTop: 2 },
  activeBadge: { fontFamily: Typography.semiBold, fontSize: 11 },
  section: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  sectionHeader: { gap: 2, marginBottom: 4 },
  sectionTitle: { fontFamily: Typography.headingSemi, fontSize: 15 },
  sectionSubtitle: { fontFamily: Typography.regular, fontSize: 11 },
  chartBox: { alignItems: "center", justifyContent: "center", marginVertical: 4 },
  districtRowCard: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  districtLabelLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  districtName: { fontFamily: Typography.medium, fontSize: 13 },
  districtCount: { fontFamily: Typography.bold, fontSize: 13 },
  track: { height: 8, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  directoryLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  directoryLinkText: {
    color: "#FFFFFF",
    fontFamily: Typography.bold,
    fontSize: 14,
  },
});
