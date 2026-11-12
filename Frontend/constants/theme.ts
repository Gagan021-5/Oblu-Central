/**
 * Graphite Mint / NEXUS CRM Design System
 * Single source of truth for color tokens, typography, and controlled geometry.
 */

import { Platform } from "react-native";

// ── Light Theme Palette ────────────────────────────────────────────────
export const LightTheme = {
  isDark: false,
  background: "#F1F4F2",
  primarySurface: "#FFFFFF",
  secondarySurface: "#F7F9F8",
  mintTintedSurface: "#DDF4EA",
  strongSurface: "#E4ECE7",
  card: "#FFFFFF",
  cardSecondary: "#F7F9F8",
  cardElevated: "#FFFFFF",
  cardBorder: "#D8E0DC",
  border: "#D8E0DC",
  borderLight: "#E8EFEB",
  borderDark: "#C5D1CB",

  // Text
  textPrimary: "#101513",
  textSecondary: "#5E6964",
  textMuted: "#636F69",
  textLight: "#8B9590",

  // Mint & Accent
  strongGraphite: "#18312A",
  primary: "#00A879",
  primaryHover: "#009168",
  primaryLight: "rgba(0, 168, 121, 0.12)",
  primaryBorder: "rgba(0, 168, 121, 0.28)",
  primaryGlow: "rgba(0, 168, 121, 0.16)",
  primarySoft: "rgba(0, 168, 121, 0.08)",
  brightMint: "#19C997",
  acidLime: "#A6E22E",
  acidLimeSoft: "rgba(166, 226, 46, 0.14)",

  // Semantic
  success: "#00A879",
  successBg: "#DDF4EA",
  warning: "#D69227",
  warningBg: "rgba(214, 146, 39, 0.12)",
  error: "#E05260",
  errorBg: "rgba(224, 82, 96, 0.12)",

  // Call Types & Status
  incoming: "#00A879",
  incomingBg: "#DDF4EA",
  outgoing: "#18312A",
  outgoingBg: "rgba(24, 49, 42, 0.08)",
  missed: "#E05260",
  missedBg: "rgba(224, 82, 96, 0.12)",

  // Legacy & Compatibility Aliases
  emerald: "#00A879",
  emeraldLight: "#DDF4EA",
  emeraldGlow: "rgba(0, 168, 121, 0.20)",
  amber: "#D69227",
  amberLight: "rgba(214, 146, 39, 0.12)",
  cyan: "#19C997",
  cyanLight: "rgba(25, 201, 151, 0.12)",
  rose: "#E05260",
  roseLight: "rgba(224, 82, 96, 0.12)",
  blue: "#00A879",
  blueLight: "rgba(0, 168, 121, 0.12)",
  secondary: "#19C997",
  secondaryLight: "rgba(25, 201, 151, 0.12)",
  secondaryGlow: "rgba(25, 201, 151, 0.20)",

  // UI Elements
  inputBg: "#FFFFFF",
  inputBorder: "#D8E0DC",
  tabBarBg: "#18312A", // Greenish graphite dock
  tabBarBorder: "rgba(255, 255, 255, 0.08)",
  tabActive: "#19C997",
  tabInactive: "#87928D",
  overlay: "rgba(16, 21, 19, 0.5)",
  dockSurface: "#18312A",

  // Expo Theme Compatibility
  light: {
    text: "#101513",
    background: "#F1F4F2",
    tint: "#00A879",
    icon: "#5E6964",
    tabIconDefault: "#87928D",
    tabIconSelected: "#00A879",
  },
  dark: {
    text: "#F2F8F5",
    background: "#0E1A16",
    tint: "#35D6A0",
    icon: "#9CB3AA",
    tabIconDefault: "#738A81",
    tabIconSelected: "#35D6A0",
  },
};

// ── Dark Theme Palette ─────────────────────────────────────────────────
export const DarkTheme = {
  isDark: true,
  background: "#0E1A16",
  primarySurface: "#15251F",
  secondarySurface: "#1C3028",
  mintTintedSurface: "rgba(53, 214, 160, 0.14)",
  strongSurface: "#223930",
  card: "#15251F",
  cardSecondary: "#1B2E27",
  cardElevated: "#20362E",
  cardBorder: "#2D493F",
  border: "#2D493F",
  borderLight: "#233B32",
  borderDark: "#3D5E52",

  // Text
  textPrimary: "#F2F8F5",
  textSecondary: "#9CB3AA",
  textMuted: "#738A81",
  textLight: "#536860",

  // Mint & Accent
  strongGraphite: "#1B2B25",
  primary: "#35D6A0",
  primaryHover: "#28C28F",
  primaryLight: "rgba(53, 214, 160, 0.12)",
  primaryBorder: "rgba(53, 214, 160, 0.28)",
  primaryGlow: "rgba(53, 214, 160, 0.20)",
  primarySoft: "rgba(53, 214, 160, 0.08)",
  brightMint: "#20E3AD",
  acidLime: "#B7F34A",
  acidLimeSoft: "rgba(183, 243, 74, 0.14)",

  // Semantic
  success: "#35D6A0",
  successBg: "rgba(53, 214, 160, 0.14)",
  warning: "#F3B84B",
  warningBg: "rgba(243, 184, 75, 0.14)",
  error: "#FF6B78",
  errorBg: "rgba(255, 107, 120, 0.14)",

  // Call Types & Status
  incoming: "#35D6A0",
  incomingBg: "rgba(53, 214, 160, 0.14)",
  outgoing: "#20E3AD",
  outgoingBg: "rgba(32, 227, 173, 0.10)",
  missed: "#FF6B78",
  missedBg: "rgba(255, 107, 120, 0.14)",

  // Legacy & Compatibility Aliases
  emerald: "#35D6A0",
  emeraldLight: "rgba(53, 214, 160, 0.14)",
  emeraldGlow: "rgba(53, 214, 160, 0.20)",
  amber: "#F3B84B",
  amberLight: "rgba(243, 184, 75, 0.14)",
  cyan: "#20E3AD",
  cyanLight: "rgba(32, 227, 173, 0.12)",
  rose: "#FF6B78",
  roseLight: "rgba(255, 107, 120, 0.14)",
  blue: "#35D6A0",
  blueLight: "rgba(53, 214, 160, 0.12)",
  secondary: "#20E3AD",
  secondaryLight: "rgba(32, 227, 173, 0.12)",
  secondaryGlow: "rgba(32, 227, 173, 0.20)",

  // UI Elements
  inputBg: "#14241E",
  inputBorder: "#2D493F",
  tabBarBg: "#13231D",
  tabBarBorder: "#2D493F",
  tabActive: "#35D6A0",
  tabInactive: "#738A81",
  overlay: "rgba(6, 12, 10, 0.72)",
  dockSurface: "#13231D",

  // Expo Theme Compatibility
  light: {
    text: "#101513",
    background: "#F1F4F2",
    tint: "#00A879",
    icon: "#5E6964",
    tabIconDefault: "#87928D",
    tabIconSelected: "#00A879",
  },
  dark: {
    text: "#F2F8F5",
    background: "#0E1A16",
    tint: "#35D6A0",
    icon: "#9CB3AA",
    tabIconDefault: "#738A81",
    tabIconSelected: "#35D6A0",
  },
};

