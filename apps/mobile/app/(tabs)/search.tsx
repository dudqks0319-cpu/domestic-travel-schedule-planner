import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import SponsoredBadge from "../../components/monetization/SponsoredBadge";
import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import { placesApi, type NormalizedPlaceDto } from "../../services/api";

type CategoryKey =
  | "all"
  | "attraction"
  | "restaurant"
  | "cafe"
  | "lodging"
  | "shopping"
  | "nature"
  | "museum"
  | "kids"
  | "indoor"
  | "pet";

interface SearchResultItem {
  id: string;
  place: NormalizedPlaceDto;
}

const CURRENT_TRIP_STORAGE_KEY = "currentTrip";

const CATEGORIES: { key: CategoryKey; label: string; query?: string }[] = [
  { key: "all", label: "전체" },
  { key: "attraction", label: "관광지", query: "관광지" },
  { key: "restaurant", label: "맛집", query: "맛집" },
  { key: "cafe", label: "카페", query: "카페" },
  { key: "lodging", label: "숙소", query: "숙소" },
  { key: "shopping", label: "쇼핑", query: "쇼핑" },
  { key: "nature", label: "자연", query: "자연" },
  { key: "museum", label: "박물관/전시", query: "박물관 전시" },
  { key: "kids", label: "아이와 함께", query: "아이와 함께" },
  { key: "indoor", label: "실내", query: "실내" },
  { key: "pet", label: "반려동물", query: "반려동물" }
];

function placeAddress(place: NormalizedPlaceDto): string {
  return place.roadAddress || place.address || "주소 정보 없음";
}

function categoryQuery(key: CategoryKey): string | undefined {
  return CATEGORIES.find((category) => category.key === key)?.query;
}

