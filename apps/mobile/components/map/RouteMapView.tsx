import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import type { OptimizedRoute, RoutePoint, RouteTransportMode } from "../../services/routeApi";

interface RouteMapViewProps {
  route: OptimizedRoute | null;
  mode: RouteTransportMode;
  loading?: boolean;
}

type KakaoMapStatus = "idle" | "loading" | "ready" | "error" | "no-key";

interface MarkerPosition {
  point: RoutePoint;
  order: number;
  leftPercent: number;
  topPercent: number;
}

interface MarkerConnection {
  id: string;
  length: number;
  centerX: number;
  centerY: number;
  angleDeg: number;
}

interface KakaoLatLng {
  new (lat: number, lng: number): unknown;
}

interface KakaoBounds {
  extend(value: unknown): void;
}

interface KakaoMapsApi {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => {
    setBounds(bounds: KakaoBounds): void;
    setCenter(latLng: unknown): void;
  };
  LatLng: KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Polyline: new (options: Record<string, unknown>) => { setMap(map: unknown): void };
  Marker: new (options: Record<string, unknown>) => { setMap(map: unknown): void };
  CustomOverlay: new (options: Record<string, unknown>) => { setMap(map: unknown): void };
  load(callback: () => void): void;
}

interface KakaoGlobal {
  maps: KakaoMapsApi;
}

declare global {
  interface Window {
    kakao?: KakaoGlobal;
  }
}

const KAKAO_MAP_SCRIPT_ID = "tripmate-kakao-map-sdk";
let kakaoMapSdkPromise: Promise<KakaoGlobal> | null = null;

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

function readKakaoMapWebKey(): string | undefined {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  const candidate =
    maybeProcess?.env?.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY ?? maybeProcess?.env?.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
  const trimmed = candidate?.trim();
  return trimmed ? trimmed : undefined;
}

