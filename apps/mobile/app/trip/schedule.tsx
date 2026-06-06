import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureRef } from "react-native-view-shot";

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
  logAdEvent,
  logAffiliateClick,
  type PremiumEntitlementState
} from "../../services/monetization";
import { getAffiliateOffers, type AffiliateOffer } from "../../services/affiliateOffers";
import {
  buildTripShareUrl,
  getApiErrorMessage,
  isFreeTripLimitError,
  plannerApi,
  tripsApi,
  type NormalizedPlaceDto
} from "../../services/api";
import {
  clearPersistedOptimizedRoute,
  loadPersistedOptimizedRoute,
  type OptimizedRoute,
  type RoutePoint
} from "../../services/routeApi";
import { CURRENT_TRIP_STORAGE_KEY } from "../../services/localTripStorage";

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
  tripPlaceId?: string;
  providerPlaceId?: string;
  category?: string;
  address?: string;
  isSponsored?: boolean;
  sponsorLabel?: string;
  dayNumber: number;
}

type DayRow = {
  id: string;
  type: "stop" | "move";
  timeText: string;
  title: string;
  detail: string;
};

interface PlannerReplanDayPlace {
  id?: string;
  placeId?: string;
  dayNumber?: number;
  title?: string;
  category?: string;
  address?: string;
  isSponsored?: boolean;
  sponsorLabel?: string;
}

interface PlannerReplanDay {
  places?: PlannerReplanDayPlace[];
}

interface PlannerReplanResponse {
  ok: true;
  days: PlannerReplanDay[];
  places?: NormalizedPlaceDto[];
}

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

  const value = raw as Record<string, unknown>;
  const rawDayNumber = toFiniteNumber(value.dayNumber);
  const tripPlaceId = typeof value.tripPlaceId === "string" ? value.tripPlaceId : undefined;
  const providerPlaceId =
    typeof value.providerPlaceId === "string" ? value.providerPlaceId : undefined;
  const category = typeof value.category === "string" ? value.category : undefined;
  const address = typeof value.address === "string" ? value.address : undefined;
  const isSponsored = typeof value.isSponsored === "boolean" ? value.isSponsored : undefined;
  const sponsorLabel = typeof value.sponsorLabel === "string" ? value.sponsorLabel : undefined;
  const dayNumber = rawDayNumber && rawDayNumber >= 1 ? Math.floor(rawDayNumber) : 1;
  return {
    ...point,
    ...(tripPlaceId ? { tripPlaceId } : {}),
    ...(providerPlaceId ? { providerPlaceId } : {}),
    ...(category ? { category } : {}),
    ...(address ? { address } : {}),
    ...(isSponsored !== undefined ? { isSponsored } : {}),
    ...(sponsorLabel ? { sponsorLabel } : {}),
    dayNumber
  };
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
    ...(point.tripPlaceId ? { tripPlaceId: point.tripPlaceId } : {}),
    ...(point.providerPlaceId ? { providerPlaceId: point.providerPlaceId } : {}),
    name: point.name,
    ...(point.category ? { category: point.category } : {}),
    ...(point.address ? { address: point.address } : {}),
    ...(point.isSponsored !== undefined ? { isSponsored: point.isSponsored } : {}),
    ...(point.sponsorLabel ? { sponsorLabel: point.sponsorLabel } : {}),
    latitude: point.lat,
    longitude: point.lng,
    dayNumber: point.dayNumber
  };
}

function editablePointToNormalizedPlace(point: EditableTripPoint, index: number): NormalizedPlaceDto {
  const id = point.providerPlaceId ?? point.id ?? `manual-${index + 1}`;
  return {
    id,
    provider: "manual",
    providerPlaceId: point.providerPlaceId ?? id,
    name: point.name ?? `장소 ${index + 1}`,
    category: point.category ?? "장소",
    ...(point.address ? { address: point.address } : {}),
    lat: point.lat,
    lng: point.lng,
    tags: [],
    score: Math.max(40, 70 - index),
    isSponsored: point.isSponsored === true,
    ...(point.sponsorLabel ? { sponsorLabel: point.sponsorLabel } : {})
  };
}

function buildExistingPointLookup(points: EditableTripPoint[]): Map<string, EditableTripPoint> {
  const lookup = new Map<string, EditableTripPoint>();
  for (const point of points) {
    if (point.id) {
      lookup.set(point.id, point);
    }
    if (point.providerPlaceId) {
      lookup.set(point.providerPlaceId, point);
    }
  }

  return lookup;
}

