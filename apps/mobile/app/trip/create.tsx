import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, Platform,
  Text, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../constants/Theme';

import StepDestination from '../../components/trip/StepDestination';
import StepDates from '../../components/trip/StepDates';
import StepAttractions from '../../components/trip/StepAttractions';
import StepRestaurants from '../../components/trip/StepRestaurants';
import { clearPersistedOptimizedRoute } from '../../services/routeApi';
import { plannerApi } from '../../services/api';

import type { CompanionType, TransportType, TripRouteMapPoint } from '../../types';
import type { AccommodationType } from '../../components/trip/StepAccommodation';

const TOTAL_STEPS = 4;
const STEP_LABELS = ['목적지', '날짜', '관광지', '맛집'] as const;
const STEP_ICONS = [
  'location-outline', 'calendar-outline', 'camera-outline', 'restaurant-outline',
] as const;
const DEFAULT_COMPANION: CompanionType = 'friends';
const DEFAULT_TRANSPORT: TransportType = 'car';
const DEFAULT_ACCOMMODATION: AccommodationType = 'hotel';

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

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDefaultDates(): Pick<StepState, 'startDate' | 'endDate'> {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 2);

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

const DEFAULTS = getDefaultDates();

const INITIAL: StepState = {
  destination: '제주도',
  startDate: DEFAULTS.startDate,
  endDate: DEFAULTS.endDate,
  companion: DEFAULT_COMPANION,
  transport: DEFAULT_TRANSPORT,
  accommodationType: DEFAULT_ACCOMMODATION,
  attractions: [], restaurants: [],
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

const FALLBACK_POINT_OFFSETS = [
  { latitude: 0, longitude: 0 },
  { latitude: 0.012, longitude: 0.014 },
  { latitude: -0.011, longitude: 0.016 },
  { latitude: -0.014, longitude: -0.009 },
  { latitude: 0.009, longitude: -0.015 }
];

function resolveDestinationCenter(destination: string): { latitude: number; longitude: number } {
  const normalized = destination.trim();
  const entry = Object.entries(DESTINATION_CENTERS).find(([name]) => normalized.includes(name));
  if (entry) {
    return entry[1];
  }

  return { latitude: 37.5665, longitude: 126.978 };
}

function buildFallbackRoutePoints(
  destination: string,
  selectedAttractions: string[],
  selectedRestaurants: string[]
): TripRouteMapPoint[] {
  const safeDestination = destination.trim() || "여행지";
  const center = resolveDestinationCenter(safeDestination);
  const attractionLabels = selectedAttractions.slice(0, 2).map((_, index) => `${safeDestination} 관광지 ${index + 1}`);
  const restaurantLabels = selectedRestaurants
    .slice(0, 2)
    .map((name, index) => (name.trim().length > 0 ? name.trim() : `${safeDestination} 맛집 ${index + 1}`));

  const pointNames = [`${safeDestination} 출발`, ...attractionLabels, ...restaurantLabels, `${safeDestination} 마무리`];
  const normalizedNames = pointNames.length >= 2 ? pointNames : [`${safeDestination} 출발`, `${safeDestination} 마무리`];

  return normalizedNames
    .slice(0, FALLBACK_POINT_OFFSETS.length)
    .map((name, index) => ({
      id: `fallback-${index + 1}`,
      name,
      latitude: center.latitude + FALLBACK_POINT_OFFSETS[index].latitude,
      longitude: center.longitude + FALLBACK_POINT_OFFSETS[index].longitude,
    }));
}

function parseDate(t: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function TripCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ destination?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<StepState>(() => ({
    ...INITIAL,
    destination: params.destination ?? INITIAL.destination,
  }));
  const [isSaving, setIsSaving] = useState(false);

  const update = <K extends keyof StepState>(key: K, val: StepState[K]) =>
    setDraft((p) => ({ ...p, [key]: val }));

  const handleChangeStartDate = (v: string) => {
    setDraft((p) => {
      const ns = parseDate(v);
      const ce = parseDate(p.endDate);
      if (ns && ce && ce.getTime() < ns.getTime()) return { ...p, startDate: v, endDate: '' };
      return { ...p, startDate: v };
    });
  };

  const handleChangeEndDate = (v: string) => {
    setDraft((p) => {
      const ne = parseDate(v);
      const cs = parseDate(p.startDate);
      if (ne && cs && ne.getTime() < cs.getTime()) return p;
      return { ...p, endDate: v };
    });
  };

  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const ensureRequiredDefaults = () => {
    setDraft((prev) => {
      const defaults = getDefaultDates();
      const startDate = parseDate(prev.startDate) ? prev.startDate : defaults.startDate;
      const endDate = parseDate(prev.endDate) ? prev.endDate : defaults.endDate;
      return {
        ...prev,
        destination: prev.destination.trim() || INITIAL.destination,
        startDate,
        endDate,
        companion: prev.companion ?? DEFAULT_COMPANION,
        transport: prev.transport ?? DEFAULT_TRANSPORT,
        accommodationType: prev.accommodationType ?? DEFAULT_ACCOMMODATION,
      };
    });
  };

  const validate = (): boolean => true;

  const handleBack = () => { if (step === 1) router.back(); else { setStep((s) => s - 1); scrollTop(); } };
  const handleNext = () => {
    ensureRequiredDefaults();
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    scrollTop();
  };

  const handleComplete = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const safeDestination = draft.destination.trim() || INITIAL.destination;
    const safeDates = getDefaultDates();
    const startDate = parseDate(draft.startDate) ? draft.startDate : safeDates.startDate;
    const endDate = parseDate(draft.endDate) ? draft.endDate : safeDates.endDate;
    const transport = draft.transport ?? DEFAULT_TRANSPORT;
    const companion = draft.companion ?? DEFAULT_COMPANION;
    try {
      const res = await plannerApi.generate({
        destination: safeDestination,
        startDate,
        endDate,
        transport,
        companions: companion,
        attractionKeywords: draft.attractions,
        restaurantKeywords: draft.restaurants,
      });
      const trip = res.data.trip;
      const routePoints: TripRouteMapPoint[] = [];
      for (const day of (trip.days ?? [])) {
        for (const place of (day.places ?? [])) {
          if (place.lat && place.lng) {
            routePoints.push({ id: place.id, name: place.name, latitude: place.lat, longitude: place.lng });
          }
        }
      }
      const savedRoutePoints =
        routePoints.length >= 2
          ? routePoints
          : buildFallbackRoutePoints(draft.destination, draft.attractions, draft.restaurants);
      await Promise.all([
        AsyncStorage.setItem('currentTrip', JSON.stringify({
          id: trip.id, title: trip.title, destination: trip.destination,
          startDate: trip.startDate ?? startDate,
          endDate: trip.endDate ?? endDate,
          routePoints: savedRoutePoints,
          attractions: draft.attractions,
          restaurants: draft.restaurants,
          transport,
          companions: companion,
          createdAt: trip.createdAt,
        })),
        clearPersistedOptimizedRoute(),
      ]);
      router.push('/trip/route-map');
    } catch {
      const fallbackRoutePoints = buildFallbackRoutePoints(
        safeDestination,
        draft.attractions,
        draft.restaurants
      );
      await Promise.all([
        AsyncStorage.setItem('currentTrip', JSON.stringify({
          id: `trip_${Date.now()}`, title: `${safeDestination} 여행`,
          destination: safeDestination,
          startDate, endDate,
          routePoints: fallbackRoutePoints,
          attractions: draft.attractions,
          restaurants: draft.restaurants,
          transport,
          companions: companion,
          createdAt: new Date().toISOString(),
        })),
        clearPersistedOptimizedRoute(),
      ]);
      router.push('/trip/route-map');
    } finally { setIsSaving(false); }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <StepDestination destination={draft.destination} onChangeDestination={(v) => update('destination', v)} />;
      case 2: return <StepDates startDate={draft.startDate} endDate={draft.endDate} onChangeStartDate={handleChangeStartDate} onChangeEndDate={handleChangeEndDate} />;
      case 3: return <StepAttractions destination={draft.destination || INITIAL.destination} selectedAttractions={draft.attractions} onChangeAttractions={(v) => update('attractions', v)} />;
      case 4:
        return (
          <StepRestaurants
            destination={draft.destination || INITIAL.destination}
            selectedRestaurants={draft.restaurants}
            onChangeRestaurants={(v) => update('restaurants', v)}
            showCompleteButton={false}
          />
        );
      default: return null;
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
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
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const current = i === step - 1;
            return (
              <View key={label} style={styles.stepIconItem}>
                <View style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  current && styles.stepDotCurrent,
                ]}>
                  <Ionicons
                    name={STEP_ICONS[i] as any}
                    size={12}
                    color={done || current ? '#FFF' : Theme.colors.textTertiary}
                  />
                </View>
                <Text style={[
                  styles.stepLabel,
                  done && styles.stepLabelDone,
                  current && styles.stepLabelCurrent,
                ]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      {step <= TOTAL_STEPS && (
        <View style={styles.bottomBar}>
          {step > 1 && (
            <TouchableOpacity
              style={[styles.btnOutline, step === TOTAL_STEPS && isSaving && styles.btnDisabled]}
              onPress={handleBack}
              disabled={step === TOTAL_STEPS && isSaving}
            >
              <Ionicons name="chevron-back" size={18} color={Theme.colors.primary} />
              <Text style={styles.btnOutlineText}>이전</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.btnPrimary,
              step === 1 && { flex: 1 },
              step === TOTAL_STEPS && isSaving && styles.btnDisabled
            ]}
            onPress={step === TOTAL_STEPS ? () => void handleComplete() : handleNext}
            disabled={step === TOTAL_STEPS && isSaving}
            activeOpacity={0.85}
          >
            {step === TOTAL_STEPS && isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.btnPrimaryText}>{step === TOTAL_STEPS ? '완료' : '다음'}</Text>
                <Ionicons
                  name={step === TOTAL_STEPS ? "checkmark" : "chevron-forward"}
                  size={18}
                  color="#FFF"
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    ...Theme.shadow.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Theme.colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...Theme.typography.h3, color: Theme.colors.textPrimary },
  headerSub: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 2 },
  headerRight: { width: 40, alignItems: 'flex-end' },
  stepCount: { ...Theme.typography.caption, color: Theme.colors.primary, fontWeight: '700' },
  progressContainer: {
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },
  progressBg: {
    height: 4, backgroundColor: Theme.colors.borderLight,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Theme.colors.primary,
    borderRadius: 2,
  },
  stepIcons: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: Theme.spacing.md,
  },
  stepIconItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Theme.colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotDone: { backgroundColor: Theme.colors.primary },
  stepDotCurrent: { backgroundColor: Theme.colors.primary, ...Theme.shadow.sm },
  stepLabel: { ...Theme.typography.caption, color: Theme.colors.textTertiary, fontSize: 9 },
  stepLabelDone: { color: Theme.colors.primary },
  stepLabelCurrent: { color: Theme.colors.primary, fontWeight: '700' },
  scrollContent: { flexGrow: 1, paddingBottom: Theme.spacing.xxl },
  bottomBar: {
    flexDirection: 'row', gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : Theme.spacing.xl,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1, borderTopColor: Theme.colors.borderLight,
    ...Theme.shadow.md,
  },
  btnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4,
    paddingVertical: 16, borderRadius: Theme.radius.lg,
    borderWidth: 2, borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  btnOutlineText: { ...Theme.typography.button, color: Theme.colors.primary },
  btnPrimary: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4,
    paddingVertical: 16, borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.primary,
    ...Theme.shadow.sm,
  },
  btnDisabled: {
    opacity: 0.65
  },
  btnPrimaryText: { ...Theme.typography.button, color: '#FFF' },
});
