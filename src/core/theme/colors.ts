export const Colors = {
  // Primary — Modern Soft Emerald Green (زمردي هادئ وراقي)
  primary: "hsl(253, 44%, 50%)",
  primaryLight: "#4ADE80",
  primaryDark: "#0D5C3A",
  onPrimary: "#FFFFFF",

  // Secondary — Warm Amber (عنبري ناعم)
  secondary: "#D97706",
  secondaryLight: "#FDE68A",
  secondaryDark: "#B45309",
  onSecondary: "#FFFFFF",

  // Tertiary — Slate Blue (أزرق هادئ)
  tertiary: "#0284C7",
  tertiaryLight: "#BAE6FD",
  tertiaryDark: "#0369A1",
  onTertiary: "#FFFFFF",

  // Error — Soft Crimson (أحمر وردي مريح للعين)
  error: "#E11D48",
  errorLight: "#FECDD3",
  errorDark: "#9F1239",
  onError: "#FFFFFF",

  // Success — Soft Green
  success: "#16A34A",
  successLight: "#BBF7D0",
  successDark: "#14532D",

  // Warning — Soft Orange
  warning: "#EA580C",
  warningLight: "#FED7AA",
  warningDark: "#9A3412",

  // Info — Soft Sky Blue
  info: "#0288D1",
  infoLight: "#E0F2FE",
  infoDark: "#0369A1",

  // Neutral — Slate Grays (خلفيات ناعمة ومحايدة تماماً)
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceVariant: "#F1F5F9",
  outline: "#CBD5E1",
  onBackground: "#0F172A",
  onSurface: "#0F172A",
  onSurfaceVariant: "#475569",

  // Dark theme overrides (ثيم ليلي هادئ)
  dark: {
    background: "#0F172A",
    surface: "#1E293B",
    surfaceVariant: "#334155",
    onBackground: "#F8FAFC",
    onSurface: "#F8FAFC",
    onSurfaceVariant: "#94A3B8",
    primary: "#4ADE80",
    secondary: "#FBBF24",
    tertiary: "#38BDF8",
  },

  // Stock level colors
  stockOk: "#16A34A",
  stockLow: "#D97706",
  stockOut: "#E11D48",

  // Credit colors (ألوان الأرصدة والديون)
  creditRed: "#E11D48",
  paymentGreen: "#16A34A",

  // Light tint backgrounds (خلفيات البادجات والكبسولات الناعمة جداً)
  successBg: "#F0FDF4",
  warningBg: "#FFFBEB",
  errorBg: "#FFF1F2",
  infoBg: "#F0F9FF",
  neutralBg: "#F8FAFC",
  neutralText: "#64748B",
  border: "#E2E8F0",
} as const;
