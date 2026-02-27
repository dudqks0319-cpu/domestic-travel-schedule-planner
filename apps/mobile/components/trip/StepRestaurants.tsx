import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import Button from "../common/Button";
import MultiSelectCard from "../common/MultiSelectCard";

interface StepRestaurantsProps {
  selectedRestaurants: string[];
  onChangeRestaurants: (nextValues: string[]) => void;
  onComplete: () => void;
  loading?: boolean;
}

interface RestaurantOption {
  key: string;
  emoji: string;
  title: string;
}

const dummyRestaurants: RestaurantOption[] = [
  { key: "korean", emoji: "🍲", title: "한식" },
  { key: "seafood", emoji: "🦐", title: "해산물" },
  { key: "bbq", emoji: "🥩", title: "고기집" },
  { key: "noodle", emoji: "🍜", title: "면요리" },
  { key: "cafe", emoji: "☕", title: "카페" },
  { key: "dessert", emoji: "🧁", title: "디저트" },
  { key: "night_food", emoji: "🍻", title: "야식" },
  { key: "local", emoji: "📍", title: "로컬 맛집" }
];

export default function StepRestaurants({
  selectedRestaurants,
  onChangeRestaurants,
  onComplete,
  loading = false
}: StepRestaurantsProps) {
  const toggleRestaurant = (value: string) => {
    if (selectedRestaurants.includes(value)) {
      onChangeRestaurants(selectedRestaurants.filter((item) => item !== value));
      return;
    }
    onChangeRestaurants([...selectedRestaurants, value]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🍽️</Text>
      <Text style={styles.title}>식당 취향도 알려주세요</Text>
      <Text style={styles.description}>
        선택 결과로 경로 지도의 식사 포인트를 구성합니다. API 연동 전 더미 목록입니다.
      </Text>

      <View style={styles.grid}>
        {dummyRestaurants.map((item) => (
          <MultiSelectCard
            key={item.key}
            emoji={item.emoji}
            title={item.title}
            isSelected={selectedRestaurants.includes(item.key)}
            onPress={() => toggleRestaurant(item.key)}
          />
        ))}
      </View>

      <Text style={styles.countText}>선택 {selectedRestaurants.length}개</Text>

      <Button
        title="완료하고 경로 만들기"
        onPress={onComplete}
        size="large"
        loading={loading}
        style={styles.completeButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl
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
  },
  completeButton: {
    marginTop: Spacing.xl,
    width: "100%"
  }
});
