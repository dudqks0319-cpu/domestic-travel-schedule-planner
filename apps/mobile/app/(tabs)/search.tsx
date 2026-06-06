import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
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
import { placesApi, tripsApi, type NormalizedPlaceDto } from "../../services/api";
import { CURRENT_TRIP_STORAGE_KEY } from "../../services/localTripStorage";

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

interface DayOption {
  dayNumber: number;
  label: string;
  dateLabel: string;
}

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

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(date: Date): string {
  const weekLabel = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()] ?? "";
  return `${date.getMonth() + 1}.${date.getDate()} (${weekLabel})`;
}

function buildDayOptions(currentTrip: Record<string, unknown> | null): DayOption[] {
  const startDateText = typeof currentTrip?.startDate === "string" ? currentTrip.startDate : "";
  const endDateText = typeof currentTrip?.endDate === "string" ? currentTrip.endDate : "";
  const startDate = parseDateOnly(startDateText);
  const endDate = parseDateOnly(endDateText);

  if (!startDate || !endDate) {
    return [{ dayNumber: 1, label: "1일차", dateLabel: "날짜 미정" }];
  }

  const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const dayCount = Math.max(1, Math.min(diffDays, 15));
  return Array.from({ length: dayCount }).map((_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      dayNumber: index + 1,
      label: `${index + 1}일차`,
      dateLabel: formatDateLabel(date)
    };
  });
}

async function persistPlaceToRemoteTrip(
  currentTrip: Record<string, unknown>,
  place: NormalizedPlaceDto,
  nextSortOrder: number,
  dayNumber: number
): Promise<string | null> {
  const tripId = typeof currentTrip.id === "string" ? currentTrip.id : "";
  if (!tripId || tripId.startsWith("trip_")) {
    return null;
  }

  try {
    const response = await tripsApi.addPlace(tripId, {
      providerPlaceId: place.providerPlaceId ?? place.id,
      name: place.name,
      category: place.category,
      address: place.roadAddress || place.address,
      lat: place.lat,
      lng: place.lng,
      dayNumber,
      sortOrder: nextSortOrder,
      isSponsored: place.isSponsored,
      ...(place.sponsorLabel ? { sponsorLabel: place.sponsorLabel } : {})
    });
    return response.data.place.id;
  } catch {
    return null;
  }
}

async function addPlaceToCurrentTrip(place: NormalizedPlaceDto, dayNumber: number): Promise<{
  count: number;
  remoteSaved: boolean;
}> {
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

  const tripPlaceId = alreadyAdded
    ? null
    : await persistPlaceToRemoteTrip(currentTrip, place, routePoints.length + 1, dayNumber);

  if (!alreadyAdded) {
    routePoints.push({
      id: place.id,
      ...(tripPlaceId ? { tripPlaceId } : {}),
      providerPlaceId: place.providerPlaceId ?? place.id,
      name: place.name,
      latitude: place.lat,
      longitude: place.lng,
      dayNumber
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

  return { count: routePoints.length, remoteSaved: !!tripPlaceId };
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [dayOptions, setDayOptions] = useState<DayOption[]>([{ dayNumber: 1, label: "1일차", dateLabel: "날짜 미정" }]);
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);

  useEffect(() => {
    let mounted = true;

    const loadTripDays = async () => {
      const rawTrip = await AsyncStorage.getItem(CURRENT_TRIP_STORAGE_KEY).catch(() => null);
      const currentTrip =
        rawTrip && rawTrip.trim()
          ? (JSON.parse(rawTrip) as Record<string, unknown>)
          : null;
      const nextOptions = buildDayOptions(currentTrip);
      if (!mounted) {
        return;
      }
      setDayOptions(nextOptions);
      setSelectedDayNumber((current) =>
        nextOptions.some((option) => option.dayNumber === current)
          ? current
          : nextOptions[0]?.dayNumber ?? 1
      );
    };

    void loadTripDays();

    return () => {
      mounted = false;
    };
  }, []);

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
      const result = await addPlaceToCurrentTrip(place, selectedDayNumber);
      const selectedDayLabel =
        dayOptions.find((option) => option.dayNumber === selectedDayNumber)?.label ?? `${selectedDayNumber}일차`;
      Alert.alert(
        "일정에 담았어요",
        result.remoteSaved
          ? `${place.name}이 ${selectedDayLabel}에 담기고 서버에 저장됐습니다.`
          : `${place.name}이 ${selectedDayLabel}에 담겼습니다. 현재 ${result.count}개 장소가 있습니다.`
      );
    } catch {
      Alert.alert("담기 실패", "장소를 일정에 담지 못했어요. 다시 시도해주세요.");
    }
  }, [dayOptions, selectedDayNumber]);

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

        <View style={styles.dayPickerWrap}>
          <Text style={styles.dayPickerLabel}>담을 날짜</Text>
          <FlatList
            horizontal
            data={dayOptions}
            keyExtractor={(item) => String(item.dayNumber)}
            renderItem={({ item }) => {
              const active = selectedDayNumber === item.dayNumber;
              return (
                <TouchableOpacity
                  style={[styles.dayChip, active ? styles.dayChipActive : null]}
                  onPress={() => setSelectedDayNumber(item.dayNumber)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayChipTitle, active ? styles.dayChipTitleActive : null]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.dayChipDate, active ? styles.dayChipDateActive : null]}>
                    {item.dateLabel}
                  </Text>
                </TouchableOpacity>
              );
            }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          />
        </View>

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
  dayPickerWrap: {
    marginHorizontal: Spacing.screenPadding,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: "#FFF",
    paddingVertical: 10
  },
  dayPickerLabel: {
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.common.gray500,
    fontWeight: "800"
  },
  dayRow: {
    paddingHorizontal: 12,
    gap: 8
  },
  dayChip: {
    minWidth: 86,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  dayChipActive: {
    borderColor: Colors.young.primary,
    backgroundColor: "#E8F4FD"
  },
  dayChipTitle: {
    fontSize: 13,
    lineHeight: 17,
    color: Colors.common.gray700,
    fontWeight: "800"
  },
  dayChipTitleActive: { color: Colors.young.primary },
  dayChipDate: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.common.gray500,
    fontWeight: "700"
  },
  dayChipDateActive: { color: Colors.young.primary },
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
