import {
  clearAuthToken,
  clearSessionTokens,
  clearUserProfile
} from "../lib/secure-storage";
import { clearLocalTripDraftData } from "./localTripStorage";

export type LocalAuthClearReason =
  | "account-deleted"
  | "expired-session"
  | "invalid-session"
  | "logout"
  | "manual";

type LocalAuthClearListener = (reason: LocalAuthClearReason) => void;

const localAuthClearListeners = new Set<LocalAuthClearListener>();

export function subscribeLocalAuthStateCleared(listener: LocalAuthClearListener): () => void {
  localAuthClearListeners.add(listener);
  return () => {
    localAuthClearListeners.delete(listener);
  };
}

function notifyLocalAuthStateCleared(reason: LocalAuthClearReason): void {
  for (const listener of localAuthClearListeners) {
    listener(reason);
  }
}

export async function clearLocalAuthState(reason: LocalAuthClearReason = "manual"): Promise<void> {
  await Promise.all([
    clearAuthToken(),
    clearSessionTokens(),
    clearUserProfile(),
    clearLocalTripDraftData(reason)
  ]);
  notifyLocalAuthStateCleared(reason);
}
