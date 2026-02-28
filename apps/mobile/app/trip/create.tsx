import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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
import { plannerApi } from "../../services/api";

import type { CompanionType, TargetGroup, TransportType, TripRouteMapPoint } from "../../types";
import type { AccommodationType } from "../../components/trip/StepAccommodation";

const TOTAL_STEPS = 7;
const STEP_LABELS = ["목적지", "날짜", "동행자", "이동수단", "숙소", "관광지", "맛집"] as const;

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

const INITIAL_STATE: StepState = {
  destination: "", startDate: "", endDate: "",
  companion: null, transport: null, accommodationType: null,
  attractions: [], restaurants: [],
};

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

export default function TripCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ destination?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<StepState>(() => ({
    ...INITIAL_STATE,
    destination: params.destination ?? "",
  }));
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
      if (nextEnd && currentStart && nextEnd.getTime() < currentStart.getTime()) return prev;
      return { ...prev, endDate: value };
    });
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (!draft.destination.trim()) { Alert.alert("목적지 입력", "여행지를 입력하거나 추천 여행지를 선택해주세요."); return false; }
        return true;
      case 2: {
        const s = parseDate(draft.startDate); const e = parseDate(draft.endDate);
        if (!s || !e) { Alert.alert("날짜 선택", "출발일과 도착일을 모두 선택해주세요."); return false; }
        if (e.getTime() < s.getTime()) { Alert.alert("날짜 확인", "도착일은 출발일 이후로 선택해주세요."); return false; }
        return true;
      }
      case 3:
        if (!draft.companion) { Alert.alert("동행자 선택", "누구와 여행하는지 선택해주세요."); return false; }
        return true;
      case 4:
        if (!draft.transport) { Alert.alert("이동수단 선택", "주 이동수단을 선택해주세요."); return false; }
        return true;
      case 5:
        if (!draft.accommodationType) { Alert.alert("숙소 선택", "선호 숙소 타입을 선택해주세요."); return false; }
        return true;
      case 6:
        if (draft.attractions.length === 0) { Alert.alert("관광지 선택", "최소 1개 이상 선택해주세요."); return false; }
        return true;
      default: return true;
    }
  };

  const handleBack = () => {
    if (step === 1) { router.back(); return; }
    setStep((prev) => prev - 1); scrollToTop();
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS)); scrollToTop();
  };

  const handleComplete = async () => {
    if (!draft.companion || !draft.transport || !draft.accommodationType) {
      Alert.alert("입력 확인", "누락된 항목이 있어요."); return;
    }
    if (isSaving) return;
    setIsSaving(true);

    try {
      const res = await plannerApi.generate({
        destination: draft.destination.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        transport: draft.transport,
        companions: draft.companion,
      });

      const trip = res.data.trip;

      const routePoints: TripRouteMapPoint[] = [];
      for (const day of (trip.days ?? [])) {
        for (const place of (day.places ?? [])) {
          if (place.lat && place.lng) {
            routePoints.push({
              id: place.id, name: place.name,
              latitude: place.lat, longitude: place.lng,
            });
          }
        }
      }

      await Promise.all([
        AsyncStorage.setItem("currentTrip", JSON.stringify({
          id: trip.id, title: trip.title, destination: trip.destination,
          startDate: trip.startDate, endDate: trip.endDate,
          routePoints, createdAt: trip.createdAt,
        })),
        clearPersistedOptimizedRoute(),
      ]);

      router.push("/trip/route-map");
    } catch {
      Alert.alert("알림", "서버 연결 실패. 로컬에 저장합니다.");
      const fallback = {
        id: `trip_${Date.now()}`,
        title: `${draft.destination} 여행`,
        destination: draft.destination.trim(),
        startDate: draft.startDate, endDate: draft.endDate,
        routePoints: [], createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("currentTrip", JSON.stringify(fallback));
      router.push("/trip/route-map");
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <StepDestination destination={draft.destination} onChangeDestination={(v) => updateDraft("destination", v)} />;
      case 2:
        return <StepDates startDate={draft.startDate} endDate={draft.endDate} onChangeStartDate={handleChangeStartDate} onChangeEndDate={handleChangeEndDate} />;
      case 3:
        return <StepCompanion companion={draft.companion} onSelectCompanion={(v) => updateDraft("companion", v)} />;
      case 4:
        return <StepTransport transport={draft.transport} onSelectTransport={(v) => updateDraft("transport", v)} />;
      case 5:
        return <StepAccommodation destination={draft.destination} accommodationType={draft.accommodationType} onSelectAccommodation={(v) => updateDraft("accommodationType", v)} />;
      case 6:
        return <StepAttractions destination={draft.destination} selectedAttractions={draft.attractions} onChangeAttractions={(v) => updateDraft("attractions", v)} />;
      case 7:
        return <StepRestaurants destination={draft.destination} selectedRestaurants={draft.restaurants} onChangeRestaurants={(v) => updateDraft("restaurants", v)} onComplete={() => void handleComplete()} loading={isSaving} />;
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <Header title="여행 만들기" subtitle={`Step ${step} · ${STEP_LABELS[step - 1]}`} onBack={handleBack} />
      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} labels={[...STEP_LABELS]} />

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {renderStep()}
      </ScrollView>

      {step < TOTAL_STEPS ? (
        <View style={styles.bottomButtons}>
          {step > 1 ? (
            <Button title="이전" onPress={handleBack} variant="outline" size="large" style={styles.backButton} />
          ) : null}
          <Button title="다음" onPress={handleNext} size="large" style={[styles.nextButton, step === 1 && styles.nextButtonFull]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.common.white },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.xl },
  bottomButtons: {
    flexDirection: "row", paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md, paddingBottom: Spacing.xxl,
    borderTopWidth: 1, borderTopColor: Colors.common.gray100, backgroundColor: Colors.common.white,
  },
  backButton: { flex: 1, marginRight: Spacing.sm },
  nextButton: { flex: 1 },
  nextButtonFull: { flex: undefined, width: "100%" },
});
