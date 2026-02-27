import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import BottomSheet from "../common/BottomSheet";
import Button from "../common/Button";

export type AccommodationType = "hotel" | "resort" | "pension" | "guesthouse" | "pool_villa";

interface StepAccommodationProps {
  accommodationType: AccommodationType | null;
  onSelectAccommodation: (type: AccommodationType) => void;
}

interface AccommodationOption {
  key: AccommodationType;
  emoji: string;
  title: string;
  subtitle: string;
}

interface DummyStay {
  id: string;
  name: string;
  area: string;
  price: string;
  type: AccommodationType;
}

const accommodationOptions: AccommodationOption[] = [
  { key: "hotel", emoji: "🏨", title: "호텔", subtitle: "접근성 중심" },
  { key: "resort", emoji: "🏝️", title: "리조트", subtitle: "휴양형" },
  { key: "pension", emoji: "🏡", title: "펜션", subtitle: "단독/프라이빗" },
  { key: "guesthouse", emoji: "🛏️", title: "게스트하우스", subtitle: "가성비형" },
  { key: "pool_villa", emoji: "🏖️", title: "풀빌라", subtitle: "프리미엄" }
];

const dummyStays: DummyStay[] = [
  { id: "stay_1", name: "오션뷰 센트럴 호텔", area: "시내 10분", price: "1박 14만원", type: "hotel" },
  { id: "stay_2", name: "힐사이드 리조트", area: "해변 5분", price: "1박 19만원", type: "resort" },
  { id: "stay_3", name: "솔바람 펜션", area: "관광지 15분", price: "1박 12만원", type: "pension" },
  { id: "stay_4", name: "트립메이트 게스트하우스", area: "역 3분", price: "1박 7만원", type: "guesthouse" },
  { id: "stay_5", name: "코랄 풀빌라", area: "전망포인트 8분", price: "1박 29만원", type: "pool_villa" }
];

export default function StepAccommodation({
  accommodationType,
  onSelectAccommodation
}: StepAccommodationProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const visibleStays = useMemo(() => {
    if (!accommodationType) return dummyStays;
    return dummyStays.filter((stay) => stay.type === accommodationType);
  }, [accommodationType]);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🛌</Text>
      <Text style={styles.title}>선호 숙소를 정해주세요</Text>
      <Text style={styles.description}>숙소 타입은 동선 구성과 체크인 시간 배치에 반영됩니다.</Text>

      <View style={styles.optionGrid}>
        {accommodationOptions.map((item) => {
          const isSelected = accommodationType === item.key;

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => onSelectAccommodation(item.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionEmoji}>{item.emoji}</Text>
              <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>{item.title}</Text>
              <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Button
        title="추천 숙소 보기"
        onPress={() => setIsSheetOpen(true)}
        variant="outline"
        size="medium"
        style={styles.sheetButton}
      />

      <BottomSheet visible={isSheetOpen} onClose={() => setIsSheetOpen(false)} title="추천 숙소 (더미 데이터)">
        <View>
          {visibleStays.map((stay) => (
            <TouchableOpacity
              key={stay.id}
              style={styles.stayRow}
              onPress={() => {
                onSelectAccommodation(stay.type);
                setIsSheetOpen(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.stayTextWrap}>
                <Text style={styles.stayName}>{stay.name}</Text>
                <Text style={styles.stayMeta}>
                  {stay.area} · {stay.price}
                </Text>
              </View>
              <Text style={styles.stayArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
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
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  optionCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.white,
    padding: Spacing.lg,
    marginBottom: Spacing.sm
  },
  optionCardSelected: {
    borderColor: Colors.young.primary,
    backgroundColor: "#EBF5FF"
  },
  optionEmoji: {
    fontSize: 26,
    marginBottom: Spacing.xs
  },
  optionTitle: {
    ...Typography.normal.body,
    color: Colors.common.gray800,
    fontWeight: "700"
  },
  optionTitleSelected: {
    color: Colors.young.primary
  },
  optionSubtitle: {
    ...Typography.normal.caption,
    color: Colors.common.gray500,
    marginTop: 2
  },
  sheetButton: {
    marginTop: Spacing.sm
  },
  stayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm
  },
  stayTextWrap: {
    flex: 1,
    marginRight: Spacing.md
  },
  stayName: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    fontWeight: "700"
  },
  stayMeta: {
    ...Typography.normal.caption,
    color: Colors.common.gray500,
    marginTop: 2
  },
  stayArrow: {
    ...Typography.normal.body,
    color: Colors.common.gray500
  }
});
