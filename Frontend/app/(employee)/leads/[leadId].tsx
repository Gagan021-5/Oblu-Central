import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmployeeTheme } from "@/constants/employeeTheme";
import { Typography, FontSizes, Shadows, Radius } from "@/constants/theme";
import { StatusPill } from "@/components/ui/StatusPill";
import { TimelineItem } from "@/components/employee/TimelineItem";
import { AddCustomerRemarkModal } from "@/components/employee/AddCustomerRemarkModal";
import { ScheduleFollowUpModal } from "@/components/employee/ScheduleFollowUpModal";
import {
  getMockLeadById,
  updateMockLeadStage,
  addMockLeadNote,
  scheduleMockLeadFollowUp,
  Lead,
  LeadStage,
} from "@/data/mockLeads";
import { fetchLeadByIdFromApi, updateLeadStageApi } from "@/services/leadService";
import { scheduleFollowUpNotifications } from "@/services/followUpNotificationService";

type LeadTab = "overview" | "activity" | "notes" | "followups";

const STAGE_STEPS: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Won"];

export default function LeadDetailScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const insets = useSafeAreaInsets();
  const { t, isDark } = useEmployeeTheme();
  const { colors } = useTheme();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<LeadTab>("overview");
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);

  const fetchLead = useCallback(async () => {
    if (!leadId) return;
    const data = await fetchLeadByIdFromApi(leadId);
    if (data) setLead(data);
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleCall = () => {
    if (!lead) return;
    const cleaned = lead.phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert("Unable to place call", lead.phone);
    });
  };

  const handleStageChange = async (newStage: LeadStage) => {
    if (!lead || lead.stage === newStage) return;
    await updateLeadStageApi(lead.id, newStage);
    await updateMockLeadStage(lead.id, newStage);
    setLead((prev) =>
      prev
        ? {
            ...prev,
            stage: newStage,
            activity: [
              {
                id: `act-${Date.now()}`,
                date: "Today",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                title: `Stage Changed to ${newStage}`,
                type: "stage_change",
                description: `Pipeline moved from ${prev.stage} to ${newStage}.`,
              },
              ...prev.activity,
            ],
          }
        : null
    );
  };

  const handleAddNote = async (text: string) => {
    if (!lead) return;
    const newNote = await addMockLeadNote(lead.id, text);
    setLead((prev) =>
      prev
        ? {
            ...prev,
            notes: [newNote, ...prev.notes],
            lastContactDate: "Today",
          }
        : null
    );
  };

  const handleScheduleFollowUp = async (data: any) => {
    if (!lead) return;
    const newFol = await scheduleMockLeadFollowUp(lead.id, data);
    setLead((prev) =>
      prev
        ? {
            ...prev,
            followUps: [newFol, ...prev.followUps],
            nextFollowUp: `${newFol.date}, ${newFol.time}`,
          }
        : null
    );

    // Schedule 1-day before outer mobile & in-app notification
    await scheduleFollowUpNotifications({
      customerName: lead.companyName,
      followUpDate: data.date,
      followUpTime: data.time,
      purpose: data.purpose,
      notes: data.notes,
    });
  };

  if (!lead) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: t.textSecondary, fontFamily: Typography.regular }}>
          Loading lead profile...
        </Text>
      </View>
    );
  }

  const initials = lead.companyName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const intentColor =
    lead.intentScore >= 80
      ? isDark
        ? "#B7F34A"
        : "#2E7D32"
      : lead.intentScore >= 60
      ? isDark
        ? "#F2B84B"
        : "#C97A1E"
      : isDark
      ? "#8FA09A"
      : "#5E6964";

  return (
    <View style={[styles.container, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      {/* Top Nav */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
            },
            Shadows.card,
          ]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(employee)/leads"))}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={t.text}
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.headerTitle,
            { color: t.text },
          ]}
        >
          Lead Profile
        </Text>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 96 },
        ]}
      >
        {/* Header Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
            },
          ]}
        >
          <View style={styles.avatarRow}>
            <View
              style={[
                styles.largeAvatar,
                {
                  backgroundColor: isDark ? "#15221D" : "#DDF4EA",
                  borderColor: isDark
                    ? "rgba(53, 214, 160, 0.3)"
                    : "rgba(0, 168, 121, 0.3)",
                },
              ]}
            >
              <Text
                style={[
                  styles.largeAvatarText,
                  { color: isDark ? "#35D6A0" : "#00A879" },
                ]}
              >
                {initials}
              </Text>
            </View>

            <View style={styles.companyMeta}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.companyName,
                    { color: t.text },
                  ]}
                >
                  {lead.companyName}
                </Text>
              </View>

              <Text
                style={[
                  styles.contactPerson,
                  { color: t.textSecondary },
                ]}
              >
                {lead.contactPerson} • {lead.phone}
              </Text>

              <View style={styles.scoreRow}>
                <View
                  style={[
                    styles.scorePill,
                    {
                      backgroundColor: isDark
                        ? "rgba(183, 243, 74, 0.12)"
                        : "rgba(166, 226, 46, 0.16)",
                      borderColor: intentColor,
                    },
                  ]}
                >
                  <Text style={[styles.scorePillText, { color: intentColor }]}>
                    Intent Score: {lead.intentScore} / 100
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Intent Meter Visualization */}
          <View style={styles.meterContainer}>
            <View style={styles.meterLabels}>
              <Text style={[styles.meterText, { color: t.textSecondary }]}>
                Opportunity Intent Score
              </Text>
              <Text style={[styles.meterTextBold, { color: intentColor }]}>
                {lead.intentScore}%
              </Text>
            </View>
            <View
              style={[
                styles.meterTrack,
                { backgroundColor: isDark ? "#1C2D26" : "#E4ECE8" },
              ]}
            >
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${lead.intentScore}%`,
                    backgroundColor: intentColor,
                  },
                ]}
              />
            </View>
          </View>

          {/* Sleek Tactile Quick Actions */}
          <View style={styles.primaryActionRow}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnCall,
                {
                  backgroundColor: isDark ? "#103C2E" : "#00A879",
                  borderColor: isDark ? "#35D6A0" : "#008E66",
                },
              ]}
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <Ionicons
                name="call"
                size={15}
                color="#FFFFFF"
              />
              <Text
                style={[styles.actionBtnText, { color: "#FFFFFF" }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Call
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isDark ? "#121F1B" : "#F4F7F5",
                  borderColor: isDark ? "#243831" : "#D8E0DC",
                },
              ]}
              onPress={() => setNoteModalVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons
                name="document-text-outline"
                size={15}
                color={t.text}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  { color: t.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Add Note
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isDark ? "#121F1B" : "#F4F7F5",
                  borderColor: isDark ? "#243831" : "#D8E0DC",
                },
              ]}
              onPress={() => setFollowUpModalVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons
                name="calendar-outline"
                size={15}
                color={t.text}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  { color: t.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Follow-up
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pipeline Position Component (Interactive Stage Ribbon) */}
        <View
          style={[
            styles.pipelineCard,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
            },
          ]}
        >
          <Text
            style={[
              styles.boxTitle,
              { color: t.textSecondary },
            ]}
          >
            PIPELINE STAGE POSITION (TAP TO MOVE)
          </Text>

          <View style={styles.stageStepper}>
            {STAGE_STEPS.map((stageName, index) => {
              const currentIndex = STAGE_STEPS.indexOf(lead.stage);
              const isPassed = index <= currentIndex;
              const isCurrent = index === currentIndex;

              return (
                <TouchableOpacity
                  key={stageName}
                  style={[
                    styles.stepBtn,
                    {
                      backgroundColor: isCurrent
                        ? isDark
                          ? "rgba(53, 214, 160, 0.18)"
                          : "#DDF4EA"
                        : isDark
                        ? "#121F1B"
                        : "#F7F9F8",
                      borderColor: isCurrent
                        ? colors.primary
                        : isDark
                        ? "#294039"
                        : "#D8E0DC",
                    },
                  ]}
                  onPress={() => handleStageChange(stageName)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: isCurrent
                          ? isDark
                            ? "#B7F34A"
                            : "#00A879"
                          : isPassed
                          ? isDark
                            ? "#35D6A0"
                            : "#19C997"
                          : isDark
                          ? "#294039"
                          : "#D8E0DC",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color: isCurrent
                          ? isDark
                            ? "#35D6A0"
                            : "#00A879"
                          : isDark
                          ? "#8FA09A"
                          : "#5E6964",
                        fontFamily: isCurrent
                          ? Typography.bold
                          : Typography.medium,
                      },
                    ]}
                  >
                    {stageName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Segmented Tabs */}
        <View
          style={[
            styles.segmentBar,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
            },
          ]}
        >
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "activity", label: `Activity (${lead.activity.length})` },
              { key: "notes", label: `Notes (${lead.notes.length})` },
              { key: "followups", label: `Follow-ups (${lead.followUps.length})` },
            ] as const
          ).map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.segmentItem,
                  isSelected && {
                    backgroundColor: isDark
                      ? "rgba(53, 214, 160, 0.14)"
                      : "#DDF4EA",
                  },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isSelected
                        ? isDark
                          ? "#35D6A0"
                          : "#00A879"
                        : isDark
                        ? "#8FA09A"
                        : "#5E6964",
                      fontFamily: isSelected
                        ? Typography.semiBold
                        : Typography.medium,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: t.surface,
                borderColor: t.border,
              },
            ]}
          >
            <Text
              style={[
                styles.boxTitle,
                { color: t.textSecondary },
              ]}
            >
              OPPORTUNITY DETAILS
            </Text>

            <View style={styles.grid2x2}>
              <View style={styles.paramItem}>
                <Text style={[styles.paramLabel, { color: isDark ? "#65756F" : "#87928D" }]}>
                  Estimated Value
                </Text>
                <Text style={[styles.paramValue, { color: isDark ? "#B7F34A" : "#2E7D32" }]}>
                  {lead.estimatedValue}
                </Text>
              </View>

              <View style={styles.paramItem}>
                <Text style={[styles.paramLabel, { color: isDark ? "#65756F" : "#87928D" }]}>
                  Lead Source
                </Text>
                <Text style={[styles.paramValue, { color: t.text }]}>
                  {lead.leadSource}
                </Text>
              </View>

              <View style={styles.paramItem}>
                <Text style={[styles.paramLabel, { color: isDark ? "#65756F" : "#87928D" }]}>
                  Assigned Employee
                </Text>
                <Text style={[styles.paramValue, { color: t.text }]}>
                  {lead.assignedEmployee}
                </Text>
              </View>

              <View style={styles.paramItem}>
                <Text style={[styles.paramLabel, { color: isDark ? "#65756F" : "#87928D" }]}>
                  Last Contact
                </Text>
                <Text style={[styles.paramValue, { color: t.text }]}>
                  {lead.lastContactDate}
                </Text>
              </View>

              <View style={styles.paramItem}>
                <Text style={[styles.paramLabel, { color: isDark ? "#65756F" : "#87928D" }]}>
                  Next Follow-up
                </Text>
                <Text
                  style={[
                    styles.paramValue,
                    { color: isDark ? "#35D6A0" : "#00A879", fontFamily: Typography.bold },
                  ]}
                >
                  {lead.nextFollowUp}
                </Text>
              </View>

              <View style={styles.paramItem}>
                <Text style={[styles.paramLabel, { color: isDark ? "#65756F" : "#87928D" }]}>
                  Expected Closing
                </Text>
                <Text style={[styles.paramValue, { color: t.text }]}>
                  {lead.expectedClosingDate}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab 2: Activity Timeline */}
        {activeTab === "activity" && (
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: t.surface,
                borderColor: t.border,
              },
            ]}
          >
            <Text
              style={[
                styles.boxTitle,
                { color: t.textSecondary },
              ]}
            >
              LEAD ACTIVITY TIMELINE
            </Text>

            {lead.activity.map((act, idx) => (
              <TimelineItem
                key={act.id}
                time={`${act.date} • ${act.time}`}
                title={act.title || "Lead Activity"}
                subtitle={act.description}
                type={
                  act.type === "meeting"
                    ? "demo"
                    : act.type === "call"
                    ? "call"
                    : "followup"
                }
                isLast={idx === lead.activity.length - 1}
              />
            ))}
          </View>
        )}

        {/* Tab 3: Notes */}
        {activeTab === "notes" && (
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: t.surface,
                borderColor: t.border,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.boxTitle,
                  { color: t.textSecondary },
                ]}
              >
                PROSPECT NOTES
              </Text>
              <TouchableOpacity
                onPress={() => setNoteModalVisible(true)}
                style={styles.inlineAddBtn}
              >
                <Ionicons
                  name="add"
                  size={14}
                  color={isDark ? "#35D6A0" : "#00A879"}
                />
                <Text
                  style={[
                    styles.inlineAddText,
                    { color: isDark ? "#35D6A0" : "#00A879" },
                  ]}
                >
                  Add Note
                </Text>
              </TouchableOpacity>
            </View>

            {lead.notes.map((n, idx) => (
              <TimelineItem
                key={n.id}
                time={n.date}
                title={n.text}
                subtitle={`By ${n.author}`}
                type="note"
                isLast={idx === lead.notes.length - 1}
              />
            ))}
          </View>
        )}

        {/* Tab 4: Follow-ups */}
        {activeTab === "followups" && (
          <View
            style={[
              styles.cardBox,
              {
                backgroundColor: t.surface,
                borderColor: t.border,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.boxTitle,
                  { color: t.textSecondary },
                ]}
              >
                SCHEDULED FOLLOW-UPS
              </Text>
              <TouchableOpacity
                onPress={() => setFollowUpModalVisible(true)}
                style={styles.inlineAddBtn}
              >
                <Ionicons
                  name="add"
                  size={14}
                  color={isDark ? "#35D6A0" : "#00A879"}
                />
                <Text
                  style={[
                    styles.inlineAddText,
                    { color: isDark ? "#35D6A0" : "#00A879" },
                  ]}
                >
                  Schedule
                </Text>
              </TouchableOpacity>
            </View>

            {lead.followUps.map((fol) => (
              <View
                key={fol.id}
                style={[
                  styles.followUpCard,
                  {
                    backgroundColor: isDark ? "#121F1B" : "#F7F9F8",
                    borderColor: isDark ? "#1C2D26" : "#E8EFEB",
                  },
                ]}
              >
                <View style={styles.followUpTop}>
                  <View style={styles.followUpDateTime}>
                    <Ionicons
                      name="calendar"
                      size={14}
                      color={isDark ? "#35D6A0" : "#00A879"}
                    />
                    <Text
                      style={[
                        styles.followUpDateText,
                        { color: t.text },
                      ]}
                    >
                      {fol.date} at {fol.time}
                    </Text>
                  </View>
                  <StatusPill
                    label={fol.status}
                    variant={fol.status === "scheduled" ? "paid" : "neutral"}
                    size="small"
                  />
                </View>
                <Text
                  style={[
                    styles.followUpPurpose,
                    { color: t.text },
                  ]}
                >
                  {fol.purpose}
                </Text>
                {fol.notes ? (
                  <Text
                    style={[
                      styles.followUpNotes,
                      { color: t.textSecondary },
                    ]}
                  >
                    {fol.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Screen Modals */}
      <AddCustomerRemarkModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        onSave={handleAddNote}
        customerName={lead.companyName}
      />

      <ScheduleFollowUpModal
        visible={followUpModalVisible}
        onClose={() => setFollowUpModalVisible(false)}
        onSchedule={handleScheduleFollowUp}
        targetName={lead.companyName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.bold,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    ...Shadows.card,
  },
  avatarRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  largeAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  largeAvatarText: {
    fontSize: 20,
    fontFamily: Typography.bold,
  },
  companyMeta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 18,
    fontFamily: Typography.bold,
    letterSpacing: -0.3,
  },
  contactPerson: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  scorePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  scorePillText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.bold,
  },
  meterContainer: {
    marginBottom: 14,
  },
  meterLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  meterText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
  },
  meterTextBold: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.bold,
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 3,
  },
  primaryActionRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.12)",
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    ...Shadows.card,
  },
  actionBtnCall: {
    ...Shadows.mintButton,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: Typography.semiBold,
    textAlign: "center",
  },
  pipelineCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    ...Shadows.card,
  },
  stageStepper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  stepBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepText: {
    fontFamily: Typography.medium,
    fontSize: FontSizes.micro,
  },
  segmentBar: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontFamily: Typography.semiBold,
    fontSize: FontSizes.caption,
  },
  cardBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    ...Shadows.card,
  },
  boxTitle: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inlineAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  inlineAddText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.semiBold,
  },
  grid2x2: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 14,
  },
  paramItem: {
    width: "50%",
  },
  paramLabel: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
    marginBottom: 2,
  },
  paramValue: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.semiBold,
  },
  followUpCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  followUpTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  followUpDateTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  followUpDateText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.semiBold,
  },
  followUpPurpose: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.semiBold,
    marginBottom: 2,
  },
  followUpNotes: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
  },
});
