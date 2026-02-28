import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "../constants/Colors";
import { useAuth, type AuthStatus } from "./providers/auth-provider";

export default function SplashScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const navigationHandledRef = useRef(false);

  useEffect(() => {
    if (status === "loading" || navigationHandledRef.current) {
      return;
    }

    void checkFirstLaunch(status);
  }, [status]);

  const checkFirstLaunch = async (
    authStatus: Extract<AuthStatus, "authenticated" | "unauthenticated">
  ) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (navigationHandledRef.current) {
        return;
      }

      const hasSeenOnboarding = await AsyncStorage.getItem("hasSeenOnboarding");

      navigationHandledRef.current = true;
      if (!hasSeenOnboarding) {
        router.replace("/onboarding");
      } else if (authStatus === "unauthenticated") {
        router.replace("/auth/login");
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      navigationHandledRef.current = true;
      router.replace("/onboarding");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.title}>TripMate</Text>
      <Text style={styles.subtitle}>나만의 완벽한 여행 플래너</Text>
      <ActivityIndicator size="large" color={Colors.common.info} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.young.primary
  },
  emoji: {
    fontSize: 80,
    marginBottom: 16
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
    color: Colors.common.white,
    letterSpacing: 2
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8
  },
  loader: {
    marginTop: 40
  }
});
