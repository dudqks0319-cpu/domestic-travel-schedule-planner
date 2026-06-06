import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
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
  TRAVEL_STYLE_OPTIONS,
  type TravelStyleKey
} from "../../constants/travelStyles";

interface TravelRegion {
  id: string;
  name: string;
  province: string;
  tagline: string;
  styles: string[];
  days: string;
  left: `${number}%`;
  top: `${number}%`;
  color: string;
}

const REGIONS: TravelRegion[] = [
  {
    id: "seoul",
    name: "서울",
    province: "수도권",
    tagline: "전시, 맛집, 야경을 하루 단위로 묶기 좋아요.",
    styles: ["도심", "전시", "맛집"],
    days: "당일-2일",
    left: "48%",
    top: "20%",
    color: "#4A90E2"
  },
  {
    id: "gangneung",
    name: "강릉",
    province: "강원",
    tagline: "바다, 카페, 중앙시장 동선을 빠르게 잡을 수 있어요.",
    styles: ["바다", "카페", "맛집"],
    days: "1박2일",
    left: "70%",
    top: "25%",
    color: "#0D9488"
  },
  {
    id: "gyeongju",
    name: "경주",
    province: "경북",
    tagline: "역사 명소와 황리단길을 날짜별로 나누기 좋아요.",
    styles: ["역사", "산책", "카페"],
    days: "1박2일",
    left: "65%",
    top: "58%",
    color: "#B45309"
  },
  {
    id: "busan",
    name: "부산",
    province: "부산",
    tagline: "해변, 시장, 야경 코스를 권역별로 묶어 보세요.",
    styles: ["바다", "시장", "야경"],
    days: "2박3일",
    left: "72%",
    top: "68%",
    color: "#2563EB"
  },
  {
    id: "jeonju",
    name: "전주",
    province: "전북",
    tagline: "한옥마을과 로컬 맛집을 여유 있게 배치해요.",
    styles: ["한옥", "맛집", "산책"],
    days: "1박2일",
    left: "42%",
    top: "58%",
    color: "#7C3AED"
  },
  {
    id: "yeosu",
    name: "여수",
    province: "전남",
    tagline: "해상 케이블카, 밤바다, 시장 코스를 이어 보세요.",
    styles: ["바다", "야경", "해산물"],
    days: "1박2일",
    left: "49%",
    top: "72%",
    color: "#DB2777"
  },
  {
    id: "jeju",
    name: "제주",
    province: "제주",
    tagline: "동서남북 권역을 나눠 이동시간 낭비를 줄여요.",
    styles: ["자연", "카페", "드라이브"],
    days: "2박3일",
    left: "33%",
    top: "88%",
    color: "#16A34A"
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const [selectedRegionId, setSelectedRegionId] = useState(REGIONS[1].id);

  const selectedRegion = useMemo(
    () => REGIONS.find((region) => region.id === selectedRegionId) ?? REGIONS[0],
    [selectedRegionId]
  );

  const startTrip = (
    regionName = selectedRegion.name,
    styleKey: TravelStyleKey = DEFAULT_TRAVEL_STYLE_KEY
  ) => {
    router.push({
      pathname: "/trip/create",
      params: { destination: regionName, styleKey }
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.logo}>TripMate</Text>
            <Text style={styles.headerSubtitle}>국내여행 일정 지도</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.75}
            onPress={() => router.push("/(tabs)/search")}
            accessibilityRole="button"
            accessibilityLabel="검색"
          >
            <Ionicons name="search-outline" size={21} color={Theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.mapPanel}>
          <View style={styles.mapHeader}>
            <View>
              <Text style={styles.mapEyebrow}>전국지도</Text>
              <Text style={styles.mapTitle}>지역을 고르면 일정 초안을 만듭니다</Text>
            </View>
            <View style={styles.daysBadge}>
              <Ionicons name="calendar-outline" size={14} color={Theme.colors.primaryDark} />
              <Text style={styles.daysBadgeText}>{selectedRegion.days}</Text>
            </View>
          </View>

          <View style={styles.koreaMap}>
            <View style={styles.peninsulaShape} />
            <View style={styles.jejuShape} />
            {REGIONS.map((region) => {
              const selected = selectedRegion.id === region.id;
              return (
                <Pressable
                  key={region.id}
                  style={[
                    styles.regionPin,
                    { left: region.left, top: region.top, borderColor: region.color },
                    selected && { backgroundColor: region.color }
                  ]}
                  onPress={() => setSelectedRegionId(region.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${region.name} 선택`}
                >
                  <Text style={[styles.regionPinText, selected && styles.regionPinTextSelected]}>
                    {region.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.regionSummary}>
            <View style={[styles.regionColorBar, { backgroundColor: selectedRegion.color }]} />
            <View style={styles.regionSummaryBody}>
              <Text style={styles.regionProvince}>{selectedRegion.province}</Text>
              <Text style={styles.regionName}>{selectedRegion.name}</Text>
              <Text style={styles.regionTagline}>{selectedRegion.tagline}</Text>
              <View style={styles.styleRow}>
                {selectedRegion.styles.map((style) => (
                  <Text key={style} style={styles.stylePill}>{style}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.quickStartBand}>
          <View style={styles.quickStartText}>
            <Text style={styles.quickStartTitle}>3개만 입력하고 바로 시작</Text>
            <Text style={styles.quickStartSubtitle}>지역, 날짜, 여행 스타일</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => startTrip()}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>일정 만들기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>스타일별 빠른 시작</Text>
        </View>
        <View style={styles.chipGrid}>
          {TRAVEL_STYLE_OPTIONS.map((style) => (
            <TouchableOpacity
              key={style.styleKey}
              style={styles.largeChip}
              activeOpacity={0.8}
              onPress={() => startTrip(selectedRegion.name, style.styleKey)}
              accessibilityRole="button"
              accessibilityLabel={`${style.title} 일정 만들기`}
            >
              <Text style={styles.largeChipText}>{style.shortTitle}</Text>
              <Ionicons name="chevron-forward" size={16} color={Theme.colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
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
    maxWidth: Platform.OS === "web" ? 520 : "100%",
    alignSelf: "center"
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  logo: {
    fontSize: 30,
    lineHeight: 36,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  mapPanel: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    ...Theme.shadow.sm
  },
  mapHeader: {
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
    marginTop: 2,
    fontSize: 20,
    lineHeight: 26,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  daysBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  daysBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.primaryDark,
    fontWeight: "800"
  },
  koreaMap: {
    marginTop: 16,
    height: 330,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: "#EAF4FF",
    overflow: "hidden"
  },
  peninsulaShape: {
    position: "absolute",
    left: "28%",
    top: "8%",
    width: "43%",
    height: "72%",
    borderTopLeftRadius: 80,
    borderTopRightRadius: 52,
    borderBottomLeftRadius: 58,
    borderBottomRightRadius: 90,
    backgroundColor: "#DDEFD9",
    transform: [{ rotate: "9deg" }],
    borderWidth: 1,
    borderColor: "#B9DDB4"
  },
  jejuShape: {
    position: "absolute",
    left: "24%",
    bottom: "7%",
    width: "24%",
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DDEFD9",
    borderWidth: 1,
    borderColor: "#B9DDB4"
  },
  regionPin: {
    position: "absolute",
    minWidth: 48,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    ...Theme.shadow.sm
  },
  regionPinText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  regionPinTextSelected: {
    color: "#FFFFFF"
  },
  regionSummary: {
    marginTop: 14,
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    overflow: "hidden",
    backgroundColor: "#FAFBFC"
  },
  regionColorBar: {
    width: 5
  },
  regionSummaryBody: {
    flex: 1,
    padding: 13
  },
  regionProvince: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textTertiary,
    fontWeight: "800"
  },
  regionName: {
    marginTop: 1,
    fontSize: 23,
    lineHeight: 29,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  regionTagline: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  styleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10
  },
  stylePill: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  quickStartBand: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.colors.textPrimary,
    borderRadius: 8,
    padding: 14
  },
  quickStartText: {
    flex: 1
  },
  quickStartTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: "#FFFFFF",
    fontWeight: "800"
  },
  quickStartSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700"
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  primaryButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#FFFFFF",
    fontWeight: "800"
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  largeChip: {
    width: "48%",
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  largeChipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  }
});
