import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Button from "../../components/common/Button";
import Header from "../../components/common/Header";
import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import { loadPersistedOptimizedRoute, type OptimizedRoute, type RoutePoint } from "../../services/routeApi";

type TimelineEntry =
  | {
      id: string;
      type: "stop";
      point: RoutePoint;
      timeMinutes: number;
      order: number;
      color: string;
    }
  | {
      id: string;
      type: "move";
      from: RoutePoint;
      to: RoutePoint;
      distanceKm: number;
      durationMin: number;
      startMinutes: number;
      endMinutes: number;
      provider: string;
    };

const DAY_COLORS = [
  Colors.schedule.day1,
  Colors.schedule.day2,
  Colors.schedule.day3,
  Colors.schedule.day4,
  Colors.schedule.day5
];
const CURRENT_TRIP_STORAGE_KEY = "currentTrip";

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

function parseCurrentTripPoints(rawTrip: unknown): RoutePoint[] {
  if (!rawTrip || typeof rawTrip !== "object") {
    return [];
  }

  const value = rawTrip as Record<string, unknown>;
  const routePoints = value.routePoints;

  if (!Array.isArray(routePoints)) {
    return [];
  }

  return routePoints
    .map((item, index) => toRoutePoint(item, index))
    .filter((item): item is RoutePoint => item !== null);
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

function pointLabel(point: RoutePoint, order: number): string {
  return point.name ?? `지점 ${order + 1}`;
}

function buildTimeline(route: OptimizedRoute): TimelineEntry[] {
  if (!route.orderedPoints.length) {
    return [];
  }

  const timeline: TimelineEntry[] = [];
  let cursor = 9 * 60;

  timeline.push({
    id: `stop-0`,
    type: "stop",
    point: route.orderedPoints[0],
    timeMinutes: cursor,
    order: 0,
    color: DAY_COLORS[0]
  });

  route.segments.forEach((segment, index) => {
    const startMinutes = cursor;
    const duration = Math.max(1, Math.round(segment.durationMin));
    const endMinutes = startMinutes + duration;

    timeline.push({
      id: `move-${index}`,
      type: "move",
      from: segment.from,
      to: segment.to,
      distanceKm: segment.distanceKm,
      durationMin: segment.durationMin,
      startMinutes,
      endMinutes,
      provider: segment.provider
    });

    cursor = endMinutes;

    const arrivalPoint = route.orderedPoints[index + 1] ?? segment.to;
    timeline.push({
      id: `stop-${index + 1}`,
      type: "stop",
      point: arrivalPoint,
      timeMinutes: cursor,
      order: index + 1,
      color: DAY_COLORS[(index + 1) % DAY_COLORS.length]
    });
  });

  return timeline;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [currentTripPoints, setCurrentTripPoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(true);

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

        setRoute(savedRoute);

        if (rawCurrentTrip) {
          const parsedCurrentTrip = JSON.parse(rawCurrentTrip) as unknown;
          setCurrentTripPoints(parseCurrentTripPoints(parsedCurrentTrip));
        }
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

  const fallbackRoute = useMemo(() => buildFallbackRoute(currentTripPoints), [currentTripPoints]);
  const displayedRoute = route ?? fallbackRoute;
  const timeline = useMemo(() => (displayedRoute ? buildTimeline(displayedRoute) : []), [displayedRoute]);
  const isFallbackTimeline = !route && !!fallbackRoute;

  return (
    <View style={styles.container}>
      <Header
        title="일정 타임라인"
        subtitle="최적 경로 인포그래픽"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>일정을 불러오는 중...</Text>
          </View>
        ) : null}

        {!loading && !displayedRoute ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>표시할 일정 데이터가 없어요</Text>
            <Text style={styles.emptyDescription}>
              여행 생성 후 경로 최적화를 실행하면 일정 타임라인이 자동으로 생성됩니다.
            </Text>
            <View style={styles.emptyActions}>
              <Button
                title="경로 최적화 하러가기"
                onPress={() => router.push("/trip/route-map")}
              />
            </View>
          </View>
        ) : null}

        {displayedRoute ? (
          <>
            {isFallbackTimeline ? (
              <View style={styles.fallbackNoticeCard}>
                <Text style={styles.fallbackNoticeText}>
                  최적화 결과가 없어 현재 여행의 저장된 경유지 순서로 임시 타임라인을 보여드리고 있어요.
                </Text>
              </View>
            ) : null}

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>총 거리</Text>
                <Text style={styles.summaryValue}>{displayedRoute.totalDistanceKm.toFixed(1)} km</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>총 이동시간</Text>
                <Text style={styles.summaryValue}>{formatDuration(displayedRoute.totalDurationMin)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>구간 수</Text>
                <Text style={styles.summaryValue}>{displayedRoute.segments.length}개</Text>
              </View>
            </View>

            <View style={styles.timelineContainer}>
              {timeline.map((entry, index) => {
                const hasNext = index < timeline.length - 1;

                return (
                  <View key={entry.id} style={styles.timelineRow}>
                    <View style={styles.railColumn}>
                      <View
                        style={[
                          styles.railDot,
                          entry.type === "stop" ? { backgroundColor: entry.color } : styles.moveDot
                        ]}
                      />
                      {hasNext ? <View style={styles.railConnector} /> : null}
                    </View>

                    <View style={[styles.timelineCard, entry.type === "stop" ? styles.stopCard : styles.moveCard]}>
                      {entry.type === "stop" ? (
                        <>
                          <Text style={styles.entryTime}>{formatClock(entry.timeMinutes)}</Text>
                          <Text style={styles.entryTitle}>{pointLabel(entry.point, entry.order)}</Text>
                          <Text style={styles.entrySub}>
                            {`위도 ${entry.point.lat.toFixed(4)} · 경도 ${entry.point.lng.toFixed(4)}`}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.entryTime}>
                            {`${formatClock(entry.startMinutes)} → ${formatClock(entry.endMinutes)}`}
                          </Text>
                          <Text style={styles.entryTitle}>
                            {`${entry.from.name ?? "출발"} → ${entry.to.name ?? "도착"}`}
                          </Text>
                          <Text style={styles.entrySub}>
                            {`${entry.distanceKm.toFixed(1)} km · ${formatDuration(entry.durationMin)} · ${entry.provider}`}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
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
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 36,
    gap: Spacing.lg
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
    gap: Spacing.sm
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.common.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm
  },
  summaryLabel: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  },
  summaryValue: {
    ...Typography.normal.bodySmall,
    marginTop: 4,
    color: Colors.common.gray800,
    fontWeight: "700"
  },
  timelineContainer: {
    backgroundColor: Colors.common.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    padding: Spacing.lg
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  railColumn: {
    width: 28,
    alignItems: "center"
  },
  railDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 12
  },
  moveDot: {
    backgroundColor: Colors.schedule.travel
  },
  railConnector: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.common.gray300,
    marginTop: 6
  },
  timelineCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  stopCard: {
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.schedule.attraction
  },
  moveCard: {
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.schedule.travel
  },
  entryTime: {
    ...Typography.normal.caption,
    color: Colors.common.gray600,
    fontWeight: "700"
  },
  entryTitle: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    marginTop: 4,
    fontWeight: "700"
  },
  entrySub: {
    ...Typography.normal.caption,
    color: Colors.common.gray600,
    marginTop: 4
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
