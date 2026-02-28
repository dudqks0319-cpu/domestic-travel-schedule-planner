import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import { getUserProfile } from "../../lib/secure-storage";
import { weatherApi, tripsApi, plannerApi } from "../../services/api";

const cardGap = 12;

interface WeatherData {
  city: string;
  temp: string;
  sky: string;
}

interface DestSuggestion {
  name: string;
  emoji: string;
  description: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState("여행자");
  const [tripCount, setTripCount] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [destinations, setDestinations] = useState<DestSuggestion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const parsed = await getUserProfile<{ nickname?: string }>();
      if (parsed?.nickname) setNickname(parsed.nickname);
    } catch { }

    try {
      const res = await tripsApi.list();
      setTripCount(res.data.trips?.length ?? 0);
    } catch {
      setTripCount(0);
    }

    setLoadingWeather(true);
    try {
      const res = await weatherApi.getForecast("서울");
      const items = res.data.items as Array<{ category: string; fcstValue: string }> | undefined;
      if (items && items.length > 0) {
        const tmpItem = items.find((i) => i.category === "TMP");
        const skyItem = items.find((i) => i.category === "SKY");
        const skyMap: Record<string, string> = { "1": "맑음", "3": "구름많음", "4": "흐림" };
        setWeather({
          city: "서울",
          temp: tmpItem ? `${tmpItem.fcstValue}°` : "--°",
          sky: skyItem ? skyMap[skyItem.fcstValue] ?? "정보없음" : "--",
        });
      }
    } catch {
      setWeather({ city: "서울", temp: "--°", sky: "조회 실패" });
    } finally {
      setLoadingWeather(false);
    }

    try {
      const res = await plannerApi.suggestions();
      setDestinations(res.data.destinations ?? []);
    } catch {
      setDestinations([
        { name: "제주도", emoji: "🏝️", description: "자연과 바다의 섬" },
        { name: "부산", emoji: "🌊", description: "해운대와 광안리" },
        { name: "강릉", emoji: "☕", description: "커피와 바다" },
        { name: "경주", emoji: "🏛️", description: "천년 고도" },
      ]);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting}>안녕하세요, {nickname}님!</Text>
        <Text style={styles.greetingSub}>어디로 떠나볼까요?</Text>
      </View>

      <View style={styles.bentoGrid}>
        <TouchableOpacity
          style={[styles.bentoCard, styles.bentoLarge]}
          activeOpacity={0.8}
          onPress={() => router.push("/trip/create")}
        >
          <Text style={styles.bentoEmoji}>✈️</Text>
          <Text style={styles.bentoTitle}>새 여행 만들기</Text>
          <Text style={styles.bentoSub}>관광지부터 맛집까지{"\n"}A to Z 한번에!</Text>
          <View style={styles.bentoButton}>
            <Text style={styles.bentoButtonText}>시작하기 →</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.bentoColumn}>
          <TouchableOpacity
            style={[styles.bentoCard, styles.bentoSmall, { backgroundColor: "#E8F5E9" }]}
            activeOpacity={0.8}
          >
            <Text style={styles.bentoSmallEmoji}>📅</Text>
            <Text style={styles.bentoSmallTitle}>내 일정</Text>
            <Text style={styles.bentoSmallCount}>{tripCount}개</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoCard, styles.bentoSmall, { backgroundColor: "#FFF3E0" }]}
            activeOpacity={0.8}
          >
            <Text style={styles.bentoSmallEmoji}>🌤️</Text>
            <Text style={styles.bentoSmallTitle}>오늘 날씨</Text>
            {loadingWeather ? (
              <ActivityIndicator size="small" color={Colors.common.gray500} />
            ) : (
              <Text style={styles.bentoSmallCount}>
                {weather ? `${weather.city} ${weather.temp}` : "--"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 빠른 검색</Text>
        <View style={styles.quickGrid}>
          {destinations.slice(0, 8).map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.quickItem}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: "/trip/create", params: { destination: item.name } })}
            >
              <Text style={styles.quickEmoji}>{item.emoji}</Text>
              <View>
                <Text style={styles.quickLabel}>{item.name}</Text>
                <Text style={styles.quickDesc}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  content: {
    paddingTop: 60,
    paddingBottom: 30,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 520 : "100%",
    alignSelf: "center"
  },
  greetingContainer: { paddingHorizontal: Spacing.screenPadding, marginBottom: 24 },
  greeting: { fontSize: 26, fontWeight: "800", color: Colors.common.black },
  greetingSub: { fontSize: 16, color: Colors.common.gray500, marginTop: 4 },
  bentoGrid: { flexDirection: "row", paddingHorizontal: Spacing.screenPadding, gap: cardGap },
  bentoColumn: { gap: cardGap, flex: 1 },
  bentoCard: { borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
  bentoLarge: { flex: 1, backgroundColor: Colors.young.primary, padding: 24, justifyContent: "space-between", minHeight: 220 },
  bentoSmall: { flex: 1, padding: 18, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  bentoEmoji: { fontSize: 44, marginBottom: 12 },
  bentoTitle: { fontSize: 20, fontWeight: "800", color: "#FFF", marginBottom: 6 },
  bentoSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 20, marginBottom: 16 },
  bentoButton: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignSelf: "flex-start" },
  bentoButtonText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  bentoSmallEmoji: { fontSize: 30, marginBottom: 8 },
  bentoSmallTitle: { fontSize: 14, fontWeight: "700", color: Colors.common.gray700 },
  bentoSmallCount: { fontSize: 13, color: Colors.common.gray500, marginTop: 4 },
  section: { marginTop: 32, paddingHorizontal: Spacing.screenPadding },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: Colors.common.black, marginBottom: 16 },
  quickGrid: { gap: 10 },
  quickItem: {
    backgroundColor: "#FFF", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: "row", gap: 12, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  quickEmoji: { fontSize: 28 },
  quickLabel: { fontSize: 15, fontWeight: "700", color: Colors.common.gray700 },
  quickDesc: { fontSize: 12, color: Colors.common.gray500, marginTop: 2 },
});
