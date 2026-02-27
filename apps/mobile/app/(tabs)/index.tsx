import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";

const { width } = Dimensions.get("window");
const cardGap = 12;
const cardWidth = (width - Spacing.screenPadding * 2 - cardGap) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState("여행자");

  useEffect(() => {
    void loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await AsyncStorage.getItem("userData");
      if (!data) return;

      const parsed = JSON.parse(data) as { nickname?: string };
      setNickname(parsed.nickname ?? "여행자");
    } catch {
      setNickname("여행자");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting}>👋 안녕하세요, {nickname}님!</Text>
        <Text style={styles.greetingSub}>어디로 떠나볼까요?</Text>
      </View>

      <View style={styles.bentoGrid}>
        <TouchableOpacity
          style={[styles.bentoCard, styles.bentoLarge]}
          activeOpacity={0.8}
          onPress={() => router.push("/create")}
        >
          <Text style={styles.bentoEmoji}>✈️</Text>
          <Text style={styles.bentoTitle}>새 여행 만들기</Text>
          <Text style={styles.bentoSub}>비행기부터 맛집까지{"\n"}A to Z 한번에!</Text>
          <View style={styles.bentoButton}>
            <Text style={styles.bentoButtonText}>시작하기 →</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.bentoColumn}>
          <TouchableOpacity style={[styles.bentoCard, styles.bentoSmall, { backgroundColor: "#E8F5E9" }]} activeOpacity={0.8}>
            <Text style={styles.bentoSmallEmoji}>📅</Text>
            <Text style={styles.bentoSmallTitle}>내 일정</Text>
            <Text style={styles.bentoSmallCount}>0개</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bentoCard, styles.bentoSmall, { backgroundColor: "#FFF3E0" }]} activeOpacity={0.8}>
            <Text style={styles.bentoSmallEmoji}>🌤️</Text>
            <Text style={styles.bentoSmallTitle}>오늘 날씨</Text>
            <Text style={styles.bentoSmallCount}>서울 12°</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 인기 여행 일정</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularList}>
          {[
            { title: "제주 3박4일", emoji: "🏝️", likes: 234, region: "제주" },
            { title: "부산 2박3일", emoji: "🌊", likes: 189, region: "부산" },
            { title: "강릉 1박2일", emoji: "☕", likes: 156, region: "강릉" },
            { title: "경주 2박3일", emoji: "🏛️", likes: 143, region: "경주" }
          ].map((item) => (
            <TouchableOpacity key={item.title} style={styles.popularCard} activeOpacity={0.8}>
              <Text style={styles.popularEmoji}>{item.emoji}</Text>
              <Text style={styles.popularTitle}>{item.title}</Text>
              <Text style={styles.popularRegion}>{item.region}</Text>
              <Text style={styles.popularLikes}>❤️ {item.likes}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 빠른 검색</Text>
        <View style={styles.quickGrid}>
          {[
            { emoji: "🏝️", label: "제주도" },
            { emoji: "🌊", label: "부산" },
            { emoji: "☕", label: "강릉" },
            { emoji: "🏛️", label: "경주" },
            { emoji: "🏯", label: "전주" },
            { emoji: "🌲", label: "속초" }
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.quickItem} activeOpacity={0.7}>
              <Text style={styles.quickEmoji}>{item.emoji}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA"
  },
  content: {
    paddingTop: 60,
    paddingBottom: 30
  },
  greetingContainer: {
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: 24
  },
  greeting: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.common.black
  },
  greetingSub: {
    fontSize: 16,
    color: Colors.common.gray500,
    marginTop: 4
  },
  bentoGrid: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screenPadding,
    gap: cardGap
  },
  bentoColumn: {
    gap: cardGap,
    width: cardWidth
  },
  bentoCard: {
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5
  },
  bentoLarge: {
    width: cardWidth,
    backgroundColor: Colors.young.primary,
    padding: 24,
    justifyContent: "space-between",
    minHeight: cardWidth * 1.3
  },
  bentoSmall: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center"
  },
  bentoEmoji: {
    fontSize: 44,
    marginBottom: 12
  },
  bentoTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 6
  },
  bentoSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    marginBottom: 16
  },
  bentoButton: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start"
  },
  bentoButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14
  },
  bentoSmallEmoji: {
    fontSize: 30,
    marginBottom: 8
  },
  bentoSmallTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.common.gray700
  },
  bentoSmallCount: {
    fontSize: 13,
    color: Colors.common.gray500,
    marginTop: 4
  },
  section: {
    marginTop: 32,
    paddingLeft: Spacing.screenPadding
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.common.black,
    marginBottom: 16
  },
  popularList: {
    paddingRight: Spacing.screenPadding,
    gap: 12
  },
  popularCard: {
    width: 150,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  popularEmoji: {
    fontSize: 36,
    marginBottom: 10
  },
  popularTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.common.gray800,
    marginBottom: 4
  },
  popularRegion: {
    fontSize: 12,
    color: Colors.common.gray500,
    marginBottom: 8
  },
  popularLikes: {
    fontSize: 13,
    color: Colors.common.error,
    fontWeight: "600"
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingRight: Spacing.screenPadding,
    gap: 10
  },
  quickItem: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  quickEmoji: {
    fontSize: 20
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.common.gray700
  }
});