function loadKakaoMapSdk(appKey: string): Promise<KakaoGlobal> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Kakao map is only available on web."));
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao?.maps.load(() => resolve(window.kakao as KakaoGlobal));
    });
  }

  if (kakaoMapSdkPromise) {
    return kakaoMapSdkPromise;
  }

  kakaoMapSdkPromise = new Promise((resolve, reject) => {
    const onKakaoReady = () => {
      if (!window.kakao?.maps) {
        kakaoMapSdkPromise = null;
        reject(new Error("Kakao Maps SDK failed to initialize."));
        return;
      }

      window.kakao.maps.load(() => resolve(window.kakao as KakaoGlobal));
    };

    const existing = document.getElementById(KAKAO_MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", onKakaoReady, { once: true });
      existing.addEventListener(
        "error",
        () => {
          kakaoMapSdkPromise = null;
          reject(new Error("Failed to load Kakao Maps SDK script."));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = KAKAO_MAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;

    script.onload = onKakaoReady;
    script.onerror = () => {
      kakaoMapSdkPromise = null;
      reject(new Error("Failed to load Kakao Maps SDK script."));
    };

    document.head.appendChild(script);
  });

  return kakaoMapSdkPromise;
}

function toMarkerPositions(points: RoutePoint[]): MarkerPosition[] {
  if (points.length === 0) return [];

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);

  return points.map((point, index) => {
    const leftRatio = (point.lng - minLng) / lngRange;
    const topRatio = (maxLat - point.lat) / latRange;

    return {
      point,
      order: index + 1,
      leftPercent: 8 + leftRatio * 84,
      topPercent: 8 + topRatio * 84
    };
  });
}

function toMarkerConnections(
  positions: MarkerPosition[],
  canvasWidth: number,
  canvasHeight: number
): MarkerConnection[] {
  if (positions.length < 2 || canvasWidth <= 0 || canvasHeight <= 0) {
    return [];
  }

  return positions.slice(0, -1).map((position, index) => {
    const next = positions[index + 1];
    const fromX = (position.leftPercent / 100) * canvasWidth;
    const fromY = (position.topPercent / 100) * canvasHeight;
    const toX = (next.leftPercent / 100) * canvasWidth;
    const toY = (next.topPercent / 100) * canvasHeight;
    const dx = toX - fromX;
    const dy = toY - fromY;

    return {
      id: `${position.point.id ?? position.order}-${next.point.id ?? next.order}-${index}`,
      length: Math.max(Math.sqrt(dx * dx + dy * dy), 8),
      centerX: fromX + dx / 2,
      centerY: fromY + dy / 2,
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI
    };
  });
}

function fallbackPointName(order: number, totalCount: number): string {
  if (order === 1) {
    return "출발지";
  }

  if (order === totalCount) {
    return "도착지";
  }

  return `경유지 ${order - 1}`;
}

export default function RouteMapView({ route, mode, loading = false }: RouteMapViewProps) {
  const points = route?.orderedPoints ?? [];
  const positions = useMemo(() => toMarkerPositions(points), [points]);
  const modeColor = getModeColor(mode);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const mapContainerIdRef = useRef(`tripmate-kakao-map-${Math.random().toString(36).slice(2)}`);
  const mapContainerRef = useRef<View | null>(null);
  const kakaoMapKey = useMemo(() => readKakaoMapWebKey(), []);
  const [kakaoStatus, setKakaoStatus] = useState<KakaoMapStatus>(kakaoMapKey ? "idle" : "no-key");
  const [kakaoError, setKakaoError] = useState<string | null>(null);
  const connections = useMemo(
    () => toMarkerConnections(positions, canvasSize.width, canvasSize.height),
    [positions, canvasSize.width, canvasSize.height]
  );

  const handleMapLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize((prev) => {
      if (prev.width === width && prev.height === height) {
        return prev;
      }

      return { width, height };
    });
  };

  useEffect(() => {
    if (!route || points.length === 0) {
      return;
    }

    if (!kakaoMapKey) {
      setKakaoStatus("no-key");
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    let cancelled = false;
    setKakaoStatus("loading");
    setKakaoError(null);

    void loadKakaoMapSdk(kakaoMapKey)
      .then((kakao) => {
        if (cancelled) {
          return;
        }

        const mapContainer =
          ((mapContainerRef.current as unknown as HTMLElement | null) ??
            document.getElementById(mapContainerIdRef.current)) as HTMLElement | null;

        if (!mapContainer) {
          throw new Error("Map container is not ready.");
        }

        const center = new kakao.maps.LatLng(points[0].lat, points[0].lng);
        const map = new kakao.maps.Map(mapContainer, {
          center,
          level: 7
        });

        const bounds = new kakao.maps.LatLngBounds();
        const path = points.map((point) => {
          const latLng = new kakao.maps.LatLng(point.lat, point.lng);
          bounds.extend(latLng);
          return latLng;
        });

        const polyline = new kakao.maps.Polyline({
          map,
          path,
          strokeWeight: 5,
          strokeColor: modeColor,
          strokeOpacity: 0.85
        });
        polyline.setMap(map);

        points.forEach((point, index) => {
          const latLng = new kakao.maps.LatLng(point.lat, point.lng);
          const marker = new kakao.maps.Marker({
            position: latLng,
            map
          });
          marker.setMap(map);

          const orderBadge = document.createElement("div");
          orderBadge.style.width = "28px";
          orderBadge.style.height = "28px";
          orderBadge.style.borderRadius = "14px";
          orderBadge.style.background = index === 0 ? Colors.route.selected : index === points.length - 1 ? Colors.family.primary : Colors.young.primary;
          orderBadge.style.color = "#fff";
          orderBadge.style.fontWeight = "700";
          orderBadge.style.fontSize = "12px";
          orderBadge.style.display = "flex";
          orderBadge.style.alignItems = "center";
          orderBadge.style.justifyContent = "center";
          orderBadge.style.border = "2px solid #fff";
          orderBadge.textContent = String(index + 1);

          const overlay = new kakao.maps.CustomOverlay({
            position: latLng,
            content: orderBadge,
            yAnchor: 1.9
          });
          overlay.setMap(map);
        });

        if (path.length > 1) {
          map.setBounds(bounds);
        } else {
          map.setCenter(center);
        }

        setKakaoStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Kakao map render failed.";
        setKakaoStatus("error");
        setKakaoError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [kakaoMapKey, modeColor, points, route]);

  const renderFallbackCanvas = () => (
    <View style={styles.mapCanvas} onLayout={handleMapLayout}>
      <View style={styles.canvasDecorLarge} />
      <View style={styles.canvasDecorSmall} />
      <View pointerEvents="none" style={styles.connectionLayer}>
        {connections.map((connection) => (
          <View
            key={connection.id}
            style={[
              styles.connectionLine,
              {
                width: connection.length,
                left: connection.centerX,
                top: connection.centerY,
                transform: [
                  { translateX: -connection.length / 2 },
                  { translateY: -1.5 },
                  { rotate: `${connection.angleDeg}deg` }
                ]
              }
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
              {item.point.name ?? fallbackPointName(item.order, positions.length)}
            </Text>
          </View>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.emptyCard}>
        <ActivityIndicator size="small" color={Colors.young.primary} />
        <Text style={styles.emptyTitle}>경로를 불러오는 중이에요</Text>
        <Text style={styles.emptyDescription}>저장된 여행 정보를 확인하고 있어요. 잠시만 기다려주세요.</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>아직 경로가 준비되지 않았어요</Text>
        <Text style={styles.emptyDescription}>
          여행 만들기에서 목적지와 장소를 선택하면 실제 이동 경로를 바로 확인할 수 있어요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        {route.source === "fallback" ? (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackBadgeText}>예상 경로</Text>
          </View>
        ) : null}
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

      {kakaoStatus === "ready" ? (
        <View ref={mapContainerRef} nativeID={mapContainerIdRef.current} style={styles.kakaoMap} />
      ) : (
        <>
          {renderFallbackCanvas()}
          <View style={styles.kakaoStatusCard}>
            {kakaoStatus === "loading" ? (
              <>
                <ActivityIndicator size="small" color={Colors.young.primary} />
                <Text style={styles.kakaoStatusText}>카카오 지도를 불러오는 중이에요...</Text>
              </>
            ) : kakaoStatus === "no-key" ? (
              <Text style={styles.kakaoStatusText}>
                카카오 지도 키가 없어 미리보기 지도로 표시 중이에요. `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`를 설정해주세요.
              </Text>
            ) : kakaoStatus === "error" ? (
              <Text style={styles.kakaoStatusText}>
                카카오 지도 로드 실패: {kakaoError ?? "알 수 없는 오류"} (도메인 등록/JavaScript 키 확인 필요)
              </Text>
            ) : null}
          </View>
        </>
      )}

      <Text style={styles.routeHint}>
        {kakaoStatus === "ready"
          ? "카카오 지도 기준으로 지점 번호 순서 이동 경로를 표시하고 있어요."
          : route.source === "fallback"
            ? "실시간 길찾기 연결 전이라 예상 이동 경로를 먼저 보여드리고 있어요."
            : "지점 번호 순서대로 이동 경로를 확인할 수 있어요."}
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
    padding: Spacing.xxl,
    alignItems: "center"
  },
  emptyTitle: {
    ...Typography.normal.h3,
    color: Colors.common.gray800,
    marginTop: Spacing.md
  },
  emptyDescription: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray600,
    marginTop: Spacing.sm,
    textAlign: "center"
  },
  summaryCard: {
    backgroundColor: Colors.common.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    padding: Spacing.lg
  },
  fallbackBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: "#FFF4E6",
    marginBottom: Spacing.sm
  },
  fallbackBadgeText: {
    ...Typography.normal.caption,
    color: "#AD6800",
    fontWeight: "700"
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
    height: 320,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: "#F3F8FF",
    overflow: "hidden",
    position: "relative"
  },
  canvasDecorLarge: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#E3EEFC",
    right: -80,
    top: -70
  },
  canvasDecorSmall: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#ECF4FF",
    left: -70,
    bottom: -50
  },
  connectionLayer: {
    ...StyleSheet.absoluteFillObject
  },
  connectionLine: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(74, 144, 226, 0.42)"
  },
  markerWrap: {
    position: "absolute",
    marginLeft: -20,
    marginTop: -20,
    alignItems: "center",
    maxWidth: 96,
    zIndex: 1
  },
  kakaoMap: {
    height: 320,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    overflow: "hidden",
    backgroundColor: Colors.common.white
  },
  kakaoStatusCard: {
    marginTop: -2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE58F",
    backgroundColor: "#FFFBE6",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs
  },
  kakaoStatusText: {
    ...Typography.normal.caption,
    color: "#8C6D1F",
    flex: 1
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
    textAlign: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  routeHint: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  }
});
