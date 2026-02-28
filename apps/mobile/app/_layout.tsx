import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_700Bold
} from "@expo-google-fonts/noto-sans-kr";

import { AuthProvider } from "./providers/auth-provider";
import Colors from "../constants/Colors";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold
  });

  useEffect(() => {
    if (!fontsLoaded) return;

    const textDefault = ((Text as unknown as { defaultProps?: { style?: unknown } }).defaultProps ??
      {}) as { style?: unknown };
    const textInputDefault = ((TextInput as unknown as { defaultProps?: { style?: unknown } }).defaultProps ??
      {}) as { style?: unknown };

    (Text as unknown as { defaultProps?: { style?: unknown } }).defaultProps = {
      ...textDefault,
      style: [textDefault.style, { fontFamily: "NotoSansKR_400Regular" }]
    };

    (TextInput as unknown as { defaultProps?: { style?: unknown } }).defaultProps = {
      ...textInputDefault,
      style: [textInputDefault.style, { fontFamily: "NotoSansKR_400Regular" }]
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.common.white }}>
          <ActivityIndicator size="large" color={Colors.young.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right"
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/signup" />
          <Stack.Screen name="auth/profile-setup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="trip/create" />
          <Stack.Screen name="trip/route-map" />
          <Stack.Screen name="trip/schedule" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
