import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { Typography, FontSizes } from "@/constants/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholders?: string[];
  intervalMs?: number;
  onClear?: () => void;
  onFilterPress?: () => void;
  filterActive?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = "Search...",
  placeholders,
  intervalMs = 2000,
  onClear,
  onFilterPress,
  filterActive = false,
}) => {
  const { colors, isDark } = useTheme();
  const hasRotatingPlaceholders =
    Array.isArray(placeholders) && placeholders.length > 1;
  const activeList = hasRotatingPlaceholders ? placeholders! : [placeholder];

  const [activeIdx, setActiveIdx] = useState(0);
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
  const placeholderColor = isDark ? "#65756F" : "#87928D";

  const outTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });
  const outOpacity = anim.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [1, 0.15, 0],
  });
  const inTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const inOpacity = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.4, 1],
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0E1714" : "#FFFFFF",
          borderColor: isDark ? "#294039" : "#D8E0DC",
        },
      ]}
    >
      <Ionicons
        name="search-outline"
        size={18}
        color={isDark ? "#8FA09A" : "#5E6964"}
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
              color: isDark ? "#F1F7F4" : "#101513",
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={hasRotatingPlaceholders ? "" : placeholder}
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
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
            color={isDark ? "#8FA09A" : "#87928D"}
          />
        </TouchableOpacity>
      )}
      {onFilterPress && (
        <TouchableOpacity
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel="Filter and sort customers"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.filterButton}
        >
          <Ionicons
            name="options-outline"
            size={21}
            color={filterActive ? colors.primary : isDark ? "#8FA09A" : "#5E6964"}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    overflow: "hidden",
  },
  placeholderText: {
    position: "absolute",
    left: 0,
    right: 0,
    fontSize: FontSizes.body,
    fontFamily: Typography.regular,
  },
  filterButton: {
    width: 30,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.body,
    fontFamily: Typography.regular,
    paddingVertical: 0,
  },
});
