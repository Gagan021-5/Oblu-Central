import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
  SlideInDown,
  FadeInDown,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { employeeTheme } from "@/constants/employeeTheme";
import { hapticMedium, triggerLightHaptic } from "@/utils/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface QuickActionModalProps {
  visible: boolean;
  onClose: () => void;
  onAddRemark: () => void;
  onScheduleFollowUp: () => void;
  onAddLead: () => void;
  onSyncCalls: () => Promise<void>;
}

interface BentoActionProps {
  index: number;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  onPress: () => void;
  isDark: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
}

const BentoActionCard: React.FC<BentoActionProps> = ({
  index,
  title,
  subtitle,
  icon,
  color,
  bg,
  onPress,
  isDark,
  isLoading,
  isSuccess,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.94, { damping: 16, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1.0, { damping: 18, stiffness: 280 });
  };

  const handlePress = () => {
    hapticMedium();
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify().damping(17).stiffness(240)}
      style={styles.bentoCol}
    >
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={isLoading}
        style={[
          styles.bentoCard,
          {
            backgroundColor: isDark ? "#12151E" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC",
            borderTopColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.98)",
            shadowColor: isDark ? "#000000" : "#0D2B20",
          },
          animStyle,
        ]}
      >
        <View style={[styles.bentoIconBox, { backgroundColor: bg }]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <Ionicons name={isSuccess ? "checkmark-circle" : icon} size={22} color={color} />
          )}
        </View>
        <Text
          style={[styles.bentoTitle, { color: isDark ? "#F8FAFC" : "#101513" }]}
          numberOfLines={1}
        >
          {isSuccess ? "Synced!" : title}
        </Text>
        <Text
          style={[styles.bentoSubtitle, { color: isDark ? "#94A3B8" : "#5E6964" }]}
          numberOfLines={2}
        >
          {isSuccess ? "Device logs up to date" : subtitle}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
};

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  visible,
  onClose,
  onAddRemark,
  onScheduleFollowUp,
  onAddLead,
  onSyncCalls,
}) => {
  const { isDark } = useTheme();
  const t = isDark ? employeeTheme.dark : employeeTheme.light;
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleSyncPress = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      await onSyncCalls();
      setSyncSuccess(true);
      setTimeout(() => {
        setIsSyncing(false);
        setSyncSuccess(false);
        onClose();
      }, 1100);
    } catch {
      setIsSyncing(false);
    }
  };

  const actionItems = [
    {
      id: "remark",
      title: "Add Remark",
      subtitle: "Log client notes, requests & summaries",
      icon: "chatbubble-ellipses-outline" as const,
      color: isDark ? "#10B981" : "#00A879",
      bg: isDark ? "rgba(16, 185, 129, 0.14)" : "#DDF4EA",
      onPress: () => {
        onClose();
        onAddRemark();
      },
    },
    {
      id: "followup",
      title: "Follow-up",
      subtitle: "Schedule client reminder or demo",
      icon: "calendar-outline" as const,
      color: isDark ? "#34D399" : "#19C997",
      bg: isDark ? "rgba(52, 211, 153, 0.14)" : "rgba(25, 201, 151, 0.12)",
      onPress: () => {
        onClose();
        onScheduleFollowUp();
      },
    },
    {
      id: "lead",
      title: "New Lead",
      subtitle: "Create prospective deal in pipeline",
      icon: "person-add-outline" as const,
      color: isDark ? "#B7F34A" : "#2E7D32",
      bg: isDark ? "rgba(183, 243, 74, 0.14)" : "rgba(166, 226, 46, 0.18)",
      onPress: () => {
        onClose();
        onAddLead();
      },
    },
    {
      id: "sync",
      title: "Sync Calls",
      subtitle: "Trigger instant call log telemetry",
      icon: "sync-outline" as const,
      color: isDark ? "#38BDF8" : "#0284C7",
      bg: isDark ? "rgba(56, 189, 248, 0.14)" : "#E0F2FE",
      onPress: handleSyncPress,
      isLoading: isSyncing,
      isSuccess: syncSuccess,
    },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop with smooth fade */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.backdrop,
            { backgroundColor: isDark ? "rgba(0, 0, 0, 0.72)" : "rgba(16, 21, 19, 0.52)" },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* CRED-Style Bento Sheet with spring entrance */}
        <Animated.View
          entering={SlideInDown.springify().damping(17).stiffness(240)}
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#0D0F17" : "#FFFFFF",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC",
              borderTopColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.95)",
            },
          ]}
        >
          {/* Top Drag Handle Pill */}
          <View
            style={[
              styles.handle,
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.16)" : t.border },
            ]}
          />

          {/* Header Row */}
          <View style={styles.sheetHeader}>
            <View>
              <Text
                style={[
                  styles.sheetTitle,
                  { color: isDark ? "#F8FAFC" : "#101513" },
                ]}
              >
                Quick Actions
              </Text>
              <Text
                style={[
                  styles.sheetSubtitle,
                  { color: isDark ? "#94A3B8" : "#5E6964" },
                ]}
              >
                Instant tools for field sales & client management
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                onClose();
              }}
              style={[
                styles.closeButton,
                {
                  backgroundColor: isDark ? "#161A26" : "#F7F9F8",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D8E0DC",
                },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={18}
                color={isDark ? "#94A3B8" : "#5E6964"}
              />
            </TouchableOpacity>
          </View>

          {/* 2-Column Bento Grid */}
          <View style={styles.bentoGrid}>
            {actionItems.map((item, idx) => (
              <BentoActionCard
                key={item.id}
                index={idx}
                title={item.title}
                subtitle={item.subtitle}
                icon={item.icon}
                color={item.color}
                bg={item.bg}
                onPress={item.onPress}
                isDark={isDark}
                isLoading={item.isLoading}
                isSuccess={item.isSuccess}
              />
            ))}
          </View>
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
  sheet: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: Typography.bold,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: FontSizes.caption,
    fontFamily: Typography.regular,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
    gap: 10,
  },
  bentoCol: {
    width: "48.2%",
  },
  bentoCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.2,
    minHeight: 122,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  bentoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  bentoTitle: {
    fontSize: FontSizes.bodySmall,
    fontFamily: Typography.bold,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  bentoSubtitle: {
    fontSize: FontSizes.micro,
    fontFamily: Typography.regular,
    lineHeight: 14,
  },
});
