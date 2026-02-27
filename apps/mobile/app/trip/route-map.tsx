import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
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

const DEFAULT_POINTS: RoutePoint[] = [
  { id: "jeju-airport", name: "제주공항", lat: 33.5113, lng: 126.4928 },
  { id: "dongmun", name: "동문시장", lat: 33.5121, lng: 126.5279 },
  { id: "seongsan", name: "성산일출봉", lat: 33.4592, lng: 126.9424 },
  { id: "seogwipo", name: "서귀포 올레시장", lat: 33.2506, lng: 126.5653 }
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

function parseCurrentTripPoints(rawTrip: unknown): RoutePoint[] {
  if (!rawTrip || typeof rawTrip !== "object") {
    return [];
  }

  const value = rawTrip as Record<string, unknown>;
  const points = value.routePoints;

  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((item, index) => toRoutePoint(item, index))
    .filter((item): item is RoutePoint => item !== null);
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
  request: OptimizeRouteRequest;
  mode: RouteTransportMode;
  hasInputPoints: boolean;
} {
  const pointsParam = normalizeParam(params.routePoints ?? params.points);
  const parsedPoints = parseRoutePoints(pointsParam);
  const fallbackPoints = options?.fallbackPoints ?? [];
  const hasInputPoints = parsedPoints.length >= 2 || fallbackPoints.length >= 2;
  const points = parsedPoints.length >= 2 ? parsedPoints : fallbackPoints.length >= 2 ? fallbackPoints : DEFAULT_POINTS;

  const modeParam = normalizeParam(params.mode ?? params.transport);
  const mode = modeParam ? normalizeMode(modeParam) : options?.fallbackMode ?? "driving";

  const start = points[0];
  const end = points[points.length - 1];
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

  const routeRequest: OptimizeRouteRequest = useMemo(
    () => ({
      ...requestConfig.request,
      mode
    }),
    [requestConfig.request, mode]
  );

  const fallbackPreviewRoute = useMemo(() => buildFallbackPreviewRoute(routeRequest), [routeRequest]);
  const displayedRoute = optimizedRoute ?? fallbackPreviewRoute;

  const optimizeRouteNow = useCallback(async (options?: { silent?: boolean }) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await optimizeRoute(routeRequest);
      setOptimizedRoute(result);
      await persistOptimizedRoute(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "경로 최적화에 실패했어요.";
      const isSilent = options?.silent ?? false;
      const fallbackMessage = "실시간 최적화 서버 연결에 실패해 예상 경로를 먼저 표시하고 있어요.";
      setErrorMessage(isSilent ? fallbackMessage : message);

      if (!isSilent && Platform.OS !== "web") {
        Alert.alert("경로 최적화 실패", message);
      }
    } finally {
      setLoading(false);
    }
  }, [routeRequest]);

  useEffect(() => {
    if (!hydrated || hasAutoOptimizedRef.current || !requestConfig.hasInputPoints || mode !== requestConfig.mode) {
      return;
    }

    hasAutoOptimizedRef.current = true;
    void optimizeRouteNow({ silent: true });
  }, [hydrated, mode, optimizeRouteNow, requestConfig.hasInputPoints, requestConfig.mode]);

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
          <Text style={styles.routeInfoLabel}>경로</Text>
          <Text style={styles.routeInfoValue}>{formatRouteNames(requestConfig.request)}</Text>

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

          <Text style={styles.routeInfoHint}>{`이동수단: ${modeLabel(mode)}`}</Text>
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
          <RouteMapView route={displayedRoute} mode={mode} />
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
                <Text style={styles.emptyListText}>경로 포인트를 확인하면 구간 리스트가 표시됩니다.</Text>
              </View>
            )}
          </View>
        )}

        {displayedRoute ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{optimizedRoute ? "최적화 결과" : "예상 경로 요약"}</Text>
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
              <Text style={styles.summaryValue}>{displayedRoute.source}</Text>
            </View>
          </View>
        ) : null}

        {displayedRoute?.warnings?.length ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>참고</Text>
            {displayedRoute.warnings.slice(0, 3).map((warning, index) => (
              <Text key={`warning-${index}`} style={styles.warningText}>
                • {warning}
              </Text>
            ))}
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Button
          title="경로 최적화 실행"
          onPress={() => {
            void optimizeRouteNow();
          }}
          loading={loading}
          size="large"
        />

        <Button
          title="일정 타임라인 보기"
          variant="outline"
          onPress={() => router.push("/trip/schedule")}
          size="large"
        />
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
  routeInfoLabel: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
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
