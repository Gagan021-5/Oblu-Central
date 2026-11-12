import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, Radius, Shadows } from "@/constants/theme";
import api from "@/services/api";
import { TrackedPO, PipelineStage, StageLogItem } from "./types";

interface TrackedPODetailModalProps {
  visible: boolean;
  poId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function TrackedPODetailModal({
  visible,
  poId,
  onClose,
  onUpdated,
}: TrackedPODetailModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [po, setPo] = useState<TrackedPO | null>(null);
  const [availableStages, setAvailableStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(false);

  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [qtyDrafts, setQtyDrafts] = useState<{ id: number; name: string; ordered: number; arrived: string; remarks: string }[]>([]);
  const [savingQty, setSavingQty] = useState(false);

  const [stageLogModalOpen, setStageLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<StageLogItem | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [enteredAt, setEnteredAt] = useState("");
  const [exitAt, setExitAt] = useState("");
  const [manualDays, setManualDays] = useState("");
  const [manualEta, setManualEta] = useState("");
  const [stageRemarks, setStageRemarks] = useState("");
  const [savingStage, setSavingStage] = useState(false);

  const loadDetail = async (id: number) => {
    try {
      setLoading(true);
      const res = await api.get(`/inventory/tracked-po/${id}/`);
      if (res.data?.status === "success") {
        setPo(res.data.tracked_order);
        setAvailableStages(res.data.available_stages || []);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load PO tracking detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && poId) {
      loadDetail(poId);
    }
  }, [visible, poId]);

  const openQtyEditor = () => {
    if (!po) return;
    setQtyDrafts(
      po.items.map((it) => ({
        id: it.id,
        name: it.item_name,
        ordered: it.ordered_quantity,
        arrived: String(it.arrived_quantity ?? 0),
        remarks: it.remarks || "",
      }))
    );
    setQtyModalOpen(true);
  };

  const handleSaveQuantities = async () => {
    if (!po) return;
    try {
      setSavingQty(true);
      const res = await api.post(`/inventory/tracked-po/${po.id}/update-quantities/`, {
        items: qtyDrafts.map((d) => ({
          id: d.id,
          arrived_quantity: parseFloat(d.arrived) || 0,
          remarks: d.remarks,
        })),
      });
      if (res.data?.status === "success") {
        setPo(res.data.tracked_order);
        setQtyModalOpen(false);
        onUpdated();
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || err?.message || "Failed to update arrived quantities.");
    } finally {
      setSavingQty(false);
    }
  };

  const openAddStageLog = () => {
    if (!po) return;
    setEditingLog(null);
    setSelectedStageId(availableStages[0]?.id ?? null);
    setEnteredAt(new Date().toISOString().slice(0, 16));
    setExitAt("");
    setManualDays("");
    setManualEta(po.manual_eta || "");
    setStageRemarks("");
    setStageLogModalOpen(true);
  };

  const openEditStageLog = (log: StageLogItem) => {
    if (!po) return;
    setEditingLog(log);
    setSelectedStageId(log.stage_id);
    setEnteredAt(log.entered_at ? log.entered_at.slice(0, 16) : "");
    setExitAt(log.exit_datetime ? log.exit_datetime.slice(0, 16) : "");
    setManualDays(log.manual_days_at_stage !== null ? String(log.manual_days_at_stage) : "");
    setManualEta(po.manual_eta || "");
    setStageRemarks(log.remarks || "");
    setStageLogModalOpen(true);
  };

  const handleSaveStageLog = async () => {
    if (!po || !selectedStageId) {
      Alert.alert("Stage Required", "Please select a stage.");
      return;
    }
    try {
      setSavingStage(true);
      const payload: any = {
        stage_id: selectedStageId,
        entered_at: enteredAt.trim() || null,
        exit_datetime: exitAt.trim() || null,
        manual_days_at_stage: manualDays.trim() || null,
        manual_eta: manualEta.trim() || null,
        remarks: stageRemarks,
      };
      const res = editingLog
        ? await api.patch(`/inventory/stage-logs/${editingLog.id}/edit/`, payload)
        : await api.post(`/inventory/tracked-po/${po.id}/stages/add/`, payload);

      if (res.data?.status === "success") {
        setPo(res.data.tracked_order);
        setStageLogModalOpen(false);
        onUpdated();
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || err?.message || "Failed to save stage log.");
    } finally {
      setSavingStage(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontFamily: Typography.bold, color: colors.primary }}>
              PO TRACKING DETAIL
            </Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }} numberOfLines={1}>
              {po?.voucher_number || "Loading..."}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.cardBorder }]}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading || !po ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 14 }}>
            {/* Summary Card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.summaryGrid}>
                <InfoItem label="PARTY" value={po.party_name} fg={colors.textPrimary} muted={colors.textMuted} />
                <InfoItem label="ORDER DATE" value={po.order_date_display} fg={colors.textPrimary} muted={colors.textMuted} />
                <InfoItem
                  label="STATUS"
                  value={po.status_display}
                  fg={po.status === "arrived" ? colors.success : colors.primary}
                  muted={colors.textMuted}
                />
                <InfoItem label="ETA / ARRIVAL" value={po.arrival_datetime_display || po.expected_delivery} fg={colors.textPrimary} muted={colors.textMuted} />
                <InfoItem
                  label="DAYS TAKEN"
                  value={po.total_days_taken !== null ? `${po.total_days_taken} days` : `${po.days_in_current_stage}d in stage`}
                  fg={colors.textPrimary}
                  muted={colors.textMuted}
                />
                <InfoItem label="PROGRESS" value={`${po.completion_pct}% Arrived`} fg={colors.primary} muted={colors.textMuted} />
              </View>
            </View>

            {/* Items Section */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Items ({po.items.length})</Text>
                <TouchableOpacity onPress={openQtyEditor} style={[styles.primarySmallBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="sync-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.primarySmallText}>Update Arrived Qty</Text>
                </TouchableOpacity>
              </View>

              {po.items.map((it, idx) => (
                <View
                  key={it.id}
                  style={{
                    paddingVertical: 10,
                    borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: colors.cardBorder,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, fontSize: 13 }}>
                      {it.item_name}
                    </Text>
                    {!!it.remarks && (
                      <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: "italic", marginTop: 2 }}>
                        {it.remarks}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: Typography.bold, color: colors.primary, fontSize: 13 }}>
                      {it.arrived_quantity} / {it.ordered_quantity}
                    </Text>
                    <View
                      style={{
                        backgroundColor: it.is_fully_arrived ? colors.successBg : colors.warningBg,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: Radius.pill,
                        marginTop: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: Typography.bold,
                          color: it.is_fully_arrived ? colors.success : colors.warning,
                        }}
                      >
                        {it.is_fully_arrived ? "Fully Arrived" : "Pending"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Stages Section */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pipeline Stages ({po.stage_history.length})</Text>
                <TouchableOpacity onPress={openAddStageLog} style={[styles.primarySmallBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                  <Text style={styles.primarySmallText}>Add Stage</Text>
                </TouchableOpacity>
              </View>

              {po.stage_history.length === 0 ? (
                <Text style={{ color: colors.textMuted, textAlign: "center", paddingVertical: 16 }}>
                  No stages added yet.
                </Text>
              ) : (
                po.stage_history.map((sl, idx) => (
                  <View
                    key={sl.id}
                    style={{
                      paddingVertical: 10,
                      borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: colors.cardBorder,
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                        <Ionicons
                          name={sl.is_current ? "time" : "checkmark-circle"}
                          size={16}
                          color={sl.is_current ? colors.warning : colors.success}
                        />
                        <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, fontSize: 13, flex: 1 }}>
                          {sl.stage_name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => openEditStageLog(sl)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 4 }}
                      >
                        <Ionicons name="create-outline" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 11.5, fontFamily: Typography.bold, color: colors.primary }}>Edit</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        Entered: {sl.entered_at_display}
                      </Text>
                      <Text style={{ fontSize: 11, color: sl.is_current ? colors.warning : colors.textMuted, fontFamily: sl.is_current ? Typography.bold : Typography.regular }}>
                        {sl.exit_datetime_display ? `Exited: ${sl.exit_datetime_display}` : "Still here"}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        Est: {sl.estimated_days}d
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: Typography.bold,
                          color: sl.is_overdue ? colors.error : colors.textPrimary,
                        }}
                      >
                        Actual: {sl.days_at_stage} days
                      </Text>
                    </View>
                    {!!sl.remarks && (
                      <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: "italic" }}>{sl.remarks}</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* Sub-Modal: Update Arrived Quantities */}
        <Modal visible={qtyModalOpen} animationType="slide" onRequestClose={() => setQtyModalOpen(false)}>
          <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
            <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
              <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>
                Update Arrived Quantities
              </Text>
              <TouchableOpacity onPress={() => setQtyModalOpen(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
              {qtyDrafts.map((d, idx) => (
                <View key={d.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={{ fontFamily: Typography.bold, color: colors.textPrimary, marginBottom: 4 }}>{d.name}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 8 }}>Ordered: {d.ordered}</Text>
                  <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.textMuted, marginBottom: 4 }}>
                    ARRIVED QUANTITY
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={d.arrived}
                    onChangeText={(val) =>
                      setQtyDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, arrived: val } : x)))
                    }
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface, marginBottom: 8 }]}
                  />
                  <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.textMuted, marginBottom: 4 }}>
                    REMARKS
                  </Text>
                  <TextInput
                    placeholder="Optional notes..."
                    placeholderTextColor={colors.textMuted}
                    value={d.remarks}
                    onChangeText={(val) =>
                      setQtyDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, remarks: val } : x)))
                    }
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
                  />
                </View>
              ))}
              <TouchableOpacity
                disabled={savingQty}
                onPress={handleSaveQuantities}
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: savingQty ? 0.6 : 1 }]}
              >
                {savingQty ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Sub-Modal: Add / Edit Stage Log */}
        <Modal visible={stageLogModalOpen} animationType="slide" onRequestClose={() => setStageLogModalOpen(false)}>
          <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
            <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
              <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>
                {editingLog ? "Edit Stage Log" : "Add Stage to PO"}
              </Text>
              <TouchableOpacity onPress={() => setStageLogModalOpen(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.textMuted, marginBottom: 6 }}>
                  SELECT PIPELINE STAGE
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {availableStages.map((s) => {
                    const active = selectedStageId === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSelectedStageId(s.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: Radius.pill,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.cardBorder,
                          backgroundColor: active ? colors.primary : colors.secondarySurface,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: active ? "#FFF" : colors.textPrimary }}>
                          {s.name} ({s.estimated_days}d)
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>ENTERED AT (YYYY-MM-DDTHH:MM)</Text>
                <TextInput
                  placeholder="YYYY-MM-DDTHH:MM"
                  placeholderTextColor={colors.textMuted}
                  value={enteredAt}
                  onChangeText={setEnteredAt}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
                />

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.textMuted }}>
                    EXITED AT (OPTIONAL — BLANK = STILL HERE)
                  </Text>
                  <TouchableOpacity onPress={() => setExitAt(new Date().toISOString().slice(0, 16))}>
                    <Text style={{ fontSize: 11, fontFamily: Typography.bold, color: colors.primary }}>Set Now</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="YYYY-MM-DDTHH:MM or leave empty"
                  placeholderTextColor={colors.textMuted}
                  value={exitAt}
                  onChangeText={setExitAt}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface, marginTop: 4 }]}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MANUAL DAYS AT STAGE (OPTIONAL)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="Leave blank to calculate from timestamps"
                  placeholderTextColor={colors.textMuted}
                  value={manualDays}
                  onChangeText={setManualDays}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MANUAL ETA (YYYY-MM-DD, OPTIONAL)</Text>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  value={manualEta}
                  onChangeText={setManualEta}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface }]}
                />

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>REMARKS</Text>
                <TextInput
                  multiline
                  placeholder="Notes about this stage..."
                  placeholderTextColor={colors.textMuted}
                  value={stageRemarks}
                  onChangeText={setStageRemarks}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.secondarySurface, minHeight: 70 }]}
                />
              </View>

              <TouchableOpacity
                disabled={savingStage}
                onPress={handleSaveStageLog}
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: savingStage ? 0.6 : 1 }]}
              >
                {savingStage ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Stage Log</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function InfoItem({ label, value, fg, muted }: { label: string; value: string; fg: string; muted: string }) {
  return (
    <View style={{ width: "47%" }}>
      <Text style={{ fontSize: 9.5, fontFamily: Typography.bold, color: muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: Typography.bold, color: fg, marginTop: 2 }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

interface TrackedShipmentsSectionProps {
  orders: TrackedPO[];
  onRefresh: () => void;
}

export function TrackedShipmentsSection({ orders, onRefresh }: TrackedShipmentsSectionProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "arrived">("all");
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);

  const filtered = orders.filter((po) => {
    if (statusFilter !== "all" && po.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        po.voucher_number.toLowerCase().includes(q) ||
        po.party_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["all", "active", "arrived"] as const).map((st) => {
          const active = statusFilter === st;
          return (
            <TouchableOpacity
              key={st}
              onPress={() => setStatusFilter(st)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: Radius.pill,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.cardBorder,
                backgroundColor: active ? colors.primary : colors.card,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: active ? "#FFF" : colors.textMuted }}>
                {st === "all" ? `All (${orders.length})` : st === "active" ? "Active" : "Arrived"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          placeholder="Search PO number or supplier..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 13 }}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="boat-outline" size={38} color={colors.textMuted} />
          <Text style={{ fontSize: 16, fontFamily: Typography.bold, color: colors.textPrimary }}>No Tracked Shipments</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
            Start tracking a Tally Purchase Order from the sidebar to monitor stages and arrivals.
          </Text>
        </View>
      ) : (
        filtered.map((po) => {
          const isArrived = po.status === "arrived" || po.completion_pct >= 100;
          return (
            <TouchableOpacity
              key={po.id}
              activeOpacity={0.8}
              onPress={() => setSelectedPoId(po.id)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 14.5, fontFamily: Typography.bold, color: colors.textPrimary }}>
                    {po.voucher_number}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{po.party_name}</Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: Radius.pill,
                    backgroundColor: isArrived ? colors.successBg : colors.primaryLight,
                  }}
                >
                  <Text style={{ fontSize: 10.5, fontFamily: Typography.bold, color: isArrived ? colors.success : colors.primary }}>
                    {po.status_display} · {po.completion_pct}%
                  </Text>
                </View>
              </View>

              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.secondarySurface, overflow: "hidden", marginBottom: 8 }}>
                <View style={{ height: "100%", width: `${Math.min(po.completion_pct, 100)}%`, backgroundColor: colors.primary }} />
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Ordered: {po.order_date_display}</Text>
                <Text style={{ fontSize: 11, color: colors.primary, fontFamily: Typography.bold }}>
                  {po.current_stage_name ? `Stage: ${po.current_stage_name}` : `ETA: ${po.expected_delivery}`}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.cardBorder }}>
                <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                  {po.items.length} items · {po.stage_history.length} stage logs
                </Text>
                <Text style={{ fontSize: 12, fontFamily: Typography.bold, color: colors.primary }}>
                  Open Details →
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <TrackedPODetailModal
        visible={selectedPoId !== null}
        poId={selectedPoId}
        onClose={() => setSelectedPoId(null)}
        onUpdated={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    ...Shadows.card,
  },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  sectionTitle: { fontSize: 14.5, fontFamily: Typography.bold },
  primarySmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  primarySmallText: { color: "#FFFFFF", fontSize: 11.5, fontFamily: Typography.bold },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  fieldLabel: { fontSize: 11, fontFamily: Typography.bold, marginTop: 12, marginBottom: 4 },
  saveBtn: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontFamily: Typography.bold, fontSize: 15 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
});
