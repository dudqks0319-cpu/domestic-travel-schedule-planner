import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";

interface SelectCardProps {
  iconName?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  isSelected: boolean;
  onPress: () => void;
  size?: "normal" | "large" | "senior";
  color?: string;
}

export default function SelectCard({
  iconName,
  title,
  subtitle,
  isSelected,
  onPress,
  size = "normal",
  color = Theme.colors.primary
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
          <Ionicons name="checkmark" size={14} color={Theme.colors.textOnPrimary} />
        </View>
      ) : null}

      <View style={[styles.iconBox, isLarge && styles.iconBoxLarge, isSelected && { backgroundColor: `${color}16` }]}>
        <Ionicons
          name={iconName ?? "ellipse-outline"}
          size={isLarge ? 28 : 24}
          color={isSelected ? color : Theme.colors.textSecondary}
        />
      </View>
      <Text style={[styles.title, isSenior && styles.titleSenior, isSelected && { color }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, isSenior && styles.subtitleSenior]}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.lg,
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
    padding: Theme.spacing.xl,
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  iconBoxLarge: {
    width: 56,
    height: 56,
    marginBottom: 12
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
    textAlign: "center"
  },
  titleSenior: {
    fontSize: 22
  },
  subtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center"
  },
  subtitleSenior: {
    fontSize: 16
  }
});
