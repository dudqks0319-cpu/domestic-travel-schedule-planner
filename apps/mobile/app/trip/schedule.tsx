import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Button from "../../components/common/Button";
import Header from "../../components/common/Header";
import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import { loadPersistedOptimizedRoute, type OptimizedRoute, type RoutePoint } from "../../services/routeApi";

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

type DayRow = {
  id: string;
  type: "stop" | "move";
  timeText: string;
  title: string;
  detail: string;
};

const CURRENT_TRIP_STORAGE_KEY = "currentTrip";
const STOP_DWELL_MINUTES = 60;

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
  const daysCount = Math.max(1, Math.min(daysFromTrip, Math.max(1, segmentCount)));
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
        detail: `위도 ${firstPoint.lat.toFixed(4)} · 경도 ${firstPoint.lng.toFixed(4)}`
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
    detail: `위도 ${firstSegment.from.lat.toFixed(4)} · 경도 ${firstSegment.from.lng.toFixed(4)}`
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
      detail: `위도 ${segment.to.lat.toFixed(4)} · 경도 ${segment.to.lng.toFixed(4)}`
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
  const [tripMeta, setTripMeta] = useState<TripMeta>({ destination: "여행", startDate: "", endDate: "" });
  const [loading, setLoading] = useState(true);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

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
          setTripMeta(parseTripMeta(parsedCurrentTrip));
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
  const dayTabs = useMemo(
    () => (displayedRoute ? buildDayTabs(displayedRoute, tripMeta) : []),
    [displayedRoute, tripMeta]
  );

  useEffect(() => {
    if (activeDayIndex >= dayTabs.length) {
      setActiveDayIndex(0);
    }
  }, [activeDayIndex, dayTabs.length]);

  const activeDay = dayTabs[activeDayIndex] ?? null;
  const dayRows = useMemo(() => {
    if (!displayedRoute || !activeDay) {
      return [];
    }

    return buildDayRows(displayedRoute, activeDay);
  }, [displayedRoute, activeDay]);

  const isFallbackTimeline = !route && !!fallbackRoute;

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

          {!loading && !displayedRoute ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>표시할 일정 데이터가 없어요</Text>
              <Text style={styles.emptyDescription}>
                여행 생성 후 경로 최적화를 실행하면 일차별 일정표가 자동으로 생성됩니다.
              </Text>
              <View style={styles.emptyActions}>
                <Button title="경로 최적화 하러가기" onPress={() => router.push("/trip/route-map")} />
              </View>
            </View>
          ) : null}

          {displayedRoute ? (
            <>
              {isFallbackTimeline ? (
                <View style={styles.fallbackNoticeCard}>
                  <Text style={styles.fallbackNoticeText}>
                    최적화 결과가 없어 현재 여행의 저장된 경유지 순서로 임시 일정표를 보여드리고 있어요.
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

              <View style={styles.bottomActions}>
                <Button title="경로 지도 보기" variant="outline" onPress={() => router.push("/trip/route-map")} />
                <Button title="홈으로" onPress={() => router.replace("/(tabs)")} />
              </View>
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
    backgroundColor: Colors.common.gray50
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 520 : "100%",
    alignSelf: "center"
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
  dayTabRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.md
  },
  dayTab: {
    backgroundColor: Colors.common.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 116
  },
  dayTabActive: {
    borderColor: Colors.young.primary,
    backgroundColor: "#EAF4FF"
  },
  dayTabTitle: {
    ...Typography.normal.caption,
    color: Colors.common.gray700,
    fontWeight: "700"
  },
  dayTabTitleActive: {
    color: Colors.young.primary
  },
  dayTabDate: {
    ...Typography.normal.caption,
    color: Colors.common.gray500,
    marginTop: 2
  },
  dayTabDateActive: {
    color: Colors.young.primary
  },
  tableCard: {
    backgroundColor: Colors.common.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    overflow: "hidden"
  },
  activeDaySummary: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F7FAFF",
    borderBottomWidth: 1,
    borderBottomColor: Colors.common.gray200
  },
  activeDaySummaryTitle: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    fontWeight: "700"
  },
  activeDaySummaryDate: {
    ...Typography.normal.caption,
    color: Colors.common.gray600,
    marginTop: 3
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#EEF3FA",
    borderBottomWidth: 1,
    borderBottomColor: Colors.common.gray200,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 10
  },
  tableHeaderText: {
    ...Typography.normal.caption,
    color: Colors.common.gray700,
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
    backgroundColor: "#FBF8FF"
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
    color: Colors.common.gray700,
    fontWeight: "700"
  },
  typeBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  stopBadge: {
    backgroundColor: "#EAF4FF"
  },
  moveBadge: {
    backgroundColor: "#F4ECFF"
  },
  typeBadgeText: {
    ...Typography.normal.caption,
    fontWeight: "700"
  },
  stopBadgeText: {
    color: Colors.young.primary
  },
  moveBadgeText: {
    color: "#7A4CC9"
  },
  tableTitle: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    fontWeight: "700"
  },
  tableDetail: {
    ...Typography.normal.caption,
    color: Colors.common.gray600,
    marginTop: 4
  },
  emptyDayRow: {
    paddingHorizontal: 12,
    paddingVertical: 16
  },
  emptyDayText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray500
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
