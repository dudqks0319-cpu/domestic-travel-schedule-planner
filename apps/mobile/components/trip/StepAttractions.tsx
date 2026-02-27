import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import MultiSelectCard from "../common/MultiSelectCard";

interface StepAttractionsProps {
  selectedAttractions: string[];
  onChangeAttractions: (nextValues: string[]) => void;
}

interface AttractionOption {
  key: string;
  emoji: string;
  title: string;
}

const dummyAttractions: AttractionOption[] = [
  { key: "nature", emoji: "🏞️", title: "자연/풍경" },
  { key: "museum", emoji: "🏛️", title: "박물관" },
  { key: "theme_park", emoji: "🎢", title: "테마파크" },
  { key: "market", emoji: "🛍️", title: "시장/쇼핑" },
  { key: "night_view", emoji: "🌃", title: "야경 명소" },
  { key: "walk_course", emoji: "🚶", title: "산책 코스" },
  { key: "kids_zone", emoji: "🧸", title: "키즈 스팟" },
  { key: "culture", emoji: "🎭", title: "공연/문화" }
];

export default function StepAttractions({
  selectedAttractions,
  onChangeAttractions
}: StepAttractionsProps) {
  const toggleAttraction = (value: string) => {
    if (selectedAttractions.includes(value)) {
      onChangeAttractions(selectedAttractions.filter((item) => item !== value));
      return;
    }
    onChangeAttractions([...selectedAttractions, value]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎡</Text>
      <Text style={styles.title}>가보고 싶은 스팟을 골라주세요</Text>
      <Text style={styles.description}>복수 선택 가능해요. 아직 API 연동 전이라 더미 옵션을 사용합니다.</Text>

      <View style={styles.grid}>
        {dummyAttractions.map((item) => (
          <MultiSelectCard
            key={item.key}
            emoji={item.emoji}
            title={item.title}
            isSelected={selectedAttractions.includes(item.key)}
            onPress={() => toggleAttraction(item.key)}
          />
        ))}
      </View>

      <Text style={styles.countText}>선택 {selectedAttractions.length}개</Text>
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
  },
  countText: {
    ...Typography.normal.bodySmall,
    color: Colors.young.primary,
    fontWeight: "700",
    textAlign: "center",
    marginTop: Spacing.md
  }
});
