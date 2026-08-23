import React, { useMemo, useState, useEffect } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";
import { Review } from "../../types";
import { fetchReviews } from "../../services/reviews.service";
import { fetchKSkillTravelInfo, type KSkillTravelInfo } from "../../services/kskill.service";

type ReviewFilter = "전체" | "가족" | "커플" | "혼자";

const FILTERS: ReviewFilter[] = ["전체", "가족", "커플", "혼자"];



function Stars({ count }: { count: number }) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <Ionicons
          key={`star-${idx}`}
          name={idx < count ? "star" : "star-outline"}
          size={14}
          color={idx < count ? "#111827" : "#9CA3AF"}
        />
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("전체");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [localInfo, setLocalInfo] = useState<KSkillTravelInfo | null>(null);

  useEffect(() => {
    fetchReviews().then(setReviews);
    fetchKSkillTravelInfo("제주도").then(setLocalInfo);
  }, []);

  const filteredReviews = useMemo(() => {
    if (activeFilter === "전체") {
      return reviews;
    }
    return reviews.filter((item) => item.type === activeFilter);
  }, [activeFilter, reviews]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.localHero}>
          <Text style={styles.localEyebrow}>K-skill 공공데이터</Text>
          <Text style={styles.placeTitle}>제주 로컬정보</Text>
          <Text style={styles.localSubtitle}>날씨, 미세먼지, 주차, 관광 후기를 한 화면에서 확인하세요.</Text>
          <View
            style={[
              styles.localStatusBadge,
              localInfo?.status === "connected" ? styles.localStatusLive : styles.localStatusDemo,
            ]}
          >
            <Text
              style={[
                styles.localStatusText,
                localInfo?.status === "connected" ? styles.localStatusTextLive : styles.localStatusTextDemo,
              ]}
            >
              {localInfo?.statusLabel ?? "데모 데이터 사용 중"}
            </Text>
          </View>
        </View>

        <View style={styles.localGrid}>
          <View style={styles.localCard}>
            <Ionicons name="partly-sunny-outline" size={22} color={Theme.colors.primary} />
            <Text style={styles.localCardLabel}>여행 날씨</Text>
            <Text style={styles.localCardValue}>
              {localInfo?.weather?.temperature ?? "--"} · {localInfo?.weather?.sky ?? "확인 중"}
            </Text>
            <Text style={styles.localCardMeta}>강수 {localInfo?.weather?.rainProbability ?? "--"}</Text>
          </View>
          <View style={styles.localCard}>
            <Ionicons name="leaf-outline" size={22} color={Theme.colors.success} />
            <Text style={styles.localCardLabel}>미세먼지</Text>
            <Text style={styles.localCardValue}>
              {localInfo?.fineDust?.overallGrade ?? localInfo?.fineDust?.pm10Grade ?? "확인 중"}
            </Text>
            <Text style={styles.localCardMeta}>PM2.5 {localInfo?.fineDust?.pm25 ?? "--"}</Text>
          </View>
          <View style={styles.localCard}>
            <Ionicons name="car-outline" size={22} color={Theme.colors.warning} />
            <Text style={styles.localCardLabel}>주차장</Text>
            <Text style={styles.localCardValue} numberOfLines={1}>
              {localInfo?.parkingLots[0]?.name ?? "공영주차장 확인 중"}
            </Text>
            <Text style={styles.localCardMeta} numberOfLines={1}>
              {localInfo?.parkingLots[0]?.address ?? "거리순 주차 정보"}
            </Text>
          </View>
          <View style={styles.localCard}>
            <Ionicons name="medkit-outline" size={22} color={Theme.colors.secondary} />
            <Text style={styles.localCardLabel}>응급/약국</Text>
            <Text style={styles.localCardValue}>서버 연결 후</Text>
            <Text style={styles.localCardMeta}>병원·약국 위치 연동 예정</Text>
          </View>
        </View>

        <View style={styles.headerBlock}>
          <Text style={styles.sectionHeading}>성산일출봉 후기</Text>
          <View style={styles.ratingLine}>
            <Ionicons name="star" size={16} color="#111827" />
            <Text style={styles.ratingScore}>4.7</Text>
            <Text style={styles.ratingMeta}>후기 1,234</Text>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((filter) => {
              const active = filter === activeFilter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, active ? styles.filterChipActive : null]}
                  onPress={() => setActiveFilter(filter)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{filter}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.reviewList}>
          {filteredReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Image source={{ uri: review.avatar }} style={styles.reviewAvatar} />
                <View style={styles.reviewMetaWrap}>
                  <View style={styles.reviewMetaTop}>
                    <View style={styles.userLine}>
                      <Text style={styles.userName}>{review.user}</Text>
                      <View style={styles.userTag}>
                        <Text style={styles.userTagText}>{review.tag}</Text>
                      </View>
                    </View>
                    <View style={styles.scoreLine}>
                      <Stars count={review.score} />
                      <Text style={styles.daysAgo}>{review.daysAgo}일 전</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={styles.reviewText}>{review.text}</Text>

              <View style={styles.reviewBottom}>
                <Image source={{ uri: review.photo }} style={styles.reviewThumb} />
                <Text style={styles.helpful}>도움돼요 {review.helpful}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F8" },
  content: {
    paddingBottom: 32,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 520 : "100%",
    alignSelf: "center",
  },
  localHero: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  localEyebrow: {
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.primary,
    fontWeight: "800",
  },
  headerBlock: {
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
    marginTop: 14,
  },
  placeTitle: {
    marginTop: 4,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: Theme.colors.textPrimary,
  },
  localSubtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  localStatusBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  localStatusLive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
  },
  localStatusDemo: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  localStatusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  localStatusTextLive: {
    color: "#047857",
  },
  localStatusTextDemo: {
    color: "#B45309",
  },
  localGrid: {
    paddingHorizontal: 16,
    paddingTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  localCard: {
    width: "48%",
    minHeight: 128,
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    ...Theme.shadow.sm,
  },
  localCardLabel: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "800",
  },
  localCardValue: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 21,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
  },
  localCardMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textTertiary,
    fontWeight: "600",
  },
  sectionHeading: {
    fontSize: 24,
    lineHeight: 30,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
  },
  ratingLine: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingScore: {
    fontSize: 17,
    lineHeight: 22,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
  },
  ratingMeta: {
    marginLeft: 4,
    fontSize: 14,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  filterRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Theme.colors.surface,
  },
  filterChipActive: {
    backgroundColor: "#EE8F79",
    borderColor: "#EE8F79",
  },
  filterText: {
    color: Theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  reviewList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  reviewCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    ...Theme.shadow.sm,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
  },
  reviewMetaWrap: { flex: 1 },
  reviewMetaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    fontSize: 15,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
  },
  userTag: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  userTagText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "700",
  },
  scoreLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  starRow: {
    flexDirection: "row",
    gap: 1,
  },
  daysAgo: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  reviewText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: Theme.colors.textPrimary,
    fontWeight: "600",
  },
  reviewBottom: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewThumb: {
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  helpful: {
    fontSize: 14,
    lineHeight: 18,
    color: "#D0876F",
    fontWeight: "800",
  },
});
