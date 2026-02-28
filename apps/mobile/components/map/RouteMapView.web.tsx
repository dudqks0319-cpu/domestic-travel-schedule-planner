import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import type { OptimizedRoute, RouteTransportMode } from "../../services/routeApi";

interface RouteMapViewProps {
  route: OptimizedRoute | null;
  mode: RouteTransportMode;
  loading?: boolean;
}

type KakaoMapStatus = "idle" | "loading" | "ready" | "error" | "no-key";

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
    maybeProcess?.env?.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY ??
    maybeProcess?.env?.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
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

export default function RouteMapView({ route, mode, loading = false }: RouteMapViewProps) {
  const points = route?.orderedPoints ?? [];
  const modeColor = getModeColor(mode);
  const kakaoMapKey = useMemo(() => readKakaoMapWebKey(), []);
  const [kakaoStatus, setKakaoStatus] = useState<KakaoMapStatus>(kakaoMapKey ? "idle" : "no-key");
  const [kakaoError, setKakaoError] = useState<string | null>(null);
  const mapContainerId = useMemo(
    () => `tripmate-kakao-map-${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    if (!route || points.length === 0) return;

    if (!kakaoMapKey) {
      setKakaoStatus("no-key");
      return;
    }

    let cancelled = false;
    setKakaoStatus("loading");
    setKakaoError(null);

    void loadKakaoMapSdk(kakaoMapKey)
      .then((kakao) => {
        if (cancelled) return;

        const mapContainer = document.getElementById(mapContainerId) as HTMLElement | null;
        if (!mapContainer) {
          throw new Error("Map container is not ready.");
        }

        mapContainer.innerHTML = "";

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
          strokeOpacity: 0.9
        });
        polyline.setMap(map);

        points.forEach((point, index) => {
          const latLng = new kakao.maps.LatLng(point.lat, point.lng);
          const marker = new kakao.maps.Marker({ position: latLng, map });
          marker.setMap(map);

          const badge = document.createElement("div");
          badge.style.width = "28px";
          badge.style.height = "28px";
          badge.style.borderRadius = "14px";
          badge.style.background =
            index === 0
              ? Colors.route.selected
              : index === points.length - 1
                ? Colors.family.primary
                : Colors.young.primary;
          badge.style.color = "#fff";
          badge.style.fontWeight = "700";
          badge.style.fontSize = "12px";
          badge.style.display = "flex";
          badge.style.alignItems = "center";
          badge.style.justifyContent = "center";
          badge.style.border = "2px solid #fff";
          badge.textContent = String(index + 1);

          const overlay = new kakao.maps.CustomOverlay({
            position: latLng,
            content: badge,
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
        if (cancelled) return;
        setKakaoStatus("error");
        setKakaoError(error instanceof Error ? error.message : "Kakao map render failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [kakaoMapKey, mapContainerId, modeColor, points, route]);

  if (loading) {
    return (
      <View style={styles.emptyCard}>
        <ActivityIndicator size="small" color={Colors.young.primary} />
        <Text style={styles.emptyTitle}>경로를 불러오는 중이에요</Text>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>아직 경로가 준비되지 않았어요</Text>
        <Text style={styles.emptyDescription}>
          여행 만들기에서 목적지와 장소를 선택하면 경로 지도를 표시합니다.
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

      <View nativeID={mapContainerId} style={styles.kakaoMap} />

      {kakaoStatus !== "ready" ? (
        <View style={styles.noticeCard}>
          {kakaoStatus === "loading" ? (
            <>
              <ActivityIndicator size="small" color={Colors.young.primary} />
              <Text style={styles.noticeText}>카카오 지도를 불러오는 중이에요...</Text>
            </>
          ) : kakaoStatus === "no-key" ? (
            <Text style={styles.noticeText}>
              웹 지도 키가 없어 미리보기만 표시돼요. `EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`를 확인해주세요.
            </Text>
          ) : (
            <Text style={styles.noticeText}>
              지도 로드 실패: {kakaoError ?? "알 수 없는 오류"}
              {"\n"}카카오 개발자 콘솔의 웹 도메인에 `http://localhost:8081` 등록 여부를 확인해주세요.
            </Text>
          )}
        </View>
      ) : null}
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
    color: Colors.common.gray800
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
  kakaoMap: {
    height: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    overflow: "hidden",
    backgroundColor: "#EAF4FF"
  },
  noticeCard: {
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
  noticeText: {
    ...Typography.normal.caption,
    color: "#8C6D1F",
    flex: 1
  }
});
