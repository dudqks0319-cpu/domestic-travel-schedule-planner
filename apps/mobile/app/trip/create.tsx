import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, Platform,
  Text, TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../../constants/Theme';

import StepDestination from '../../components/trip/StepDestination';
import StepDates from '../../components/trip/StepDates';
import StepCompanion from '../../components/trip/StepCompanion';
import StepTransport from '../../components/trip/StepTransport';
import StepAccommodation from '../../components/trip/StepAccommodation';
import StepAttractions from '../../components/trip/StepAttractions';
import StepRestaurants from '../../components/trip/StepRestaurants';
import { clearPersistedOptimizedRoute } from '../../services/routeApi';
import { plannerApi } from '../../services/api';

import type { CompanionType, TransportType, TripRouteMapPoint } from '../../types';
import type { AccommodationType } from '../../components/trip/StepAccommodation';

const TOTAL_STEPS = 7;
const STEP_LABELS = ['목적지', '날짜', '동행자', '이동수단', '숙소', '관광지', '맛집'] as const;
const STEP_ICONS = [
  'location-outline', 'calendar-outline', 'people-outline',
  'car-outline', 'bed-outline', 'camera-outline', 'restaurant-outline',
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

const INITIAL: StepState = {
  destination: '', startDate: '', endDate: '',
  companion: null, transport: null, accommodationType: null,
  attractions: [], restaurants: [],
};

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
    destination: params.destination ?? '',
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

  const validate = (): boolean => {
    switch (step) {
      case 1: if (!draft.destination.trim()) { Alert.alert('', '여행지를 선택해주세요'); return false; } return true;
      case 2: {
        const s = parseDate(draft.startDate), e = parseDate(draft.endDate);
        if (!s || !e) { Alert.alert('', '출발일과 도착일을 선택해주세요'); return false; }
        if (e.getTime() < s.getTime()) { Alert.alert('', '도착일은 출발일 이후여야 해요'); return false; }
        return true;
      }
      case 3: if (!draft.companion) { Alert.alert('', '동행자를 선택해주세요'); return false; } return true;
      case 4: if (!draft.transport) { Alert.alert('', '이동수단을 선택해주세요'); return false; } return true;
      case 5: if (!draft.accommodationType) { Alert.alert('', '숙소 타입을 선택해주세요'); return false; } return true;
      case 6: if (draft.attractions.length === 0) { Alert.alert('', '관광지를 1개 이상 선택해주세요'); return false; } return true;
      default: return true;
    }
  };

  const handleBack = () => { if (step === 1) router.back(); else { setStep((s) => s - 1); scrollTop(); } };
  const handleNext = () => { if (!validate()) return; setStep((s) => Math.min(s + 1, TOTAL_STEPS)); scrollTop(); };

  const handleComplete = async () => {
    if (!draft.companion || !draft.transport || !draft.accommodationType) {
      Alert.alert('', '누락된 항목이 있어요'); return;
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
            routePoints.push({ id: place.id, name: place.name, latitude: place.lat, longitude: place.lng });
          }
        }
      }
      await Promise.all([
        AsyncStorage.setItem('currentTrip', JSON.stringify({
          id: trip.id, title: trip.title, destination: trip.destination,
          startDate: trip.startDate, endDate: trip.endDate,
          routePoints, createdAt: trip.createdAt,
        })),
        clearPersistedOptimizedRoute(),
      ]);
      router.push('/trip/route-map');
    } catch {
      Alert.alert('', '서버 연결 실패. 로컬에 저장합니다.');
      await AsyncStorage.setItem('currentTrip', JSON.stringify({
        id: `trip_${Date.now()}`, title: `${draft.destination} 여행`,
        destination: draft.destination.trim(),
        startDate: draft.startDate, endDate: draft.endDate,
        routePoints: [], createdAt: new Date().toISOString(),
      }));
      router.push('/trip/route-map');
    } finally { setIsSaving(false); }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <StepDestination destination={draft.destination} onChangeDestination={(v) => update('destination', v)} />;
      case 2: return <StepDates startDate={draft.startDate} endDate={draft.endDate} onChangeStartDate={handleChangeStartDate} onChangeEndDate={handleChangeEndDate} />;
      case 3: return <StepCompanion companion={draft.companion} onSelectCompanion={(v) => update('companion', v)} />;
      case 4: return <StepTransport transport={draft.transport} onSelectTransport={(v) => update('transport', v)} />;
      case 5: return <StepAccommodation destination={draft.destination} accommodationType={draft.accommodationType} onSelectAccommodation={(v) => update('accommodationType', v)} />;
      case 6: return <StepAttractions destination={draft.destination} selectedAttractions={draft.attractions} onChangeAttractions={(v) => update('attractions', v)} />;
      case 7: return <StepRestaurants destination={draft.destination} selectedRestaurants={draft.restaurants} onChangeRestaurants={(v) => update('restaurants', v)} onComplete={() => void handleComplete()} loading={isSaving} />;
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

      {step < TOTAL_STEPS && (
        <View style={styles.bottomBar}>
          {step > 1 && (
            <TouchableOpacity style={styles.btnOutline} onPress={handleBack}>
              <Ionicons name="chevron-back" size={18} color={Theme.colors.primary} />
              <Text style={styles.btnOutlineText}>이전</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btnPrimary, step === 1 && { flex: 1 }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>다음</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFF" />
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
  btnPrimaryText: { ...Theme.typography.button, color: '#FFF' },
});
