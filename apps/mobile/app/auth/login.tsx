import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";
import { completeKakaoRedirectIfPresent, requestKakaoAccessToken } from "../../lib/kakao-login";
import { useAuth } from "../providers/auth-provider";

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithKakao } = useAuth();
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  const handleGuestStart = () => {
    router.replace("/(tabs)");
  };

  useEffect(() => {
    let isActive = true;

    const completeRedirect = async () => {
      try {
        setKakaoError(null);
        const kakaoAccessToken = await completeKakaoRedirectIfPresent();
        if (!kakaoAccessToken || !isActive) {
          return;
        }

        setKakaoLoading(true);
        await loginWithKakao(kakaoAccessToken);
        if (isActive) {
          router.replace("/(tabs)");
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message = error instanceof Error ? error.message : "카카오 로그인에 실패했어요.";
        setKakaoError(message);
        Alert.alert("카카오 로그인", `${message}\n\n로그인 없이도 TripMate를 사용할 수 있어요.`, [
          { text: "계속 둘러보기", onPress: handleGuestStart },
          { text: "확인", style: "cancel" }
        ]);
      } finally {
        if (isActive) {
          setKakaoLoading(false);
        }
      }
    };

    void completeRedirect();

    return () => {
      isActive = false;
    };
  }, [loginWithKakao, router]);

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    setKakaoError(null);
    try {
      const kakaoAccessToken = await requestKakaoAccessToken();
      await loginWithKakao(kakaoAccessToken);
      router.replace("/(tabs)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "카카오 로그인에 실패했어요.";
      setKakaoError(message);
      Alert.alert("카카오 로그인", `${message}\n\n로그인 없이도 TripMate를 사용할 수 있어요.`, [
        { text: "계속 둘러보기", onPress: handleGuestStart },
        { text: "확인", style: "cancel" }
      ]);
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
          <View style={styles.brandMark}>
            <Ionicons name="map-outline" size={30} color={Theme.colors.primary} />
          </View>
          <Text style={styles.title}>TripMate 시작하기</Text>
          <Text style={styles.subtitle}>지금은 로그인 없이 둘러보고, 나중에 카카오로 일정을 동기화할 수 있어요.</Text>
        </View>

        <View style={styles.loginCard}>
          <View style={styles.benefitRow}>
            <Ionicons name="location-outline" size={18} color={Theme.colors.primary} />
            <Text style={styles.benefitText}>지역 선택부터 일정 생성까지 로그인 없이 먼저 사용</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Theme.colors.success} />
            <Text style={styles.benefitText}>프리미엄 상태는 서버 검증 후에만 활성화</Text>
          </View>
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestStart}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
            <Text style={styles.guestButtonText}>로그인 없이 시작</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kakaoButton}
            onPress={() => { void handleKakaoLogin(); }}
            activeOpacity={0.8}
            disabled={kakaoLoading}
            accessibilityRole="button"
            accessibilityState={{ busy: kakaoLoading, disabled: kakaoLoading }}
          >
            {kakaoLoading ? (
              <ActivityIndicator color={Theme.colors.kakaoBlack} />
            ) : (
              <Ionicons name="chatbubble" size={18} color={Theme.colors.kakaoBlack} />
            )}
            <Text style={styles.kakaoButtonText}>
              {kakaoLoading ? "로그인 중..." : "카카오로 동기화"}
            </Text>
          </TouchableOpacity>

          {kakaoError ? (
            <View style={styles.noticeBox}>
              <Ionicons name="alert-circle-outline" size={18} color={Theme.colors.primary} />
              <Text style={styles.noticeText}>{kakaoError}</Text>
            </View>
          ) : null}

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>카카오는 개발 빌드와 앱 키 설정 후 사용할 수 있어요. </Text>
            <TouchableOpacity onPress={() => router.push("/auth/signup")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.signupLink}>기본 설정으로 이동</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    justifyContent: "center",
    alignItems: "center"
  },
  header: { width: "100%", maxWidth: 420, alignItems: "center", paddingTop: 54, paddingBottom: 22 },
  brandMark: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: Theme.colors.textPrimary
  },
  subtitle: {
    maxWidth: 300,
    fontSize: 15,
    lineHeight: 22,
    color: Theme.colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
    fontWeight: "600"
  },
  loginCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 18,
    ...Theme.shadow.sm
  },
  benefitRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  kakaoButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: Theme.colors.kakaoYellow, borderRadius: Theme.radius.md, minHeight: 52,
    width: "100%", marginTop: 10, gap: 8
  },
  kakaoButtonText: { fontSize: 16, fontWeight: "800", color: Theme.colors.kakaoBlack },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    width: "100%",
    marginTop: 16,
    gap: 8,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primary
  },
  guestButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.primaryLight
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  signupRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 18 },
  signupText: { fontSize: 13, lineHeight: 18, color: Theme.colors.textSecondary, fontWeight: "600" },
  signupLink: { fontSize: 13, lineHeight: 18, color: Theme.colors.primary, fontWeight: "800" }
});
