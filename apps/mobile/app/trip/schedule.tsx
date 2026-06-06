import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Button from "../../components/common/Button";
import Header from "../../components/common/Header";
import AdPlacement from "../../components/monetization/AdPlacement";
import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Theme from "../../constants/Theme";
import Typography from "../../constants/Typography";
import {
  DEFAULT_FREE_ENTITLEMENT,
  loadEntitlementState,
  type PremiumEntitlementState
} from "../../services/monetization";
import {
  clearPersistedOptimizedRoute,
  loadPersistedOptimizedRoute,
  type OptimizedRoute,
  type RoutePoint
} from "../../services/routeApi";

interface TripMeta {
  destination: string;
  startDate: string;
  endDate: string;
}

interface DayTab {
  key: string;
  dayNumber: number;
  dateText: string;
  segmentStart: number;
  segmentEndExclusive: number;
}

interface EditableTripPoint extends RoutePoint {
  dayNumber: number;
}

type DayRow = {
  id: string;
  type: "stop" | "move";
  timeText: string;
  title: string;
  detail: string;
};

const CURRENT_TRIP_STORAGE_KEY = "currentTrip";
const STOP_DWELL_MINUTES = 60;

const DESTINATION_CENTERS: Record<string, { lat: number; lng: number }> = {
  제주: { lat: 33.4996, lng: 126.5312 },
  부산: { lat: 35.1796, lng: 129.0756 },
  서울: { lat: 37.5665, lng: 126.978 },
  강릉: { lat: 37.7519, lng: 128.8761 },
  여수: { lat: 34.7604, lng: 127.6622 },
  경주: { lat: 35.8562, lng: 129.2247 },
  전주: { lat: 35.8242, lng: 127.148 },
  인천: { lat: 37.4563, lng: 126.7052 },
  속초: { lat: 38.207, lng: 128.5918 },
  포항: { lat: 36.019, lng: 129.3435 }
};

const FALLBACK_POINT_OFFSETS = [
  { lat: 0, lng: 0 },
  { lat: 0.012, lng: 0.014 },
  { lat: -0.011, lng: -0.009 }
];

const CURRENT_NODE_ENV =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.NODE_ENV;
const ALLOW_DEVELOPMENT_PREVIEW_POINTS =
  CURRENT_NODE_ENV === "development" || CURRENT_NODE_ENV === "test";

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toRoutePoint(raw: unknown, index: number): RoutePoint | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const lat = toFiniteNumber(value.lat ?? value.latitude);
  const lng = toFiniteNumber(value.lng ?? value.longitude ?? value.lon);

  if (lat === null || lng === null) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : `trip-point-${index + 1}`;
  const name = typeof value.name === "string" ? value.name : `지점 ${index + 1}`;

  return { id, name, lat, lng };
}

function toEditableTripPoint(raw: unknown, index: number): EditableTripPoint | null {
  const point = toRoutePoint(raw, index);
  if (!point || !raw || typeof raw !== "object") {
    return point ? { ...point, dayNumber: 1 } : null;
  }

  const rawDayNumber = toFiniteNumber((raw as Record<string, unknown>).dayNumber);
  const dayNumber = rawDayNumber && rawDayNumber >= 1 ? Math.floor(rawDayNumber) : 1;
  return { ...point, dayNumber };
}

function editableToRoutePoint(point: EditableTripPoint): RoutePoint {
  return {
    id: point.id,
    name: point.name,
    lat: point.lat,
    lng: point.lng
  };
}

function serializeEditableTripPoint(point: EditableTripPoint): Record<string, unknown> {
  return {
    id: point.id,
    name: point.name,
    latitude: point.lat,
    longitude: point.lng,
    dayNumber: point.dayNumber
  };
}

function resolveDestinationCenter(destination: string): { lat: number; lng: number } {
  const normalized = destination.trim();
  const entry = Object.entries(DESTINATION_CENTERS).find(([name]) => normalized.includes(name));
  if (entry) {
    return entry[1];
  }

  return { lat: 37.5665, lng: 126.978 };
}

