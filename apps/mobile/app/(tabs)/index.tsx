import React, { useEffect, useMemo, useState } from "react";
import {
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
import { fetchDestinations } from "../../services/destinations.service";
import { fetchTopFriends } from "../../services/friends.service";
import type { Destination } from "../../types";

interface TopFriend {
  id: string;
  name: string;
  avatar: string;
}

const CATEGORY_CHIPS = [
  { key: "family", label: "가족여행", color: "#F8DADA", icon: "people-outline" as const },
  { key: "solo", label: "혼자여행", color: "#DDE9FB", icon: "walk-outline" as const },
  { key: "couple", label: "커플여행", color: "#F3E8FB", icon: "heart-outline" as const },
  { key: "active", label: "액티비티", color: "#DCF4E1", icon: "triangle-outline" as const }
];

export default function HomeScreen() {
  const router = useRouter();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [friends, setFriends] = useState<TopFriend[]>([]);

  useEffect(() => {
    void Promise.all([fetchDestinations(), fetchTopFriends()]).then(([destinationsRes, friendsRes]) => {
      setDestinations(destinationsRes.slice(0, 3));
      setFriends((friendsRes as TopFriend[]).slice(0, 5));
    });
  }, []);

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

        <View style={styles.destList}>
          {destinations.map((destination) => (
            <TouchableOpacity
              key={destination.id}
              activeOpacity={0.85}
              style={styles.destCard}
              onPress={() =>
                router.push({
                  pathname: "/trip/create",
                  params: { destination: destination.name }
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
          {CATEGORY_CHIPS.map((chip) => (
            <TouchableOpacity key={chip.key} style={[styles.categoryChip, { backgroundColor: chip.color }]} activeOpacity={0.8}>
              <Ionicons name={chip.icon} size={18} color={Theme.colors.textPrimary} />
              <Text style={styles.categoryLabel}>{chip.label}</Text>
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

        <TouchableOpacity style={styles.cta} onPress={() => router.push("/trip/create")} activeOpacity={0.85}>
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
  destList: {
    gap: 10
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
