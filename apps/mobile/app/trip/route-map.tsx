import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Header from "../../components/common/Header";
import Button from "../../components/common/Button";
import { RouteDetailCard, RouteMapView } from "../../components/map";
import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import {
  loadPersistedOptimizedRoute,
  optimizeRoute,
  persistOptimizedRoute,
  type OptimizeRouteRequest,
  type OptimizedRoute,
  type RoutePoint,
  type RouteTransportMode
} from "../../services/routeApi";

type ViewMode = "map" | "list";

interface RouteParams {
  routePoints?: string | string[];
  points?: string | string[];
  mode?: string | string[];
  transport?: string | string[];
  roundTrip?: string | string[];
}

const CURRENT_TRIP_STORAGE_KEY = "currentTrip";

const LEGACY_POINT_NAME_PATTERN = /(도착|추천 스팟|식당)$/;

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
  { lat: 0, lng: 0 },
  { lat: 0.014, lng: 0.012 },
  { lat: -0.011, lng: 0.017 },
  { lat: -0.016, lng: -0.01 },
  { lat: 0.013, lng: -0.016 },
  { lat: 0.006, lng: 0.022 }
];

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) {
    return param[0];
  }

  return param;
}

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
  const lng = toFiniteNumber(value.lng ?? value.lon ?? value.longitude);

  if (lat === null || lng === null) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : `point-${index + 1}`;
  const name = typeof value.name === "string" ? value.name : `지점 ${index + 1}`;

  return { id, name, lat, lng };
}

function parseRoutePoints(rawParam: string | undefined): RoutePoint[] {
  if (!rawParam) {
    return [];
  }

  const decodeCandidate = rawParam.includes("%") ? decodeURIComponent(rawParam) : rawParam;

  try {
    const parsed = JSON.parse(decodeCandidate) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => toRoutePoint(item, index))
      .filter((item): item is RoutePoint => item !== null);
  } catch {
    return [];
  }
}

function normalizeMode(rawMode: string | undefined): RouteTransportMode {
  if (!rawMode) {
    return "driving";
  }

  const value = rawMode.toLowerCase().trim();

  if (["transit", "public", "bus", "subway"].includes(value)) {
    return "transit";
  }

  if (["walk", "walking", "pedestrian"].includes(value)) {
    return "walking";
  }

  return "driving";
}

function toBoolean(raw: string | undefined, defaultValue: boolean): boolean {
  if (!raw) {
    return defaultValue;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  return defaultValue;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function hasTripSelectionData(destination: string, attractions: string[], restaurants: string[]): boolean {
  return destination.trim().length > 0 && (attractions.length > 0 || restaurants.length > 0);
}

function resolveDestinationCenter(destination: string): { lat: number; lng: number } {
  const normalized = destination.trim();
  const entry = Object.entries(DESTINATION_CENTERS).find(([name]) => normalized.includes(name));
  if (entry) {
    return entry[1];
  }

  return { lat: 37.5665, lng: 126.978 };
}

function buildTripRoutePointsFromSelection(
  destination: string,
  attractions: string[],
  restaurants: string[]
): RoutePoint[] {
  const safeDestination = destination.trim() || "여행지";
  const center = resolveDestinationCenter(safeDestination);
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
    lat: center.lat + POINT_OFFSETS[index].lat,
    lng: center.lng + POINT_OFFSETS[index].lng
  }));
}

function parseCurrentTripPoints(rawTrip: unknown): RoutePoint[] {
  if (!rawTrip || typeof rawTrip !== "object") {
    return [];
  }

  const value = rawTrip as Record<string, unknown>;
  const points = value.routePoints;
  const destination = typeof value.destination === "string" ? value.destination : "";
  const attractions = normalizeStringArray(value.attractions);
  const restaurants = normalizeStringArray(value.restaurants);
  const canBuildFromSelection = hasTripSelectionData(destination, attractions, restaurants);

  if (!Array.isArray(points)) {
    return canBuildFromSelection
      ? buildTripRoutePointsFromSelection(destination, attractions, restaurants)
      : [];
  }

  const parsedPoints = points
    .map((item, index) => toRoutePoint(item, index))
    .filter((item): item is RoutePoint => item !== null);

  if (parsedPoints.length < 2) {
    return canBuildFromSelection
      ? buildTripRoutePointsFromSelection(destination, attractions, restaurants)
      : [];
  }

  const hasOnlyLegacyNames = parsedPoints.every((point) =>
    typeof point.name === "string" ? LEGACY_POINT_NAME_PATTERN.test(point.name) : false
  );

  if (!hasOnlyLegacyNames) {
    return parsedPoints;
  }

  return buildTripRoutePointsFromSelection(destination, attractions, restaurants);
}