function buildFallbackTripPoints(destination: string): RoutePoint[] {
  if (!ALLOW_DEVELOPMENT_PREVIEW_POINTS) {
    return [];
  }

  const safeDestination = destination.trim();
  if (!safeDestination) {
    return [];
  }

  const center = resolveDestinationCenter(safeDestination);
  const names = [`${safeDestination} 출발`, `${safeDestination} 추천 스팟`, `${safeDestination} 마무리`];

  return names.map((name, index) => ({
    id: `trip-fallback-${index + 1}`,
    name,
    lat: center.lat + FALLBACK_POINT_OFFSETS[index].lat,
    lng: center.lng + FALLBACK_POINT_OFFSETS[index].lng
  }));
}

function parseCurrentTripPoints(rawTrip: unknown): RoutePoint[] {
  if (!rawTrip || typeof rawTrip !== "object") {
    return [];
  }

  const value = rawTrip as Record<string, unknown>;
  const routePoints = value.routePoints;
  const destination = typeof value.destination === "string" ? value.destination : "";

  if (!Array.isArray(routePoints)) {
    return buildFallbackTripPoints(destination);
  }

  const parsed = routePoints
    .map((item, index) => toRoutePoint(item, index))
    .filter((item): item is RoutePoint => item !== null);

  if (parsed.length >= 2) {
    return parsed;
  }

  return buildFallbackTripPoints(destination);
}

function parseEditableTripPoints(rawTrip: unknown): EditableTripPoint[] {
  if (!rawTrip || typeof rawTrip !== "object") {
    return [];
  }

  const value = rawTrip as Record<string, unknown>;
  const routePoints = value.routePoints;

  if (!Array.isArray(routePoints)) {
    return [];
  }

  return routePoints
    .map((item, index) => toEditableTripPoint(item, index))
    .filter((item): item is EditableTripPoint => item !== null);
}

function parseTripMeta(rawTrip: unknown): TripMeta {
  if (!rawTrip || typeof rawTrip !== "object") {
    return { destination: "여행", startDate: "", endDate: "" };
  }

  const value = rawTrip as Record<string, unknown>;
  return {
    destination: typeof value.destination === "string" && value.destination.trim().length > 0 ? value.destination : "여행",
    startDate: typeof value.startDate === "string" ? value.startDate : "",
    endDate: typeof value.endDate === "string" ? value.endDate : ""
  };
}

function parseDateOnly(dateText: string): Date | null {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return null;
  }

  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end) {
    return 1;
  }

  const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays < 1) return 1;
  return Math.min(diffDays, 15);
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(from: RoutePoint, to: RoutePoint): number {
  const radiusKm = 6371;
  const latDiff = toRad(to.lat - from.lat);
  const lngDiff = toRad(to.lng - from.lng);
  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(lngDiff / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusKm * c;
}

function isRouteAlignedWithTrip(route: OptimizedRoute, tripPoints: RoutePoint[]): boolean {
  if (tripPoints.length < 2 || route.orderedPoints.length < 2) {
    return false;
  }

  const routeStart = route.orderedPoints[0];
  const routeEnd = route.orderedPoints[route.orderedPoints.length - 1];
  const tripStart = tripPoints[0];
  const tripEnd = tripPoints[tripPoints.length - 1];

  if (!routeStart || !routeEnd || !tripStart || !tripEnd) {
    return false;
  }

  const startDistanceKm = distanceKm(routeStart, tripStart);
  const endDistanceKm = distanceKm(routeEnd, tripEnd);
  return startDistanceKm <= 15 && endDistanceKm <= 15;
}

function buildFallbackRoute(points: RoutePoint[]): OptimizedRoute | null {
  if (points.length < 2) {
    return null;
  }

  const averageSpeedKmPerHour = 30;
  const segments = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1];
    const segmentDistanceKm = distanceKm(from, to);
    const durationMin = Math.max(1, Math.round((segmentDistanceKm / averageSpeedKmPerHour) * 60));

    return {
      from,
      to,
      distanceKm: segmentDistanceKm,
      durationMin,
      provider: "fallback" as const
    };
  });

  return {
    orderedPoints: points,
    segments,
    totalDistanceKm: segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    totalDurationMin: segments.reduce((sum, segment) => sum + segment.durationMin, 0),
    source: "fallback",
    warnings: ["최적 경로가 없어 현재 여행의 저장된 경유지 순서로 임시 타임라인을 표시합니다."]
  };
}

