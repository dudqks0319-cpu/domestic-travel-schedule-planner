import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "../constants/Colors";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    void checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const hasSeenOnboarding = await AsyncStorage.getItem("hasSeenOnboarding");
      const userToken = await AsyncStorage.getItem("userToken");

      if (!hasSeenOnboarding) {
        router.replace("/onboarding");
      } else if (!userToken) {
        router.replace("/auth/login");
      } else {
        router.replace("/");
        router.replace("/(tabs)");
      }
    } catch {
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
