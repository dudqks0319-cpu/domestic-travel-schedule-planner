import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";

import Theme from "../../constants/Theme";
import { type TripDto, tripsApi } from "../../services/api";
import { hydrateCurrentTripFromServerTrip } from "../../services/tripHydration";

interface PlaceMarker {
  id: string;
  trip: TripDto;
  name: string;
  lat: number;
  lng: number;
  category: string;
  tripTitle: string;
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  attraction: { label: "관광지", color: "#4A90E2", icon: "camera-outline" },
  restaurant: { label: "맛집", color: "#FF7A59", icon: "restaurant-outline" },
  cafe: { label: "카페", color: "#8C7AE6", icon: "cafe-outline" },
  hotel: { label: "숙소", color: "#24B47E", icon: "bed-outline" }
};

const INITIAL_REGION = {
  latitude: 36.5,
  longitude: 127.5,
  latitudeDelta: 5,
  longitudeDelta: 5
};

export default function TabMapViewNative() {
  const router = useRouter();
  const [savedTrips, setSavedTrips] = useState<TripDto[]>([]);
  const [markers, setMarkers] = useState<PlaceMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [openingTripId, setOpeningTripId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const loadMarkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tripsApi.list();
      const trips = res.data.trips ?? [];
      const allMarkers: PlaceMarker[] = [];
      setSavedTrips(trips);

      for (const trip of trips) {
        const placesResponse = await tripsApi.getPlacesByTrip(trip.id);
        const places = placesResponse.data.places ?? [];
        for (const place of places) {
          if (typeof place.lat === "number" && typeof place.lng === "number") {
            allMarkers.push({
              id: place.id,
              trip,
              name: place.name,
              lat: place.lat,
              lng: place.lng,
              category: place.category,
              tripTitle: trip.title
            });
          }
        }
      }

      setMarkers(allMarkers);
      setSelectedMarkerId(allMarkers[0]?.id ?? null);
    } catch {
      setSavedTrips([]);
      setMarkers([]);
      setSelectedMarkerId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkers();
  }, [loadMarkers]);

  const selectedMarker = useMemo(
    () => markers.find((marker) => marker.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId]
  );

  const openTripSchedule = useCallback(async (trip: TripDto) => {
    setOpeningTripId(trip.id);
    setOpenError(null);
    try {
      await hydrateCurrentTripFromServerTrip(trip);
      router.push("/trip/schedule");
    } catch {
      setOpenError("저장된 여행 장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setOpeningTripId(null);
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.title}>내 여행 지도</Text>
        <Text style={styles.subtitle}>
          {loading
            ? "장소 불러오는 중..."
            : markers.length > 0
              ? `${markers.length}개 장소가 지도에 표시됩니다`
              : savedTrips.length > 0
                ? `${savedTrips.length}개 저장 여행이 있습니다`
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
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
          </View>
        ) : (
          <MapView style={styles.map} initialRegion={INITIAL_REGION} showsUserLocation showsMyLocationButton>
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.lat, longitude: marker.lng }}
                title={marker.name}
                description={`${marker.tripTitle} · ${marker.category}`}
                pinColor={CATEGORY_META[marker.category]?.color ?? Theme.colors.primary}
                onPress={() => setSelectedMarkerId(marker.id)}
              />
            ))}
          </MapView>
        )}
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
        <Text style={styles.selectedCoord}>지도 marker 기준으로 표시된 장소입니다</Text>
        {openError ? <Text style={styles.openErrorText}>{openError}</Text> : null}
        <Pressable
          style={styles.openScheduleButton}
          onPress={() => { void openTripSchedule(selectedMarker.trip); }}
          disabled={openingTripId === selectedMarker.trip.id}
        >
          <Text style={styles.openScheduleButtonText}>
            {openingTripId === selectedMarker.trip.id ? "불러오는 중..." : "이 여행 일정표 열기"}
          </Text>
        </Pressable>
      </View>
      ) : null}

      {savedTrips.length ? (
        <View style={styles.savedTripsCard}>
          <View style={styles.savedTripsHeader}>
            <Text style={styles.savedTripsTitle}>저장 여행</Text>
            <Text style={styles.savedTripsCount}>{`${savedTrips.length}개`}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedTripScroll}>
            {savedTrips.map((trip) => (
              <Pressable
                key={trip.id}
                style={styles.savedTripChip}
                onPress={() => { void openTripSchedule(trip); }}
                disabled={openingTripId === trip.id}
              >
                <Text numberOfLines={1} style={styles.savedTripTitle}>{trip.title}</Text>
                <Text numberOfLines={1} style={styles.savedTripMeta}>{trip.destination}</Text>
                <Text style={styles.savedTripDate}>{`${trip.startDate} - ${trip.endDate}`}</Text>
                <Text style={styles.savedTripAction}>
                  {openingTripId === trip.id ? "불러오는 중..." : "일정표 열기"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
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
  map: { flex: 1 },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  openErrorText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.error,
    fontWeight: "600"
  },
  openScheduleButton: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 10,
    alignItems: "center"
  },
  openScheduleButtonText: {
    fontSize: 13,
    lineHeight: 17,
    color: "#FFFFFF",
    fontWeight: "800"
  },
  savedTripsCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    ...Theme.shadow.sm
  },
  savedTripsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  savedTripsTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  savedTripsCount: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  savedTripScroll: {
    gap: 8,
    paddingRight: 20
  },
  savedTripChip: {
    width: 172,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: "#FAFCFF",
    padding: 12
  },
  savedTripTitle: {
    fontSize: 13,
    lineHeight: 17,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  savedTripMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  savedTripDate: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    color: Theme.colors.textTertiary,
    fontWeight: "600"
  },
  savedTripAction: {
    marginTop: 9,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.primary,
    fontWeight: "800"
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
