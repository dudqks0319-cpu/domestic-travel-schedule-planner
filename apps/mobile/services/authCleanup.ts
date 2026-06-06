import {
  clearAuthToken,
  clearSessionTokens,
  clearUserProfile
} from "../lib/secure-storage";
import { clearLocalTripDraftData } from "./localTripStorage";

export async function clearLocalAuthState(): Promise<void> {
  await Promise.all([
    clearAuthToken(),
    clearSessionTokens(),
    clearUserProfile(),
    clearLocalTripDraftData()
  ]);
}