async function addPlaceToCurrentTrip(place: NormalizedPlaceDto): Promise<number> {
  const rawTrip = await AsyncStorage.getItem(CURRENT_TRIP_STORAGE_KEY);
  const currentTrip =
    rawTrip && rawTrip.trim()
      ? (JSON.parse(rawTrip) as Record<string, unknown>)
      : {
          destination: "",
          startDate: "",
          endDate: "",
          providerStatus: "ready"
        };
  const routePoints = Array.isArray(currentTrip.routePoints)
    ? [...currentTrip.routePoints]
    : [];
  const alreadyAdded = routePoints.some((item) => {
    if (!item || typeof item !== "object") return false;
    const value = item as Record<string, unknown>;
    return value.id === place.id;
  });

  if (!alreadyAdded) {
    routePoints.push({
      id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      category: place.category
    });
  }

  await AsyncStorage.setItem(
    CURRENT_TRIP_STORAGE_KEY,
    JSON.stringify({
      ...currentTrip,
      providerStatus: routePoints.length >= 2 ? "ready" : "empty",
      routePoints
    })
  );

  return routePoints.length;
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    setWarnings([]);

    try {
      const category = categoryQuery(activeCategory);
      const searchQuery = category ? `${trimmed} ${category}` : trimmed;
      const response = await placesApi.search({
        query: searchQuery,
        ...(category ? { category } : {}),
        limit: 20
      });
      const places = response.data.places ?? [];
      setResults(places.map((place) => ({ id: place.id, place })));
      setWarnings(response.data.warnings ?? []);
    } catch {
      setResults([]);
      setWarnings(["추천 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요."]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, query]);

  const handleAddPlace = useCallback(async (place: NormalizedPlaceDto) => {
    try {
      const count = await addPlaceToCurrentTrip(place);
      Alert.alert("일정에 담았어요", `${place.name}까지 ${count}개 장소가 담겼습니다.`);
    } catch {
      Alert.alert("담기 실패", "장소를 일정에 담지 못했어요. 다시 시도해주세요.");
    }
  }, []);

  const renderItem = ({ item }: { item: SearchResultItem }) => {
    const place = item.place;
    return (
      <View style={styles.resultCard}>
        {place.imageUrl ? (
          <Image source={{ uri: place.imageUrl }} style={styles.resultImage} />
        ) : (
          <View style={[styles.resultImage, styles.resultImagePlaceholder]}>
            <Text style={styles.placeholderIcon}>📍</Text>
          </View>
        )}
        <View style={styles.resultContent}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle} numberOfLines={1}>{place.name}</Text>
            {place.isSponsored ? <SponsoredBadge label={place.sponsorLabel ?? "스폰서"} /> : null}
          </View>
          <Text style={styles.resultAddress} numberOfLines={1}>{placeAddress(place)}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.resultCategory}>{place.category}</Text>
            <Text style={styles.providerText}>{place.provider}</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.8}
              onPress={() => { void handleAddPlace(place); }}
            >
              <Text style={styles.addButtonText}>일정에 담기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>통합 검색</Text>
          <Text style={styles.headerSubtitle}>네이버·카카오·공공 관광 데이터를 합쳐 찾습니다</Text>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="지역, 장소, 취향을 검색하세요"
            placeholderTextColor={Colors.common.gray400}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => { void handleSearch(); }}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => { void handleSearch(); }}>
            <Text style={styles.searchButtonText}>검색</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const active = activeCategory === item.key;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, active ? styles.categoryChipActive : null]}
                onPress={() => {
                  setActiveCategory(item.key);
                  setResults([]);
                  setSearched(false);
                  setWarnings([]);
                }}
              >
                <Text style={[styles.categoryChipText, active ? styles.categoryChipTextActive : null]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        />

        {warnings.length ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warnings[0]}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={Colors.young.primary} size="large" style={styles.loader} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              searched ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>🔍</Text>
                  <Text style={styles.emptyText}>추천 데이터를 불러오지 못했어요</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={() => { void handleSearch(); }}>
                    <Text style={styles.retryButtonText}>추천 데이터를 다시 불러오기</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>✨</Text>
                  <Text style={styles.emptyText}>장소를 검색하고 일정에 바로 담아보세요</Text>
                </View>
              )
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 520 : "100%",
    alignSelf: "center"
  },
  header: { paddingTop: 60, paddingHorizontal: Spacing.screenPadding, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: Colors.common.black },
  headerSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 18, color: Colors.common.gray500 },
  searchBar: {
    flexDirection: "row",
    marginHorizontal: Spacing.screenPadding,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    overflow: "hidden",
    marginBottom: 10
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 14, paddingHorizontal: 16, color: Colors.common.black },
  searchButton: {
    backgroundColor: Colors.young.primary,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center"
  },
  searchButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  categoryRow: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    gap: 8
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: "#FFF",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  categoryChipActive: { backgroundColor: "#E8F4FD", borderColor: Colors.young.primary },
  categoryChipText: { fontSize: 13, lineHeight: 17, fontWeight: "700", color: Colors.common.gray600 },
  categoryChipTextActive: { color: Colors.young.primary },
  warningBox: {
    marginHorizontal: Spacing.screenPadding,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    padding: 10
  },
  warningText: { fontSize: 12, lineHeight: 16, color: "#92400E", fontWeight: "700" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 30, flexGrow: 1 },
  resultCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.common.gray200
  },
  resultImage: { width: 92, minHeight: 126 },
  resultImagePlaceholder: { backgroundColor: Colors.common.gray100, alignItems: "center", justifyContent: "center" },
  placeholderIcon: { fontSize: 24 },
  resultContent: { flex: 1, padding: 12, justifyContent: "center" },
  resultHeader: { gap: 6 },
  resultTitle: { ...Typography.normal.body, fontWeight: "800", color: Colors.common.gray800 },
  resultAddress: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 },
  resultCategory: {
    ...Typography.normal.caption,
    color: Colors.young.primary,
    backgroundColor: "#E8F4FD",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden"
  },
  providerText: { ...Typography.normal.caption, color: Colors.common.gray500, fontWeight: "700" },
  actionRow: { marginTop: 10, alignItems: "flex-start" },
  addButton: {
    borderRadius: 9,
    backgroundColor: Colors.young.primary,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addButtonText: { fontSize: 13, lineHeight: 17, color: "#FFF", fontWeight: "800" },
  emptyWrap: { alignItems: "center", marginTop: 80, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, lineHeight: 22, color: Colors.common.gray500, textAlign: "center" },
  retryButton: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.young.primary,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  retryButtonText: { color: Colors.young.primary, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  loader: { marginTop: 80 }
});
