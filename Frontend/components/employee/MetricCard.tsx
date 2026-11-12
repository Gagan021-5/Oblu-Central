import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography } from "@/constants/theme";
import { MetricBadge3D } from "@/components/employee/SubAppLogo";

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isHighlight?: boolean;
  onPress?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = React.memo(({
  label,
  value,
  subValue,
  icon,
  isHighlight = false,
  onPress,
}) => {
  const { isDark } = useTheme();

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      style={[
        styles.outwardCard,
        {
          backgroundColor: isDark ? "#12201B" : "#FFFFFF",
          borderColor: isHighlight
            ? isDark ? "rgba(53, 214, 160, 0.40)" : "rgba(0, 168, 121, 0.35)"
            : isDark ? "rgba(53, 214, 160, 0.18)" : "rgba(13, 43, 32, 0.08)",
          borderTopColor: isHighlight
            ? isDark ? "rgba(53, 214, 160, 0.65)" : "rgba(0, 168, 121, 0.50)"
            : isDark ? "rgba(53, 214, 160, 0.36)" : "rgba(255, 255, 255, 0.98)",
          borderBottomColor: isDark ? "#080F0C" : "rgba(13, 43, 32, 0.14)",
          shadowColor: isHighlight
            ? isDark ? "#35D6A0" : "#00A879"
            : isDark ? "#000000" : "#0D2B20",
          shadowOpacity: isHighlight ? (isDark ? 0.35 : 0.15) : (isDark ? 0.48 : 0.09),
        },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={styles.topRow}>
        <View style={styles.labelBadge}>
          <Text
            style={[
              styles.labelText,
              {
                color: isHighlight
                  ? isDark ? "#35D6A0" : "#00A879"
                  : isDark ? "#8FA09A" : "#5E6964",
              },
            ]}
            numberOfLines={1}
          >
            {label.toUpperCase()}
          </Text>
        </View>
        {icon && <MetricBadge3D icon={String(icon)} label={label} size={36} borderRadius={11} isHighlight={isHighlight} />}
      </View>

      <Text
        style={[
          styles.valueText,
          {
            color: isHighlight
              ? isDark ? "#35D6A0" : "#00A879"
              : isDark ? "#F1F7F4" : "#101513",
          },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>

      {subValue && (
        <Text
          style={[
            styles.subText,
            { color: isDark ? "#8FA09A" : "#5E6964" },
          ]}
          numberOfLines={1}
        >
          {subValue}
        </Text>
      )}
    </CardWrapper>
  );
});

const styles = StyleSheet.create({
  outwardCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
    zIndex: 2,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelBadge: {
    flex: 1,
    marginRight: 6,
  },
  labelText: {
    fontSize: 10,
    fontFamily: Typography.bold,
    letterSpacing: 0.8,
  },
  valueText: {
    fontSize: 26,
    fontFamily: Typography.bold,
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  subText: {
    fontSize: 12,
    fontFamily: Typography.medium,
    marginTop: 2,
  },
});
