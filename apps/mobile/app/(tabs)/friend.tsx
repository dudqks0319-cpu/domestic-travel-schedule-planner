import React, { useEffect, useMemo, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Theme from "../../constants/Theme";
import type { FriendMatch } from "../../types";
import { fetchFriendMatches } from "../../services/friends.service";

type FilterKey = "all" | "same" | "high";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "same", label: "같은 일정" },
  { key: "high", label: "높은 매칭순" }
];

function tagColor(index: number): string {
  const colors = ["#EFE7DC", "#DEE6F5", "#E9DDF5"];
  return colors[index % colors.length];
}

export default function FriendScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [mates, setMates] = useState<FriendMatch[]>([]);

  useEffect(() => {
    void fetchFriendMatches().then((data) => setMates(data));
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === "high") {
      return [...mates].sort((a, b) => b.match - a.match);
    }

    if (activeFilter === "same") {
      return mates.filter((item) => item.destination.includes("제주") || item.destination.includes("서울"));
    }

    return mates;
  }, [activeFilter, mates]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>여행 친구 찾기</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} />

              <View style={styles.infoWrap}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}, {item.age}세</Text>
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchText}>{item.match}% 매칭</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={14} color={Theme.colors.textSecondary} />
                  <Text style={styles.meta}>{item.destination} | {item.dateRange}</Text>
                </View>

                <View style={styles.tagRow}>
                  {item.tags.map((tag, index) => (
                    <View key={`${item.id}-${tag}`} style={[styles.tag, { backgroundColor: tagColor(index) }]}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.bio}>{item.bio}</Text>
            <Text style={styles.checklist}>✓ {item.checklist.join("  ✓ ")}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, styles.chatButton]} activeOpacity={0.85}>
                <Text style={styles.chatButtonText}>채팅하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.compareButton]}
                onPress={() => router.push("/trip/schedule")}
                activeOpacity={0.85}
              >
                <Text style={styles.compareButtonText}>일정 비교</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 500 : "100%",
    alignSelf: "center"
  },
  title: {
    fontSize: 48,
    lineHeight: 54,
    fontWeight: "800",
    color: Theme.colors.textPrimary,
    marginBottom: 15,
    letterSpacing: -0.6
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Theme.colors.surface,
    minHeight: 38,
    justifyContent: "center"
  },
  filterChipActive: {
    backgroundColor: "#EE8F79",
    borderColor: "#EE8F79"
  },
  filterText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: Theme.colors.textPrimary
  },
  filterTextActive: {
    color: "#FFFFFF"
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
    ...Theme.shadow.sm
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 12
  },
  infoWrap: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  name: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    color: Theme.colors.textPrimary
  },
  matchBadge: {
    backgroundColor: "#D8F1DF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  matchText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#4E9D6B"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4
  },
  meta: {
    fontSize: 14,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  tagRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4
  },
  tagText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  bio: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  checklist: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 21,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 11,
    minHeight: 44
  },
  chatButton: {
    backgroundColor: "#EE8F79"
  },
  chatButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800"
  },
  compareButton: {
    backgroundColor: "#8CB4EA"
  },
  compareButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800"
  }
});
