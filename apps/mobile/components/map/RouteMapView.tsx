import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import type { OptimizedRoute, RoutePoint, RouteTransportMode } from "../../services/routeApi";

interface RouteMapViewProps {
  route: OptimizedRoute | null;
  mode: RouteTransportMode;
}

interface MarkerPosition {
  point: RoutePoint;
  order: number;
  leftPercent: number;
  topPercent: number;
}

function getModeLabel(mode: RouteTransportMode): string {
  if (mode === "transit") {
    return "대중교통";
  }

  if (mode === "walking") {
    return "도보";
  }

  return "자동차";
}

function getModeColor(mode: RouteTransportMode): string {
  if (mode === "transit") {
    return Colors.route.transit;
  }

  if (mode === "walking") {
    return Colors.route.walk;
  }

  return Colors.route.car;
}

function formatDistance(distanceKm: number): string {
  return `${distanceKm.toFixed(1)} km`;
}

function formatDuration(durationMin: number): string {
  if (durationMin >= 60) {
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return `${hours}시간 ${mins}분`;
  }

  return `${Math.round(durationMin)}분`;
}

function toMarkerPositions(points: RoutePoint[]): MarkerPosition[] {
  if (points.length === 0) {
    return [];
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);
  const paddedMinPercent = 8;
  const paddedRangePercent = 84;

  return points.map((point, index) => {
    const leftRatio = (point.lng - minLng) / lngRange;
    const topRatio = (maxLat - point.lat) / latRange;

    return {
      point,
      order: index + 1,
      leftPercent: paddedMinPercent + leftRatio * paddedRangePercent,
      topPercent: paddedMinPercent + topRatio * paddedRangePercent
    };
  });
}

export default function RouteMapView({ route, mode }: RouteMapViewProps) {
  const points = route?.orderedPoints ?? [];
  const positions = useMemo(() => toMarkerPositions(points), [points]);
  const modeColor = getModeColor(mode);

  if (!route) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>최적 경로가 아직 없어요</Text>
        <Text style={styles.emptyDescription}>
          아래 버튼으로 경로 최적화를 실행하면 지도와 상세 경로를 확인할 수 있어요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>이동수단</Text>
          <Text style={[styles.summaryValue, { color: modeColor }]}>{getModeLabel(mode)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>총 거리</Text>
          <Text style={styles.summaryValue}>{formatDistance(route.totalDistanceKm)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>예상 시간</Text>
          <Text style={styles.summaryValue}>{formatDuration(route.totalDurationMin)}</Text>
        </View>
      </View>

      <View style={styles.mapCanvas}>
        <View style={styles.gridLayer}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View
              key={`h-${index}`}
              style={[
                styles.gridLineHorizontal,
                { top: `${(index + 1) * 20}%` }
              ]}
            />
          ))}
          {Array.from({ length: 4 }).map((_, index) => (
            <View
              key={`v-${index}`}
              style={[
                styles.gridLineVertical,
                { left: `${(index + 1) * 20}%` }
              ]}
            />
          ))}
        </View>

        {positions.map((item, index) => {
          const isStart = index === 0;
          const isEnd = index === positions.length - 1;
          const markerStyle = isStart ? styles.startMarker : isEnd ? styles.endMarker : styles.midMarker;

          return (
            <View
              key={`${item.point.id ?? item.order}-${item.order}`}
              style={[
                styles.markerWrap,
                {
                  left: `${item.leftPercent}%`,
                  top: `${item.topPercent}%`
                }
              ]}
            >
              <View style={[styles.marker, markerStyle]}>
                <Text style={styles.markerText}>{item.order}</Text>
              </View>
              <Text numberOfLines={1} style={styles.markerLabel}>
                {item.point.name ?? `Point ${item.order}`}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.routeHint}>
        시작/경유/도착 지점은 숫자 순서대로 이동합니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg
  },
  emptyCard: {
    backgroundColor: Colors.common.white,
    borderRadius: 20,
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
  summaryCard: {
    backgroundColor: Colors.common.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    padding: Spacing.lg
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm
  },
  summaryLabel: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray600
  },
  summaryValue: {
    ...Typography.normal.body,
    fontWeight: "700",
    color: Colors.common.gray800
  },
  mapCanvas: {
    height: 280,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.gray50,
    overflow: "hidden",
    position: "relative"
  },
  gridLayer: {
    ...StyleSheet.absoluteFillObject
  },
  gridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.common.gray200
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderLeftColor: Colors.common.gray200
  },
  markerWrap: {
    position: "absolute",
    marginLeft: -20,
    marginTop: -20,
    alignItems: "center",
    maxWidth: 90
  },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.common.white
  },
  startMarker: {
    backgroundColor: Colors.route.selected
  },
  midMarker: {
    backgroundColor: Colors.young.primary
  },
  endMarker: {
    backgroundColor: Colors.family.primary
  },
  markerText: {
    ...Typography.normal.caption,
    fontWeight: "700",
    color: Colors.common.white
  },
  markerLabel: {
    ...Typography.normal.caption,
    color: Colors.common.gray700,
    marginTop: 4,
    textAlign: "center"
  },
  routeHint: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  }
});
