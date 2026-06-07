import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_STORAGE_KEY = "userToken";
export const USER_PROFILE_STORAGE_KEY = "userData";
export const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
export const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";

const SENSITIVE_TOKEN_KEYS = new Set([
  AUTH_TOKEN_STORAGE_KEY,
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY
]);

function canUseSecureStore(): boolean {
  return Platform.OS !== "web";
}

function canUseAsyncStorageFallback(key: string): boolean {
  return Platform.OS === "web" || !SENSITIVE_TOKEN_KEYS.has(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.setItemAsync(key, value);
      if (SENSITIVE_TOKEN_KEYS.has(key)) {
        await AsyncStorage.removeItem(key);
      }
      return;
    } catch {
      if (!canUseAsyncStorageFallback(key)) {
        throw new Error("SecureStore is required for auth token storage.");
      }
    }
  }

  await AsyncStorage.setItem(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (canUseSecureStore()) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) {
        if (SENSITIVE_TOKEN_KEYS.has(key)) {
          await AsyncStorage.removeItem(key);
        }
        return value;
      }
    } catch {
      if (!canUseAsyncStorageFallback(key)) {
        return null;
      }
    }

    if (!canUseAsyncStorageFallback(key)) {
      await AsyncStorage.removeItem(key);
      return null;
    }
  }

  return AsyncStorage.getItem(key);
}

async function removeItem(key: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Continue cleanup via AsyncStorage fallback below.
    }
  }

  await AsyncStorage.removeItem(key);
}

export async function setAuthToken(token: string): Promise<void> {
  await setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  return getItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function clearAuthToken(): Promise<void> {
  await removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export async function clearAccessToken(): Promise<void> {
  await removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  await removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

export async function clearSessionTokens(): Promise<void> {
  await Promise.all([clearAccessToken(), clearRefreshToken()]);
}

export async function setUserProfile<T>(profile: T): Promise<void> {
  await setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export async function getUserProfile<T>(): Promise<T | null> {
  const raw = await getItem(USER_PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function clearUserProfile(): Promise<void> {
  await removeItem(USER_PROFILE_STORAGE_KEY);
}
