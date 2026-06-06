import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface SponsoredBadgeProps {
  label?: string;
}

export default function SponsoredBadge({ label = "스폰서" }: SponsoredBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D97706",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    color: "#92400E",
    fontWeight: "800",
    letterSpacing: 0
  }
});
