import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";

interface SelectCardProps {
  emoji: string;
  title: string;
  subtitle?: string;
  isSelected: boolean;
  onPress: () => void;
  size?: "normal" | "large" | "senior";
  color?: string;
}

export default function SelectCard({
  emoji,
  title,
  subtitle,
  isSelected,
  onPress,
  size = "normal",
  color = Colors.young.primary
}: SelectCardProps) {
  const isSenior = size === "senior";
  const isLarge = size === "large" || isSenior;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isLarge && styles.cardLarge,
        isSelected && { borderColor: color, backgroundColor: `${color}08` }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      {isSelected ? (
        <View style={[styles.checkBadge, { backgroundColor: color }]}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      ) : null}

      <Text style={[styles.emoji, isLarge && styles.emojiLarge]}>{emoji}</Text>
      <Text style={[styles.title, isSenior && styles.titleSenior, isSelected && { color }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, isSenior && styles.subtitleSenior]}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.common.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.common.gray200,
    padding: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minWidth: "45%",
    minHeight: 120,
    margin: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  cardLarge: {
    padding: Spacing.xl,
    minWidth: "45%",
    minHeight: 140
  },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  checkText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700"
  },
  emoji: {
    fontSize: 36,
    marginBottom: 8
  },
  emojiLarge: {
    fontSize: 48,
    marginBottom: 12
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.common.gray800,
    textAlign: "center"
  },
  titleSenior: {
    fontSize: 22
  },
  subtitle: {
    fontSize: 12,
    color: Colors.common.gray500,
    marginTop: 4,
    textAlign: "center"
  },
  subtitleSenior: {
    fontSize: 16
  }
});
