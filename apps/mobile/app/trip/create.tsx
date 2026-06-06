import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";

import StepDates from "../../components/trip/StepDates";
import StepDestination from "../../components/trip/StepDestination";
import { Theme } from "../../constants/Theme";
import { plannerApi } from "../../services/api";
import { clearPersistedOptimizedRoute } from "../../services/routeApi";
import type { CompanionType, TransportType, TripRouteMapPoint } from "../../types";

const TOTAL_STEPS = 3;
const STEP_LABELS = ["지역", "날짜", "스타일"] as const;
const STEP_ICONS = ["map-outline", "calendar-outline", "sparkles-outline"] as const;

interface TravelStyleOption {
  key: string;
  title: string;
  desc: string;
  keywordSuffix: string;
  transport: TransportType;
  companion: CompanionType;
  icon: keyof typeof Ionicons.glyphMap;
}

const STYLE_OPTIONS: TravelStyleOption[] = [
  {
    key: "sea_cafe_food",
    title: "바다+카페+맛집",
    desc: "해변, 로컬 카페, 식사 시간을 균형 있게 배치합니다.",
    keywordSuffix: "바다 카페 맛집",
    transport: "car",
    companion: "friends",
    icon: "cafe-outline"
  },
  {
    key: "history_walk",
    title: "역사 산책",
    desc: "문화유산과 걷기 좋은 거리를 무리 없이 묶습니다.",
    keywordSuffix: "역사 산책 문화",
    transport: "walk",
    companion: "solo",
    icon: "footsteps-outline"
  },
  {
    key: "family_easy",
    title: "아이와 함께",
    desc: "이동 거리를 줄이고 쉬는 시간을 넉넉히 둡니다.",
    keywordSuffix: "가족 아이 실내",
    transport: "car",
    companion: "family_kids",
    icon: "happy-outline"
  },
  {
    key: "rainy_backup",
    title: "비 오는 날",
    desc: "실내 관광지와 식사/카페 동선을 우선합니다.",
    keywordSuffix: "실내 전시 카페",
    transport: "transit",
    companion: "couple",
    icon: "rainy-outline"
  }
];

interface StepState {
  destination: string;
  startDate: string;
  endDate: string;
  styleKey: string;
}

const INITIAL: StepState = {
  destination: "",
  startDate: "",
  endDate: "",
  styleKey: STYLE_OPTIONS[0].key
};

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeMode(transport: TransportType): "driving" | "transit" | "walking" {
  if (transport === "transit") {
    return "transit";
  }
  if (transport === "walk") {
    return "walking";
  }
  return "driving";
}

function extractRoutePoints(trip: {
  days?: Array<{ places?: Array<Record<string, unknown>> }>;
}): TripRouteMapPoint[] {
  const routePoints: TripRouteMapPoint[] = [];

  for (const day of trip.days ?? []) {
    for (const place of day.places ?? []) {
      const lat = typeof place.lat === "number" ? place.lat : null;
      const lng = typeof place.lng === "number" ? place.lng : null;
      if (lat === null || lng === null) {
        continue;
      }
      routePoints.push({
        id: String(place.id ?? `${place.name ?? "place"}-${routePoints.length}`),
        name: String(place.name ?? `장소 ${routePoints.length + 1}`),
        latitude: lat,
        longitude: lng
      });
    }
  }

  return routePoints;
}

