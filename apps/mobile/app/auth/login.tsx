import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Alert,
} from "react-native";
import { useRouter } from "expo-router";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { useAuth } from "../providers/auth-provider";

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithKakaoMock } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!email) {
      newErrors.email = "이메일을 입력해주세요";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "올바른 이메일 형식이 아니에요";
    }
    if (!password) {
      newErrors.password = "비밀번호를 입력해주세요";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const safeEmail = email.trim().toLowerCase();
      const nickname = safeEmail.includes("@") ? safeEmail.split("@")[0] : "여행자";
      await loginWithKakaoMock({ email: safeEmail, nickname });
      router.replace("/(tabs)");
    } catch {
      Alert.alert("오류", "로그인에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    try {
      await loginWithKakaoMock({ email: "kakao@tripmate.app", nickname: "카카오 여행자" });
      router.replace("/(tabs)");
    } catch {
      Alert.alert("오류", "카카오 로그인에 실패했어요.");
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
          <Text style={styles.subtitle}>TripMate에 로그인하세요</Text>
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

        <View style={styles.form}>
          <Input
            label="이메일"
            icon="📧"
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="비밀번호"
            icon="🔒"
            placeholder="비밀번호 입력"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            isPassword
          />
        </View>

        <View style={styles.buttonArea}>
          <Button
            title="이메일 로그인"
            onPress={() => { void handleLogin(); }}
            size="large"
            loading={loading}
            style={{ width: "100%" }}
          />
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>아직 계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/signup")}>
              <Text style={styles.signupLink}>회원가입</Text>
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
  form: { paddingHorizontal: Spacing.screenPadding },
  buttonArea: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.xl, alignItems: "center" },
  signupRow: { flexDirection: "row", marginTop: 24 },
  signupText: { fontSize: 14, color: Colors.common.gray500 },
  signupLink: { fontSize: 14, color: Colors.young.primary, fontWeight: "700" },
});
