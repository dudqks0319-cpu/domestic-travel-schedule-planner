import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import { tripsApi } from "../../services/api";

interface PlaceMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  tripTitle: string;
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
  Marker: new (options: Record<string, unknown>) => { setMap(map: unknown): void };
  CustomOverlay: new (options: Record<string, unknown>) => { setMap(map: unknown): void };
  load(callback: () => void): void;
}

interface KakaoGlobal {
  maps: KakaoMapsApi;
}

const KAKAO_MAP_SCRIPT_ID = "tripmate-kakao-map-sdk-tab";
let kakaoMapSdkPromise: Promise<KakaoGlobal> | null = null;

const KOREA_CENTER = { lat: 36.35, lng: 127.9 };

const CATEGORY_COLORS: Record<string, string> = {
  attraction: Colors.common.markerAttraction,
  restaurant: Colors.common.markerRestaurant,
  cafe: Colors.common.markerCafe,
  hotel: Colors.common.markerHotel
};

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

  const browserWindow = window as Window & { kakao?: KakaoGlobal };

  if (browserWindow.kakao?.maps) {
    return new Promise((resolve) => {
      browserWindow.kakao?.maps.load(() => resolve(browserWindow.kakao as KakaoGlobal));
    });
  }

  if (kakaoMapSdkPromise) {
    return kakaoMapSdkPromise;
  }

  kakaoMapSdkPromise = new Promise((resolve, reject) => {
    const onKakaoReady = () => {
      const currentWindow = window as Window & { kakao?: KakaoGlobal };
      if (!currentWindow.kakao?.maps) {
        kakaoMapSdkPromise = null;
        reject(new Error("Kakao Maps SDK failed to initialize."));
        return;
      }
      currentWindow.kakao.maps.load(() => resolve(currentWindow.kakao as KakaoGlobal));
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

export default function TabMapViewWeb() {
  const [markers, setMarkers] = useState<PlaceMarker[]>([]);
  const [loadingMarkers, setLoadingMarkers] = useState(true);
  const kakaoMapKey = useMemo(() => readKakaoMapWebKey(), []);
  const [kakaoStatus, setKakaoStatus] = useState<KakaoMapStatus>(kakaoMapKey ? "idle" : "no-key");
  const [kakaoError, setKakaoError] = useState<string | null>(null);
  const mapContainerId = useMemo(
    () => `tripmate-kakao-map-tab-${Math.random().toString(36).slice(2)}`,
    []
  );

  const loadMarkers = useCallback(async () => {
    setLoadingMarkers(true);
    try {
      const res = await tripsApi.list();
      const trips = res.data.trips ?? [];
      const allMarkers: PlaceMarker[] = [];

      for (const trip of trips) {
        const days = (trip as { days?: Array<{ places?: Array<Record<string, unknown>> }> }).days ?? [];
        for (const day of days) {
          const places = day.places ?? [];
          for (const place of places) {
            if (typeof place.lat === "number" && typeof place.lng === "number") {
              allMarkers.push({
                id: String(place.id ?? `${trip.id}-${place.name}`),
                name: String(place.name ?? "장소"),
                lat: place.lat,
                lng: place.lng,
                category: String(place.category ?? "attraction"),
                tripTitle: String((trip as { title?: string }).title ?? "여행")
              });
            }
          }
        }
      }

      setMarkers(allMarkers);
    } catch {
      setMarkers([]);
    } finally {
      setLoadingMarkers(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkers();
  }, [loadMarkers]);

  useEffect(() => {
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

        const defaultCenter = new kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng);
        const map = new kakao.maps.Map(mapContainer, {
          center: defaultCenter,
          level: 13
        });

        if (markers.length > 0) {
          const bounds = new kakao.maps.LatLngBounds();
          markers.forEach((marker, index) => {
            const latLng = new kakao.maps.LatLng(marker.lat, marker.lng);
            bounds.extend(latLng);

            const mapMarker = new kakao.maps.Marker({
              position: latLng,
              map
            });
            mapMarker.setMap(map);

            const badge = document.createElement("div");
            badge.style.minWidth = "20px";
            badge.style.height = "20px";
            badge.style.padding = "0 6px";
            badge.style.borderRadius = "10px";
            badge.style.background = CATEGORY_COLORS[marker.category] ?? Colors.young.primary;
            badge.style.color = "#fff";
            badge.style.fontWeight = "700";
            badge.style.fontSize = "11px";
            badge.style.display = "flex";
            badge.style.alignItems = "center";
            badge.style.justifyContent = "center";
            badge.style.border = "1px solid #fff";
            badge.textContent = String(index + 1);

            const overlay = new kakao.maps.CustomOverlay({
              position: latLng,
              content: badge,
              yAnchor: 1.9
            });
            overlay.setMap(map);
          });

          map.setBounds(bounds);
        } else {
          map.setCenter(defaultCenter);
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
  }, [kakaoMapKey, mapContainerId, markers]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 여행 지도</Text>
        <Text style={styles.headerSub}>
          {loadingMarkers
            ? "여행 장소를 불러오는 중..."
            : markers.length > 0
              ? `${markers.length}곳 표시 중`
              : "로그인/일정 생성 후 마커가 표시됩니다"}
        </Text>
      </View>

      <View nativeID={mapContainerId} style={styles.kakaoMap} />

      {kakaoStatus !== "ready" ? (
        <View style={styles.noticeCard}>
          {kakaoStatus === "loading" ? (
            <>
              <ActivityIndicator size="small" color={Colors.young.primary} />
              <Text style={styles.noticeText}>카카오 지도를 불러오는 중입니다...</Text>
            </>
          ) : kakaoStatus === "no-key" ? (
            <View style={styles.noticeTextWrap}>
              <Text style={styles.noticeTitle}>카카오 웹 지도 키 필요</Text>
              <Text style={styles.noticeText}>`EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`를 확인해주세요.</Text>
            </View>
          ) : (
            <View style={styles.noticeTextWrap}>
              <Text style={styles.noticeTitle}>카카오 지도 로드 실패</Text>
              <Text style={styles.noticeText}>원인: {kakaoError ?? "알 수 없는 오류"}</Text>
              <Text style={styles.noticeText}>카카오 개발자 콘솔 웹 도메인에 `http://localhost:8081` 등록이 필요합니다.</Text>
            </View>
          )}
        </View>
      ) : null}

      {loadingMarkers ? (
        <View style={styles.infoCard}>
          <ActivityIndicator size="small" color={Colors.young.primary} />
          <Text style={styles.infoText}>마커 데이터 조회 중...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA", padding: Spacing.screenPadding, gap: Spacing.md },
  header: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.gray100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm
  },
  headerTitle: { ...Typography.normal.h3, color: Colors.common.black },
  headerSub: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 4 },
  kakaoMap: {
    flex: 1,
    minHeight: 440,
    borderRadius: 16,
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
    alignItems: "flex-start",
    gap: Spacing.xs
  },
  noticeTextWrap: { flex: 1 },
  noticeTitle: {
    ...Typography.normal.bodySmall,
    color: "#8C6D1F",
    fontWeight: "700",
    marginBottom: 2
  },
  noticeText: { ...Typography.normal.caption, color: "#8C6D1F", lineHeight: 18 },
  infoCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm
  },
  infoText: { ...Typography.normal.caption, color: Colors.common.gray600 },
});
