import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes, Shadows } from "@/constants/theme";
import { PersonAvatar3D } from "@/components/employee/SubAppLogo";
import { fetchHRMSSelfProfileApi, HRMSSelfProfile } from "@/services/hrmsService";
import {
  fetchUserPermissionsApi,
  UserPermissionProfile,
} from "@/services/permissionService";

export default function EmployeeProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { colors, isDark, mode, setMode } = useTheme();

  const [profile, setProfile] = useState<UserPermissionProfile | null>(null);
  const [dbEmployee, setDbEmployee] = useState<HRMSSelfProfile["employee"]>(null);
  const [employeeProfileStatus, setEmployeeProfileStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [loggingOut, setLoggingOut] = useState(false);

  // Fetch real authenticated profile and employee record from backend DB
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const permProfile = await fetchUserPermissionsApi();
        if (mounted && permProfile) {
          setProfile(permProfile);
        }
      } catch (err) {
        console.warn("[Profile] Error loading permissions:", err);
      }

      try {
        const employeeProfile = await fetchHRMSSelfProfileApi();
        if (mounted) {
          setDbEmployee(employeeProfile.employee);
          setEmployeeProfileStatus("loaded");
        }
      } catch (err) {
        console.warn("[Profile] Error loading linked employee record:", err);
        if (mounted) setEmployeeProfileStatus("error");
      }

    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [user]);

  const activeUser = profile?.user?.id ? profile.user : user;
  const username = activeUser?.username || "";
  // Prefer active database-assigned RBAC roles, then Django's resolved role.
  const roleTitle = useMemo(() => {
    const assignedRoles = profile?.roles?.map((role) => role.name).filter(Boolean) || [];
    return assignedRoles.length ? assignedRoles.join(", ") : activeUser?.role || "—";
  }, [profile?.roles, activeUser?.role]);

  // Real Name & Initials (strictly authentic name without fake last names)
  const displayName = useMemo(() => {
    if (dbEmployee?.name) return dbEmployee.name;
    if (profile?.user?.name) return profile.user.name;
    if ((user as any)?.name) return (user as any).name;
    if (!username) return "—";
    return username.charAt(0).toUpperCase() + username.slice(1);
  }, [dbEmployee?.name, profile, user, username]);

  const employeeGender =
    dbEmployee?.gender ||
    profile?.user?.gender ||
    profile?.gender ||
    user?.gender ||
    "";

  // Purely dynamic department and employee code from database record
  const empDetails = useMemo(() => {
    return {
      code: dbEmployee?.employee_code || "—",
      dept: dbEmployee?.department || "—",
      desig: dbEmployee?.designation || "—",
      email: dbEmployee?.email || profile?.email || (user as any)?.email || "—",
      entity: dbEmployee?.company || "—",
    };
  }, [dbEmployee, profile, user]);

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? Your cloud session and synchronization state will remain secure.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              setLoggingOut(true);
              await logout();
              router.replace("/(auth)/login" as any);
            } catch (err) {
              setLoggingOut(false);
              Alert.alert("Error", "Could not sign out. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Top Header */}
      <View
        style={[
          styles.navBar,
          {
            borderBottomColor: isDark
              ? "rgba(41, 64, 57, 0.45)"
              : "rgba(216, 224, 220, 0.7)",
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/(employee)" as any);
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={isDark ? "#F1F7F4" : "#101513"}
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.navTitle,
            { color: isDark ? "#F1F7F4" : "#101513" },
          ]}
        >
          My Profile
        </Text>

        <TouchableOpacity
          style={[
            styles.themeToggleBtn,
            {
              backgroundColor: isDark ? "#121F1B" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
          onPress={() => setMode(mode === "dark" ? "light" : "dark")}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={17}
            color={isDark ? "#35D6A0" : "#00A879"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 96 },
        ]}
      >
        {/* Profile Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
            Shadows.cardElevated,
          ]}
        >
          <View style={styles.heroTopRow}>
            <PersonAvatar3D
              gender={employeeGender}
              size={62}
              borderWidth={2}
              borderColor={isDark ? "#35D6A0" : "#00A879"}
            />

            <View style={styles.heroInfo}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isDark
                      ? "rgba(53, 214, 160, 0.14)"
                      : "#E8F5EE",
                    borderColor: isDark
                      ? "rgba(53, 214, 160, 0.3)"
                      : "#C0E8D7",
                  },
                ]}
              >
                <View style={styles.statusDot} />
                <Text
                  style={[
                    styles.statusText,
                    { color: isDark ? "#35D6A0" : "#00A879" },
                  ]}
                >
                  {roleTitle}
                </Text>
              </View>

              <Text
                style={[
                  styles.profileName,
                  { color: isDark ? "#F1F7F4" : "#101513" },
                ]}
              >
                {displayName}
              </Text>

              <Text
                style={[
                  styles.profileRole,
                  { color: isDark ? "#8FA09A" : "#5E6964" },
                ]}
              >
                {empDetails.desig}
              </Text>

              <View style={styles.empIdBadge}>
                <Ionicons
                  name="shield-checkmark"
                  size={12}
                  color={isDark ? "#35D6A0" : "#00A879"}
                />
                <Text
                  style={[
                    styles.empIdText,
                    { color: isDark ? "#35D6A0" : "#00A879" },
                  ]}
                >
                  {username ? `@${username}` : "Signed-in account"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Corporate Employment Details */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#F1F7F4" : "#101513" },
            ]}
          >
            Employment Details
          </Text>
          {employeeProfileStatus === "loading" ? <ActivityIndicator size="small" color={isDark ? "#35D6A0" : "#00A879"} /> : null}
        </View>

        {employeeProfileStatus === "loaded" && !dbEmployee ? (
          <Text style={[styles.profileNotice, { color: isDark ? "#8FA09A" : "#5E6964" }]}>No HR employee record is linked to this login.</Text>
        ) : employeeProfileStatus === "error" ? (
          <Text style={[styles.profileNotice, { color: isDark ? "#8FA09A" : "#5E6964" }]}>Employee details could not be loaded. Check your connection and try again.</Text>
        ) : null}

        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
        >
          {/* Employee Code */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Ionicons
                name="card-outline"
                size={18}
                color={isDark ? "#35D6A0" : "#00A879"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailLabel, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                Employee Code
              </Text>
              <Text style={[styles.detailValue, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                {empDetails.code}
              </Text>
            </View>
          </View>

          <View style={[styles.innerDivider, { backgroundColor: isDark ? "#1C2B25" : "#EDF2EF" }]} />

          {/* Department */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Ionicons
                name="business-outline"
                size={18}
                color={isDark ? "#35D6A0" : "#00A879"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailLabel, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                Department
              </Text>
              <Text style={[styles.detailValue, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                {empDetails.dept}
              </Text>
            </View>
          </View>

          <View style={[styles.innerDivider, { backgroundColor: isDark ? "#1C2B25" : "#EDF2EF" }]} />

          {/* Work Email */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={isDark ? "#35D6A0" : "#00A879"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailLabel, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                Work Email
              </Text>
              <Text style={[styles.detailValue, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                {empDetails.email}
              </Text>
            </View>
          </View>

          <View style={[styles.innerDivider, { backgroundColor: isDark ? "#1C2B25" : "#EDF2EF" }]} />

          {/* Operating Entity */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Ionicons
                name="cube-outline"
                size={18}
                color={isDark ? "#35D6A0" : "#00A879"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailLabel, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                Operating Entity
              </Text>
              <Text style={[styles.detailValue, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                {empDetails.entity}
              </Text>
            </View>
          </View>
        </View>

        {/* Telephony Sync */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#F1F7F4" : "#101513" },
            ]}
          >
            Telephony & Calling
          </Text>
        </View>

        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
              borderColor: isDark ? "#294039" : "#D8E0DC",
            },
          ]}
        >
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryLeft}>
              <View style={styles.greenPulseDot} />
              <View>
                <Text style={[styles.telemetryLabel, { color: isDark ? "#F1F7F4" : "#101513" }]}>
                  Call Recording Sync
                </Text>
                <Text style={[styles.telemetrySub, { color: isDark ? "#8FA09A" : "#5E6964" }]}>
                  Automatic cloud synchronization for office calls
                </Text>
              </View>
            </View>
            <Text style={[styles.telemetryStatus, { color: "#10B981" }]}>Active</Text>
          </View>
        </View>

        {/* Sign Out Action Button */}
        <TouchableOpacity
          style={[
            styles.signOutBtn,
            {
              backgroundColor: isDark ? "rgba(255, 107, 120, 0.12)" : "#FEF2F2",
              borderColor: isDark ? "rgba(255, 107, 120, 0.35)" : "#FCA5A5",
            },
          ]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#FF6B78" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#FF6B78" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 16,
    fontFamily: Typography.semiBold,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 22,
    fontFamily: Typography.bold,
  },
  heroInfo: {
    flex: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 11,
    fontFamily: Typography.semiBold,
  },
  profileName: {
    fontSize: 20,
    fontFamily: Typography.bold,
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    fontFamily: Typography.regular,
    marginBottom: 6,
  },
  empIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  empIdText: {
    fontSize: 11,
    fontFamily: Typography.medium,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Typography.semiBold,
  },
  profileNotice: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    marginTop: -4,
    marginBottom: 10,
  },
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  detailIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(53, 214, 160, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: Typography.medium,
  },
  innerDivider: {
    height: 1,
  },
  telemetryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  telemetryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  telemetryLabel: {
    fontSize: 13,
    fontFamily: Typography.medium,
  },
  telemetrySub: {
    fontSize: 11,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  telemetryStatus: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 24,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: Typography.semiBold,
    color: "#FF6B78",
  },
});
