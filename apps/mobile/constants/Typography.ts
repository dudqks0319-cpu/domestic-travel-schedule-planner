const FONT_FAMILY = {
  regular: "NotoSansKR_400Regular",
  medium: "NotoSansKR_500Medium",
  bold: "NotoSansKR_700Bold"
} as const;

const Typography = {
  normal: {
    h1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 36, fontFamily: FONT_FAMILY.bold },
    h2: { fontSize: 22, fontWeight: "700" as const, lineHeight: 30, fontFamily: FONT_FAMILY.bold },
    h3: { fontSize: 18, fontWeight: "600" as const, lineHeight: 26, fontFamily: FONT_FAMILY.medium },
    body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24, fontFamily: FONT_FAMILY.regular },
    bodySmall: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
    caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16, fontFamily: FONT_FAMILY.regular },
    button: { fontSize: 16, fontWeight: "600" as const, lineHeight: 24, fontFamily: FONT_FAMILY.medium },
    badge: { fontSize: 11, fontWeight: "700" as const, lineHeight: 14, fontFamily: FONT_FAMILY.bold }
  },
  senior: {
    h1: { fontSize: 36, fontWeight: "700" as const, lineHeight: 46, fontFamily: FONT_FAMILY.bold },
    h2: { fontSize: 28, fontWeight: "700" as const, lineHeight: 38, fontFamily: FONT_FAMILY.bold },
    h3: { fontSize: 24, fontWeight: "600" as const, lineHeight: 34, fontFamily: FONT_FAMILY.medium },
    body: { fontSize: 22, fontWeight: "400" as const, lineHeight: 32, fontFamily: FONT_FAMILY.regular },
    bodySmall: { fontSize: 18, fontWeight: "400" as const, lineHeight: 26, fontFamily: FONT_FAMILY.regular },
    caption: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22, fontFamily: FONT_FAMILY.regular },
    button: { fontSize: 22, fontWeight: "600" as const, lineHeight: 32, fontFamily: FONT_FAMILY.medium },
    badge: { fontSize: 14, fontWeight: "700" as const, lineHeight: 18, fontFamily: FONT_FAMILY.bold }
  }
} as const;

export default Typography;
