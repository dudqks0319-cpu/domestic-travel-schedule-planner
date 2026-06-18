import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";

interface MultiSelectCardProps {
  iconName?: keyof typeof Ionicons.glyphMap;
  title: string;
  isSelected: boolean;
  onPress: () => void;
}

export default function MultiSelectCard({ iconName, title, isSelected, onPress }: MultiSelectCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
        <Ionicons
          name={iconName ?? "ellipse-outline"}
          size={18}
          color={isSelected ? Theme.colors.primary : Theme.colors.textSecondary}
        />
      </View>
      <Text style={[styles.title, isSelected && styles.titleSelected]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 4,
    minHeight: 44
  },
  cardSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryLight
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },
  iconBoxSelected: {
    backgroundColor: Theme.colors.surface
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.colors.textPrimary
  },
  titleSelected: {
    color: Theme.colors.primary
  }
});
