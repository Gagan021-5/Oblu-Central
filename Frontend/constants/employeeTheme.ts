/**
 * Employee Workspace Theme Tokens
 * Strict implementation of True Obsidian & Charcoal Glass design system.
 */

import { useTheme } from "@/contexts/ThemeContext";

export const EmployeeLightTheme = {
  isDark: false,

  // ── Canvas & Surface Hierarchy ──
  bg: "#F4F6FA", // Soft cool alabaster canvas so pure white cards pop cleanly
  background: "#F4F6FA",
  surface: "#FFFFFF", // Crisp elevated card surface
  mainSurface: "#FFFFFF",
  card: "#FFFFFF",
  elevatedSurface: "#FFFFFF",
  surfaceAlt: "#EEF2F6", // Subtle cool well for pills, inputs, and search tracks
  secondarySurface: "#EEF2F6",
  mintSurface: "#DDF4EA",

  // ── Borders ──
  border: "rgba(15, 23, 42, 0.08)", // Clean, subtle hairline border
  borderSubtle: "rgba(15, 23, 42, 0.04)",
  borderFocus: "#00A879",

  // ── Typography ──
  text: "#101513",
  primaryText: "#101513",
  textSecondary: "#5E6964",
  secondaryText: "#5E6964",
  textTertiary: "#8FA09A",
  mutedText: "#8FA09A",

  // ── Brand & Accent ──
  primary: "#00A879",
  primaryMint: "#00A879",
  primaryLight: "#19C997",
  brightMint: "#19C997",
  primaryDark: "#008560",
  primarySurface: "#DDF4EA",
  primaryBorder: "rgba(0, 168, 121, 0.28)",
  accentLime: "#A6E22E",

  // ── Semantic Feedback ──
  danger: "#EF4444",
  error: "#EF4444",
  errorBg: "#FDF2F2",
  warning: "#E49B31",
  warningBg: "#FEF9EE",
  success: "#00A879",
  successBg: "#DDF4EA",

  // ── Floating Dock & Glass ──
  dockBg: "#101815",
  dockBorder: "rgba(255, 255, 255, 0.1)",
  glassOverlay: "rgba(16, 21, 19, 0.6)",
};

export const EmployeeDarkTheme = {
  isDark: true,

  // ── True Obsidian & Charcoal Glass Palette ──
  bg: "#090B10", // Deep Obsidian Carbon — no green tint
  background: "#090B10",
  surface: "#12151E", // Rich Zomato/Swiggy Elevated Charcoal card surface
  mainSurface: "#12151E",
  card: "#12151E",
  elevatedSurface: "#161A26",
  surfaceAlt: "#1A1E2B", // Graphite inner well for icon boxes, search bar, and inactive pills
  secondarySurface: "#1A1E2B",
  mintSurface: "rgba(16, 185, 129, 0.14)",

  // ── Borders ──
  border: "rgba(255, 255, 255, 0.07)", // Crisp neutral glass hairline border
  borderSubtle: "rgba(255, 255, 255, 0.05)",
  borderFocus: "#10B981",

  // ── Typography ──
  text: "#F8FAFC", // Crisp alabaster white
  primaryText: "#F8FAFC",
  textSecondary: "#94A3B8", // Clean slate grey
  secondaryText: "#94A3B8",
  textTertiary: "#64748B",
  mutedText: "#64748B",

  // ── Brand & Accent ──
  primary: "#10B981", // Vibrant Emerald
  primaryMint: "#10B981",
  primaryLight: "#34D399",
  brightMint: "#34D399",
  primaryDark: "#059669",
  primarySurface: "rgba(16, 185, 129, 0.14)", // Subtle emerald tint ONLY for active elements
  primaryBorder: "rgba(16, 185, 129, 0.35)",
  accentLime: "#B7F34A",

  // ── Semantic Feedback ──
  danger: "#EF4444",
  error: "#FF6B6B",
  errorBg: "rgba(255, 107, 107, 0.12)",
  warning: "#F2B84B",
  warningBg: "rgba(242, 184, 75, 0.12)",
  success: "#10B981",
  successBg: "rgba(16, 185, 129, 0.14)",

  // ── Floating Dock & Glass ──
  dockBg: "#0C0E15",
  dockBorder: "rgba(255, 255, 255, 0.08)",
  glassOverlay: "rgba(9, 11, 16, 0.75)",
};

export const employeeTheme = {
  light: EmployeeLightTheme,
  dark: EmployeeDarkTheme,
};

export type EmployeeTheme = typeof EmployeeDarkTheme;

/**
 * Universal hook providing the single source of truth for all screens,
 * layouts, modals, and components across the entire app.
 */
export function useEmployeeTheme() {
  const { isDark, mode, setMode } = useTheme();
  const t = isDark ? EmployeeDarkTheme : EmployeeLightTheme;
  return { t, theme: t, isDark, mode, setMode };
}