function parseCurrentTripMode(rawTrip: unknown): RouteTransportMode | null {
  if (!rawTrip || typeof rawTrip !== "object") {
    return null;
  }

  const value = rawTrip as Record<string, unknown>;
  if (typeof value.transport !== "string") {
    return null;
  }

  return normalizeMode(value.transport);
}

function buildRequestPoints(request: OptimizeRouteRequest): RoutePoint[] {
  return [request.start, ...(request.waypoints ?? []), ...(request.end ? [request.end] : [])];
}

function pointsEqual(left: RoutePoint, right: RoutePoint): boolean {
  return left.lat === right.lat && left.lng === right.lng;
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

function averageSpeedKmPerHour(mode: RouteTransportMode | undefined): number {
  if (mode === "walking") {
    return 4.5;
  }

  if (mode === "transit") {
    return 24;
  }

  return 36;
}

function buildFallbackPreviewRoute(request: OptimizeRouteRequest): OptimizedRoute | null {
  const orderedPoints = [...buildRequestPoints(request)];

  if (request.roundTrip && orderedPoints.length >= 2 && !pointsEqual(orderedPoints[0], orderedPoints[orderedPoints.length - 1])) {
    orderedPoints.push(orderedPoints[0]);
  }

  if (orderedPoints.length < 2) {
    return null;
  }

  const speed = averageSpeedKmPerHour(request.mode);
  const segments = orderedPoints.slice(0, -1).map((from, index) => {
    const to = orderedPoints[index + 1];
    const segmentDistanceKm = distanceKm(from, to);
    const durationMin = Math.max(1, Math.round((segmentDistanceKm / speed) * 60));

    return {
      from,
      to,
      distanceKm: segmentDistanceKm,
      durationMin,
      provider: "fallback" as const
    };
  });

  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const totalDurationMin = segments.reduce((sum, segment) => sum + segment.durationMin, 0);

  return {
    orderedPoints,
    segments,
    totalDistanceKm,
    totalDurationMin,
    source: "fallback",
    warnings: ["실시간 최적화 API 연결 전에는 직선 거리 기반 예상 경로를 표시합니다."]
  };
}

function buildRequestConfig(
  params: RouteParams,
  options?: {
    fallbackPoints?: RoutePoint[];
    fallbackMode?: RouteTransportMode | null;
  }
): {
  request: OptimizeRouteRequest | null;
  mode: RouteTransportMode;
  hasInputPoints: boolean;
} {
  const pointsParam = normalizeParam(params.routePoints ?? params.points);
  const parsedPoints = parseRoutePoints(pointsParam);
  const fallbackPoints = options?.fallbackPoints ?? [];
  const points = parsedPoints.length >= 2 ? parsedPoints : fallbackPoints.length >= 2 ? fallbackPoints : [];
  const hasInputPoints = points.length >= 2;

  const modeParam = normalizeParam(params.mode ?? params.transport);
  const mode = modeParam ? normalizeMode(modeParam) : options?.fallbackMode ?? "driving";

  if (!hasInputPoints) {
    return {
      request: null,
      mode,
      hasInputPoints: false
    };
  }

  const start = points[0] as RoutePoint;
  const end = points[points.length - 1] as RoutePoint;
  const waypoints = points.slice(1, points.length - 1);

  return {
    request: {
      start,
      end,
      waypoints,
      roundTrip: toBoolean(normalizeParam(params.roundTrip), false)
    },
    mode,
    hasInputPoints
  };
}

function modeLabel(mode: RouteTransportMode): string {
  if (mode === "transit") {
    return "대중교통";
  }

  if (mode === "walking") {
    return "도보";
  }

  return "자동차";
}

function sourceLabel(source: OptimizedRoute["source"]): string {
  if (source === "kakao") return "카카오 길찾기";
  if (source === "odsay") return "공공교통 데이터";
  if (source === "mixed") return "혼합 추정";
  return "예상 경로(미리보기)";
}

function toUserFriendlyRouteMessage(rawMessage: string): string {
  const message = rawMessage.toLowerCase();

  if (message.includes("at least two points")) {
    return "출발지와 도착지를 포함해 2개 이상의 장소가 필요해요.";
  }

  if (message.includes("network") || message.includes("failed to fetch") || message.includes("connection")) {
    return "네트워크 연결이 불안정해 실시간 경로를 불러오지 못했어요.";
  }

  if (message.includes("timeout")) {
    return "응답이 지연되어 실시간 경로 대신 예상 경로를 먼저 보여드려요.";
  }

  if (message.includes("status") || message.includes("request failed") || message.includes("route optimization")) {
    return "실시간 경로 서버 응답이 불안정해 예상 경로로 안내하고 있어요.";
  }

  if (message.includes("invalid")) {
    return "경로 데이터 확인 중 문제가 있어 예상 경로를 먼저 보여드려요.";
  }

  return "실시간 경로를 불러오지 못해 예상 경로를 먼저 보여드리고 있어요.";
}

function formatWarning(warning: string): string {
  const normalized = warning.toLowerCase();

  if (normalized.includes("kakao")) {
    return "카카오 실시간 경로 계산이 불안정해 대체 경로로 표시했어요.";
  }

  if (normalized.includes("odsay") || normalized.includes("transit")) {
    return "대중교통 경로 응답이 불안정해 대체 경로로 표시했어요.";
  }

  if (normalized.includes("fallback") || normalized.includes("estimate") || normalized.includes("straight")) {
    return "실시간 최적화 연결 전, 예상 경로를 먼저 보여드리고 있어요.";
  }

  if (normalized.includes("network") || normalized.includes("timeout")) {
    return "연결 상태가 불안정해 일부 구간은 예상 이동 시간으로 안내돼요.";
  }

  return "일부 구간 데이터가 불안정해 예상 경로를 함께 안내하고 있어요.";
}

function formatDuration(durationMin: number): string {
  if (durationMin >= 60) {
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return `${hours}시간 ${mins}분`;
  }

  return `${Math.round(durationMin)}분`;
}

function formatRouteNames(routeRequest: OptimizeRouteRequest): string {
  const pointNames = [
    routeRequest.start.name ?? "출발지",
    ...(routeRequest.waypoints ?? []).map((point) => point.name ?? "경유지"),
    routeRequest.end?.name ?? "도착지"
  ];

  return pointNames.join("  →  ");
}

const MODE_OPTIONS: Array<{ mode: RouteTransportMode; label: string }> = [
  { mode: "driving", label: "자동차" },
  { mode: "transit", label: "대중교통" },
  { mode: "walking", label: "도보" }
];

export default function RouteMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as RouteParams;

  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [tripPoints, setTripPoints] = useState<RoutePoint[]>([]);
  const [tripMode, setTripMode] = useState<RouteTransportMode | null>(null);
  const [mode, setMode] = useState<RouteTransportMode>("driving");
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const hasAutoOptimizedRef = useRef(false);

  const requestConfig = useMemo(
    () =>
      buildRequestConfig(params, {
        fallbackPoints: tripPoints,
        fallbackMode: tripMode
      }),
    [params, tripPoints, tripMode]
  );

  useEffect(() => {
    setMode(requestConfig.mode);
  }, [requestConfig.mode]);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const [savedRoute, rawCurrentTrip] = await Promise.all([
          loadPersistedOptimizedRoute(),
          AsyncStorage.getItem(CURRENT_TRIP_STORAGE_KEY)
        ]);

        if (!mounted) {
          return;
        }

        if (savedRoute) {
          setOptimizedRoute(savedRoute);
        }

        if (rawCurrentTrip) {
          const parsedCurrentTrip = JSON.parse(rawCurrentTrip) as unknown;
          const parsedPoints = parseCurrentTripPoints(parsedCurrentTrip);
          setTripPoints(parsedPoints);
          setTripMode(parseCurrentTripMode(parsedCurrentTrip));
        }
      } catch {
        // Ignore persistence read failures and continue with fresh optimization.
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const routeRequest = useMemo(
    () => (requestConfig.request ? { ...requestConfig.request, mode } : null),
    [requestConfig.request, mode]
  );

  const fallbackPreviewRoute = useMemo(
    () => (routeRequest ? buildFallbackPreviewRoute(routeRequest) : null),
    [routeRequest]
  );
  const displayedRoute = requestConfig.hasInputPoints ? optimizedRoute ?? fallbackPreviewRoute : null;
  const isFallbackRoute = displayedRoute?.source === "fallback";
  const routeTitleText = !hydrated
    ? "저장된 여행 경로를 불러오는 중이에요."
    : requestConfig.request
      ? formatRouteNames(requestConfig.request)
      : "아직 표시할 경로가 없어요.";
  const routeInfoHintText = !hydrated
    ? "잠시만요, 여행 정보를 확인하고 있어요."
    : !requestConfig.hasInputPoints
      ? "여행 만들기에서 목적지와 장소를 선택하면 경로가 자동으로 채워져요."
      : isFallbackRoute
        ? "실시간 경로 연결이 지연돼 예상 경로를 먼저 보여드리고 있어요."
        : `이동수단: ${modeLabel(mode)}`;
  const routeStatusLabel = !hydrated
    ? "불러오는 중"
    : !requestConfig.hasInputPoints
      ? "경로 없음"
      : isFallbackRoute
        ? "예상 경로"
        : "실시간 경로";
  const listEmptyText = !hydrated
    ? "경로 정보를 불러오는 중이에요."
    : !requestConfig.hasInputPoints
      ? "여행을 만들면 이동 구간 리스트가 여기에 표시돼요."
      : "경로 포인트를 확인하면 구간 리스트가 표시됩니다.";

  const optimizeRouteNow = useCallback(async (options?: { silent?: boolean }) => {
    if (!routeRequest) {
      const emptyRouteMessage = "여행 만들기에서 장소를 선택하면 경로 최적화를 시작할 수 있어요.";
      setErrorMessage(emptyRouteMessage);
      if (!(options?.silent ?? false) && Platform.OS !== "web") {
        Alert.alert("경로 최적화 안내", emptyRouteMessage);
      }
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await optimizeRoute(routeRequest);
      setOptimizedRoute(result);
      await persistOptimizedRoute(result);
    } catch (error) {
      const technicalMessage = error instanceof Error ? error.message : "";
      const userMessage = toUserFriendlyRouteMessage(technicalMessage);
      const isSilent = options?.silent ?? false;
      const fallbackMessage = "실시간 경로 연결이 지연되어 예상 경로를 먼저 표시하고 있어요.";
      setErrorMessage(isSilent ? fallbackMessage : userMessage);

      if (!isSilent && Platform.OS !== "web") {
        Alert.alert("경로 최적화 안내", userMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [routeRequest]);

  useEffect(() => {
    if (!hydrated || hasAutoOptimizedRef.current || !routeRequest || mode !== requestConfig.mode) {
      return;
    }

    hasAutoOptimizedRef.current = true;
    void optimizeRouteNow({ silent: true });
  }, [hydrated, mode, optimizeRouteNow, requestConfig.mode, routeRequest]);

  useEffect(() => {
    if (!requestConfig.hasInputPoints) {
      setErrorMessage(null);
    }
  }, [requestConfig.hasInputPoints]);

  return (
    <View style={styles.container}>
      <Header
        title="최적 경로 지도"
        subtitle="지도/리스트로 확인"
        onBack={() => router.back()}
        rightLabel="일정"
        onRightPress={() => router.push("/trip/schedule")}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.routeInfoCard}>
          <View style={styles.routeInfoTopRow}>
            <Text style={styles.routeInfoLabel}>경로</Text>
            <View
              style={[
                styles.routeStatusBadge,
                !hydrated ? styles.routeStatusBadgeLoading : null,
                hydrated && !requestConfig.hasInputPoints ? styles.routeStatusBadgeMuted : null,
                isFallbackRoute ? styles.routeStatusBadgeFallback : null
              ]}
            >
              {!hydrated ? (
                <ActivityIndicator size="small" color={Colors.common.white} />
              ) : null}
              <Text
                style={[
                  styles.routeStatusText,
                  hydrated && !requestConfig.hasInputPoints ? styles.routeStatusTextMuted : null,
                  isFallbackRoute ? styles.routeStatusTextFallback : null
                ]}
              >
                {routeStatusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.routeInfoValue}>{routeTitleText}</Text>

          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.mode}
                style={[styles.modeChip, mode === option.mode && styles.modeChipActive]}
                onPress={() => setMode(option.mode)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} 선택`}
              >
                <Text style={[styles.modeChipText, mode === option.mode && styles.modeChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.routeInfoHint}>{routeInfoHintText}</Text>
        </View>

        <View style={styles.toggleWrap}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === "map" && styles.toggleButtonActive]}
            onPress={() => setViewMode("map")}
            accessibilityRole="button"
            accessibilityLabel="지도 보기"
          >
            <Text style={[styles.toggleText, viewMode === "map" && styles.toggleTextActive]}>지도</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === "list" && styles.toggleButtonActive]}
            onPress={() => setViewMode("list")}
            accessibilityRole="button"
            accessibilityLabel="리스트 보기"
          >
            <Text style={[styles.toggleText, viewMode === "list" && styles.toggleTextActive]}>리스트</Text>
          </TouchableOpacity>
        </View>

        {viewMode === "map" ? (
          <RouteMapView route={displayedRoute} mode={mode} loading={!hydrated || (loading && !displayedRoute)} />
        ) : (
          <View style={styles.listContainer}>
            {displayedRoute?.segments.length ? (
              displayedRoute.segments.map((segment, index) => (
                <RouteDetailCard
                  key={`${segment.from.id ?? index}-${segment.to.id ?? index + 1}`}
                  segment={segment}
                  segmentIndex={index}
                  mode={mode}
                />
              ))
            ) : (
              <View style={styles.emptyListCard}>
                <Text style={styles.emptyListText}>{listEmptyText}</Text>
              </View>
            )}
          </View>
        )}

        {displayedRoute ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {displayedRoute.source === "fallback" ? "예상 경로 요약" : "최적화 결과"}
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>총 거리</Text>
              <Text style={styles.summaryValue}>{displayedRoute.totalDistanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>예상 이동 시간</Text>
              <Text style={styles.summaryValue}>{formatDuration(displayedRoute.totalDurationMin)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>데이터 소스</Text>
              <Text style={styles.summaryValue}>{sourceLabel(displayedRoute.source)}</Text>
            </View>
          </View>
        ) : null}

        {displayedRoute?.warnings?.length ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>참고</Text>
            {displayedRoute.warnings.slice(0, 3).map((warning, index) => (
              <Text key={`warning-${index}`} style={styles.warningText}>
                • {formatWarning(warning)}
              </Text>
            ))}
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {requestConfig.hasInputPoints ? (
          <>
            <Button
              title="경로 최적화 실행"
              onPress={() => {
                void optimizeRouteNow();
              }}
              loading={loading}
              disabled={!routeRequest}
              size="large"
            />

            <Button
              title="일정 타임라인 보기"
              variant="outline"
              onPress={() => router.push("/trip/schedule")}
              size="large"
            />
          </>
        ) : hydrated ? (
          <Button
            title="여행 만들기 시작"
            onPress={() => router.push("/trip/create")}
            size="large"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.common.gray50
  },
  scrollContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 36,
    gap: Spacing.lg
  },
  routeInfoCard: {
    backgroundColor: Colors.common.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    padding: Spacing.lg
  },
  routeInfoTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  routeInfoLabel: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  },
  routeStatusBadge: {
    borderRadius: 999,
    backgroundColor: Colors.young.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  routeStatusBadgeLoading: {
    backgroundColor: Colors.young.primary
  },
  routeStatusBadgeMuted: {
    backgroundColor: Colors.common.gray100
  },
  routeStatusBadgeFallback: {
    backgroundColor: "#FFF4E6"
  },
  routeStatusText: {
    ...Typography.normal.caption,
    color: Colors.common.white,
    fontWeight: "700"
  },
  routeStatusTextMuted: {
    color: Colors.common.gray600
  },
  routeStatusTextFallback: {
    color: "#AD6800"
  },
  routeInfoValue: {
    ...Typography.normal.bodySmall,
    fontWeight: "700",
    color: Colors.common.gray800,
    marginTop: Spacing.xs
  },
  routeInfoHint: {
    ...Typography.normal.caption,
    color: Colors.common.gray500,
    marginTop: Spacing.sm
  },
  modeRow: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm
  },
  modeChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.common.gray300,
    backgroundColor: Colors.common.gray50,
    alignItems: "center"
  },
  modeChipActive: {
    borderColor: Colors.young.primary,
    backgroundColor: "#EAF4FF"
  },
  modeChipText: {
    ...Typography.normal.caption,
    color: Colors.common.gray600,
    fontWeight: "600"
  },
  modeChipTextActive: {
    color: Colors.young.primary
  },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: Colors.common.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    padding: 4
  },
  toggleButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9
  },
  toggleButtonActive: {
    backgroundColor: Colors.young.primary
  },
  toggleText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray600,
    fontWeight: "700"
  },
  toggleTextActive: {
    color: Colors.common.white
  },
  listContainer: {
    gap: Spacing.md
  },
  emptyListCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.white,
    padding: Spacing.lg
  },
  emptyListText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray600
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.white,
    padding: Spacing.lg
  },
  summaryTitle: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray700,
    fontWeight: "700",
    marginBottom: Spacing.sm
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  summaryLabel: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  },
  summaryValue: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    fontWeight: "700"
  },
  warningCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.warning,
    backgroundColor: "#FFF9DB",
    padding: Spacing.lg
  },
  warningTitle: {
    ...Typography.normal.bodySmall,
    color: "#8A5D00",
    fontWeight: "700",
    marginBottom: Spacing.xs
  },
  warningText: {
    ...Typography.normal.caption,
    color: "#8A5D00",
    marginTop: 2
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.error,
    backgroundColor: "#FFF5F5",
    padding: Spacing.md
  },
  errorText: {
    ...Typography.normal.bodySmall,
    color: "#C92A2A"
  }
});
