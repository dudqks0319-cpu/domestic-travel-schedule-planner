import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearPersistedOptimizedRoute } from "./routeApi";

export const CURRENT_TRIP_STORAGE_KEY = "currentTrip";

export async function clearLocalTripDraftData(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(CURRENT_TRIP_STORAGE_KEY),
    clearPersistedOptimizedRoute()
  ]);
}
