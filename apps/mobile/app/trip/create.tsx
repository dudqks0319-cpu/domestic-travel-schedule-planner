import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Header from "../../components/common/Header";
import ProgressBar from "../../components/common/ProgressBar";
import Button from "../../components/common/Button";
import StepDestination from "../../components/trip/StepDestination";
import StepDates from "../../components/trip/StepDates";
import StepCompanion from "../../components/trip/StepCompanion";
import StepTransport from "../../components/trip/StepTransport";
import StepAccommodation from "../../components/trip/StepAccommodation";
import StepAttractions from "../../components/trip/StepAttractions";
import StepRestaurants from "../../components/trip/StepRestaurants";
import { clearPersistedOptimizedRoute } from "../../services/routeApi";

import type {
  CompanionType,
  TargetGroup,
  TransportType,
  TripCreateDraft,
  TripRouteMapPoint
} from "../../types";
import type { AccommodationType } from "../../components/trip/StepAccommodation";

const TOTAL_STEPS = 7;
const STEP_LABELS = [
  "목적지",
  "날짜",
  "동행자",
  "이동수단",
  "숙소",
  "관광지",
  "맛집"
] as const;

interface StepState {
  destination: string;
  startDate: string;
  endDate: string;
  companion: CompanionType | null;
  transport: TransportType | null;
  accommodationType: AccommodationType | null;
  attractions: string[];
  restaurants: string[];
}

interface CurrentTrip extends TripCreateDraft {
  id: string;
  accommodationType: AccommodationType;
  attractions: string[];
  restaurants: string[];
  routePoints: TripRouteMapPoint[];
  createdAt: string;
}

const INITIAL_STATE: StepState = {
  destination: "",
  startDate: "",
  endDate: "",
  companion: null,
  transport: null,
  accommodationType: null,
  attractions: [],
  restaurants: []
};

const DESTINATION_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  제주: { latitude: 33.4996, longitude: 126.5312 },
  부산: { latitude: 35.1796, longitude: 129.0756 },
  서울: { latitude: 37.5665, longitude: 126.978 },
  강릉: { latitude: 37.7519, longitude: 128.8761 },
  여수: { latitude: 34.7604, longitude: 127.6622 },
  경주: { latitude: 35.8562, longitude: 129.2247 },
  전주: { latitude: 35.8242, longitude: 127.148 },
  인천: { latitude: 37.4563, longitude: 126.7052 },
  속초: { latitude: 38.207, longitude: 128.5918 },
  포항: { latitude: 36.019, longitude: 129.3435 }
};

const ATTRACTION_LABELS: Record<string, string> = {
  nature: "자연/풍경",
  museum: "박물관",
  theme_park: "테마파크",
  market: "시장/쇼핑",
  night_view: "야경 명소",
  walk_course: "산책 코스",
  kids_zone: "키즈 스팟",
  culture: "공연/문화"
};

const RESTAURANT_LABELS: Record<string, string> = {
  korean: "한식",
  seafood: "해산물",
  bbq: "고기집",
  noodle: "면요리",
  cafe: "카페",
  dessert: "디저트",
  night_food: "야식",
  local: "로컬 맛집"
};

const POINT_OFFSETS = [
  { latitude: 0, longitude: 0 },
  { latitude: 0.014, longitude: 0.012 },
  { latitude: -0.011, longitude: 0.017 },
  { latitude: -0.016, longitude: -0.01 },
  { latitude: 0.013, longitude: -0.016 },
  { latitude: 0.006, longitude: 0.022 }
];

