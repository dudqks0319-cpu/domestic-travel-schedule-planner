import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import SelectCard from "../common/SelectCard";

import type { CompanionType } from "../../types";

interface StepCompanionProps {
  companion: CompanionType | null;
  onSelectCompanion: (companion: CompanionType) => void;
}

const companionOptions: {
  key: CompanionType;
  emoji: string;
  title: string;
  subtitle: string;
  color?: string;
}[] = [
  { key: "solo", emoji: "🧑", title: "혼자", subtitle: "나만의 페이스" },
  { key: "friends", emoji: "👫", title: "친구와", subtitle: "함께 즐기는 여행" },
  { key: "couple", emoji: "💑", title: "커플", subtitle: "데이트 여행" },
  {
    key: "family_kids",
    emoji: "👨‍👩‍👧‍👦",
    title: "가족+아이",
    subtitle: "키즈 친화 장소 우선",
    color: Colors.family.primary
  },
  {
    key: "family_no_kids",
    emoji: "👨‍👩‍👧",
    title: "가족",
    subtitle: "여유 중심 여행",
    color: Colors.family.primary
  },
  {
    key: "parents",
    emoji: "👴👵",
    title: "부모님과",
    subtitle: "이동 부담 최소화",
    color: Colors.senior.primary
  }
];

export default function StepCompanion({ companion, onSelectCompanion }: StepCompanionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👥</Text>
      <Text style={styles.title}>누구와 함께 가나요?</Text>
      <Text style={styles.description}>동행자에 맞춰 추천 장소와 동선을 조정해요.</Text>

      <View style={styles.grid}>
        {companionOptions.map((item) => (
          <SelectCard
            key={item.key}
            emoji={item.emoji}
            title={item.title}
            subtitle={item.subtitle}
            isSelected={companion === item.key}
            onPress={() => onSelectCompanion(item.key)}
            size="large"
            color={item.color}
          />
        ))}
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center"
  }
});
