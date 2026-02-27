import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import type { OptimizedRoute, RouteTransportMode } from "../../services/routeApi";

interface RouteMapViewProps {
  route: OptimizedRoute | null;
  mode: RouteTransportMode;
}

function getModeLabel(mode: RouteTransportMode): string {
  if (mode === "transit") return "대중교통";
  if (mode === "walking") return "도보";
  return "자동차";
}

function getModeColor(mode: RouteTransportMode): string {
  if (mode === "transit") return Colors.route.transit;
  if (mode === "walking") return Colors.route.walk;
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

export default function RouteMapView({ route, mode }: RouteMapViewProps) {
  const modeColor = getModeColor(mode);
  const mapRef = useRef<MapView>(null);
  const points = route?.orderedPoints ?? [];

  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;

    const coordinates = points.map((point) => ({
      latitude: point.lat,
      longitude: point.lng
    }));

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [points]);

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

      <MapView
        ref={mapRef}
        style={styles.nativeMap}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: points[0]?.lat ?? 33.4996,
          longitude: points[0]?.lng ?? 126.5312,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15
        }}
        showsCompass
        showsScale
        showsUserLocation
      >
        {route.segments.map((segment, index) => (
          <Polyline
            key={`${segment.from.id ?? index}-${segment.to.id ?? index + 1}`}
            coordinates={[
              { latitude: segment.from.lat, longitude: segment.from.lng },
              { latitude: segment.to.lat, longitude: segment.to.lng }
            ]}
            strokeColor={modeColor}
            strokeWidth={4}
            lineDashPattern={mode === "walking" ? [8, 6] : undefined}
          />
        ))}

        {points.map((point, index) => (
          <Marker
            key={`${point.id ?? index}-${index}`}
            coordinate={{ latitude: point.lat, longitude: point.lng }}
            title={`${index + 1}. ${point.name ?? `Point ${index + 1}`}`}
            pinColor={
              index === 0
                ? Colors.route.selected
                : index === points.length - 1
                  ? Colors.family.primary
                  : Colors.young.primary
            }
          />
        ))}
      </MapView>

      <Text style={styles.routeHint}>시작/경유/도착 지점은 숫자 순서대로 이동합니다.</Text>
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
  nativeMap: {
    height: 320,
    borderRadius: 20
  },
  routeHint: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  }
});
