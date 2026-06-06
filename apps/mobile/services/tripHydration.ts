import AsyncStorage from "@react-native-async-storage/async-storage";

import { type TripDto, type TripPlaceDto, tripsApi } from "./api";
import { CURRENT_TRIP_STORAGE_KEY } from "./localTripStorage";
import { clearPersistedOptimizedRoute } from "./routeApi";

function normalizeTransportMode(value?: string | null): "driving" | "transit" | "walking" {
  if (value === "transit" || value === "walking") {
    return value;
  }

  return "driving";
}

function toRoutePoint(place: TripPlaceDto) {
  if (typeof place.lat !== "number" || typeof place.lng !== "number") {
    return null;
  }

  return {
    id: place.providerPlaceId ?? place.id,
    tripPlaceId: place.id,
    ...(place.dayId ? { dayId: place.dayId } : {}),
    ...(place.providerPlaceId ? { providerPlaceId: place.providerPlaceId } : {}),
    name: place.name,
    category: place.category,
    ...(place.address ? { address: place.address } : {}),
    latitude: place.lat,
    longitude: place.lng,
    dayNumber: place.dayNumber ?? 1,
    ...(place.sortOrder ? { sortOrder: place.sortOrder } : {}),
    ...(place.startTime ? { startTime: place.startTime } : {}),
    ...(place.endTime ? { endTime: place.endTime } : {}),
    ...(place.memo ? { memo: place.memo } : {}),
    isSponsored: place.isSponsored,
    ...(place.sponsorLabel ? { sponsorLabel: place.sponsorLabel } : {})
  };
}

export async function hydrateCurrentTripFromServerTrip(trip: TripDto): Promise<{
  routePointCount: number;
}> {
  const response = await tripsApi.getPlacesByTrip(trip.id);
  const routePoints = (response.data.places ?? [])
    .map(toRoutePoint)
    .filter((point): point is NonNullable<ReturnType<typeof toRoutePoint>> => point !== null);

  await Promise.all([
    AsyncStorage.setItem(
      CURRENT_TRIP_STORAGE_KEY,
      JSON.stringify({
        id: trip.id,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        style: trip.styleKey ?? "custom",
        styleKey: trip.styleKey ?? "custom",
        transport: trip.transportMode ?? "car",
        mode: normalizeTransportMode(trip.transportMode),
        providerStatus: routePoints.length >= 2 ? "ready" : "empty",
        routePoints,
        createdAt: trip.createdAt ?? new Date().toISOString()
      })
    ),
    clearPersistedOptimizedRoute()
  ]);

  return { routePointCount: routePoints.length };
}
