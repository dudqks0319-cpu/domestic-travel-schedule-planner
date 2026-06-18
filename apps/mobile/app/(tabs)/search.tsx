import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Image, ActivityIndicator, Keyboard, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";
import { tourismApi, restaurantApi } from "../../services/api";

type TabKey = "attractions" | "restaurants" | "festivals";
type TabIconName = "camera-outline" | "restaurant-outline" | "ticket-outline";

interface SearchResultItem {
  id: string;
  title: string;
  address: string;
  image?: string;
  category?: string;
  tab: TabKey;
}

const TABS: { key: TabKey; label: string; iconName: TabIconName }[] = [
  { key: "attractions", label: "관광지", iconName: "camera-outline" },
  { key: "restaurants", label: "맛집", iconName: "restaurant-outline" },
  { key: "festivals", label: "축제", iconName: "ticket-outline" },
];

const NON_FOOD_CATEGORY_KEYWORDS = [
  "마트",
  "슈퍼",
  "가구",
  "가전",
  "인테리어",
  "쇼핑",
  "편의점",
  "백화점",
  "의류",
  "약국"
];

const FOOD_CATEGORY_KEYWORDS = ["음식점", "맛집", "카페", "디저트", "주점", "베이커리", "치킨"];

const hasNonFoodCategory = (category?: string) =>
  (category ?? "")
    .split(" ")
    .join("")
    .split(">")
    .map((segment) => segment.trim())
    .some((segment) =>
      NON_FOOD_CATEGORY_KEYWORDS.some((keyword) => segment.includes(keyword))
    );

const hasFoodCategory = (category?: string) =>
  (category ?? "")
    .split(" ")
    .join("")
    .split(">")
    .map((segment) => segment.trim())
    .some((segment) =>
      FOOD_CATEGORY_KEYWORDS.some((keyword) => segment.includes(keyword))
    );

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("attractions");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    setError(null);

    try {
      let items: SearchResultItem[] = [];

      if (activeTab === "attractions") {
        const res = await tourismApi.search(trimmed);
        const raw = (res.data.items ?? []) as Array<{
          contentid: string; title: string; addr1: string; firstimage?: string;
        }>;
        items = raw.map((r) => ({
          id: r.contentid, title: r.title, address: r.addr1,
          image: r.firstimage, tab: "attractions",
        }));
      } else if (activeTab === "restaurants") {
        const queryForFood = /(맛집|음식|식당|카페)/.test(trimmed) ? trimmed : `${trimmed} 맛집`;
        const res = await restaurantApi.search(queryForFood, 20);
        const raw = (res.data.items ?? []) as Array<{
          title: string; roadAddress: string; address: string; category: string;
        }>;
        const filtered = raw.filter(
          (r) => hasFoodCategory(r.category) && !hasNonFoodCategory(r.category)
        );
        items = filtered.map((r, i) => ({
          id: `rest_${i}`, title: r.title, address: r.roadAddress || r.address,
          category: r.category.split(">").pop()?.trim(), tab: "restaurants",
        }));
      } else {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const res = await tourismApi.getFestivals(today, trimmed);
        const raw = (res.data.items ?? []) as Array<{
          contentid: string; title: string; addr1: string; firstimage?: string;
        }>;
        items = raw.map((r) => ({
          id: r.contentid, title: r.title, address: r.addr1,
          image: r.firstimage, tab: "festivals",
        }));
      }

      setResults(items);
    } catch {
      setResults([]);
      setError("provider 응답이 불안정해 검색 결과를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [query, activeTab]);

  const renderItem = ({ item }: { item: SearchResultItem }) => (
    <TouchableOpacity style={styles.resultCard} activeOpacity={0.7}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.resultImage} />
      ) : (
        <View style={[styles.resultImage, styles.resultImagePlaceholder]}>
          <Ionicons
            name={item.tab === "restaurants" ? "restaurant-outline" : item.tab === "festivals" ? "ticket-outline" : "camera-outline"}
            size={24}
            color={Theme.colors.textSecondary}
          />
        </View>
      )}
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
        {item.category ? <Text style={styles.resultCategory}>{item.category}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>검색</Text>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="관광지, 맛집, 축제 검색..."
            placeholderTextColor={Theme.colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearch()}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => void handleSearch()}>
            <Text style={styles.searchButtonText}>검색</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => { setActiveTab(tab.key); setResults([]); setSearched(false); setError(null); }}
            >
            <Ionicons
              name={tab.iconName}
              size={16}
              color={activeTab === tab.key ? Theme.colors.primary : Theme.colors.textSecondary}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={Theme.colors.primary} size="large" style={styles.loader} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              error ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="cloud-offline-outline" size={42} color={Theme.colors.textSecondary} />
                  <Text style={styles.emptyText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={() => void handleSearch()}>
                    <Text style={styles.retryButtonText}>다시 검색</Text>
                  </TouchableOpacity>
                </View>
              ) : searched ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="search-outline" size={42} color={Theme.colors.textSecondary} />
                  <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="map-outline" size={42} color={Theme.colors.primary} />
                  <Text style={styles.emptyText}>여행지, 맛집, 축제를 검색해보세요</Text>
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
  container: { flex: 1, backgroundColor: Theme.colors.background },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 520 : "100%",
    alignSelf: "center"
  },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: Theme.colors.textPrimary },
  searchBar: {
    flexDirection: "row", marginHorizontal: 20,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg, borderWidth: 1, borderColor: Theme.colors.border,
    overflow: "hidden", marginBottom: 12,
    minHeight: 52,
    ...Theme.shadow.sm
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 14, paddingHorizontal: 16, color: Theme.colors.textPrimary },
  searchButton: {
    backgroundColor: Theme.colors.primary, paddingHorizontal: 20,
    justifyContent: "center", alignItems: "center",
    minWidth: 72
  },
  searchButtonText: { color: Theme.colors.textOnPrimary, fontSize: 15, fontWeight: "800" },
  tabRow: {
    flexDirection: "row", marginHorizontal: 20,
    marginBottom: 16, gap: 8,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    minHeight: 44, borderRadius: Theme.radius.md, backgroundColor: Theme.colors.surface,
    borderWidth: 1, borderColor: Theme.colors.border, gap: 4,
  },
  tabActive: { backgroundColor: Theme.colors.primaryLight, borderColor: Theme.colors.primary },
  tabLabel: { fontSize: 13, fontWeight: "700", color: Theme.colors.textSecondary },
  tabLabelActive: { color: Theme.colors.primary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
  resultCard: {
    flexDirection: "row", backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    marginBottom: 10, overflow: "hidden", borderWidth: 1, borderColor: Theme.colors.borderLight,
    ...Theme.shadow.sm
  },
  resultImage: { width: 90, height: 90 },
  resultImagePlaceholder: { backgroundColor: Theme.colors.background, alignItems: "center", justifyContent: "center" },
  resultContent: { flex: 1, padding: 12, justifyContent: "center" },
  resultTitle: { ...Theme.typography.body2, fontWeight: "800", color: Theme.colors.textPrimary },
  resultAddress: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 4 },
  resultCategory: {
    ...Theme.typography.caption, color: Theme.colors.primary, marginTop: 4,
    backgroundColor: Theme.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, alignSelf: "flex-start", overflow: "hidden",
  },
  emptyWrap: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 15, color: Theme.colors.textSecondary, marginTop: 12, textAlign: "center", lineHeight: 22, fontWeight: "700" },
  retryButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  retryButtonText: { color: Theme.colors.textOnPrimary, fontSize: 14, fontWeight: "800" },
  loader: { marginTop: 80 },
});