function formatClock(totalMinutes: number): string {
  const normalized = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(durationMin: number): string {
  if (durationMin >= 60) {
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return `${hours}시간 ${mins}분`;
  }

  return `${Math.round(durationMin)}분`;
}

function formatDateLabel(date: Date | null): string {
  if (!date) {
    return "날짜 미정";
  }

  const weekLabel = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()] ?? "";
  return `${date.getMonth() + 1}.${date.getDate()} (${weekLabel})`;
}

function buildDayTabs(route: OptimizedRoute, tripMeta: TripMeta): DayTab[] {
  const segmentCount = route.segments.length;
  const daysFromTrip = daysBetweenInclusive(tripMeta.startDate, tripMeta.endDate);
  const daysCount = Math.max(1, daysFromTrip);
  const segmentChunk = Math.max(1, Math.ceil(segmentCount / daysCount));
  const startDate = parseDateOnly(tripMeta.startDate);

  return Array.from({ length: daysCount }).map((_, index) => {
    const segmentStart = Math.min(segmentCount, index * segmentChunk);
    const segmentEndExclusive = Math.min(segmentCount, (index + 1) * segmentChunk);

    const currentDate = startDate ? new Date(startDate) : null;
    if (currentDate) {
      currentDate.setDate(currentDate.getDate() + index);
    }

    return {
      key: `day-${index + 1}`,
      dayNumber: index + 1,
      dateText: formatDateLabel(currentDate),
      segmentStart,
      segmentEndExclusive
    };
  });
}

function buildTripOnlyDayTabs(tripMeta: TripMeta): DayTab[] {
  const daysCount = daysBetweenInclusive(tripMeta.startDate, tripMeta.endDate);
  const startDate = parseDateOnly(tripMeta.startDate);

  return Array.from({ length: daysCount }).map((_, index) => {
    const currentDate = startDate ? new Date(startDate) : null;
    if (currentDate) {
      currentDate.setDate(currentDate.getDate() + index);
    }

    return {
      key: `day-${index + 1}`,
      dayNumber: index + 1,
      dateText: formatDateLabel(currentDate),
      segmentStart: 0,
      segmentEndExclusive: 0
    };
  });
}

