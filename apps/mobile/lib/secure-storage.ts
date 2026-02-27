import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_STORAGE_KEY = "userToken";
export const USER_PROFILE_STORAGE_KEY = "userData";

function canUseSecureStore(): boolean {
  return Platform.OS !== "web";
}

async function setItem(key: string, value: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // SecureStore is unavailable on some simulators/dev environments.
    }
  }

  await AsyncStorage.setItem(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (canUseSecureStore()) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) {
        return value;
      }
    } catch {
      // Fallback to AsyncStorage for compatibility.
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
