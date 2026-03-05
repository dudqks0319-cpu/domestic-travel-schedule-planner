import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";
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

const CATEGORY_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  attraction: { label: "관광지", color: "#4A90E2", icon: "camera-outline" },
  restaurant: { label: "맛집", color: "#FF7A59", icon: "restaurant-outline" },
  cafe: { label: "카페", color: "#8C7AE6", icon: "cafe-outline" },
  hotel: { label: "숙소", color: "#24B47E", icon: "bed-outline" }
};

function readKakaoMapWebKey(): string | undefined {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  const candidate = maybeProcess?.env?.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY;
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
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const kakaoMapKey = useMemo(() => readKakaoMapWebKey(), []);
  const [kakaoStatus, setKakaoStatus] = useState<KakaoMapStatus>(kakaoMapKey ? "idle" : "no-key");
  const [kakaoError, setKakaoError] = useState<string | null>(null);
  const mapContainerId = useMemo(() => `tripmate-kakao-map-tab-${Math.random().toString(36).slice(2)}`, []);

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
      setSelectedMarkerId(allMarkers[0]?.id ?? null);
    } catch {
      setMarkers([]);
      setSelectedMarkerId(null);
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
            badge.style.minWidth = "24px";
            badge.style.height = "24px";
            badge.style.padding = "0 6px";
            badge.style.borderRadius = "12px";
            badge.style.background = CATEGORY_META[marker.category]?.color ?? Theme.colors.primary;
            badge.style.color = "#fff";
            badge.style.fontWeight = "700";
            badge.style.fontSize = "11px";
            badge.style.display = "flex";
            badge.style.alignItems = "center";
            badge.style.justifyContent = "center";
            badge.style.border = "2px solid #fff";
            badge.textContent = String(index + 1);

            const overlay = new kakao.maps.CustomOverlay({
              position: latLng,
              content: badge,
              yAnchor: 1.8
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

  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId) ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.title}>내 여행 지도</Text>
        <Text style={styles.subtitle}>
          {loadingMarkers
            ? "장소 불러오는 중..."
            : markers.length > 0
              ? `${markers.length}개 장소가 지도에 표시됩니다`
              : "생성된 여행 일정이 아직 없습니다"}
        </Text>

        <View style={styles.legendRow}>
          {Object.entries(CATEGORY_META).map(([key, value]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: value.color }]} />
              <Text style={styles.legendText}>{value.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.mapCard}>
        <View nativeID={mapContainerId} style={styles.kakaoMap} />
        {kakaoStatus !== "ready" ? (
          <View style={styles.noticeOverlay}>
            {kakaoStatus === "loading" ? (
              <>
                <ActivityIndicator size="small" color={Theme.colors.primary} />
                <Text style={styles.noticeText}>카카오 지도 로딩 중...</Text>
              </>
            ) : kakaoStatus === "no-key" ? (
              <Text style={styles.noticeText}>`EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY` 설정이 필요합니다.</Text>
            ) : (
              <Text style={styles.noticeText}>지도 로드 실패: {kakaoError ?? "알 수 없는 오류"}</Text>
            )}
          </View>
        ) : null}
      </View>

      {selectedMarker ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <View
              style={[
                styles.selectedDot,
                { backgroundColor: CATEGORY_META[selectedMarker.category]?.color ?? Theme.colors.primary }
              ]}
            />
            <Text style={styles.selectedTitle}>{selectedMarker.name}</Text>
          </View>
          <Text style={styles.selectedSub}>{selectedMarker.tripTitle}</Text>
          <Text style={styles.selectedCoord}>
            {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.markerScroll}>
        {markers.map((marker) => {
          const active = marker.id === selectedMarkerId;
          const meta = CATEGORY_META[marker.category] ?? CATEGORY_META.attraction;
          return (
            <Pressable
              key={marker.id}
              style={[styles.markerChip, active && styles.markerChipActive]}
              onPress={() => setSelectedMarkerId(marker.id)}
            >
              <Ionicons
                name={meta.icon}
                size={14}
                color={active ? Theme.colors.primary : Theme.colors.textSecondary}
              />
              <Text numberOfLines={1} style={[styles.markerChipText, active && styles.markerChipTextActive]}>
                {marker.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12
  },
  summaryCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Theme.shadow.sm
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: Theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  legendRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  mapCard: {
    flex: 1,
    minHeight: 320,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: "hidden",
    backgroundColor: "#EAF4FF"
  },
  kakaoMap: {
    flex: 1,
    minHeight: 300
  },
  noticeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 8
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textPrimary,
    fontWeight: "600",
    textAlign: "center"
  },
  selectedCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    ...Theme.shadow.sm
  },
  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  selectedTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  selectedSub: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 17,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  selectedCoord: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textTertiary,
    fontWeight: "600"
  },
  markerScroll: {
    gap: 8,
    paddingRight: 20
  },
  markerChip: {
    minWidth: 120,
    maxWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  markerChipActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryLight
  },
  markerChipText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  markerChipTextActive: {
    color: Theme.colors.primary
  }
});