function replanResponseToEditablePoints(
  response: PlannerReplanResponse,
  existingPoints: EditableTripPoint[]
): EditableTripPoint[] {
  const sourcePlaces = response.places ?? [];
  const placesById = new Map<string, NormalizedPlaceDto>();
  const existingById = buildExistingPointLookup(existingPoints);
  for (const place of sourcePlaces) {
    placesById.set(place.id, place);
    if (place.providerPlaceId) {
      placesById.set(place.providerPlaceId, place);
    }
  }

  return response.days.flatMap((day) =>
    (day.places ?? []).flatMap((place): EditableTripPoint[] => {
      const source = place.placeId ? placesById.get(place.placeId) : undefined;
      if (!source) {
        return [];
      }
      const existing = existingById.get(source.id) ?? (
        source.providerPlaceId ? existingById.get(source.providerPlaceId) : undefined
      );

      return [{
        id: source.id,
        ...(existing?.tripPlaceId ? { tripPlaceId: existing.tripPlaceId } : {}),
        providerPlaceId: source.providerPlaceId ?? source.id,
        name: place.title ?? source.name,
        lat: source.lat,
        lng: source.lng,
        category: place.category ?? source.category,
        address: place.address ?? source.roadAddress ?? source.address,
        isSponsored: place.isSponsored ?? source.isSponsored,
        sponsorLabel: place.sponsorLabel ?? source.sponsorLabel,
        dayNumber: place.dayNumber && place.dayNumber >= 1 ? place.dayNumber : 1
      }];
    })
  );
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
  const scheduleExportRef = useRef<View | null>(null);
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [currentTripPoints, setCurrentTripPoints] = useState<RoutePoint[]>([]);
  const [editableTripPoints, setEditableTripPoints] = useState<EditableTripPoint[]>([]);
  const [currentTripDraft, setCurrentTripDraft] = useState<Record<string, unknown> | null>(null);
  const [tripMeta, setTripMeta] = useState<TripMeta>({ destination: "여행", startDate: "", endDate: "" });
  const [loading, setLoading] = useState(true);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [entitlement, setEntitlement] = useState<PremiumEntitlementState>(DEFAULT_FREE_ENTITLEMENT);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [affiliateNotice, setAffiliateNotice] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [replanLoading, setReplanLoading] = useState(false);
  const [replanNotice, setReplanNotice] = useState<string | null>(null);
  const affiliateOffers = useMemo(() => getAffiliateOffers(), []);

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

  const persistEditableTripPoints = async (
    nextPoints: EditableTripPoint[],
    draftOverride?: Record<string, unknown>
  ) => {
    const nextRoutePoints = nextPoints.map(editableToRoutePoint);
    const baseDraft = draftOverride ?? currentTripDraft ?? {
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

  const currentServerTripId = () => {
    const tripId = typeof currentTripDraft?.id === "string" ? currentTripDraft.id : "";
    return tripId && !tripId.startsWith("trip_") ? tripId : null;
  };

  const syncRemotePlaceMove = async (point: EditableTripPoint, nextDayNumber: number) => {
    const tripId = currentServerTripId();
    if (!tripId || !point.tripPlaceId) {
      return;
    }

    await tripsApi.updatePlaceById(tripId, point.tripPlaceId, { dayNumber: nextDayNumber });
  };

  const syncRemotePlaceDelete = async (point: EditableTripPoint) => {
    const tripId = currentServerTripId();
    if (!tripId || !point.tripPlaceId) {
      return;
    }

    await tripsApi.deletePlaceById(tripId, point.tripPlaceId);
  };

  const syncPlacesToTrip = async (tripId: string, nextPoints: EditableTripPoint[]) => {
    const syncPlaces = nextPoints.map((point, index) => ({
      clientId: point.id ?? point.providerPlaceId ?? `replan-point-${index + 1}`,
      point,
      payload: {
        clientId: point.id ?? point.providerPlaceId ?? `replan-point-${index + 1}`,
        ...(point.tripPlaceId ? { tripPlaceId: point.tripPlaceId } : {}),
        ...(point.providerPlaceId || point.id ? { providerPlaceId: point.providerPlaceId ?? point.id } : {}),
        name: point.name ?? `장소 ${index + 1}`,
        category: point.category ?? "장소",
        ...(point.address ? { address: point.address } : {}),
        lat: point.lat,
        lng: point.lng,
        dayNumber: point.dayNumber,
        sortOrder: index + 1,
        isSponsored: point.isSponsored === true,
        ...(point.sponsorLabel ? { sponsorLabel: point.sponsorLabel } : {})
      }
    }));

    const response = await tripsApi.syncPlaces(
      tripId,
      syncPlaces.map((item) => item.payload)
    );

    const tripPlaceIdsByClientId = new Map(
      response.data.sync.items.map((item) => [item.clientId, item.tripPlaceId])
    );
    const syncedPoints = syncPlaces.map(({ clientId, point }) => {
      const tripPlaceId = tripPlaceIdsByClientId.get(clientId) ?? point.tripPlaceId;
      return tripPlaceId ? { ...point, tripPlaceId } : point;
    });
    return {
      points: syncedPoints,
      created: response.data.sync.created,
      relinked: response.data.sync.relinked,
      updated: response.data.sync.updated,
      skipped: response.data.sync.skipped
    };
  };

  const syncRemoteReplannedPlaces = async (nextPoints: EditableTripPoint[]) => {
    const tripId = currentServerTripId();
    if (!tripId) {
      return { points: nextPoints, created: 0, relinked: 0, updated: 0, skipped: nextPoints.length };
    }

    return syncPlacesToTrip(tripId, nextPoints);
  };

  const saveCurrentTripToServer = async () => {
    if (saveLoading) {
      return;
    }

    setSaveLoading(true);
    setSaveNotice(null);
    try {
      const existingTripId = currentServerTripId();
      if (existingTripId) {
        if (!editableTripPoints.length) {
          setSaveNotice("서버에 저장된 여행입니다. 동기화할 장소가 아직 없어요.");
          return;
        }

        const syncResult = await syncPlacesToTrip(existingTripId, editableTripPoints);
        if (syncResult.created > 0 || syncResult.relinked > 0 || syncResult.updated > 0) {
          await persistEditableTripPoints(syncResult.points);
        }
        setSaveNotice(`현재 장소 ${syncResult.created + syncResult.relinked + syncResult.updated}개를 서버에 다시 동기화했어요.`);
        return;
      }

      const styleKey =
        typeof currentTripDraft?.styleKey === "string" && currentTripDraft.styleKey.trim()
          ? currentTripDraft.styleKey
          : "sea_cafe_food";
      const transportMode =
        typeof currentTripDraft?.transportMode === "string" && currentTripDraft.transportMode.trim()
          ? currentTripDraft.transportMode
          : typeof currentTripDraft?.mode === "string" && currentTripDraft.mode.trim()
            ? currentTripDraft.mode
            : "driving";
      const title =
        typeof currentTripDraft?.title === "string" && currentTripDraft.title.trim()
          ? currentTripDraft.title
          : `${tripMeta.destination} 여행`;
      const response = await tripsApi.create({
        title,
        destination: tripMeta.destination,
        startDate: tripMeta.startDate,
        endDate: tripMeta.endDate,
        styleKey,
        transportMode
      });
      const savedTrip = response.data.trip;
      const baseDraft = currentTripDraft ?? {};
      const nextDraft = {
        ...baseDraft,
        id: savedTrip.id,
        title: savedTrip.title,
        destination: savedTrip.destination,
        startDate: savedTrip.startDate,
        endDate: savedTrip.endDate,
        styleKey: savedTrip.styleKey ?? styleKey,
        transportMode: savedTrip.transportMode ?? transportMode
      };

      setCurrentTripDraft(nextDraft);
      await AsyncStorage.setItem(CURRENT_TRIP_STORAGE_KEY, JSON.stringify({
        ...nextDraft,
        routePoints: editableTripPoints.map(serializeEditableTripPoint),
        providerStatus: editableTripPoints.length >= 2 ? "ready" : "empty"
      }));

      if (editableTripPoints.length) {
        const syncResult = await syncPlacesToTrip(savedTrip.id, editableTripPoints);
        if (syncResult.created > 0 || syncResult.relinked > 0 || syncResult.updated > 0) {
          await persistEditableTripPoints(syncResult.points, nextDraft);
        }
        setSaveNotice(`여행을 서버에 저장하고 장소 ${syncResult.created + syncResult.relinked + syncResult.updated}개를 연결했어요.`);
      } else {
        setSaveNotice("여행을 서버에 저장했어요. 검색 화면에서 장소를 추가해 주세요.");
      }
    } catch (error) {
      if (isFreeTripLimitError(error)) {
        setSaveNotice(getApiErrorMessage(error) ?? "무료 플랜 저장 한도에 도달했어요. 프리미엄에서 무제한 저장을 사용할 수 있습니다.");
      } else {
        setSaveNotice("여행을 서버에 저장하지 못했어요. 로그인 상태나 네트워크를 확인해 주세요.");
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const shareCurrentTrip = async () => {
    const tripId = currentServerTripId();
    if (!tripId) {
      setShareNotice("공유 링크는 로그인 후 저장된 여행에서 만들 수 있어요.");
      return;
    }

    setShareLoading(true);
    setShareNotice(null);

    try {
      const response = await tripsApi.createShare(tripId);
      const shareUrl = buildTripShareUrl(response.data.share.token);
      const message = `${tripMeta.destination} 여행 일정표\n${shareUrl}`;

      if (Platform.OS === "web") {
        const clipboard = (globalThis as { navigator?: { clipboard?: { writeText(text: string): Promise<void> } } })
          .navigator?.clipboard;
        if (clipboard) {
          await clipboard.writeText(shareUrl);
          setShareNotice("공유 링크를 클립보드에 복사했어요.");
        } else {
          setShareNotice(`공유 링크가 생성됐어요: ${shareUrl}`);
        }
      } else {
        await Share.share({ message, url: shareUrl, title: `${tripMeta.destination} 여행 일정표` });
        setShareNotice("공유 링크를 만들었어요.");
      }
    } catch {
      const message = "공유 링크를 만들지 못했어요. 로그인 상태나 네트워크를 확인해 주세요.";
      setShareNotice(message);
      if (Platform.OS !== "web") {
        Alert.alert("공유 실패", message);
      }
    } finally {
      setShareLoading(false);
    }
  };

  const openAffiliateOffer = async (offer: AffiliateOffer) => {
    if (!offer.targetUrl) {
      setAffiliateNotice(`${offer.title} 제휴 링크가 아직 설정되지 않았어요. 환경변수 ${offer.envName}을 확인해 주세요.`);
      return;
    }

    setAffiliateNotice(null);
    try {
      await logAffiliateClick({
        provider: offer.provider,
        placement: "schedule_bottom",
        targetUrl: offer.targetUrl,
        ...(currentServerTripId() ? { tripId: currentServerTripId() ?? undefined } : {})
      });
    } catch {
      setAffiliateNotice("클릭 기록은 실패했지만 외부 예약 서비스는 열어드릴게요.");
    }

    const canOpen = await Linking.canOpenURL(offer.targetUrl);
    if (canOpen) {
      await Linking.openURL(offer.targetUrl);
    } else {
      setAffiliateNotice("외부 예약 링크를 열 수 없어요. 링크 설정을 확인해 주세요.");
    }
  };

  const requestFreeExportGate = async () => {
    setExportNotice("PDF/이미지 내보내기는 프리미엄 기능입니다. 무료 사용자는 보상형 광고 기반 1회 내보내기 정책을 연결할 수 있습니다.");
    await logAdEvent({
      placement: "free_export",
      eventType: "requested",
      metadata: { screen: "trip_schedule", result: "premium_gate" }
    }).catch(() => undefined);
  };

  const exportScheduleImage = async () => {
    if (!entitlement.benefits.exportEnabled) {
      await requestFreeExportGate();
      return;
    }

    if (!scheduleExportRef.current) {
      setExportNotice("내보낼 일정 영역이 아직 준비되지 않았어요.");
      return;
    }

    setExportLoading(true);
    setExportNotice(null);
    try {
      const uri = await captureRef(scheduleExportRef.current, {
        format: "png",
        quality: 0.92,
        result: "tmpfile"
      });
      await Share.share({
        title: `${tripMeta.destination} 일정표 이미지`,
        message: `${tripMeta.destination} 여행 일정표 이미지`,
        url: uri
      });
      setExportNotice("일정표 이미지를 생성했어요.");
    } catch {
      setExportNotice("이미지 내보내기를 완료하지 못했어요. 기기 저장 공간이나 공유 권한을 확인해 주세요.");
    } finally {
      setExportLoading(false);
    }
  };

  const exportSchedulePdf = async () => {
    if (!entitlement.benefits.exportEnabled) {
      await requestFreeExportGate();
      return;
    }

    const tripId = currentServerTripId();
    if (!tripId) {
      setExportNotice("PDF 내보내기는 로그인 후 저장된 여행에서 요청할 수 있어요.");
      return;
    }

    setExportLoading(true);
    setExportNotice(null);
    try {
      const response = await tripsApi.createExport(tripId, "pdf");
      const downloadUrl = response.data.export.downloadUrl;
      if (downloadUrl) {
        const canOpen = await Linking.canOpenURL(downloadUrl);
        if (canOpen) {
          await Linking.openURL(downloadUrl);
          setExportNotice("PDF 저장용 인쇄 페이지를 열었어요.");
        } else {
          setExportNotice(`PDF 저장용 페이지가 준비됐어요: ${downloadUrl}`);
        }
      } else {
        setExportNotice(`PDF 내보내기 작업을 준비했어요. 상태: ${response.data.export.status}`);
      }
    } catch {
      setExportNotice("PDF 내보내기 작업을 만들지 못했어요. 프리미엄 상태나 네트워크를 확인해 주세요.");
    } finally {
      setExportLoading(false);
    }
  };

  const replanSchedule = async (options?: { weatherAlternative?: boolean }) => {
    const weatherAlternative = options?.weatherAlternative === true;
    const hasBenefit = weatherAlternative
      ? entitlement.benefits.weatherAlternatives
      : entitlement.benefits.advancedReplan;

    if (!hasBenefit) {
      setReplanNotice(
        weatherAlternative
          ? "비 오는 날 대체코스는 프리미엄 기능입니다. 무료 사용자는 장소 편집과 기본 경로 최적화를 사용할 수 있어요."
          : "고급 일정 재생성은 프리미엄 기능입니다. 무료 사용자는 장소 편집과 기본 경로 최적화를 사용할 수 있어요."
      );
      await logAdEvent({
        placement: "schedule_bottom",
        eventType: "requested",
        metadata: {
          screen: "trip_schedule",
          result: weatherAlternative ? "weather_alternative_gate" : "advanced_replan_gate"
        }
      }).catch(() => undefined);
      return;
    }

    if (!editableTripPoints.length) {
      setReplanNotice(
        weatherAlternative
          ? "대체코스로 정리할 실제 장소가 없어요. 검색 화면에서 실내 장소를 먼저 담아주세요."
          : "재생성할 실제 장소가 없어요. 검색 화면에서 장소를 먼저 담아주세요."
      );
      return;
    }

    setReplanLoading(true);
    setReplanNotice(null);
    try {
      const styleKey =
        weatherAlternative
          ? "rainy_backup"
          : typeof currentTripDraft?.styleKey === "string" && currentTripDraft.styleKey.trim()
            ? currentTripDraft.styleKey
            : "sea_cafe_food";
      const mode =
        typeof currentTripDraft?.mode === "string"
          ? currentTripDraft.mode
          : typeof currentTripDraft?.transportMode === "string"
            ? currentTripDraft.transportMode
            : "driving";
      const response = await plannerApi.replan({
        destination: tripMeta.destination,
        startDate: tripMeta.startDate,
        endDate: tripMeta.endDate,
        styleKey,
        mode,
        places: editableTripPoints.map(editablePointToNormalizedPlace),
        replacementQuery: weatherAlternative
          ? `${tripMeta.destination} 실내 전시 카페 비 오는 날`
          : tripMeta.destination
      });
      const nextPoints = replanResponseToEditablePoints(response.data as PlannerReplanResponse, editableTripPoints);
      if (nextPoints.length < 2) {
        setReplanNotice("재생성 결과에 경로를 만들 만큼의 좌표가 없어요. 장소를 더 담은 뒤 다시 시도해 주세요.");
        return;
      }

      await persistEditableTripPoints(nextPoints);
      const syncResult = await syncRemoteReplannedPlaces(nextPoints);
      if (syncResult.created > 0 || syncResult.relinked > 0) {
        await persistEditableTripPoints(syncResult.points);
      }
      setActiveDayIndex(0);
      const createdNotice = syncResult.created > 0
        ? ` 새 장소 ${syncResult.created}개도 저장했습니다.`
        : "";
      setReplanNotice(
        syncResult.updated > 0
          ? `${weatherAlternative ? "비 오는 날 대체코스를" : "일정을"} 다시 정리하고 저장된 장소 ${syncResult.updated}개를 서버에 반영했어요.${createdNotice}`
          : weatherAlternative
            ? "비 오는 날 대체코스를 정리했어요. 로그인 후 저장된 여행에서는 새 순서를 서버에도 반영할 수 있습니다."
            : "일정을 다시 정리했어요. 로그인 후 저장된 여행에서는 새 순서를 서버에도 반영할 수 있습니다."
      );
    } catch {
      setReplanNotice(
        weatherAlternative
          ? "대체코스를 정리했지만 서버 동기화 또는 provider 호출을 완료하지 못했어요. 네트워크 상태를 확인해 주세요."
          : "일정을 다시 정리했지만 서버 동기화 또는 provider 호출을 완료하지 못했어요. 네트워크 상태를 확인해 주세요."
      );
    } finally {
      setReplanLoading(false);
    }
  };

  const moveSavedPlace = (pointId: string | undefined, nextDayNumber: number) => {
    if (!pointId || nextDayNumber < 1 || nextDayNumber > visibleDayTabs.length) {
      return;
    }

    const target = editableTripPoints.find((point) => point.id === pointId);
    if (!target) {
      return;
    }

    const nextPoints = editableTripPoints.map((point) =>
      point.id === pointId ? { ...point, dayNumber: nextDayNumber } : point
    );
    setSyncNotice(null);
    void (async () => {
      await persistEditableTripPoints(nextPoints);
      try {
        await syncRemotePlaceMove(target, nextDayNumber);
      } catch {
        setSyncNotice("로컬 일정은 수정됐지만 서버 동기화는 완료하지 못했어요. 로그인 상태나 네트워크를 확인해 주세요.");
      }
    })();
  };

  const removeSavedPlace = (pointId: string | undefined) => {
    if (!pointId) {
      return;
    }

    const target = editableTripPoints.find((point) => point.id === pointId);
    if (!target) {
      return;
    }

    const nextPoints = editableTripPoints.filter((point) => point.id !== pointId);
    setSyncNotice(null);
    void (async () => {
      await persistEditableTripPoints(nextPoints);
      try {
        await syncRemotePlaceDelete(target);
      } catch {
        setSyncNotice("로컬 일정에서는 삭제됐지만 서버 동기화는 완료하지 못했어요. 로그인 상태나 네트워크를 확인해 주세요.");
      }
    })();
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

      {syncNotice ? (
        <View style={styles.syncNotice}>
          <Text style={styles.syncNoticeText}>{syncNotice}</Text>
        </View>
      ) : null}

      {savedPlacesForActiveDay.length ? (
        savedPlacesForActiveDay.map((point, index) => (
          <View key={`${point.id ?? point.name}-${index}`} style={styles.savedPlaceRow}>
            <View style={styles.savedPlaceIndex}>
              <Text style={styles.savedPlaceIndexText}>{index + 1}</Text>
            </View>
            <View style={styles.savedPlaceBody}>
              <Text style={styles.savedPlaceName}>{point.name ?? "저장된 장소"}</Text>
              <Text style={styles.savedPlaceMeta}>방문 장소 · 좌표는 일정표에 표시하지 않아요</Text>
              <View style={styles.dayMoveChips}>
                {visibleDayTabs.map((dayTab) => {
                  const selected = dayTab.dayNumber === point.dayNumber;
                  return (
                    <TouchableOpacity
                      key={`${point.id ?? point.name}-day-${dayTab.dayNumber}`}
                      style={[
                        styles.dayMoveChip,
                        selected ? styles.dayMoveChipSelected : null
                      ]}
                      disabled={selected}
                      onPress={() => moveSavedPlace(point.id, dayTab.dayNumber)}
                    >
                      <Text
                        style={[
                          styles.dayMoveChipText,
                          selected ? styles.dayMoveChipTextSelected : null
                        ]}
                      >
                        {`${dayTab.dayNumber}일차`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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

  const affiliateSection = (
    <View style={styles.affiliateCard}>
      <View style={styles.affiliateHeader}>
        <Text style={styles.affiliateTitle}>예약/제휴</Text>
        <Text style={styles.affiliateBadge}>외부 서비스</Text>
      </View>
      <Text style={styles.affiliateDescription}>
        숙소·렌터카·티켓·보험 예약은 앱 프리미엄 결제와 분리된 외부 서비스로 이동합니다.
      </Text>
      {affiliateNotice ? <Text style={styles.affiliateNotice}>{affiliateNotice}</Text> : null}
      <View style={styles.affiliateGrid}>
        {affiliateOffers.map((offer) => (
          <TouchableOpacity
            key={offer.provider}
            style={[styles.affiliateOffer, !offer.targetUrl ? styles.affiliateOfferDisabled : null]}
            onPress={() => { void openAffiliateOffer(offer); }}
            activeOpacity={0.78}
          >
            <Text style={styles.affiliateOfferTitle}>{offer.title}</Text>
            <Text style={styles.affiliateOfferDescription}>{offer.description}</Text>
            <Text style={styles.affiliateOfferAction}>
              {offer.targetUrl ? "외부에서 보기" : "링크 설정 필요"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const exportSection = (
    <View style={styles.exportCard}>
      <View style={styles.exportHeader}>
        <Text style={styles.exportTitle}>내보내기</Text>
        <Text style={[styles.exportBadge, entitlement.benefits.exportEnabled ? styles.exportBadgePremium : null]}>
          {entitlement.benefits.exportEnabled ? "PREMIUM" : "프리미엄"}
        </Text>
      </View>
      <Text style={styles.exportDescription}>
        이미지/PDF 내보내기는 광고 제거와 함께 제공되는 프리미엄 기능입니다. 무료 사용자는 보상형 광고 정책으로 1회 내보내기를 열 수 있습니다.
      </Text>
      {exportNotice ? <Text style={styles.exportNotice}>{exportNotice}</Text> : null}
      <View style={styles.exportActions}>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => { void exportScheduleImage(); }}
          disabled={exportLoading}
        >
          <Text style={styles.exportButtonText}>{exportLoading ? "내보내기 처리 중..." : "이미지 내보내기"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => { void exportSchedulePdf(); }}
          disabled={exportLoading}
        >
          <Text style={styles.exportButtonText}>PDF 내보내기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const replanSection = (
    <View style={styles.replanCard}>
      <View style={styles.replanHeader}>
        <Text style={styles.replanTitle}>고급 일정 재생성</Text>
        <Text style={[styles.replanBadge, entitlement.benefits.advancedReplan ? styles.replanBadgePremium : null]}>
          {entitlement.benefits.advancedReplan ? "PREMIUM" : "프리미엄"}
        </Text>
      </View>
      <Text style={styles.replanDescription}>
        현재 담긴 장소와 provider 추천을 다시 정렬해 날짜별 동선을 정리합니다. 비 오는 날은 실내·전시·카페 중심 대체코스로 다시 구성할 수 있습니다.
      </Text>
      {replanNotice ? <Text style={styles.replanNotice}>{replanNotice}</Text> : null}
      <TouchableOpacity
        style={[styles.replanButton, replanLoading ? styles.replanButtonDisabled : null]}
        onPress={() => { void replanSchedule(); }}
        disabled={replanLoading}
      >
        <Text style={styles.replanButtonText}>
          {replanLoading ? "재생성 중..." : "일정 다시 정리"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.weatherReplanButton, replanLoading ? styles.replanButtonDisabled : null]}
        onPress={() => { void replanSchedule({ weatherAlternative: true }); }}
        disabled={replanLoading}
      >
        <Text style={styles.weatherReplanButtonText}>
          {replanLoading ? "대체코스 정리 중..." : "비 오는 날 대체코스"}
        </Text>
      </TouchableOpacity>
    </View>
  );

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
              <View ref={scheduleExportRef} collapsable={false} style={styles.exportCaptureArea}>
                {savedPlaceSection}
              </View>
              {replanSection}
              {exportSection}
              {affiliateSection}
              <View style={styles.bottomActions}>
                <Button title="경로 최적화 하러가기" variant="outline" onPress={() => router.push("/trip/route-map")} />
                <Button
                  title={
                    saveLoading
                      ? "서버 저장 중..."
                      : currentServerTripId()
                        ? "장소 다시 동기화"
                        : "서버에 저장"
                  }
                  variant="outline"
                  onPress={() => { void saveCurrentTripToServer(); }}
                />
                {saveNotice ? <Text style={styles.saveNoticeText}>{saveNotice}</Text> : null}
                <Button
                  title={shareLoading ? "공유 링크 생성 중..." : "공유 링크 만들기"}
                  variant="outline"
                  onPress={() => { void shareCurrentTrip(); }}
                />
                {shareNotice ? <Text style={styles.shareNoticeText}>{shareNotice}</Text> : null}
                <Button title="홈으로" onPress={() => router.replace("/(tabs)")} />
              </View>
            </>
          ) : null}

          {displayedRoute ? (
            <>
              {isFallbackTimeline ? (
                <View style={styles.fallbackNoticeCard}>
                  <Text style={styles.fallbackNoticeText}>
                    저장된 장소 좌표와 경유지 순서를 바탕으로 만든 예상 일정표입니다. 실제 이동시간은 경로 최적화 후 확인해 주세요.
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

              <View ref={scheduleExportRef} collapsable={false} style={styles.exportCaptureArea}>
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
              </View>

              {replanSection}
              {exportSection}
              {affiliateSection}

              <View style={styles.bottomActions}>
                <Button title="경로 지도 보기" variant="outline" onPress={() => router.push("/trip/route-map")} />
                <Button
                  title={
                    saveLoading
                      ? "서버 저장 중..."
                      : currentServerTripId()
                        ? "장소 다시 동기화"
                        : "서버에 저장"
                  }
                  variant="outline"
                  onPress={() => { void saveCurrentTripToServer(); }}
                />
                {saveNotice ? <Text style={styles.saveNoticeText}>{saveNotice}</Text> : null}
                <Button
                  title={shareLoading ? "공유 링크 생성 중..." : "공유 링크 만들기"}
                  variant="outline"
                  onPress={() => { void shareCurrentTrip(); }}
                />
                {shareNotice ? <Text style={styles.shareNoticeText}>{shareNotice}</Text> : null}
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
  syncNotice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.common.warning,
    backgroundColor: "#FFF9DB",
    padding: Spacing.sm
  },
  syncNoticeText: {
    ...Typography.normal.caption,
    color: "#8A5D00"
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
  dayMoveChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10
  },
  dayMoveChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Colors.common.white,
    paddingHorizontal: 10,
    justifyContent: "center"
  },
  dayMoveChipSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryLight
  },
  dayMoveChipText: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  dayMoveChipTextSelected: {
    color: Theme.colors.primary
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
  exportCaptureArea: {
    gap: 12
  },
  replanCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    padding: Spacing.md,
    gap: 10,
    ...Theme.shadow.sm
  },
  replanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  replanTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  replanBadge: {
    ...Typography.normal.caption,
    color: Theme.colors.primary,
    fontWeight: "800",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  replanBadgePremium: {
    color: "#146C43",
    borderColor: "#A8E6C1",
    backgroundColor: "#EAF8EF"
  },
  replanDescription: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    lineHeight: 18
  },
  replanNotice: {
    ...Typography.normal.caption,
    color: "#8A5D00",
    borderRadius: 10,
    backgroundColor: "#FFF9DB",
    padding: Spacing.sm
  },
  replanButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  replanButtonDisabled: {
    opacity: 0.65
  },
  replanButtonText: {
    ...Typography.normal.caption,
    color: Colors.common.white,
    fontWeight: "800",
    textAlign: "center"
  },
  weatherReplanButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    backgroundColor: Colors.common.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  weatherReplanButtonText: {
    ...Typography.normal.caption,
    color: Theme.colors.primary,
    fontWeight: "800",
    textAlign: "center"
  },
  exportCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    padding: Spacing.md,
    gap: 10,
    ...Theme.shadow.sm
  },
  exportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  exportTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  exportBadge: {
    ...Typography.normal.caption,
    color: Theme.colors.primary,
    fontWeight: "800",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  exportBadgePremium: {
    color: "#146C43",
    borderColor: "#A8E6C1",
    backgroundColor: "#EAF8EF"
  },
  exportDescription: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    lineHeight: 18
  },
  exportNotice: {
    ...Typography.normal.caption,
    color: "#8A5D00",
    borderRadius: 10,
    backgroundColor: "#FFF9DB",
    padding: Spacing.sm
  },
  exportActions: {
    flexDirection: "row",
    gap: 8
  },
  exportButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  exportButtonText: {
    ...Typography.normal.caption,
    color: Colors.common.white,
    fontWeight: "800",
    textAlign: "center"
  },
  affiliateCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    padding: Spacing.md,
    gap: 10,
    ...Theme.shadow.sm
  },
  affiliateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  affiliateTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  affiliateBadge: {
    ...Typography.normal.caption,
    color: "#8A5D00",
    fontWeight: "800",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.common.warning,
    backgroundColor: "#FFF9DB",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  affiliateDescription: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    lineHeight: 18
  },
  affiliateNotice: {
    ...Typography.normal.caption,
    color: "#8A5D00",
    borderRadius: 10,
    backgroundColor: "#FFF9DB",
    padding: Spacing.sm
  },
  affiliateGrid: {
    gap: 8
  },
  affiliateOffer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: "#FAFCFF",
    padding: 12
  },
  affiliateOfferDisabled: {
    opacity: 0.72
  },
  affiliateOfferTitle: {
    ...Typography.normal.bodySmall,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  affiliateOfferDescription: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 17
  },
  affiliateOfferAction: {
    ...Typography.normal.caption,
    color: Theme.colors.primary,
    fontWeight: "800",
    marginTop: 8
  },
  bottomActions: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl
  },
  shareNoticeText: {
    ...Typography.normal.caption,
    color: Theme.colors.textSecondary,
    textAlign: "center"
  },
  saveNoticeText: {
    ...Typography.normal.caption,
    color: Theme.colors.primaryDark,
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: 10,
    padding: Spacing.sm,
    textAlign: "center"
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
