import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearPersistedOptimizedRoute } from "./routeApi";

export const CURRENT_TRIP_STORAGE_KEY = "currentTrip";

export async function clearLocalTripDraftData(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(CURRENT_TRIP_STORAGE_KEY),
    clearPersistedOptimizedRoute()
  ]);
}

export async function clearLocalTripDraftDataForTrip(tripId: string): Promise<boolean> {
  const normalizedTripId = tripId.trim();
  if (!normalizedTripId) {
    return false;
  }

  const raw = await AsyncStorage.getItem(CURRENT_TRIP_STORAGE_KEY);
  if (!raw?.trim()) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== "object") {
    return false;
  }

  const currentTripId = (parsed as { id?: unknown }).id;
  if (currentTripId !== normalizedTripId) {
    return false;
  }

  await clearLocalTripDraftData();
  return true;
}
