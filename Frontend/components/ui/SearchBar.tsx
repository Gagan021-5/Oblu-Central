import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";
import { triggerSelectionHaptic } from "@/utils/haptics";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholders?: string[];
  intervalMs?: number;
  onClear?: () => void;
  onSubmitEditing?: () => void;
  onFilterPress?: () => void;
  filterActive?: boolean;
  showQuickChips?: boolean;
}

const QUICK_CHIPS = [
  { label: "🔥 Hot Leads", query: "Hot Leads" },
  { label: "📞 Missed Calls", query: "Missed Calls" },
  { label: "💳 Overdue", query: "Overdue" },
  { label: "📄 Proforma", query: "Proforma" },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = "Search...",
  placeholders,
  intervalMs = 2000,
  onClear,
  onSubmitEditing,
  onFilterPress,
  filterActive = false,
  showQuickChips = true,
}) => {
  const { colors, isDark } = useTheme();
  const hasRotatingPlaceholders =
    Array.isArray(placeholders) && placeholders.length > 1;
  const activeList = hasRotatingPlaceholders ? placeholders! : [placeholder];

  const [activeIdx, setActiveIdx] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const shouldAnimate = hasRotatingPlaceholders && value.length === 0;

  useLayoutEffect(() => {
    anim.setValue(0);
  }, [activeIdx, anim]);

  useEffect(() => {
    if (!shouldAnimate) {
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }

    let running = true;
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && running) {
          setActiveIdx((prev) => (prev + 1) % activeList.length);
        }
      });
    }, intervalMs);

    return () => {
      running = false;
      clearTimeout(timer);
      anim.stopAnimation();
    };
  }, [shouldAnimate, activeIdx, activeList.length, intervalMs, anim]);

  const currentIdx = activeIdx % activeList.length;
  const nextIdx = (currentIdx + 1) % activeList.length;
  const placeholderColor = isDark ? "#94A3B8" : "#87928D";

  const outTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -22],
  });
  const outOpacity = anim.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [1, 0.15, 0],
  });
  const inTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });
  const inOpacity = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.4, 1],
  });

  return (
    <View style={styles.wrapper}>
      {/* Main Search Bar Shell */}
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#141822" : "#FFFFFF",
            borderColor: isFocused
              ? isDark ? "#10B981" : "#00A879"
              : isDark ? "rgba(255, 255, 255, 0.09)" : "#D8E0DC",
            borderWidth: 1,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={isFocused ? (isDark ? "#10B981" : "#00A879") : isDark ? "#94A3B8" : "#5E6964"}
          style={styles.searchIcon}
        />
        <View style={styles.inputWrap}>
          {shouldAnimate && (
            <View style={styles.placeholderOverlay} pointerEvents="none">
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.placeholderText,
                  {
                    color: placeholderColor,
                    opacity: outOpacity,
                    transform: [{ translateY: outTranslateY }],
                  },
                ]}
              >
                {activeList[currentIdx]}
              </Animated.Text>
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.placeholderText,
                  {
                    color: placeholderColor,
                    opacity: inOpacity,
                    transform: [{ translateY: inTranslateY }],
                  },
                ]}
              >
                {activeList[nextIdx]}
              </Animated.Text>
            </View>
          )}
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? "#F8FAFC" : "#101513",
              },
            ]}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={hasRotatingPlaceholders ? "" : placeholder}
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
          />
        </View>

        {/* Clear Button */}
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              onChangeText("");
              onClear?.();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={isDark ? "#94A3B8" : "#87928D"}
            />
          </TouchableOpacity>
        )}

        {/* Swiggy/Zomato Right Addon: Divider + Sparkle/Filter Badge */}
        {value.length === 0 && (
          <View style={styles.rightAddonGroup}>
            <View
              style={[
                styles.verticalDivider,
                { backgroundColor: isDark ? "rgba(255, 255, 255, 0.09)" : "#D8E0DC" },
              ]}
            />
            <TouchableOpacity
              onPress={onFilterPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.sparkleButton}
              accessibilityRole="button"
              accessibilityLabel="Search filters and quick actions"
            >
              <Ionicons
                name={onFilterPress ? "options-outline" : "sparkles-outline"}
                size={18}
                color={filterActive ? colors.primary : isDark ? "#10B981" : "#00A879"}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Quick Search Chips below input when focused and query is empty */}
      {showQuickChips && isFocused && value.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChipsScroll}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip.label}
              style={[
                styles.chipPill,
                {
                  backgroundColor: isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(0, 168, 121, 0.08)",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(0, 168, 121, 0.22)",
                },
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                onChangeText(chip.query);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isDark ? "#10B981" : "#00A879" },
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  inputWrap: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    overflow: "hidden",
  },
  placeholderOverlay: {
    position: "absolute",
    left: 7,
    right: 0,
    top: "50%",
    marginTop: -11,
    height: 22,
    justifyContent: "center",
    overflow: "hidden",
  },
  placeholderText: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 22,
    lineHeight: 22,
    fontSize: FontSizes.body,
    fontFamily: Typography.regular,
  },
  rightAddonGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  verticalDivider: {
    width: 1,
    height: 18,
    marginRight: 8,
  },
  sparkleButton: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: FontSizes.body,
    fontFamily: Typography.regular,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  quickChipsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
  },
  chipPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11.5,
    fontFamily: Typography.bold,
    letterSpacing: 0.2,
  },
});