function parseDate(dateText: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getTargetGroup(companion: CompanionType): TargetGroup {
  if (companion === "family_kids" || companion === "family_no_kids") return "family";
  if (companion === "parents") return "senior";
  return "young";
}

function resolveDestinationCenter(destination: string): { latitude: number; longitude: number } {
  const normalized = destination.trim();
  const entry = Object.entries(DESTINATION_CENTERS).find(([name]) => normalized.includes(name));
  if (entry) {
    return entry[1];
  }

  return { latitude: 37.5665, longitude: 126.978 };
}

function buildRoutePoints(
  destination: string,
  attractions: string[],
  restaurants: string[]
): TripRouteMapPoint[] {
  const center = resolveDestinationCenter(destination);
  const safeDestination = destination.trim() || "여행지";

  const attractionNames = attractions
    .slice(0, 3)
    .map((key, index) => `${safeDestination} ${ATTRACTION_LABELS[key] ?? `추천 명소 ${index + 1}`}`);
  const restaurantNames = restaurants
    .slice(0, 2)
    .map((key, index) => `${safeDestination} ${RESTAURANT_LABELS[key] ?? `추천 맛집 ${index + 1}`}`);

  const maxIntermediateCount = Math.max(0, POINT_OFFSETS.length - 2);
  const intermediateNames = [...attractionNames, ...restaurantNames].slice(0, maxIntermediateCount);

  const names = [`${safeDestination} 출발`, ...intermediateNames, `${safeDestination} 마무리`];

  if (intermediateNames.length === 0 && POINT_OFFSETS.length >= 3) {
    names.splice(1, 0, `${safeDestination} 추천 스팟`);
  }

  return names.slice(0, POINT_OFFSETS.length).map((name, index) => ({
    id: `point_${index + 1}`,
    name,
    latitude: center.latitude + POINT_OFFSETS[index].latitude,
    longitude: center.longitude + POINT_OFFSETS[index].longitude
  }));
}

export default function TripCreateScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<StepState>(() => ({ ...INITIAL_STATE }));
  const [isSaving, setIsSaving] = useState(false);

  const updateDraft = <K extends keyof StepState>(key: K, value: StepState[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleChangeStartDate = (value: string) => {
    setDraft((prev) => {
      const nextStart = parseDate(value);
      const currentEnd = parseDate(prev.endDate);

      if (nextStart && currentEnd && currentEnd.getTime() < nextStart.getTime()) {
        return { ...prev, startDate: value, endDate: "" };
      }

      return { ...prev, startDate: value };
    });
  };

  const handleChangeEndDate = (value: string) => {
    setDraft((prev) => {
      const nextEnd = parseDate(value);
      const currentStart = parseDate(prev.startDate);

      if (nextEnd && currentStart && nextEnd.getTime() < currentStart.getTime()) {
        return prev;
      }

      return { ...prev, endDate: value };
    });
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (!draft.destination.trim()) {
          Alert.alert("목적지 입력", "여행지를 입력하거나 추천 여행지를 선택해주세요.");
          return false;
        }
        return true;

      case 2: {
        const start = parseDate(draft.startDate);
        const end = parseDate(draft.endDate);
        if (!start || !end) {
          Alert.alert("날짜 선택", "출발일과 도착일을 모두 선택해주세요.");
          return false;
        }
        if (end.getTime() < start.getTime()) {
          Alert.alert("날짜 확인", "도착일은 출발일 이후로 선택해주세요.");
          return false;
        }
        return true;
      }

      case 3:
        if (!draft.companion) {
          Alert.alert("동행자 선택", "누구와 여행하는지 선택해주세요.");
          return false;
        }
        return true;

      case 4:
        if (!draft.transport) {
          Alert.alert("이동수단 선택", "주 이동수단을 선택해주세요.");
          return false;
        }
        return true;

      case 5:
        if (!draft.accommodationType) {
          Alert.alert("숙소 선택", "선호 숙소 타입을 선택해주세요.");
          return false;
        }
        return true;

      case 6:
        if (draft.attractions.length === 0) {
          Alert.alert("관광지 선택", "최소 1개 이상 선택해주세요.");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }

    setStep((prev) => prev - 1);
    scrollToTop();
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    scrollToTop();
  };

  const handleComplete = async () => {
    if (!draft.companion || !draft.transport || !draft.accommodationType) {
      Alert.alert("입력 확인", "누락된 항목이 있어요. 이전 단계를 확인해주세요.");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    const currentTrip: CurrentTrip = {
      id: `trip_${Date.now()}`,
      title: `${draft.destination} 여행`,
      destination: draft.destination.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate,
      companion: draft.companion,
      transport: draft.transport,
      targetGroup: getTargetGroup(draft.companion),
      budgetRange: "50_100",
      accommodationType: draft.accommodationType,
      attractions: draft.attractions,
      restaurants: draft.restaurants,
      routePoints: buildRoutePoints(draft.destination.trim(), draft.attractions, draft.restaurants),
      createdAt: new Date().toISOString()
    };

    try {
      await Promise.all([
        AsyncStorage.setItem("currentTrip", JSON.stringify(currentTrip)),
        clearPersistedOptimizedRoute()
      ]);
      router.push("/trip/route-map");
    } catch {
      Alert.alert("저장 실패", "여행 정보를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <StepDestination
            destination={draft.destination}
            onChangeDestination={(value) => updateDraft("destination", value)}
          />
        );

      case 2:
        return (
          <StepDates
            startDate={draft.startDate}
            endDate={draft.endDate}
            onChangeStartDate={handleChangeStartDate}
            onChangeEndDate={handleChangeEndDate}
          />
        );

      case 3:
        return (
          <StepCompanion
            companion={draft.companion}
            onSelectCompanion={(value) => updateDraft("companion", value)}
          />
        );

      case 4:
        return (
          <StepTransport
            transport={draft.transport}
            onSelectTransport={(value) => updateDraft("transport", value)}
          />
        );

      case 5:
        return (
          <StepAccommodation
            accommodationType={draft.accommodationType}
            onSelectAccommodation={(value) => updateDraft("accommodationType", value)}
          />
        );

      case 6:
        return (
          <StepAttractions
            selectedAttractions={draft.attractions}
            onChangeAttractions={(values) => updateDraft("attractions", values)}
          />
        );

      case 7:
        return (
          <StepRestaurants
            selectedRestaurants={draft.restaurants}
            onChangeRestaurants={(values) => updateDraft("restaurants", values)}
            onComplete={() => void handleComplete()}
            loading={isSaving}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Header title="여행 만들기" subtitle={`Step ${step} · ${STEP_LABELS[step - 1]}`} onBack={handleBack} />

      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderStep()}
      </ScrollView>

      {step < TOTAL_STEPS ? (
        <View style={styles.bottomButtons}>
          {step > 1 ? (
            <Button
              title="← 이전"
              onPress={handleBack}
              variant="outline"
              size="large"
              style={styles.backButton}
            />
          ) : null}

          <Button
            title="다음 →"
            onPress={handleNext}
            size="large"
            style={[styles.nextButton, step === 1 && styles.nextButtonFull]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.common.white
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl
  },
  bottomButtons: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: Colors.common.gray100,
    backgroundColor: Colors.common.white
  },
  backButton: {
    flex: 1,
    marginRight: Spacing.sm
  },
  nextButton: {
    flex: 1
  },
  nextButtonFull: {
    flex: undefined,
    width: "100%"
  }
});
