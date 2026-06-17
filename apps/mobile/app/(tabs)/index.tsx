import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Theme from "../../constants/Theme";
import {
  DEFAULT_TRAVEL_STYLE_KEY,
  TRAVEL_STYLE_OPTIONS
} from "../../constants/travelStyles";
import { fetchDestinations } from "../../services/destinations.service";
import { fetchTopFriends } from "../../services/friends.service";
import type { Destination } from "../../types";

interface TopFriend {
  id: string;
  name: string;
  avatar: string;
}

const QUICK_START_STYLES = TRAVEL_STYLE_OPTIONS.slice(0, 4);
const REGION_MARKERS = [
  { id: "seoul", name: "서울", x: "46%", y: "25%" },
  { id: "gangneung", name: "강릉", x: "67%", y: "24%" },
  { id: "jeonju", name: "전주", x: "43%", y: "53%" },
  { id: "busan", name: "부산", x: "68%", y: "70%" },
  { id: "jeju", name: "제주", x: "35%", y: "86%" }
] as const;

type HomeDataStatus = "loading" | "ready" | "error";

export default function HomeScreen() {
  const router = useRouter();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [friends, setFriends] = useState<TopFriend[]>([]);
  const [status, setStatus] = useState<HomeDataStatus>("loading");

  const loadHomeData = useCallback(async () => {
    setStatus("loading");
    try {
      const [destinationsRes, friendsRes] = await Promise.all([fetchDestinations(), fetchTopFriends()]);
      setDestinations(destinationsRes.slice(0, 3));
      setFriends((friendsRes as TopFriend[]).slice(0, 5));
      setStatus("ready");
    } catch {
      setDestinations([]);
      setFriends([]);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "좋은 아침이에요";
    if (hour < 18) return "좋은 오후예요";
    return "좋은 저녁이에요";
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.logo}>트립메이트</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7} onPress={() => router.push("/(tabs)/search")}>
              <Ionicons name="search-outline" size={21} color={Theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={21} color={Theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.greeting}>{greeting}, 김지수님!</Text>
        <Text style={styles.subGreeting}>오늘 어디로 여행 가시겠어요?</Text>

        <View style={styles.mapFirstPanel}>
          <View style={styles.mapHeaderRow}>
            <View>
              <Text style={styles.mapEyebrow}>전국 지도에서 바로 시작</Text>
              <Text style={styles.mapTitle}>지역을 고르면 날짜만으로 초안을 만들어요</Text>
            </View>
            {status === "loading" ? <ActivityIndicator color={Theme.colors.primary} /> : null}
          </View>

          <View style={styles.koreaMapSurface}>
            <View style={styles.mapLandShape} />
            {REGION_MARKERS.map((marker) => (
              <TouchableOpacity
                key={marker.id}
                style={[styles.regionMarker, { left: marker.x, top: marker.y }]}
                activeOpacity={0.82}
                onPress={() =>
                  router.push({
                    pathname: "/trip/create",
                    params: { destination: marker.name, styleKey: DEFAULT_TRAVEL_STYLE_KEY }
                  })
                }
              >
                <View style={styles.regionMarkerDot} />
                <Text style={styles.regionMarkerText}>{marker.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {status === "error" ? (
            <View style={styles.stateNotice}>
              <Ionicons name="cloud-offline-outline" size={16} color={Theme.colors.error} />
              <Text style={styles.stateNoticeText}>추천 데이터를 불러오지 못했어요. 지역 선택은 계속 사용할 수 있습니다.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void loadHomeData()}>
                <Text style={styles.retryButtonText}>재시도</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.destList}>
          {destinations.length === 0 && status !== "loading" ? (
            <View style={styles.emptyDestCard}>
              <Text style={styles.emptyDestTitle}>추천 지역이 비어 있어요</Text>
              <Text style={styles.emptyDestText}>지도에서 지역을 먼저 선택해 여행을 시작할 수 있습니다.</Text>
            </View>
          ) : null}
          {destinations.map((destination) => (
            <TouchableOpacity
              key={destination.id}
              activeOpacity={0.85}
              style={styles.destCard}
              onPress={() =>
                router.push({
                  pathname: "/trip/create",
                  params: { destination: destination.name, styleKey: DEFAULT_TRAVEL_STYLE_KEY }
                })
              }
            >
              <Image source={{ uri: destination.image }} style={styles.destImage} />
              <View style={styles.destOverlay} />
              <View style={styles.destFooter}>
                <Text style={styles.destName}>{destination.name}</Text>
                <View style={styles.ratingWrap}>
                  <Ionicons name="star" size={14} color="#FFFFFF" />
                  <Text style={styles.rating}>{destination.rating.toFixed(1)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.categoryRow}>
          {QUICK_START_STYLES.map((styleOption) => (
            <TouchableOpacity
              key={styleOption.key}
              style={[styles.categoryChip, { backgroundColor: styleOption.tintColor }]}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: "/trip/create",
                  params: { styleKey: styleOption.key }
                })
              }
            >
              <Ionicons name={styleOption.iconName} size={18} color={Theme.colors.textPrimary} />
              <Text style={styles.categoryLabel}>{styleOption.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>여행 친구 찾기</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/friend")}> 
            <Text style={styles.moreLink}>더보기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.friendRow}>
          {friends.map((friend, index) => (
            <TouchableOpacity
              key={friend.id}
              style={styles.friendItem}
              activeOpacity={0.75}
              onPress={() => router.push("/(tabs)/friend")}
            >
              <View>
                <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                {index < 3 ? (
                  <View style={styles.plusBadge}>
                    <Ionicons name="add" size={11} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.friendName} numberOfLines={1}>{friend.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={() =>
            router.push({
              pathname: "/trip/create",
              params: { styleKey: DEFAULT_TRAVEL_STYLE_KEY }
            })
          }
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.ctaText}>새 여행 만들기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  content: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 34,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 500 : "100%",
    alignSelf: "center"
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  logo: {
    fontSize: 35,
    lineHeight: 40,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  greeting: {
    marginTop: 12,
    fontSize: 34,
    lineHeight: 40,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  subGreeting: {
    marginTop: 2,
    fontSize: 22,
    lineHeight: 28,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: 14
  },
  mapFirstPanel: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    padding: 14,
    marginBottom: 12,
    ...Theme.shadow.sm
  },
  mapHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  mapEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.primary,
    fontWeight: "800"
  },
  mapTitle: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 21,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  koreaMapSurface: {
    marginTop: 12,
    height: 238,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D5EAF8",
    backgroundColor: "#EAF7FF",
    overflow: "hidden",
    position: "relative"
  },
  mapLandShape: {
    position: "absolute",
    left: "27%",
    top: "8%",
    width: "45%",
    height: "76%",
    borderTopLeftRadius: 72,
    borderTopRightRadius: 46,
    borderBottomLeftRadius: 54,
    borderBottomRightRadius: 86,
    backgroundColor: "#DFF3E6",
    borderWidth: 1,
    borderColor: "#B8DDC4",
    transform: [{ rotate: "12deg" }]
  },
  regionMarker: {
    position: "absolute",
    minHeight: 44,
    minWidth: 68,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    ...Theme.shadow.sm
  },
  regionMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.primary
  },
  regionMarkerText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  stateNotice: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD8D8",
    backgroundColor: "#FFF5F5",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  stateNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  retryButton: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.error,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  retryButtonText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.error,
    fontWeight: "800"
  },
  destList: {
    gap: 10
  },
  emptyDestCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    padding: 14
  },
  emptyDestTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  emptyDestText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  destCard: {
    height: 134,
    borderRadius: 14,
    overflow: "hidden",
    ...Theme.shadow.sm
  },
  destImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%"
  },
  destOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.24)"
  },
  destFooter: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  destName: {
    color: "#FFFFFF",
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800"
  },
  ratingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  rating: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700"
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14
  },
  categoryChip: {
    width: "48%",
    borderRadius: 12,
    minHeight: 74,
    paddingHorizontal: 13,
    paddingVertical: 10,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)"
  },
  categoryLabel: {
    marginTop: 5,
    fontSize: 18,
    lineHeight: 22,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: 33,
    lineHeight: 38,
    fontWeight: "800",
    color: Theme.colors.textPrimary
  },
  moreLink: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8
  },
  friendItem: {
    flex: 1,
    alignItems: "center"
  },
  friendAvatar: {
    width: 55,
    height: 55,
    borderRadius: 28
  },
  plusBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: Theme.colors.textPrimary,
    borderWidth: 2,
    borderColor: Theme.colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  friendName: {
    marginTop: 6,
    fontSize: 24,
    lineHeight: 28,
    color: Theme.colors.textPrimary,
    fontWeight: "600"
  },
  cta: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: Theme.colors.primary,
    ...Theme.shadow.md
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700"
  }
});
