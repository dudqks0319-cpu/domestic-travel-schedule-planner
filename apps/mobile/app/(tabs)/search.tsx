import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Image, ActivityIndicator, Keyboard, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
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
            color={Colors.common.gray500}
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
            placeholderTextColor={Colors.common.gray400}
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
                color={activeTab === tab.key ? Colors.young.primary : Colors.common.gray600}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
              error ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="cloud-offline-outline" size={44} color={Colors.common.gray500} />
                  <Text style={styles.emptyText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={() => void handleSearch()}>
                    <Text style={styles.retryButtonText}>다시 검색</Text>
                  </TouchableOpacity>
                </View>
              ) : searched ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="search-outline" size={44} color={Colors.common.gray500} />
                  <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="sparkles-outline" size={44} color={Colors.young.primary} />
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
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 520 : "100%",
    alignSelf: "center"
  },
  header: { paddingTop: 60, paddingHorizontal: Spacing.screenPadding, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: Colors.common.black },
  searchBar: {
    flexDirection: "row", marginHorizontal: Spacing.screenPadding,
    backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1, borderColor: Colors.common.gray200,
    overflow: "hidden", marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 14, paddingHorizontal: 16, color: Colors.common.black },
  searchButton: {
    backgroundColor: Colors.young.primary, paddingHorizontal: 20,
    justifyContent: "center", alignItems: "center",
  },
  searchButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  tabRow: {
    flexDirection: "row", marginHorizontal: Spacing.screenPadding,
    marginBottom: 16, gap: 8,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 12, backgroundColor: "#FFF",
    borderWidth: 1, borderColor: Colors.common.gray200, gap: 4,
  },
  tabActive: { backgroundColor: "#E8F4FD", borderColor: Colors.young.primary },
  tabLabel: { fontSize: 13, fontWeight: "600", color: Colors.common.gray600 },
  tabLabelActive: { color: Colors.young.primary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 30, flexGrow: 1 },
  resultCard: {
    flexDirection: "row", backgroundColor: "#FFF", borderRadius: 16,
    marginBottom: 10, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  resultImage: { width: 90, height: 90 },
  resultImagePlaceholder: { backgroundColor: Colors.common.gray100, alignItems: "center", justifyContent: "center" },
  resultContent: { flex: 1, padding: 12, justifyContent: "center" },
  resultTitle: { ...Typography.normal.body, fontWeight: "700", color: Colors.common.gray800 },
  resultAddress: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 4 },
  resultCategory: {
    ...Typography.normal.caption, color: Colors.young.primary, marginTop: 4,
    backgroundColor: "#E8F4FD", paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, alignSelf: "flex-start", overflow: "hidden",
  },
  emptyWrap: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16, color: Colors.common.gray500, marginTop: 12, textAlign: "center", lineHeight: 22 },
  retryButton: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: Colors.young.primary,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  retryButtonText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  loader: { marginTop: 80 },
});