// Default export alias for backwards-compatibility
export const Colors = LightTheme;

export type ThemeColors = typeof DarkTheme;

// ── Typography ────────────────────────────────────────────────────────
export const Typography = {
  // Headings & Display (General Sans)
  heading: "GeneralSans-Bold",
  headingExtra: "GeneralSans-Bold",
  headingSemi: "GeneralSans-Semibold",
  headingMedium: "GeneralSans-Medium",
  headingRegular: "GeneralSans-Regular",

  // Core App Font Family
  regular: "GeneralSans-Regular",
  medium: "GeneralSans-Medium",
  semiBold: "GeneralSans-Semibold",
  bold: "GeneralSans-Bold",
  extraBold: "GeneralSans-Bold",

  // Explicit Weights
  generalSansBold: "GeneralSans-Bold",
  generalSansSemiBold: "GeneralSans-Semibold",
  generalSansMedium: "GeneralSans-Medium",
  generalSansRegular: "GeneralSans-Regular",
  generalSansLight: "GeneralSans-Light",
  generalSansExtraLight: "GeneralSans-Extralight",
  generalSansItalic: "GeneralSans-Italic",
  generalSansBoldItalic: "GeneralSans-BoldItalic",
  generalSansMediumItalic: "GeneralSans-MediumItalic",
  generalSansLightItalic: "GeneralSans-LightItalic",
  generalSansExtraLightItalic: "GeneralSans-ExtralightItalic",
  generalSansSemiBoldItalic: "GeneralSans-SemiboldItalic",

  // Backward compatibility aliases
  clashBold: "GeneralSans-Bold",
  clashSemiBold: "GeneralSans-Semibold",
  clashMedium: "GeneralSans-Medium",
  clashRegular: "GeneralSans-Regular",
  clashLight: "GeneralSans-Light",
  clashExtraLight: "GeneralSans-Light",

  gambettaBold: "GeneralSans-Bold",
  gambettaSemiBold: "GeneralSans-Semibold",
  gambettaMedium: "GeneralSans-Medium",
  gambettaRegular: "GeneralSans-Regular",
  gambettaLight: "GeneralSans-Light",
  gambettaItalic: "GeneralSans-Italic",

  // Clean Sans-Serif (Inter)
  interRegular: "GeneralSans-Regular",
  interMedium: "GeneralSans-Medium",
  interSemiBold: "GeneralSans-Semibold",
  interBold: "GeneralSans-Bold",
  interExtraBold: "GeneralSans-Bold",
};

// ── Font Sizes ────────────────────────────────────────────────────────
export const FontSizes = {
  mainHeading: 30,
  largeMetric: 56,
  screenTitle: 22,
  sectionTitle: 17,
  primaryMetric: 32,
  body: 15,
  bodySmall: 13,
  label: 12,
  caption: 11,
  micro: 10,
  button: 15,
  tabLabel: 10,
};

// ── Spacing (8px grid) ────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screenPadding: 16,
  sectionSpacing: 24,
};

// ── Controlled Radius System ──────────────────────────────────────────
export const Radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  dock: 28,
  pill: 999,
  avatar: 22,
};

// ── Subtle Shadows ────────────────────────────────────────────────────
export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#0D2B20",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
    },
    android: {
      elevation: 5,
    },
    default: {
      boxShadow: "0 8px 24px -4px rgba(13, 43, 32, 0.08), 0 2px 6px -1px rgba(13, 43, 32, 0.04)",
    },
  }),

  cardElevated: Platform.select({
    ios: {
      shadowColor: "#0D2B20",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    android: {
      elevation: 7,
    },
    default: {
      boxShadow: "0 12px 30px -5px rgba(13, 43, 32, 0.10), 0 4px 10px -2px rgba(13, 43, 32, 0.05)",
    },
  }),

  floatingDock: Platform.select({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
    },
    android: {
      elevation: 10,
    },
    default: {},
  }),

  mintButton: Platform.select({
    ios: {
      shadowColor: "#00A879",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),

  button: Platform.select({
    ios: {
      shadowColor: "#00A879",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 10,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),

  none: {},
};
