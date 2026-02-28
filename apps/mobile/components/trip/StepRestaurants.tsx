import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import Button from "../common/Button";
import { restaurantApi } from "../../services/api";

interface StepRestaurantsProps {
  destination: string;
  selectedRestaurants: string[];
  onChangeRestaurants: (nextValues: string[]) => void;
  onComplete: () => void;
  loading?: boolean;
}

interface RestaurantItem {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  mapx: string;
  mapy: string;
}

const FOOD_CATEGORIES = [
  { key: "맛집", label: "전체" },
  { key: "한식", label: "한식" },
  { key: "해산물", label: "해산물" },
  { key: "고기", label: "고기" },
  { key: "카페", label: "카페" },
  { key: "디저트", label: "디저트" },
  { key: "분식", label: "분식" },
];

export default function StepRestaurants({
  destination,
  selectedRestaurants,
  onChangeRestaurants,
  onComplete,
  loading: savingLoading = false,
}: StepRestaurantsProps) {
  const [items, setItems] = useState<RestaurantItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("맛집");

  const fetchRestaurants = useCallback(async (category: string) => {
    if (!destination) return;
    setFetching(true);
    setError("");
    try {
      const query = category === "맛집" ? `${destination} 맛집` : `${destination} ${category}`;
      const res = await restaurantApi.search(query, 20);
      setItems((res.data.items ?? []) as RestaurantItem[]);
    } catch {
      setError("맛집 정보를 불러올 수 없습니다");
    } finally {
      setFetching(false);
    }
  }, [destination]);

  useEffect(() => {
    void fetchRestaurants(activeCategory);
  }, [destination, activeCategory, fetchRestaurants]);

  const toggleRestaurant = (title: string) => {
    if (selectedRestaurants.includes(title)) {
      onChangeRestaurants(selectedRestaurants.filter((v) => v !== title));
    } else {
      onChangeRestaurants([...selectedRestaurants, title]);
    }
  };

  const renderItem = ({ item }: { item: RestaurantItem }) => {
    const isSelected = selectedRestaurants.includes(item.title);
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleRestaurant(item.title)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.categoryBadge}>{item.category.split(">").pop()?.trim() ?? "음식점"}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardAddress} numberOfLines={1}>{item.roadAddress || item.address}</Text>
          {item.telephone ? <Text style={styles.cardPhone}>{item.telephone}</Text> : null}
        </View>
        {isSelected && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🍽️</Text>
      <Text style={styles.title}>
        {destination ? `${destination} 맛집` : "식당 취향도 알려주세요"}
      </Text>
      <Text style={styles.description}>네이버 검색 결과에서 불러온 실제 맛집입니다.</Text>

      <View style={styles.filterRow}>
        {FOOD_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.filterChip, activeCategory === cat.key && styles.filterChipActive]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={[styles.filterChipText, activeCategory === cat.key && styles.filterChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.title}_${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          fetching ? <ActivityIndicator color={Colors.young.primary} style={styles.loader} /> : null
        }
        ListEmptyComponent={
          !fetching ? <Text style={styles.emptyText}>검색 결과가 없습니다</Text> : null
        }
        style={styles.list}
      />

      <Text style={styles.countText}>선택 {selectedRestaurants.length}개</Text>

      <Button
        title="완료하고 경로 만들기"
        onPress={onComplete}
        size="large"
        loading={savingLoading}
        style={styles.completeButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl, flex: 1 },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: Spacing.sm },
  title: { ...Typography.normal.h2, color: Colors.common.black, textAlign: "center", marginBottom: Spacing.xs },
  description: { ...Typography.normal.bodySmall, color: Colors.common.gray500, textAlign: "center", marginBottom: Spacing.md },
  filterRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: Spacing.md, gap: 6 },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: Colors.common.gray100, borderWidth: 1, borderColor: Colors.common.gray200,
  },
  filterChipActive: { backgroundColor: "#FFF3E0", borderColor: Colors.common.warning },
  filterChipText: { ...Typography.normal.caption, color: Colors.common.gray600, fontWeight: "600" },
  filterChipTextActive: { color: "#A15B00" },
  list: { maxHeight: 350 },
  listContent: { paddingBottom: Spacing.md },
  card: {
    flexDirection: "row", alignItems: "center", borderRadius: 14,
    borderWidth: 2, borderColor: Colors.common.gray200, backgroundColor: Colors.common.white,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  cardSelected: { borderColor: Colors.young.primary, backgroundColor: "#F5FAFF" },
  cardLeft: { flex: 1 },
  categoryBadge: {
    ...Typography.normal.caption, color: Colors.common.gray500, backgroundColor: Colors.common.gray100,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: "flex-start", marginBottom: 4, overflow: "hidden",
  },
  cardTitle: { ...Typography.normal.body, fontWeight: "700", color: Colors.common.gray800 },
  cardAddress: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 2 },
  cardPhone: { ...Typography.normal.caption, color: Colors.common.info, marginTop: 2 },
  checkBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.young.primary, alignItems: "center", justifyContent: "center", marginLeft: Spacing.sm,
  },
  checkText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  countText: {
    ...Typography.normal.bodySmall, color: Colors.young.primary,
    fontWeight: "700", textAlign: "center", marginTop: Spacing.md,
  },
  completeButton: { marginTop: Spacing.xl, width: "100%" },
  errorText: { ...Typography.normal.bodySmall, color: Colors.common.error, textAlign: "center", marginBottom: Spacing.md },
  emptyText: { ...Typography.normal.body, color: Colors.common.gray500, textAlign: "center", marginTop: Spacing.xxl },
  loader: { marginVertical: Spacing.md },
});
