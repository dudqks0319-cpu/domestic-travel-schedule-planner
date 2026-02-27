const Typography = {
  normal: {
    h1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 36 },
    h2: { fontSize: 22, fontWeight: "700" as const, lineHeight: 30 },
    h3: { fontSize: 18, fontWeight: "600" as const, lineHeight: 26 },
    body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
    button: { fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
    badge: { fontSize: 11, fontWeight: "700" as const, lineHeight: 14 }
  },
  senior: {
    h1: { fontSize: 36, fontWeight: "700" as const, lineHeight: 46 },
    h2: { fontSize: 28, fontWeight: "700" as const, lineHeight: 38 },
    h3: { fontSize: 24, fontWeight: "600" as const, lineHeight: 34 },
    body: { fontSize: 22, fontWeight: "400" as const, lineHeight: 32 },
    bodySmall: { fontSize: 18, fontWeight: "400" as const, lineHeight: 26 },
    caption: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22 },
    button: { fontSize: 22, fontWeight: "600" as const, lineHeight: 32 },
    badge: { fontSize: 14, fontWeight: "700" as const, lineHeight: 18 }
  }
} as const;

export default Typography;
