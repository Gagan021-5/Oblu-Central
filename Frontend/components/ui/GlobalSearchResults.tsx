import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { SubAppLogo } from "@/components/employee/SubAppLogo";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import {
  UnifiedSearchResults,
  SearchTelephonyUser,
  SearchCallItem,
} from "@/services/globalSearchService";
import { Customer } from "@/data/customerTypes";
import { Lead } from "@/data/mockLeads";
import { ProformaItem } from "@/services/proformaService";
import { EmployeeDirectoryItem } from "@/services/hrmsService";

interface GlobalSearchResultsProps {
  query: string;
  results: UnifiedSearchResults;
  isSearching?: boolean;
  onClear: () => void;
  onOpenApp: (appId: string) => void;
  onPressCustomer: (customer: Customer) => void;
  onPressLead: (lead: Lead) => void;
  onPressProforma: (item: ProformaItem) => void;
  onPressInventory: () => void;
  onPressTelephonyUser?: (user: SearchTelephonyUser) => void;
  onPressEmployee?: (emp: EmployeeDirectoryItem) => void;
  onPressLeave?: () => void;
  onPressCall?: (call: SearchCallItem) => void;
}

/**
 * Unified multi-module search results panel shared between Admin and Employee Home screens.
 */
export const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({
  query,
  results,
  isSearching = false,
  onClear,
  onOpenApp,
  onPressCustomer,
  onPressLead,
  onPressProforma,
  onPressInventory,
  onPressTelephonyUser,
  onPressEmployee,
  onPressLeave,
  onPressCall,
}) => {
  const { isDark, colors } = useTheme();
  const mutedColor = isDark ? "#9CB3AA" : "#5E6964";
  const cardBg = isDark ? "#15251F" : "#FFFFFF";
  const cardBorder = isDark ? "#2D493F" : "#D8E0DC";
  const accent = isDark ? "#35D6A0" : "#00A879";

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Search Results
          </Text>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: isDark
                  ? "rgba(53, 214, 160, 0.16)"
                  : "rgba(0, 168, 121, 0.12)",
              },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: accent }]}>
              {results.totalCount} found
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.clearText, { color: accent }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* 1. Matching Sub-Apps */}
      {results.apps.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            SUB-APPS ({results.apps.length})
          </Text>
          {results.apps.map((app) => (
            <TouchableOpacity
              key={`search-app-${app.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onOpenApp(app.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <SubAppLogo appId={app.id} size={40} borderRadius={12} />
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {app.label}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {app.subtitle}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 2. Leads */}
      {results.leads.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            LEADS & PROSPECTS ({results.leads.length})
          </Text>
          {results.leads.map((l) => (
            <TouchableOpacity
              key={`search-lead-${l.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPressLead(l)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(251, 191, 36, 0.14)" : "#FEF3C7" },
                  ]}
                >
                  <Ionicons name="filter" size={18} color={isDark ? "#FBBF24" : "#D97706"} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {l.name || l.companyName}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {l.stage} • {l.estimatedValue || "Open"} • {l.phone || l.city || "Prospect"}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 3. Customers */}
      {results.customers.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            CUSTOMERS & ACCOUNTS ({results.customers.length})
          </Text>
          {results.customers.map((c) => (
            <TouchableOpacity
              key={`search-cust-${c.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPressCustomer(c)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#DDF4EA" },
                  ]}
                >
                  <Ionicons name="business" size={18} color={accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {c.contactPerson || "Contact"} • {c.city || "Office"} •{" "}
                    {c.outstandingPayment || c.phone}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 4. Proforma Invoices & Quotations */}
      {results.proformas.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            PROFORMA & QUOTATIONS ({results.proformas.length})
          </Text>
          {results.proformas.map((p) => (
            <TouchableOpacity
              key={`search-pi-${p.doc_type}-${p.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPressProforma(p)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(167, 139, 250, 0.14)" : "#F3E8FF" },
                  ]}
                >
                  <Ionicons
                    name="document-text"
                    size={18}
                    color={isDark ? "#A78BFA" : "#7C3AED"}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {p.piNumber} • {p.clientName}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {p.amount} • {p.status} • {p.date}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 5. Inventory Items & SKUs */}
      {results.inventory.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            INVENTORY & STOCK ({results.inventory.length})
          </Text>
          {results.inventory.map((item) => (
            <TouchableOpacity
              key={`search-inv-${item.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={onPressInventory}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(129, 140, 248, 0.14)" : "#E0E7FF" },
                  ]}
                >
                  <Ionicons name="cube" size={18} color={isDark ? "#818CF8" : "#4F46E5"} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {item.sku ? `SKU: ${item.sku} • ` : ""}
                    {item.stock} {item.unit} • {item.status}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 6. Telephony Users & Devices (Admin) */}
      {results.telephonyUsers.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            TEAM HANDSETS & USERS ({results.telephonyUsers.length})
          </Text>
          {results.telephonyUsers.map((u) => (
            <TouchableOpacity
              key={`search-user-${u.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPressTelephonyUser?.(u)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#DDF4EA" },
                  ]}
                >
                  <Ionicons name="person" size={18} color={accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {u.username}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {u.role} • {u.device_model || "No device linked"}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 7. HRMS Staff Directory */}
      {results.employees.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            HRMS STAFF DIRECTORY ({results.employees.length})
          </Text>
          {results.employees.map((e) => (
            <TouchableOpacity
              key={`search-emp-${e.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPressEmployee?.(e)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(53, 214, 160, 0.12)" : "#DDF4EA" },
                  ]}
                >
                  <Ionicons name="id-card" size={18} color={accent} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {e.name} ({e.employee_code})
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {e.designation || "Staff"} • {e.department}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 8. Pending Leave Requests */}
      {results.leaves.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            LEAVE REQUESTS ({results.leaves.length})
          </Text>
          {results.leaves.map((lv) => (
            <TouchableOpacity
              key={`search-leave-${lv.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPressLeave?.()}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(45, 212, 191, 0.14)" : "#CCFBF1" },
                  ]}
                >
                  <Ionicons name="calendar" size={18} color={isDark ? "#2DD4BF" : "#0D9488"} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {lv.employee_name} • {lv.leave_type}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {lv.total_days}d ({lv.start_date} – {lv.end_date}) • {lv.department}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 9. Recent Call Logs */}
      {results.calls.length > 0 && (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: mutedColor }]}>
            CALL LOGS ({results.calls.length})
          </Text>
          {results.calls.map((c) => (
            <TouchableOpacity
              key={`search-call-${c.id}`}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPressCall?.(c)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isDark ? "rgba(52, 211, 153, 0.14)" : "#D1FAE5" },
                  ]}
                >
                  <Ionicons name="call" size={18} color={isDark ? "#34D399" : "#059669"} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {c.username} • {c.phone_number}
                  </Text>
                  <Text style={[styles.cardSub, { color: mutedColor }]} numberOfLines={1}>
                    {c.call_type.toUpperCase()} • {c.duration || 0}s
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isSearching && (
        <SkeletonCardList count={results.totalCount === 0 ? 3 : 1} height={74} />
      )}

      {/* Empty State */}
      {results.totalCount === 0 && !isSearching && (
        <View style={styles.emptyBox}>
          <Ionicons
            name="search-outline"
            size={42}
            color={isDark ? "#294039" : "#C8D4CE"}
          />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            No matching results
          </Text>
          <Text style={[styles.emptySub, { color: mutedColor }]}>
            No apps, customers, leads, invoices, inventory items, or staff matched "{query}".
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Typography.bold,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  clearText: {
    fontSize: 13,
    fontFamily: Typography.medium,
  },
  group: {
    marginBottom: 14,
  },
  groupTitle: {
    fontSize: 11,
    fontFamily: Typography.bold,
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: Typography.semiBold,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Typography.bold,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Typography.regular,
    textAlign: "center",
    lineHeight: 19,
  },
});

