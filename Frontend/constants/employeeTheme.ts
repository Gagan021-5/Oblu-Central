/**
 * Employee Workspace Theme Tokens
 * Strict implementation of Nexus Graphite Mint design system.
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
};

export const EmployeeDarkTheme = {
  isDark: true,
  background: "#0E1A16",
  mainSurface: "#15251F",
  secondarySurface: "#1B2E27",
  mintSurface: "rgba(53, 214, 160, 0.14)",
  elevatedSurface: "#20362E",
  primaryText: "#F2F8F5",
  secondaryText: "#9CB3AA",
  mutedText: "#738A81",
  primaryMint: "#35D6A0",
  brightMint: "#20E3AD",
  accentLime: "#B7F34A",
  border: "#2D493F",
  borderSubtle: "#223930",
  error: "#FF6B6B",
  errorBg: "rgba(255, 107, 107, 0.12)",
  warning: "#F2B84B",
  warningBg: "rgba(242, 184, 75, 0.12)",
  card: "#15251F",
  dockBg: "#13231D",
  dockBorder: "rgba(53, 214, 160, 0.24)",
  glassOverlay: "rgba(6, 12, 10, 0.72)",
};

export type EmployeeTheme = typeof EmployeeDarkTheme;
