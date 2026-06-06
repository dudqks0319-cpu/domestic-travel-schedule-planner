import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Alert,
} from "react-native";
import { useRouter } from "expo-router";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import { requestKakaoAccessToken } from "../../lib/kakao-login";
import { useAuth } from "../providers/auth-provider";

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithKakao } = useAuth();
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    try {
      const kakaoAccessToken = await requestKakaoAccessToken();
      await loginWithKakao(kakaoAccessToken);
      router.replace("/(tabs)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "카카오 로그인에 실패했어요.";
      Alert.alert("카카오 로그인", message);
    } finally {
      setKakaoLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>🗺️</Text>
          <Text style={styles.title}>다시 만나서 반가워요!</Text>
          <Text style={styles.subtitle}>저장, 공유, 프리미엄 기능은 카카오 로그인으로 이어집니다</Text>
        </View>

        <View style={styles.socialArea}>
          <TouchableOpacity
            style={styles.kakaoButton}
            onPress={() => { void handleKakaoLogin(); }}
            activeOpacity={0.8}
            disabled={kakaoLoading}
          >
            <Text style={styles.kakaoIcon}>💬</Text>
            <Text style={styles.kakaoButtonText}>
              {kakaoLoading ? "로그인 중..." : "카카오 로그인"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.buttonArea}>
          <TouchableOpacity style={styles.guestButton} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.guestButtonText}>로그인 없이 둘러보기</Text>
          </TouchableOpacity>
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>취향을 저장하고 시작하려면 </Text>
            <TouchableOpacity onPress={() => router.push("/auth/signup")}>
              <Text style={styles.signupLink}>게스트 프로필 만들기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: { alignItems: "center", paddingTop: 80, paddingBottom: 20 },
  emoji: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", color: Colors.common.black },
  subtitle: { fontSize: 15, color: Colors.common.gray500, marginTop: 6 },
  socialArea: { paddingHorizontal: Spacing.screenPadding, marginTop: 20 },
  kakaoButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#FEE500", borderRadius: 12, paddingVertical: 16,
    width: "100%",
  },
  kakaoIcon: { fontSize: 20, marginRight: 8 },
  kakaoButtonText: { fontSize: 16, fontWeight: "700", color: "#191919" },
  divider: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.screenPadding, marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.common.gray200 },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: Colors.common.gray500 },
  buttonArea: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.xl, alignItems: "center" },
  guestButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#FFFFFF"
  },
  guestButtonText: { fontSize: 16, fontWeight: "700", color: Colors.common.gray700 },
  signupRow: { flexDirection: "row", marginTop: 24 },
  signupText: { fontSize: 14, color: Colors.common.gray500 },
  signupLink: { fontSize: 14, color: Colors.young.primary, fontWeight: "700" },
});
