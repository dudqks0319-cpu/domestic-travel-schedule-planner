import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./providers/auth-provider";

export default function RootLayout() {
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
