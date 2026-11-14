/**
 * Employee Workspace Theme Tokens
 * Strict implementation of True Obsidian & Charcoal Glass design system.
 */

export const EmployeeLightTheme = {
  isDark: false,
  background: "#F1F4F2",
  mainSurface: "#FFFFFF",
  secondarySurface: "#F7F9F8",
  mintSurface: "#DDF4EA",
  elevatedSurface: "#FFFFFF",
  primaryText: "#101513",
  secondaryText: "#5E6964",
  mutedText: "#8FA09A",
  primaryMint: "#00A879",
  brightMint: "#19C997",
  accentLime: "#A6E22E",
  border: "#D8E0DC",
  borderSubtle: "#E4ECE8",
  error: "#D84A4A",
  errorBg: "#FDF2F2",
  warning: "#E49B31",
  warningBg: "#FEF9EE",
  card: "#FFFFFF",
  dockBg: "#101815",
  dockBorder: "rgba(255, 255, 255, 0.1)",
  glassOverlay: "rgba(16, 21, 19, 0.6)",

  // Modern Swiggy/CRED token mappings
  bg: "#F1F4F2",
  surface: "#FFFFFF",
  surfaceAlt: "#F7F9F8",
  borderFocus: "#00A879",
  text: "#101513",
  textTertiary: "#8FA09A",
  primary: "#00A879",
  primaryLight: "#19C997",
  primaryDark: "#008560",
  primarySurface: "#DDF4EA",
  primaryBorder: "rgba(0, 168, 121, 0.28)",
};

export const EmployeeDarkTheme = {
  isDark: true,

  // ── True Obsidian & Charcoal Glass Palette ──
  bg: "#090B10", // Deep Obsidian Carbon — no green tint
  surface: "#12151E", // Rich Zomato/Swiggy Elevated Charcoal card surface
  surfaceAlt: "#1A1E2B", // Graphite inner well for icon boxes, search bar, and inactive pills
  border: "rgba(255, 255, 255, 0.07)", // Crisp neutral glass hairline border — NOT green
  borderFocus: "#10B981",
  text: "#F8FAFC", // Crisp alabaster white
  textSecondary: "#94A3B8", // Clean slate grey — not green-grey
  textTertiary: "#64748B",
  primary: "#10B981", // Vibrant Emerald
  primaryLight: "#34D399",
  primaryDark: "#059669",
  primarySurface: "rgba(16, 185, 129, 0.14)", // Subtle emerald tint ONLY for active/highlighted elements
  primaryBorder: "rgba(16, 185, 129, 0.35)",

  // Backward-compatible tokens
  background: "#090B10",
  mainSurface: "#12151E",
  secondarySurface: "#1A1E2B",
  mintSurface: "rgba(16, 185, 129, 0.14)",
  elevatedSurface: "#161A26",
  primaryText: "#F8FAFC",
  mutedText: "#64748B",
  primaryMint: "#10B981",
  brightMint: "#34D399",
  accentLime: "#B7F34A",
  borderSubtle: "rgba(255, 255, 255, 0.05)",
  error: "#FF6B6B",
  errorBg: "rgba(255, 107, 107, 0.12)",
  warning: "#F2B84B",
  warningBg: "rgba(242, 184, 75, 0.12)",
  card: "#12151E",
  dockBg: "#0C0E15",
  dockBorder: "rgba(255, 255, 255, 0.08)",
  glassOverlay: "rgba(9, 11, 16, 0.75)",
};

export const employeeTheme = {
  light: EmployeeLightTheme,
  dark: EmployeeDarkTheme,
};

export type EmployeeTheme = typeof EmployeeDarkTheme;