function buildDayRows(route: OptimizedRoute, dayTab: DayTab): DayRow[] {
  const rows: DayRow[] = [];
  const hasSegment = dayTab.segmentStart < dayTab.segmentEndExclusive;

  if (!hasSegment) {
    const firstPoint = route.orderedPoints[dayTab.segmentStart];
    if (firstPoint) {
      rows.push({
        id: `${dayTab.key}-stop-alone`,
        type: "stop",
        timeText: "09:00",
        title: firstPoint.name ?? "방문 지점",
        detail: "저장된 장소"
      });
    }
    return rows;
  }

  const firstSegment = route.segments[dayTab.segmentStart];
  let cursor = 9 * 60;

  rows.push({
    id: `${dayTab.key}-stop-start`,
    type: "stop",
    timeText: formatClock(cursor),
    title: firstSegment.from.name ?? "출발 지점",
    detail: "저장된 장소"
  });

  for (let index = dayTab.segmentStart; index < dayTab.segmentEndExclusive; index += 1) {
    const segment = route.segments[index];
    const moveStart = cursor;
    const moveDuration = Math.max(1, Math.round(segment.durationMin));
    const moveEnd = moveStart + moveDuration;

    rows.push({
      id: `${dayTab.key}-move-${index}`,
      type: "move",
      timeText: `${formatClock(moveStart)} - ${formatClock(moveEnd)}`,
      title: `${segment.from.name} → ${segment.to.name}`,
      detail: `${segment.distanceKm.toFixed(1)}km · ${formatDuration(segment.durationMin)} · ${segment.provider}`
    });

    cursor = moveEnd;

    rows.push({
      id: `${dayTab.key}-stop-${index}`,
      type: "stop",
      timeText: formatClock(cursor),
      title: segment.to.name ?? "도착 지점",
      detail: "저장된 장소"
    });

    if (index < dayTab.segmentEndExclusive - 1) {
      cursor += STOP_DWELL_MINUTES;
    }
  }

  return rows;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [currentTripPoints, setCurrentTripPoints] = useState<RoutePoint[]>([]);
  const [editableTripPoints, setEditableTripPoints] = useState<EditableTripPoint[]>([]);
  const [currentTripDraft, setCurrentTripDraft] = useState<Record<string, unknown> | null>(null);
  const [tripMeta, setTripMeta] = useState<TripMeta>({ destination: "여행", startDate: "", endDate: "" });
  const [loading, setLoading] = useState(true);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [entitlement, setEntitlement] = useState<PremiumEntitlementState>(DEFAULT_FREE_ENTITLEMENT);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [savedRoute, rawCurrentTrip] = await Promise.all([
          loadPersistedOptimizedRoute(),
          AsyncStorage.getItem(CURRENT_TRIP_STORAGE_KEY)
        ]);

        if (!mounted) {
          return;
        }

        let parsedPoints: RoutePoint[] = [];
        if (rawCurrentTrip) {
          const parsedCurrentTrip = JSON.parse(rawCurrentTrip) as unknown;
          const parsedDraft =
            parsedCurrentTrip && typeof parsedCurrentTrip === "object"
              ? (parsedCurrentTrip as Record<string, unknown>)
              : null;
          parsedPoints = parseCurrentTripPoints(parsedCurrentTrip);
          setCurrentTripDraft(parsedDraft);
          setCurrentTripPoints(parsedPoints);
          setEditableTripPoints(parseEditableTripPoints(parsedCurrentTrip));
          setTripMeta(parseTripMeta(parsedCurrentTrip));
        } else {
          setCurrentTripDraft(null);
          setCurrentTripPoints([]);
          setEditableTripPoints([]);
          setTripMeta({ destination: "여행", startDate: "", endDate: "" });
        }

        const alignedSavedRoute =
          savedRoute && isRouteAlignedWithTrip(savedRoute, parsedPoints) ? savedRoute : null;
        setRoute(alignedSavedRoute);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadPremium = async () => {
      try {
        const nextEntitlement = await loadEntitlementState();
        if (mounted) {
          setEntitlement(nextEntitlement);
        }
      } catch {
        if (mounted) {
          setEntitlement(DEFAULT_FREE_ENTITLEMENT);
        }
      }
    };

    void loadPremium();

    return () => {
      mounted = false;
    };
  }, []);

  const fallbackRoute = useMemo(() => buildFallbackRoute(currentTripPoints), [currentTripPoints]);
  const displayedRoute = route ?? fallbackRoute;
  const dayTabs = useMemo(
    () => (displayedRoute ? buildDayTabs(displayedRoute, tripMeta) : []),
    [displayedRoute, tripMeta]
  );
  const tripOnlyDayTabs = useMemo(() => buildTripOnlyDayTabs(tripMeta), [tripMeta]);
  const visibleDayTabs = dayTabs.length ? dayTabs : tripOnlyDayTabs;

  useEffect(() => {
    if (activeDayIndex >= visibleDayTabs.length) {
      setActiveDayIndex(0);
    }
  }, [activeDayIndex, visibleDayTabs.length]);

  const activeDay = visibleDayTabs[activeDayIndex] ?? null;
  const dayRows = useMemo(() => {
    if (!displayedRoute || !activeDay) {
      return [];
    }

    return buildDayRows(displayedRoute, activeDay);
  }, [displayedRoute, activeDay]);
  const savedPlacesForActiveDay = useMemo(() => {
    if (!activeDay) {
      return [];
    }

    return editableTripPoints.filter((point) => point.dayNumber === activeDay.dayNumber);
  }, [activeDay, editableTripPoints]);

  const isFallbackTimeline = !route && !!fallbackRoute;
  const hasEditablePlaces = editableTripPoints.length > 0;

  const persistEditableTripPoints = async (nextPoints: EditableTripPoint[]) => {
    const nextRoutePoints = nextPoints.map(editableToRoutePoint);
    const baseDraft = currentTripDraft ?? {
      destination: tripMeta.destination,
      startDate: tripMeta.startDate,
      endDate: tripMeta.endDate
    };
    const nextDraft = {
      ...baseDraft,
      destination: tripMeta.destination,
      startDate: tripMeta.startDate,
      endDate: tripMeta.endDate,
      routePoints: nextPoints.map(serializeEditableTripPoint),
      providerStatus: nextPoints.length >= 2 ? "ready" : "empty"
    };

    setEditableTripPoints(nextPoints);
    setCurrentTripPoints(nextRoutePoints);
    setCurrentTripDraft(nextDraft);
    setRoute(null);

    await Promise.all([
      AsyncStorage.setItem(CURRENT_TRIP_STORAGE_KEY, JSON.stringify(nextDraft)),
      clearPersistedOptimizedRoute()
    ]);
  };

  const moveSavedPlace = (pointId: string | undefined, nextDayNumber: number) => {
    if (!pointId || nextDayNumber < 1 || nextDayNumber > visibleDayTabs.length) {
      return;
    }

    const nextPoints = editableTripPoints.map((point) =>
      point.id === pointId ? { ...point, dayNumber: nextDayNumber } : point
    );
    void persistEditableTripPoints(nextPoints);
  };

  const removeSavedPlace = (pointId: string | undefined) => {
    if (!pointId) {
      return;
    }

    const nextPoints = editableTripPoints.filter((point) => point.id !== pointId);
    void persistEditableTripPoints(nextPoints);
  };

  const savedPlaceSection = activeDay ? (
    <View style={styles.savedPlacesCard}>
      <View style={styles.savedPlacesHeader}>
        <View>
          <Text style={styles.savedPlacesTitle}>저장된 장소</Text>
          <Text style={styles.savedPlacesSubtitle}>{`${activeDay.dayNumber}일차에 담긴 장소 ${savedPlacesForActiveDay.length}개`}</Text>
        </View>
        <TouchableOpacity style={styles.addPlaceButton} onPress={() => router.push("/search")}>
          <Text style={styles.addPlaceButtonText}>장소 추가</Text>
        </TouchableOpacity>
      </View>

      {savedPlacesForActiveDay.length ? (
        savedPlacesForActiveDay.map((point, index) => (
          <View key={`${point.id ?? point.name}-${index}`} style={styles.savedPlaceRow}>
            <View style={styles.savedPlaceIndex}>
              <Text style={styles.savedPlaceIndexText}>{index + 1}</Text>
            </View>
            <View style={styles.savedPlaceBody}>
              <Text style={styles.savedPlaceName}>{point.name ?? "저장된 장소"}</Text>
              <Text style={styles.savedPlaceMeta}>방문 장소 · 좌표는 일정표에 표시하지 않아요</Text>
              <View style={styles.savedPlaceActions}>
                <TouchableOpacity
                  style={[styles.placeActionButton, activeDay.dayNumber <= 1 ? styles.placeActionDisabled : null]}
                  disabled={activeDay.dayNumber <= 1}
                  onPress={() => moveSavedPlace(point.id, activeDay.dayNumber - 1)}
                >
                  <Text
                    style={[
                      styles.placeActionText,
                      activeDay.dayNumber <= 1 ? styles.placeActionTextDisabled : null
                    ]}
                  >
                    전날
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.placeActionButton,
                    activeDay.dayNumber >= visibleDayTabs.length ? styles.placeActionDisabled : null
                  ]}
                  disabled={activeDay.dayNumber >= visibleDayTabs.length}
                  onPress={() => moveSavedPlace(point.id, activeDay.dayNumber + 1)}
                >
                  <Text
                    style={[
                      styles.placeActionText,
                      activeDay.dayNumber >= visibleDayTabs.length ? styles.placeActionTextDisabled : null
                    ]}
                  >
                    다음날
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteActionButton} onPress={() => removeSavedPlace(point.id)}>
                  <Text style={styles.deleteActionText}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptySavedPlace}>
          <Text style={styles.emptySavedPlaceTitle}>선택한 날짜에 담긴 장소가 없어요.</Text>
          <Text style={styles.emptySavedPlaceDescription}>
            검색 화면에서 실제 provider 장소를 담거나 다른 날짜의 장소를 이동해 주세요.
          </Text>
        </View>
      )}
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.frame}>
        <Header
          title={`${tripMeta.destination} 일정표`}
          subtitle="일차별 타임라인"
          onBack={() => router.back()}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>일정을 불러오는 중...</Text>
            </View>
          ) : null}

          {!loading && !displayedRoute && !hasEditablePlaces ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>표시할 일정 데이터가 없어요</Text>
              <Text style={styles.emptyDescription}>
                추천 데이터를 불러오지 못했거나 실제 장소 좌표가 아직 없습니다.
              </Text>
              <View style={styles.emptyActions}>
                <Button title="경로 최적화 하러가기" onPress={() => router.push("/trip/route-map")} />
              </View>
            </View>
          ) : null}

          {!loading && !displayedRoute && hasEditablePlaces ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabRow}>
                {visibleDayTabs.map((dayTab, index) => {
                  const active = index === activeDayIndex;
                  return (
                    <TouchableOpacity
                      key={dayTab.key}
                      style={[styles.dayTab, active ? styles.dayTabActive : null]}
                      onPress={() => setActiveDayIndex(index)}
                    >
                      <Text style={[styles.dayTabTitle, active ? styles.dayTabTitleActive : null]}>{`${dayTab.dayNumber}일차`}</Text>
                      <Text style={[styles.dayTabDate, active ? styles.dayTabDateActive : null]}>{dayTab.dateText}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {savedPlaceSection}
              <View style={styles.bottomActions}>
                <Button title="경로 최적화 하러가기" variant="outline" onPress={() => router.push("/trip/route-map")} />
                <Button title="홈으로" onPress={() => router.replace("/(tabs)")} />
              </View>
            </>
          ) : null}

          {displayedRoute ? (
            <>
              {isFallbackTimeline ? (
                <View style={styles.fallbackNoticeCard}>
                  <Text style={styles.fallbackNoticeText}>
                    개발 환경에서만 저장된 경유지 순서로 임시 일정표를 보여드리고 있어요.
                  </Text>
                </View>
              ) : null}

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>총 거리</Text>
                  <Text style={styles.summaryValue}>{displayedRoute.totalDistanceKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>이동 시간</Text>
                  <Text style={styles.summaryValue}>{formatDuration(displayedRoute.totalDurationMin)}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>처리 일수</Text>
                  <Text style={styles.summaryValue}>{dayTabs.length}일</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabRow}>
                {dayTabs.map((dayTab, index) => {
                  const active = index === activeDayIndex;
                  return (
                    <TouchableOpacity
                      key={dayTab.key}
                      style={[styles.dayTab, active ? styles.dayTabActive : null]}
                      onPress={() => setActiveDayIndex(index)}
                    >
                      <Text style={[styles.dayTabTitle, active ? styles.dayTabTitleActive : null]}>{`${dayTab.dayNumber}일차`}</Text>
                      <Text style={[styles.dayTabDate, active ? styles.dayTabDateActive : null]}>{dayTab.dateText}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.tableCard}>
                <View style={styles.activeDaySummary}>
                  <Text style={styles.activeDaySummaryTitle}>
                    {activeDay ? `${activeDay.dayNumber}일차 일정` : "선택 일정"}
                  </Text>
                  <Text style={styles.activeDaySummaryDate}>{activeDay?.dateText ?? "날짜 미정"}</Text>
                </View>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderText, styles.timeCol]}>시간</Text>
                  <Text style={[styles.tableHeaderText, styles.typeCol]}>구분</Text>
                  <Text style={[styles.tableHeaderText, styles.contentCol]}>일정</Text>
                </View>

                {dayRows.length ? (
                  dayRows.map((row) => (
                    <View key={row.id} style={[styles.tableRow, row.type === "move" ? styles.tableRowMove : styles.tableRowStop]}>
                      <Text style={[styles.tableTime, styles.timeCol]}>{row.timeText}</Text>
                      <View style={[styles.typeBadge, row.type === "move" ? styles.moveBadge : styles.stopBadge, styles.typeCol]}>
                        <Text style={[styles.typeBadgeText, row.type === "move" ? styles.moveBadgeText : styles.stopBadgeText]}>
                          {row.type === "move" ? "이동" : "방문"}
                        </Text>
                      </View>
                      <View style={styles.contentCol}>
                        <Text style={styles.tableTitle}>{row.title}</Text>
                        <Text style={styles.tableDetail}>{row.detail}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyDayRow}>
                    <Text style={styles.emptyDayText}>선택한 날짜에 배정된 일정이 아직 없어요.</Text>
                  </View>
                )}
              </View>

              {savedPlaceSection}

              <View style={styles.bottomActions}>
                <Button title="경로 지도 보기" variant="outline" onPress={() => router.push("/trip/route-map")} />
                <Button title="홈으로" onPress={() => router.replace("/(tabs)")} />
              </View>

              <AdPlacement
                placement="schedule_bottom"
                premium={entitlement.premium}
                screen="trip_schedule"
              />
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 500 : "100%",
    alignSelf: "center"
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 28,
    gap: 12
  },
  fallbackNoticeCard: {
    backgroundColor: "#FFF9DB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.warning,
    padding: Spacing.md
  },
  fallbackNoticeText: {
    ...Typography.normal.caption,
    color: "#8A5D00"
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...Theme.shadow.sm
  },
  summaryLabel: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary
  },
  summaryValue: {
    ...Typography.normal.bodySmall,
    marginTop: 5,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  dayTabRow: {
    gap: 8,
    paddingRight: 12
  },
  dayTab: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 116
  },
  dayTabActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryLight
  },
  dayTabTitle: {
    ...Typography.normal.caption,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  dayTabTitleActive: {
    color: Theme.colors.primary
  },
  dayTabDate: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2
  },
  dayTabDateActive: {
    color: Theme.colors.primary
  },
  tableCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    overflow: "hidden",
    ...Theme.shadow.sm
  },
  activeDaySummary: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F3F8FF",
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight
  },
  activeDaySummaryTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  activeDaySummaryDate: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    marginTop: 3
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EEF4FC",
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 10
  },
  tableHeaderText: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.common.gray100
  },
  tableRowStop: {
    backgroundColor: "#F8FBFF"
  },
  tableRowMove: {
    backgroundColor: "#FBF9FF"
  },
  timeCol: {
    width: 92
  },
  typeCol: {
    width: 52
  },
  contentCol: {
    flex: 1
  },
  tableTime: {
    ...Typography.normal.caption,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  typeBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  stopBadge: {
    backgroundColor: Theme.colors.primaryLight
  },
  moveBadge: {
    backgroundColor: "#EFE9FF"
  },
  typeBadgeText: {
    ...Typography.normal.caption,
    fontWeight: "700"
  },
  stopBadgeText: {
    color: Theme.colors.primary
  },
  moveBadgeText: {
    color: "#7A4CC9"
  },
  tableTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  tableDetail: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    marginTop: 4
  },
  emptyDayRow: {
    paddingHorizontal: 12,
    paddingVertical: 16
  },
  emptyDayText: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textSecondary
  },
  savedPlacesCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    padding: Spacing.md,
    gap: 12,
    ...Theme.shadow.sm
  },
  savedPlacesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  savedPlacesTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  savedPlacesSubtitle: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    marginTop: 3
  },
  addPlaceButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  addPlaceButtonText: {
    ...Typography.normal.caption,
    color: Theme.colors.primary,
    fontWeight: "700"
  },
  savedPlaceRow: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.gray100,
    backgroundColor: "#FAFCFF",
    padding: 12
  },
  savedPlaceIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.primaryLight
  },
  savedPlaceIndexText: {
    ...Typography.normal.caption,
    color: Theme.colors.primary,
    fontWeight: "800"
  },
  savedPlaceBody: {
    flex: 1,
    minWidth: 0
  },
  savedPlaceName: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  savedPlaceMeta: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    marginTop: 4
  },
  savedPlaceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  placeActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: Colors.common.white
  },
  placeActionDisabled: {
    opacity: 0.45
  },
  placeActionText: {
    ...Typography.normal.caption,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  placeActionTextDisabled: {
    color: Theme.colors.textSecondary
  },
  deleteActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.common.error,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: Colors.common.white
  },
  deleteActionText: {
    ...Typography.normal.caption,
    color: Colors.common.error,
    fontWeight: "700"
  },
  emptySavedPlace: {
    borderRadius: 14,
    backgroundColor: Colors.common.gray50,
    padding: Spacing.md
  },
  emptySavedPlaceTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  emptySavedPlaceDescription: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    marginTop: 5
  },
  bottomActions: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl
  },
  emptyCard: {
    backgroundColor: Colors.common.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    padding: Spacing.xxl
  },
  emptyTitle: {
    ...Typography.normal.h3,
    color: Colors.common.gray800
  },
  emptyDescription: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray600,
    marginTop: Spacing.sm
  },
  emptyActions: {
    marginTop: Spacing.lg
  }
});
