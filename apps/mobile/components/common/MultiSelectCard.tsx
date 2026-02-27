import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";

interface MultiSelectCardProps {
  emoji: string;
  title: string;
  isSelected: boolean;
  onPress: () => void;
}

export default function MultiSelectCard({ emoji, title, isSelected, onPress }: MultiSelectCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, isSelected && styles.titleSelected]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.common.gray50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.common.gray200,
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 4
  },
  cardSelected: {
    borderColor: Colors.young.primary,
    backgroundColor: "#EBF5FF"
  },
  emoji: {
    fontSize: 20,
    marginRight: 8
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.common.gray700
  },
  titleSelected: {
    color: Colors.young.primary
  }
});
