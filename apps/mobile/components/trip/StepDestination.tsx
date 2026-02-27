import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import Input from "../common/Input";

interface StepDestinationProps {
  destination: string;
  onChangeDestination: (destination: string) => void;
}

const dummyDestinations = [
  "제주도",
  "부산",
  "서울",
  "강릉",
  "여수",
  "경주"
] as const;

export default function StepDestination({ destination, onChangeDestination }: StepDestinationProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>어디로 떠나시나요?</Text>
      <Text style={styles.description}>여행지를 입력하거나 아래 추천에서 바로 선택해보세요.</Text>

      <Input
        label="여행지"
        icon="🧭"
        placeholder="예: 제주도"
        value={destination}
        onChangeText={onChangeDestination}
      />

      <Text style={styles.quickLabel}>빠른 선택</Text>
      <View style={styles.chipContainer}>
        {dummyDestinations.map((item) => {
          const isSelected = destination.trim() === item;

          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onChangeDestination(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm
  },
  emoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: Spacing.sm
  },
  title: {
    ...Typography.normal.h2,
    color: Colors.common.black,
    textAlign: "center",
    marginBottom: Spacing.xs
  },
  description: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray500,
    textAlign: "center",
    marginBottom: Spacing.xxl
  },
  quickLabel: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray600,
    fontWeight: "700",
    marginBottom: Spacing.sm
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    backgroundColor: Colors.common.gray100,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm
  },
  chipSelected: {
    backgroundColor: "#E8F4FD"
  },
  chipText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray700,
    fontWeight: "600"
  },
  chipTextSelected: {
    color: Colors.young.primary
  }
});
