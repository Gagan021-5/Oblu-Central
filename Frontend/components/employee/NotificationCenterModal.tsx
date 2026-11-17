import React, { useState, useMemo, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  FadeInDown,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { employeeTheme } from "@/constants/employeeTheme";
import { useNotifications } from "@/contexts/NotificationContext";
import { FollowUpNotificationItem } from "@/services/followUpNotificationService";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

type FilterTab = "all" | "unread" | "followups" | "tickets";

interface NotificationCardItemProps {
  item: FollowUpNotificationItem;
  index: number;
  isDark: boolean;
  onPress: () => void;
  onDelete: () => void;
}

const NotificationCardItem: React.FC<NotificationCardItemProps> = ({
  item,
  index,
  isDark,
  onPress,
  onDelete,
}) => {
  const scale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);
  const isTicket = item.type === "payment_ticket_raised";
  const isUnread = !item.read;

  useEffect(() => {
    if (isUnread) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800 }),
          withTiming(1.0, { duration: 800 })
        ),
        -1,
        true
      );
    }
  }, [isUnread, pulseOpacity]);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 16, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1.0, { damping: 18, stiffness: 280 });
  };

  const handlePress = () => {
    triggerLightHaptic();
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const accentColor = isTicket
    ? "#EF4444"
    : isDark
    ? "#10B981"
    : "#00A879";

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 35).springify().damping(18).stiffness(240)}
      style={animStyle}
    >
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.notifCard,
          {
            backgroundColor: isDark
              ? isUnread
                ? "#12151E"
                : "#0D0F17"
              : isUnread
              ? "#FFFFFF"
              : "#F7F9F8",
            borderColor: isDark
              ? isUnread
                ? "rgba(16, 185, 129, 0.28)"
                : "rgba(255, 255, 255, 0.07)"
              : isUnread
              ? "rgba(0, 168, 121, 0.25)"
              : "#E1E8E4",
            borderTopColor: isDark
              ? isUnread
                ? "rgba(255, 255, 255, 0.14)"
                : "rgba(255, 255, 255, 0.08)"
              : "rgba(255, 255, 255, 0.95)",
            shadowColor: isDark ? "#000000" : "#0D2B20",
          },
        ]}
      >
        {/* Subtle Left Accent Bar for Unread */}
        {isUnread && (
          <View
            style={[
              styles.leftAccentBar,
              { backgroundColor: accentColor },
            ]}
          />
        )}

        {/* Top Row: Clean Category Pill + Time + Delete */}
        <View style={styles.notifTopRow}>
          <View style={styles.pillContainer}>
            {isUnread && (
              <Animated.View
                style={[
                  styles.liveDot,
                  { backgroundColor: accentColor },
                  pulseDotStyle,
                ]}
              />
            )}
            <View
              style={[
                styles.cleanPill,
                {
                  backgroundColor: isTicket
                    ? isDark
                      ? "rgba(239, 68, 68, 0.14)"
                      : "#FDECEB"
                    : isDark
                    ? "rgba(16, 185, 129, 0.14)"
                    : "#DDF4EA",
                },
              ]}
            >
              <Ionicons
                name={isTicket ? "alert-circle" : "calendar"}
                size={11}
                color={accentColor}
              />
              <Text style={[styles.cleanPillText, { color: accentColor }]}>
                {isTicket ? "Payment Ticket" : "Follow-up"}
              </Text>
            </View>
          </View>

          <View style={styles.topRightActions}>
            <Text
              style={[
                styles.itemDate,
                {
                  color: isTicket
                    ? isDark
                      ? "#F87171"
                      : "#DC2626"
                    : isDark
                    ? "#94A3B8"
                    : "#5E6964",
                },
              ]}
              numberOfLines={1}
            >
              {isTicket
                ? `Overdue • ${item.expectedDate || "Passed"}`
                : `${item.followUpDate || "Scheduled"} • ${item.followUpTime || ""}`}
            </Text>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                triggerLightHaptic();
                onDelete();
              }}
              style={styles.trashIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="trash-outline"
                size={14}
                color={isDark ? "#64748B" : "#8FA09A"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer Name */}
        <Text
          style={[
            styles.customerTitle,
            { color: isDark ? "#F8FAFC" : "#101513" },
          ]}
          numberOfLines={1}
        >
          {item.customerName}
        </Text>

        {/* Context Line: Invoice or Purpose */}
        <View style={styles.contextLine}>
          <Ionicons
            name={isTicket ? "receipt-outline" : "bookmark-outline"}
            size={13}
            color={isDark ? "#94A3B8" : "#5E6964"}
          />
          <Text
            style={[
              styles.contextText,
              { color: isDark ? "#94A3B8" : "#5E6964" },
            ]}
            numberOfLines={1}
          >
            {isTicket
              ? `Invoice #${item.invoiceNumber || "INV"} • Amount: ${item.amount || ""}`
              : item.purpose || "Customer Follow-up"}
          </Text>
        </View>

        {/* Note / Snippet */}
        {isTicket ? (
          <Text
            style={[
              styles.messageSnippet,
              { color: isDark ? "#CBD5E1" : "#4A5852" },
            ]}
            numberOfLines={2}
          >
            Expected payment date ({item.expectedDate}) passed. Automated alert dispatched to accounts.
          </Text>
        ) : item.notes ? (
          <Text
            style={[
              styles.messageSnippet,
              { color: isDark ? "#CBD5E1" : "#4A5852" },
            ]}
            numberOfLines={2}
          >
            "{item.notes}"
          </Text>
        ) : null}

        {/* Footer Action Link */}
        <View style={styles.notifFooter}>
          <Text
            style={[
              styles.actionHint,
              { color: isDark ? "#10B981" : "#00A879" },
            ]}
          >
            {isTicket ? "View invoice details" : "View customer profile"}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={12}
            color={isDark ? "#10B981" : "#00A879"}
          />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  visible,
  onClose,
}) => {
  const { isDark } = useTheme();
  const t = isDark ? employeeTheme.dark : employeeTheme.light;
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const ticketCount = useMemo(
    () => notifications.filter((n) => n.type === "payment_ticket_raised").length,
    [notifications]
  );

  const followUpCount = useMemo(
    () => notifications.filter((n) => n.type === "1_day_reminder").length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case "unread":
        return notifications.filter((n) => !n.read);
      case "followups":
        return notifications.filter((n) => n.type === "1_day_reminder");
      case "tickets":
        return notifications.filter((n) => n.type === "payment_ticket_raised");
      case "all":
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  const handleItemPress = (customerId?: string) => {
    onClose();
    if (customerId) {
      router.push(`/(employee)/customers/${customerId}` as any);
    } else {
      router.push("/(employee)/customers" as any);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.backdrop,
            { backgroundColor: isDark ? "rgba(0,0,0,0.72)" : "rgba(16,21,19,0.52)" },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Modal Tray Sheet */}
        <Animated.View
          entering={SlideInDown.springify().damping(17).stiffness(240)}
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? "#0D0F17" : "#FFFFFF",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC",
              borderTopColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.95)",
            },
          ]}
        >
          {/* Drag Handle Pill */}
          <View
            style={[
              styles.handle,
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.16)" : t.border },
            ]}
          />

          {/* Clean Header */}
          <View
            style={[
              styles.header,
              {
                borderBottomColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(216, 224, 220, 0.8)",
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? "#F8FAFC" : "#101513" },
                ]}
              >
                Notifications
              </Text>
              {unreadCount > 0 && (
                <View
                  style={[
                    styles.unreadBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.14)"
                        : "#DDF4EA",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.unreadBadgeText,
                      { color: isDark ? "#10B981" : "#00A879" },
                    ]}
                  >
                    {unreadCount} new
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.headerRight}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    triggerSelectionHaptic();
                    markAllAsRead();
                  }}
                  style={styles.markAllReadBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.markAllReadText,
                      { color: isDark ? "#10B981" : "#00A879" },
                    ]}
                  >
                    Mark all read
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  onClose();
                }}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDark ? "#161A26" : "#F7F9F8",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC",
                  },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={isDark ? "#94A3B8" : "#5E6964"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Refined Filter Chips */}
          <View
            style={[
              styles.filterRow,
              {
                borderBottomColor: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(216, 224, 220, 0.6)",
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              {(
                [
                  { key: "all", label: `All (${notifications.length})` },
                  { key: "unread", label: `Unread (${unreadCount})` },
                  { key: "followups", label: `Follow-ups (${followUpCount})` },
                  { key: "tickets", label: `Tickets (${ticketCount})` },
                ] as const
              ).map((tab) => {
                const isSelected = activeFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(16, 185, 129, 0.14)"
                            : "#DDF4EA"
                          : isDark
                          ? "#161A26"
                          : "#F7F9F8",
                        borderColor: isSelected
                          ? isDark
                            ? "#10B981"
                            : "#00A879"
                          : isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "#D8E0DC",
                      },
                    ]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setActiveFilter(tab.key);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: isSelected
                            ? isDark
                              ? "#10B981"
                              : "#00A879"
                            : isDark
                            ? "#94A3B8"
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
            </ScrollView>
          </View>

          {/* Notification Cards List with Cascade Animation */}
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {filteredNotifications.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIconBg,
                    {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.10)"
                        : "#EEF8F4",
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done-circle-outline"
                    size={36}
                    color={isDark ? "#10B981" : "#00A879"}
                  />
                </View>
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: isDark ? "#F8FAFC" : "#101513" },
                  ]}
                >
                  All caught up
                </Text>
                <Text
                  style={[
                    styles.emptyBody,
                    { color: isDark ? "#94A3B8" : "#5E6964" },
                  ]}
                >
                  {activeFilter === "unread"
                    ? "You have no unread notifications."
                    : activeFilter === "tickets"
                    ? "No raised payment tickets."
                    : "Follow-up reminders and payment alerts will appear here."}
                </Text>
              </View>
            ) : (
              filteredNotifications.map((item, idx) => (
                <NotificationCardItem
                  key={item.id}
                  item={item}
                  index={idx}
                  isDark={isDark}
                  onPress={() => handleItemPress(item.customerId)}
                  onDelete={() => deleteNotification(item.id)}
                />
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingBottom: 28,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Typography.bold,
    letterSpacing: -0.3,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontFamily: Typography.bold,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  markAllReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  markAllReadText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.semiBold,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: FontSizes.caption,
  },
  list: {
    flexGrow: 0,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },
  notifCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    padding: 14,
    position: "relative",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  leftAccentBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  notifTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cleanPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cleanPillText: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.semiBold,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemDate: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.medium,
  },
  trashIconBtn: {
    padding: 2,
  },
  customerTitle: {
    fontSize: FontSizes.body,
    fontFamily: Typography.semiBold,
    marginBottom: 4,
  },
  contextLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  contextText: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
  },
  messageSnippet: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    lineHeight: 18,
    marginBottom: 8,
  },
  notifFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  actionHint: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.bold,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: FontSizes.body,
    fontFamily: Typography.bold,
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    textAlign: "center",
    lineHeight: 18,
  },
});
