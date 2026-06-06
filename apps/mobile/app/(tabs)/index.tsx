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
import { DEFAULT_TRAVEL_REGION_ID, TRAVEL_REGIONS } from "../../constants/travelRegions";
import {
  DEFAULT_TRAVEL_STYLE_KEY,
  TRAVEL_STYLE_OPTIONS,
  type TravelStyleKey
} from "../../constants/travelStyles";
import {
  getConfiguredMapDisplayProvider,
  getMapProviderNotice
} from "../../services/mapDisplayProvider";

export default function HomeScreen() {
  const router = useRouter();
  const mapProvider = useMemo(() => getConfiguredMapDisplayProvider(), []);
  const [selectedRegionId, setSelectedRegionId] = useState(DEFAULT_TRAVEL_REGION_ID);

  const selectedRegion = useMemo(
    () => TRAVEL_REGIONS.find((region) => region.id === selectedRegionId) ?? TRAVEL_REGIONS[0],
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
            <View style={styles.headerBadges}>
              <View style={styles.providerBadge}>
                <Ionicons name="map-outline" size={14} color={Theme.colors.primaryDark} />
                <Text style={styles.daysBadgeText}>{mapProvider.label}</Text>
              </View>
              <View style={styles.daysBadge}>
                <Ionicons name="calendar-outline" size={14} color={Theme.colors.primaryDark} />
                <Text style={styles.daysBadgeText}>{selectedRegion.days}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.providerNotice}>{getMapProviderNotice(mapProvider)}</Text>

          <View style={styles.koreaMap}>
            <View style={styles.peninsulaShape} />
            <View style={styles.jejuShape} />
            {TRAVEL_REGIONS.map((region) => {
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
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  headerBadges: {
    alignItems: "flex-end",
    gap: 6
  },
  daysBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.primaryDark,
    fontWeight: "800"
  },
  providerNotice: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: Theme.colors.textTertiary,
    fontWeight: "600"
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
