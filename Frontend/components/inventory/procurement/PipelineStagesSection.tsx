import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";
import { PipelineStage } from "./types";

interface PipelineStagesSectionProps {
  stages: PipelineStage[];
  onRefresh: () => void;
}

export function PipelineStagesSection({ stages, onRefresh }: PipelineStagesSectionProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [name, setName] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("0");
  const [sortOrder, setSortOrder] = useState("0");
  const [isFinal, setIsFinal] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingStage(null);
    setName("");
    setEstimatedDays("3");
    setSortOrder(String(stages.length + 1));
    setIsFinal(false);
    setIsActive(true);
    setFormModalOpen(true);
  };

  const openEditModal = (stage: PipelineStage) => {
    setEditingStage(stage);
    setName(stage.name);
    setEstimatedDays(String(stage.estimated_days));
    setSortOrder(String(stage.sort_order));
    setIsFinal(stage.is_final_stage);
    setIsActive(stage.is_active);
    setFormModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Stage name is required.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        estimated_days: parseInt(estimatedDays, 10) || 0,
        sort_order: parseInt(sortOrder, 10) || 0,
        is_final_stage: isFinal,
        is_active: isActive,
      };
      if (editingStage) {
        await api.patch(`/inventory/stages/${editingStage.id}/`, payload);
      } else {
        await api.post("/inventory/stages/", payload);
      }
      setFormModalOpen(false);
      onRefresh();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || err?.message || "Failed to save pipeline stage.");
    } finally {
      setSaving(false);
    }
  };

  const cardBg = isDark ? "#111D19" : "#FFFFFF";
  const border = isDark ? "#1E332D" : "#E2E8F0";
  const fg = colors.textPrimary;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const bg = isDark ? "#080F0D" : "#F8FAFC";

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 13.5, fontFamily: Typography.bold, color: muted }}>
          {stages.length} Workflow Stage{stages.length === 1 ? "" : "s"}
        </Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addBtn}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 12.5 }}>Add Stage</Text>
        </TouchableOpacity>
      </View>

      {stages.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Ionicons name="git-network-outline" size={38} color={muted} />
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg }}>No Pipeline Stages</Text>
          <Text style={{ fontSize: 12, color: muted, textAlign: "center" }}>
            Click "Add Stage" to configure PO workflow milestones.
          </Text>
        </View>
      ) : (
        stages.map((stage, idx) => (
          <View
            key={stage.id}
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: border,
                opacity: stage.is_active ? 1 : 0.65,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View
                style={[
                  styles.orderCircle,
                  { backgroundColor: stage.is_final_stage ? "rgba(16,185,129,0.15)" : "rgba(0,168,121,0.12)" },
                ]}
              >
                <Text
                  style={{
                    fontFamily: Typography.bold,
                    fontSize: 12,
                    color: stage.is_final_stage ? "#10B981" : "#00A879",
                  }}
                >
                  #{stage.sort_order ?? idx + 1}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: Typography.bold, color: fg }}>{stage.name}</Text>
                <Text style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                  Estimated: {stage.estimated_days} days · {stage.active_pos_count ?? 0} Active POs
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => openEditModal(stage)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
              >
                <Ionicons name="create-outline" size={15} color="#6366F1" />
                <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: "#6366F1" }}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: stage.is_final_stage ? "rgba(99,102,241,0.12)" : isDark ? "#1E293B" : "#F1F5F9" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontFamily: Typography.bold,
                    color: stage.is_final_stage ? "#6366F1" : muted,
                  }}
                >
                  {stage.is_final_stage ? "Final Stage" : "Standard"}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: stage.is_active ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.15)" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontFamily: Typography.bold,
                    color: stage.is_active ? "#10B981" : muted,
                  }}
                >
                  {stage.is_active ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}

      {/* Add / Edit Stage Modal */}
      <Modal visible={formModalOpen} animationType="slide" onRequestClose={() => setFormModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
          <View style={[styles.headerBar, { backgroundColor: cardBg, borderBottomColor: border }]}>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: fg }}>
              {editingStage ? "Edit Pipeline Stage" : "Add Pipeline Stage"}
            </Text>
            <TouchableOpacity onPress={() => setFormModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={20} color={fg} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border, gap: 12 }]}>
              <View>
                <Text style={[styles.label, { color: muted }]}>STAGE NAME</Text>
                <TextInput
                  placeholder="e.g. ERKODENT S2 CUSTOMS CLEARANCE"
                  placeholderTextColor={muted}
                  value={name}
                  onChangeText={setName}
                  style={[styles.input, { color: fg, borderColor: border, backgroundColor: bg }]}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: muted }]}>ESTIMATED DAYS</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={estimatedDays}
                    onChangeText={setEstimatedDays}
                    style={[styles.input, { color: fg, borderColor: border, backgroundColor: bg }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: muted }]}>SORT ORDER</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={sortOrder}
                    onChangeText={setSortOrder}
                    style={[styles.input, { color: fg, borderColor: border, backgroundColor: bg }]}
                  />
                </View>
              </View>

              <View style={[styles.switchRow, { backgroundColor: bg, borderColor: border }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 13 }}>Final Stage?</Text>
                  <Text style={{ fontSize: 11, color: muted }}>
                    Marks Purchase Order as Arrived when completed
                  </Text>
                </View>
                <Switch value={isFinal} onValueChange={setIsFinal} trackColor={{ true: "#00A879" }} />
              </View>

              <View style={[styles.switchRow, { backgroundColor: bg, borderColor: border }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: Typography.bold, color: fg, fontSize: 13 }}>Active Stage?</Text>
                  <Text style={{ fontSize: 11, color: muted }}>
                    Available for assignment in PO tracking
                  </Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: "#00A879" }} />
              </View>
            </View>

            <TouchableOpacity
              disabled={saving}
              onPress={handleSave}
              style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Stage</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  orderCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  label: { fontSize: 11, fontFamily: Typography.bold, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 12,
  },
  saveBtn: {
    backgroundColor: "#00A879",
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 15 },
});
