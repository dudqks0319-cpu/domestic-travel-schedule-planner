export const Theme = {
  colors: {
    primary: "#4A90E2",
    primaryLight: "#EBF3FF",
    primaryDark: "#2E6BC6",
    secondary: "#FF6B6B",
    secondaryLight: "#FFE8E8",
    background: "#F5F6F8",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#1A1A2E",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    textOnPrimary: "#FFFFFF",
    border: "#E5E7EB",
    borderLight: "#F3F4F6",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
    kakaoYellow: "#FEE500",
    kakaoBlack: "#191919",
    overlay: "rgba(0,0,0,0.4)",
    shimmer: "#E5E7EB"
  },
  typography: {
    h1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 36 },
    h2: { fontSize: 22, fontWeight: "700" as const, lineHeight: 30 },
    h3: { fontSize: 18, fontWeight: "600" as const, lineHeight: 26 },
    body1: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
    body2: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
    button: { fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
    buttonSmall: { fontSize: 14, fontWeight: "600" as const, lineHeight: 20 },
    tab: { fontSize: 11, fontWeight: "500" as const, lineHeight: 14 }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999
  },
  shadow: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6
    }
  }
};

export default Theme;
