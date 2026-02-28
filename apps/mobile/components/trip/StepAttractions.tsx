import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import { tourismApi } from "../../services/api";

interface StepAttractionsProps {
  destination: string;
  selectedAttractions: string[];
  onChangeAttractions: (nextValues: string[]) => void;
}

interface AttractionItem {
  contentid: string;
  title: string;
  addr1: string;
  firstimage?: string;
  mapx: string;
  mapy: string;
}

const CATEGORY_FILTERS = [
  { key: "all", label: "전체" },
  { key: "12", label: "관광지" },
  { key: "14", label: "문화시설" },
  { key: "15", label: "축제/행사" },
  { key: "25", label: "여행코스" },
  { key: "28", label: "레포츠" },
  { key: "38", label: "쇼핑" },
];

export default function StepAttractions({
  destination,
  selectedAttractions,
  onChangeAttractions,
}: StepAttractionsProps) {
  const [items, setItems] = useState<AttractionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchAttractions = useCallback(
    async (pageNum: number, contentType?: string, reset = false) => {
      if (!destination) return;
      setLoading(true);
      setError("");
      try {
        const area = destination.replace(/도$|시$|군$|구$/g, "").trim();
        const ct = contentType === "all" ? undefined : contentType;
        const res = await tourismApi.getAttractions(area, pageNum, ct);
        const newItems = (res.data.items ?? []) as AttractionItem[];
        setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
        setHasMore(newItems.length >= 20);
      } catch {
        setError("관광지 정보를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    },
    [destination]
  );

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    void fetchAttractions(1, activeCategory, true);
  }, [destination, activeCategory, fetchAttractions]);

  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchAttractions(nextPage, activeCategory);
  };

  const toggleAttraction = (id: string) => {
    if (selectedAttractions.includes(id)) {
      onChangeAttractions(selectedAttractions.filter((v) => v !== id));
    } else {
      onChangeAttractions([...selectedAttractions, id]);
    }
  };

  const renderItem = ({ item }: { item: AttractionItem }) => {
    const isSelected = selectedAttractions.includes(item.contentid);
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleAttraction(item.contentid)}
        activeOpacity={0.7}
      >
        {item.firstimage ? (
          <Image source={{ uri: item.firstimage }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={styles.placeholderEmoji}>📷</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardAddress} numberOfLines={1}>{item.addr1}</Text>
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
      <Text style={styles.emoji}>🎡</Text>
      <Text style={styles.title}>
        {destination ? `${destination} 관광지` : "가보고 싶은 스팟을 골라주세요"}
      </Text>
      <Text style={styles.description}>
        실제 관광 데이터에서 불러온 결과입니다. 복수 선택 가능해요.
      </Text>

      <View style={styles.filterRow}>
        {CATEGORY_FILTERS.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.filterChip, activeCategory === cat.key && styles.filterChipActive]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeCategory === cat.key && styles.filterChipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.contentid}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading ? <ActivityIndicator color={Colors.young.primary} style={styles.loader} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
          ) : null
        }
        style={styles.list}
      />

      <Text style={styles.countText}>선택 {selectedAttractions.length}개</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.sm, flex: 1 },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: Spacing.sm },
  title: { ...Typography.normal.h2, color: Colors.common.black, textAlign: "center", marginBottom: Spacing.xs },
  description: { ...Typography.normal.bodySmall, color: Colors.common.gray500, textAlign: "center", marginBottom: Spacing.md },
  filterRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: Spacing.md, gap: 6 },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: Colors.common.gray100, borderWidth: 1, borderColor: Colors.common.gray200,
  },
  filterChipActive: { backgroundColor: "#E8F4FD", borderColor: Colors.young.primary },
  filterChipText: { ...Typography.normal.caption, color: Colors.common.gray600, fontWeight: "600" },
  filterChipTextActive: { color: Colors.young.primary },
  list: { maxHeight: 400 },
  listContent: { paddingBottom: Spacing.md },
  row: { justifyContent: "space-between" },
  card: {
    width: "48%", borderRadius: 16, borderWidth: 2, borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.white, marginBottom: Spacing.sm, overflow: "hidden",
  },
  cardSelected: { borderColor: Colors.young.primary, backgroundColor: "#F5FAFF" },
  cardImage: { width: "100%", height: 100, backgroundColor: Colors.common.gray100 },
  cardImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderEmoji: { fontSize: 32 },
  cardContent: { padding: 10 },
  cardTitle: { ...Typography.normal.bodySmall, fontWeight: "700", color: Colors.common.gray800 },
  cardAddress: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 2 },
  checkBadge: {
    position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.young.primary, alignItems: "center", justifyContent: "center",
  },
  checkText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  countText: {
    ...Typography.normal.bodySmall, color: Colors.young.primary,
    fontWeight: "700", textAlign: "center", marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.normal.bodySmall, color: Colors.common.error,
    textAlign: "center", marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.normal.body, color: Colors.common.gray500,
    textAlign: "center", marginTop: Spacing.xxl,
  },
  loader: { marginVertical: Spacing.md },
});