function StepTravelStyle({
  selectedStyleKey,
  onSelectStyle
}: {
  selectedStyleKey: string;
  onSelectStyle: (styleKey: string) => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={30} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>어떤 여행인가요?</Text>
        <Text style={styles.subtitle}>스타일에 맞춰 식사와 동선 밀도를 조정합니다</Text>
      </View>

      <View style={styles.styleList}>
        {STYLE_OPTIONS.map((option) => {
          const selected = selectedStyleKey === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.styleCard, selected && styles.styleCardSelected]}
              onPress={() => onSelectStyle(option.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${option.title} 선택`}
            >
              <View style={[styles.styleIconBox, selected && styles.styleIconBoxSelected]}>
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={selected ? Theme.colors.primary : Theme.colors.textSecondary}
                />
              </View>
              <View style={styles.styleBody}>
                <Text style={[styles.styleTitle, selected && styles.styleTitleSelected]}>
                  {option.title}
                </Text>
                <Text style={styles.styleDesc}>{option.desc}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TripCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ destination?: string; style?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const paramStyle = getParamValue(params.style);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<StepState>(() => {
    const matchedStyle = STYLE_OPTIONS.find((option) => option.title === paramStyle);
    return {
      ...INITIAL,
      destination: getParamValue(params.destination) ?? "",
      styleKey: matchedStyle?.key ?? INITIAL.styleKey
    };
  });
  const [isSaving, setIsSaving] = useState(false);

  const selectedStyle = useMemo(
    () => STYLE_OPTIONS.find((option) => option.key === draft.styleKey) ?? STYLE_OPTIONS[0],
    [draft.styleKey]
  );

  const update = <K extends keyof StepState>(key: K, value: StepState[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const handleChangeStartDate = (value: string) => {
    setDraft((previous) => {
      const nextStart = parseDate(value);
      const currentEnd = parseDate(previous.endDate);
      if (nextStart && currentEnd && currentEnd.getTime() < nextStart.getTime()) {
        return { ...previous, startDate: value, endDate: "" };
      }
      return { ...previous, startDate: value };
    });
  };

  const handleChangeEndDate = (value: string) => {
    setDraft((previous) => {
      const nextEnd = parseDate(value);
      const currentStart = parseDate(previous.startDate);
      if (nextEnd && currentStart && nextEnd.getTime() < currentStart.getTime()) {
        return previous;
      }
      return { ...previous, endDate: value };
    });
  };

  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const validate = (): boolean => {
    if (step === 1 && !draft.destination.trim()) {
      Alert.alert("", "여행 지역을 선택해주세요");
      return false;
    }

    if (step === 2) {
      const startDate = parseDate(draft.startDate);
      const endDate = parseDate(draft.endDate);
      if (!startDate || !endDate) {
        Alert.alert("", "출발일과 도착일을 선택해주세요");
        return false;
      }
      if (endDate.getTime() < startDate.getTime()) {
        Alert.alert("", "도착일은 출발일 이후여야 해요");
        return false;
      }
    }

    return true;
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((current) => current - 1);
    scrollTop();
  };

  const handleNext = () => {
    if (!validate()) {
      return;
    }
    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
    scrollTop();
  };

  const handleComplete = async () => {
    if (!validate() || isSaving) {
      return;
    }

    setIsSaving(true);
    const destination = draft.destination.trim();
    const keyword = `${destination} ${selectedStyle.keywordSuffix}`;

    try {
      const response = await plannerApi.generate({
        destination,
        startDate: draft.startDate,
        endDate: draft.endDate,
        transport: selectedStyle.transport,
        companions: selectedStyle.companion,
        keyword
      });
      const trip = response.data.trip;
      const routePoints = extractRoutePoints(trip);

      await Promise.all([
        AsyncStorage.setItem(
          "currentTrip",
          JSON.stringify({
            id: trip.id,
            title: trip.title,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            style: selectedStyle.title,
            transport: selectedStyle.transport,
            mode: normalizeMode(selectedStyle.transport),
            providerStatus: routePoints.length >= 2 ? "ready" : "empty",
            routePoints,
            createdAt: trip.createdAt
          })
        ),
        clearPersistedOptimizedRoute()
      ]);
      router.push("/trip/route-map");
    } catch {
      Alert.alert("", "추천 데이터를 불러오지 못했어요. 빈 일정 초안으로 저장합니다.");
      await AsyncStorage.setItem(
        "currentTrip",
        JSON.stringify({
          id: `trip_${Date.now()}`,
          title: `${destination} 여행`,
          destination,
          startDate: draft.startDate,
          endDate: draft.endDate,
          style: selectedStyle.title,
          transport: selectedStyle.transport,
          mode: normalizeMode(selectedStyle.transport),
          providerStatus: "unavailable",
          routePoints: [],
          createdAt: new Date().toISOString()
        })
      );
      await clearPersistedOptimizedRoute();
      router.push("/trip/route-map");
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <StepDestination
          destination={draft.destination}
          onChangeDestination={(value) => update("destination", value)}
        />
      );
    }

    if (step === 2) {
      return (
        <StepDates
          startDate={draft.startDate}
          endDate={draft.endDate}
          onChangeStartDate={handleChangeStartDate}
          onChangeEndDate={handleChangeEndDate}
        />
      );
    }

    return (
      <StepTravelStyle
        selectedStyleKey={draft.styleKey}
        onSelectStyle={(value) => update("styleKey", value)}
      />
    );
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={Theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>여행 만들기</Text>
          <Text style={styles.headerSub}>{STEP_LABELS[step - 1]}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.stepCount}>{step}/{TOTAL_STEPS}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.stepIcons}>
          {STEP_LABELS.map((label, index) => {
            const done = index < step;
            const current = index === step - 1;
            return (
              <View key={label} style={styles.stepIconItem}>
                <View
                  style={[
                    styles.stepDot,
                    done && styles.stepDotDone,
                    current && styles.stepDotCurrent
                  ]}
                >
                  <Ionicons
                    name={STEP_ICONS[index]}
                    size={12}
                    color={done || current ? "#FFFFFF" : Theme.colors.textTertiary}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    done && styles.stepLabelDone,
                    current && styles.stepLabelCurrent
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderStep()}
      </ScrollView>

      <View style={styles.bottomBar}>
        {step > 1 ? (
          <TouchableOpacity style={styles.btnOutline} onPress={handleBack} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={18} color={Theme.colors.primary} />
            <Text style={styles.btnOutlineText}>이전</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.btnPrimary, step === 1 && { flex: 1 }, isSaving && styles.btnDisabled]}
          onPress={step < TOTAL_STEPS ? handleNext : () => void handleComplete()}
          activeOpacity={0.85}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.btnPrimaryText}>
                {step < TOTAL_STEPS ? "다음" : "일정 초안 만들기"}
              </Text>
              <Ionicons
                name={step < TOTAL_STEPS ? "chevron-forward" : "sparkles"}
                size={18}
                color="#FFFFFF"
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    ...Theme.shadow.sm
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { ...Theme.typography.body1, fontWeight: "800", color: Theme.colors.textPrimary },
  headerSub: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 2 },
  headerRight: { width: 40, alignItems: "flex-end" },
  stepCount: { ...Theme.typography.caption, fontWeight: "800", color: Theme.colors.primary },
  progressContainer: {
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight
  },
  progressBg: {
    height: 4,
    backgroundColor: Theme.colors.borderLight,
    borderRadius: 2,
    overflow: "hidden"
  },
  progressFill: { height: "100%", backgroundColor: Theme.colors.primary, borderRadius: 2 },
  stepIcons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Theme.spacing.md
  },
  stepIconItem: { alignItems: "center", flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  stepDotDone: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  stepDotCurrent: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  stepLabel: {
    ...Theme.typography.caption,
    color: Theme.colors.textTertiary,
    marginTop: 4,
    fontWeight: "700"
  },
  stepLabelDone: { color: Theme.colors.primary },
  stepLabelCurrent: { color: Theme.colors.textPrimary },
  scrollContent: { flexGrow: 1 },
  stepContainer: { padding: Theme.spacing.xl },
  hero: { alignItems: "center", marginBottom: Theme.spacing.xxl },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Theme.spacing.md
  },
  title: { ...Theme.typography.h2, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 4, textAlign: "center" },
  styleList: { gap: Theme.spacing.md },
  styleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.lg,
    ...Theme.shadow.sm
  },
  styleCardSelected: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primaryLight },
  styleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Theme.spacing.md
  },
  styleIconBoxSelected: { backgroundColor: "#FFFFFF" },
  styleBody: { flex: 1 },
  styleTitle: { ...Theme.typography.body1, fontWeight: "800", color: Theme.colors.textPrimary },
  styleTitleSelected: { color: Theme.colors.primaryDark },
  styleDesc: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Theme.spacing.sm
  },
  radioSelected: { borderColor: Theme.colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Theme.colors.primary },
  bottomBar: {
    flexDirection: "row",
    gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight,
    padding: Theme.spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 34 : Theme.spacing.lg
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    minHeight: 52
  },
  btnOutlineText: { ...Theme.typography.button, color: Theme.colors.primary },
  btnPrimary: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    minHeight: 52
  },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { ...Theme.typography.button, color: "#FFFFFF" }
});
