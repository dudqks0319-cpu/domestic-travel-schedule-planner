import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "../constants/Colors";
import { useAuth, type AuthStatus } from "./providers/auth-provider";

export default function SplashScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const navigationHandledRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    if (status === "loading" || navigationHandledRef.current) return;
    void checkFirstLaunch(status);
  }, [status]);

  const checkFirstLaunch = async (authStatus: Extract<AuthStatus, "authenticated" | "unauthenticated">) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (navigationHandledRef.current) return;
      const hasSeenOnboarding = await AsyncStorage.getItem("hasSeenOnboarding");
      navigationHandledRef.current = true;
      if (!hasSeenOnboarding) router.replace("/onboarding");
      else if (authStatus === "unauthenticated") router.replace("/auth/login");
      else router.replace("/(tabs)");
    } catch {
      navigationHandledRef.current = true;
      router.replace("/onboarding");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.logo}>✈️</Text>
        <Text style={styles.title}>TripMate</Text>
        <Text style={styles.subtitle}>나만의 완벽한 여행 플래너</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[styles.dot, {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.3, i * 0.2 + 0.4, 1],
                }),
              }]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: Colors.young.primary, overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute", width: 400, height: 400, borderRadius: 200,
    backgroundColor: "rgba(255,255,255,0.08)", top: -100, right: -100,
  },
  bgCircle2: {
    position: "absolute", width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -50, left: -80,
  },
  content: { alignItems: "center" },
  logo: { fontSize: 80, marginBottom: 16 },
  title: { fontSize: 42, fontWeight: "900", color: "#FFF", letterSpacing: 2 },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.85)", marginTop: 8, fontWeight: "500" },
  dotsRow: { flexDirection: "row", gap: 8, marginTop: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFF" },
});
