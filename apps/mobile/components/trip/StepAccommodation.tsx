import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, FlatList } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import BottomSheet from "../common/BottomSheet";
import Button from "../common/Button";
import { tourismApi } from "../../services/api";

export type AccommodationType = "hotel" | "resort" | "pension" | "guesthouse" | "pool_villa";

interface StepAccommodationProps {
  destination: string;
  accommodationType: AccommodationType | null;
  onSelectAccommodation: (type: AccommodationType) => void;
}

interface AccommodationOption {
  key: AccommodationType;
  emoji: string;
  title: string;
  subtitle: string;
}

interface StayItem {
  contentid: string;
  title: string;
  addr1: string;
  firstimage?: string;
  tel?: string;
  mapx: string;
  mapy: string;
}

const accommodationOptions: AccommodationOption[] = [
  { key: "hotel", emoji: "🏨", title: "호텔", subtitle: "접근성 중심" },
  { key: "resort", emoji: "🏝️", title: "리조트", subtitle: "휴양형" },
  { key: "pension", emoji: "🏡", title: "펜션", subtitle: "단독/프라이빗" },
  { key: "guesthouse", emoji: "🛏️", title: "게스트하우스", subtitle: "가성비형" },
  { key: "pool_villa", emoji: "🏖️", title: "풀빌라", subtitle: "프리미엄" },
];

export default function StepAccommodation({
  destination,
  accommodationType,
  onSelectAccommodation,
}: StepAccommodationProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [stays, setStays] = useState<StayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAccommodation = useCallback(async () => {
    if (!destination) return;
    setLoading(true);
    setError("");
    try {
      const area = destination.replace(/도$|시$|군$|구$/g, "").trim();
      const res = await tourismApi.getAttractions(area, 1, "32");
      setStays((res.data.items ?? []) as StayItem[]);
    } catch {
      setError("숙소 정보를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [destination]);

  useEffect(() => {
    void fetchAccommodation();
  }, [destination, fetchAccommodation]);

  const filteredStays = useMemo(() => {
    if (!accommodationType) return stays;
    const typeKeywords: Record<AccommodationType, string[]> = {
      hotel: ["호텔", "hotel"],
      resort: ["리조트", "resort"],
      pension: ["펜션", "pension"],
      guesthouse: ["게스트하우스", "민박", "guesthouse"],
      pool_villa: ["풀빌라", "풀 빌라", "villa"],
    };
    const keywords = typeKeywords[accommodationType];
    const filtered = stays.filter((s) =>
      keywords.some((kw) => s.title.toLowerCase().includes(kw))
    );
    return filtered.length > 0 ? filtered : stays;
  }, [accommodationType, stays]);

  const renderStay = ({ item }: { item: StayItem }) => (
    <TouchableOpacity
      style={styles.stayRow}
      onPress={() => setIsSheetOpen(false)}
      activeOpacity={0.7}
    >
      {item.firstimage ? (
        <Image source={{ uri: item.firstimage }} style={styles.stayImage} />
      ) : (
        <View style={[styles.stayImage, styles.stayImagePlaceholder]}>
          <Text>🏠</Text>
        </View>
      )}
      <View style={styles.stayTextWrap}>
        <Text style={styles.stayName} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.stayMeta} numberOfLines={1}>{item.addr1}</Text>
        {item.tel ? <Text style={styles.stayPhone}>{item.tel}</Text> : null}
      </View>
    </TouchableOpacity>
  );

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
        title={`추천 숙소 보기 (${filteredStays.length}곳)`}
        onPress={() => setIsSheetOpen(true)}
        variant="outline"
        size="medium"
        style={styles.sheetButton}
      />

      <BottomSheet
        visible={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={`${destination} 숙소 (${filteredStays.length}곳)`}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={Colors.young.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={filteredStays}
            keyExtractor={(item) => item.contentid}
            renderItem={renderStay}
            style={styles.stayList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>숙소 정보가 없습니다</Text>
            }
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.sm },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: Spacing.sm },
  title: { ...Typography.normal.h2, color: Colors.common.black, textAlign: "center", marginBottom: Spacing.xs },
  description: { ...Typography.normal.bodySmall, color: Colors.common.gray500, textAlign: "center", marginBottom: Spacing.xxl },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  optionCard: {
    width: "48%", borderRadius: 16, borderWidth: 2, borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.white, padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  optionCardSelected: { borderColor: Colors.young.primary, backgroundColor: "#EBF5FF" },
  optionEmoji: { fontSize: 26, marginBottom: Spacing.xs },
  optionTitle: { ...Typography.normal.body, color: Colors.common.gray800, fontWeight: "700" },
  optionTitleSelected: { color: Colors.young.primary },
  optionSubtitle: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 2 },
  sheetButton: { marginTop: Spacing.sm },
  stayList: { maxHeight: 400 },
  stayRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1,
    borderColor: Colors.common.gray200, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stayImage: { width: 60, height: 60, borderRadius: 10, marginRight: Spacing.md },
  stayImagePlaceholder: {
    backgroundColor: Colors.common.gray100, alignItems: "center", justifyContent: "center",
  },
  stayTextWrap: { flex: 1 },
  stayName: { ...Typography.normal.bodySmall, color: Colors.common.gray800, fontWeight: "700" },
  stayMeta: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 2 },
  stayPhone: { ...Typography.normal.caption, color: Colors.common.info, marginTop: 2 },
  errorText: { ...Typography.normal.bodySmall, color: Colors.common.error, textAlign: "center", marginBottom: Spacing.md },
  emptyText: { ...Typography.normal.body, color: Colors.common.gray500, textAlign: "center", marginTop: Spacing.xl },
  loader: { marginVertical: Spacing.xl },
});
