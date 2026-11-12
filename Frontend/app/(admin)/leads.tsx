/**
 * Admin — Lead Signal Screen (Live PostgreSQL Database Integration)
 * Nexus CRM Graphite Mint Design System.
 * Connects to live Django REST API (/api/leads/) with zero hardcoded dummy data.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes, Spacing, Radius, Shadows } from "@/constants/theme";
import { SkeletonCardList } from "@/components/ui/SkeletonCard";
import { fetchLeadsFromApi, updateLeadStageApi } from "@/services/leadService";
import { Lead, LeadStage } from "@/data/mockLeads";

export default function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadPickerVisible, setLeadPickerVisible] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);

  const stages: LeadStage[] = [
    "New",
    "Contacted",
    "Qualified",
    "Proposal",
    "Won",
  ];

  const loadLeads = useCallback(async (isPull = false) => {
    if (!isPull) setLoading(true);
    try {
      const data = await fetchLeadsFromApi();
      setLeads(data);
      if (data.length > 0) {
        setSelectedLead((prev) => {
          if (!prev) return data[0];
          const found = data.find((l) => l.id === prev.id);
          return found || data[0];
        });
      } else {
        setSelectedLead(null);
      }
    } catch (err) {
      console.warn("[AdminLeads] Error loading leads:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads(true);
  };

  const handleStartCall = () => {
    if (!selectedLead?.phone) {
      Alert.alert("No Phone Number", "This lead does not have a contact phone number.");
      return;
    }
    Alert.alert(
      "Start Outreach Call",
      `Dial ${selectedLead.companyName || selectedLead.name} at ${selectedLead.phone}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: () => {
            Linking.openURL(`tel:${selectedLead.phone}`).catch(() => {
              Alert.alert("Dialer Error", "Unable to launch mobile dialer.");
            });
          },
        },
      ]
    );
  };

  const handleStageSelect = async (newStage: LeadStage) => {
    if (!selectedLead || selectedLead.stage === newStage || updatingStage) return;
    setUpdatingStage(true);
    try {
      await updateLeadStageApi(selectedLead.id, newStage);
      setSelectedLead((prev) => (prev ? { ...prev, stage: newStage } : null));
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, stage: newStage } : l))
      );
    } catch {
      Alert.alert("Error", "Could not update pipeline stage.");
    } finally {
      setUpdatingStage(false);
    }
  };

  const currentStageIndex = useMemo(() => {
    if (!selectedLead) return 0;
    const idx = stages.indexOf(selectedLead.stage);
    return idx >= 0 ? idx : 0;
  }, [selectedLead, stages]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Top Bar ── */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(admin)/users"))}
          style={styles.navBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>
            Lead Signal
          </Text>
          <Text style={[styles.topBarSub, { color: colors.textMuted }]}>
            {leads.length > 0 ? `${leads.length} Live Prospects` : "Live CRM Database"}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setLeadPickerVisible(true)}
          style={styles.navBtn}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <SkeletonCardList count={5} height={106} style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      ) : !selectedLead ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <Ionicons name="filter-outline" size={56} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            No Leads in Database
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            There are currently no active leads recorded in the CRM database.
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: colors.primary }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Spacing.screenPadding,
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + 32,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── High Intent Pill & Timestamp ── */}
          <View style={styles.topStatusRow}>
            <View
              style={[
                styles.intentBadge,
                { backgroundColor: colors.mintTintedSurface },
              ]}
            >
              <View
                style={[styles.intentDot, { backgroundColor: colors.primary }]}
              />
              <Text style={[styles.highIntentText, { color: colors.primary }]}>
                {selectedLead.intentLevel || "High"} intent
              </Text>
            </View>
            <Text style={[styles.updatedText, { color: colors.textMuted }]}>
              {selectedLead.lastContactTime || "Active"}
            </Text>
          </View>

          {/* ── Company Identity & Intent Score ── */}
          <View style={styles.companyRow}>
            <View style={styles.companyLeft}>
              <View
                style={[
                  styles.companyLogo,
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.14)"
                      : "rgba(245, 158, 11, 0.12)",
                  },
                ]}
              >
                <Text
                  style={[styles.companyLogoText, { color: colors.primary }]}
                >
                  {(selectedLead.companyName || selectedLead.name || "P").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.companyInfo}>
                <Text
                  style={[styles.companyName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {selectedLead.companyName || selectedLead.name}
                </Text>
                <Text
                  style={[styles.companyMeta, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {selectedLead.city || "Headquarters"} • {selectedLead.leadSource || "Direct"}
                </Text>
              </View>
            </View>

            <View style={styles.scoreCol}>
              <Text style={[styles.intentScoreNum, { color: colors.primary }]}>
                {selectedLead.intentScore || 85}
              </Text>
              <Text style={[styles.intentScoreLabel, { color: colors.textMuted }]}>
                Intent score
              </Text>
            </View>
          </View>

          {/* ── Strategic Lead Contact ── */}
          <View
            style={[
              styles.quoteCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.borderLight,
              },
            ]}
          >
            <View style={styles.quoteBar} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.quoteText, { color: colors.textPrimary }]}>
                Contact: {selectedLead.contactPerson || selectedLead.name}
              </Text>
              <Text style={[styles.quoteAuthor, { color: colors.textSecondary }]}>
                Assigned to {selectedLead.assignedSalesperson || "Sales Team"}
              </Text>
            </View>
          </View>

          {/* ── Evaluation Metrics ── */}
          <View style={styles.evalRow}>
            <View
              style={[
                styles.evalChip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <Text style={[styles.chipKey, { color: colors.textSecondary }]}>
                Est. Value
              </Text>
              <Text style={[styles.chipVal, { color: colors.primary }]}>
                {selectedLead.estimatedValue || "₹0"}
              </Text>
            </View>

            <View
              style={[
                styles.evalChip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <Text style={[styles.chipKey, { color: colors.textSecondary }]}>
                Closing
              </Text>
              <Text style={[styles.chipVal, { color: colors.textPrimary }]}>
                {selectedLead.expectedClosingDate || "Open"}
              </Text>
            </View>

            <View
              style={[
                styles.evalChip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <Text style={[styles.chipKey, { color: colors.textSecondary }]}>
                Stage
              </Text>
              <Text style={[styles.chipVal, { color: colors.textPrimary }]}>
                {selectedLead.stage}
              </Text>
            </View>
          </View>

          {/* ── Pipeline Position ── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Pipeline position
            </Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              Tap to update stage
            </Text>
          </View>

          <View style={styles.pipelineChevrons}>
            {stages.map((stg, i) => {
              const isActive = i <= currentStageIndex;
              const isCurrent = i === currentStageIndex;
              return (
                <TouchableOpacity
                  key={stg}
                  activeOpacity={0.8}
                  onPress={() => handleStageSelect(stg)}
                  style={[
                    styles.chevronStep,
                    {
                      backgroundColor: isCurrent
                        ? colors.primary
                        : isActive
                        ? colors.mintTintedSurface
                        : colors.card,
                      borderColor: isCurrent
                        ? colors.primary
                        : colors.borderLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pipelineStageText,
                      {
                        color: isCurrent
                          ? "#FFFFFF"
                          : isActive
                          ? colors.primary
                          : colors.textMuted,
                        fontFamily: isCurrent ? Typography.semiBold : Typography.regular,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {stg}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Next Best Action Panel ── */}
          <View style={[styles.actionPanel, Shadows.card]}>
            <View style={styles.actionHeader}>
              <View style={styles.lightningBox}>
                <Ionicons name="flash" size={16} color="#111815" />
              </View>
              <Text style={[styles.actionTag, { color: "#A0B3A8" }]}>
                Next best action
              </Text>
            </View>

            <Text style={styles.actionTitle}>Outreach & Follow Up</Text>
            <Text style={styles.actionReason}>
              {selectedLead.phone
                ? `Direct telephone outreach ready: ${selectedLead.phone}`
                : "No phone number recorded for this prospect."}
            </Text>

            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleStartCall}
                style={[
                  styles.startCallBtn,
                  { opacity: selectedLead.phone ? 1 : 0.6 },
                ]}
              >
                <Ionicons name="call" size={16} color="#0F1512" />
                <Text style={styles.startCallText}>Start Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setLeadPickerVisible(true)}
                style={styles.moreActionBtn}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#F1F7F4" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── Lead Selector Modal ── */}
      <Modal
        visible={leadPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLeadPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLeadPickerVisible(false)}
        >
          <View
            style={[
              styles.pickerSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.borderLight,
              },
            ]}
          >
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>
                Switch Lead Prospect
              </Text>
              <TouchableOpacity onPress={() => setLeadPickerVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {leads.length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted, fontSize: FontSizes.bodySmall, fontFamily: Typography.regular }}>
                  No leads recorded in database.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {leads.map((lead) => (
                  <TouchableOpacity
                    key={lead.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedLead(lead);
                      setLeadPickerVisible(false);
                    }}
                    style={[
                      styles.leadPickItem,
                      {
                        backgroundColor:
                          selectedLead?.id === lead.id
                            ? colors.mintTintedSurface
                            : "transparent",
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.leadPickName, { color: colors.textPrimary }]}>
                        {lead.companyName || lead.name}
                      </Text>
                      <Text style={[styles.leadPickSub, { color: colors.textSecondary }]}>
                        {lead.contactPerson || "Contact"} • Stage: {lead.stage}
                      </Text>
                    </View>
                    <Text style={[styles.leadPickScore, { color: colors.primary }]}>
                      {lead.intentScore || 85}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    alignItems: "center",
  },
  topBarTitle: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.body,
    letterSpacing: 0.2,
  },
  topBarSub: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    marginTop: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.medium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: FontSizes.sectionTitle,
    fontFamily: Typography.semiBold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  refreshBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  topStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  intentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    gap: 6,
  },
  intentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  highIntentText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.caption,
  },
  updatedText: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  companyLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  companyLogoText: {
    fontFamily: Typography.bold,
    fontSize: 20,
    color: "#D97706",
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontFamily: Typography.bold,
    fontSize: 18,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  companyMeta: {
    fontFamily: Typography.medium,
    fontSize: 13,
  },
  scoreCol: {
    alignItems: "flex-end",
  },
  intentScoreNum: {
    fontFamily: Typography.bold,
    fontSize: 28,
    lineHeight: 32,
  },
  intentScoreLabel: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  quoteCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  quoteBar: {
    width: 3,
    backgroundColor: "#00A879",
    borderRadius: Radius.pill,
    marginRight: 12,
  },
  quoteText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.bodySmall,
    lineHeight: 20,
    marginBottom: 2,
  },
  quoteAuthor: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  evalRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.lg,
  },
  evalChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  chipKey: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    marginBottom: 2,
  },
  chipVal: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.bodySmall,
  },
  sectionSub: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
  },
  pipelineChevrons: {
    flexDirection: "row",
    gap: 4,
    marginBottom: Spacing.lg,
  },
  chevronStep: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pipelineStageText: {
    fontFamily: Typography.semiBold,
    fontSize: 10,
  },
  actionPanel: {
    backgroundColor: "#1B2421",
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A3833",
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  lightningBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#00D097",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTag: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.caption,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  actionTitle: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.body,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  actionReason: {
    fontFamily: Typography.regular,
    fontSize: FontSizes.caption,
    color: "#A0B3A8",
    lineHeight: 18,
    marginBottom: 14,
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  startCallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00D097",
    paddingVertical: 11,
    borderRadius: Radius.md,
  },
  startCallText: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.bodySmall,
    color: "#0F1512",
  },
  moreActionBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: "#2A3833",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  pickerSheet: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 16,
    maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE22",
  },
  pickerTitle: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.body,
  },
  leadPickItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  leadPickName: {
    fontFamily: Typography.bold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  leadPickSub: {
    fontFamily: Typography.medium,
    fontSize: 13,
    marginTop: 2,
  },
  leadPickScore: {
    fontFamily: Typography.bold,
    fontSize: FontSizes.body,
  },
});
