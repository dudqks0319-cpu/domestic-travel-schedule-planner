import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Spacing from "../../constants/Spacing";
import Theme from "../../constants/Theme";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ProgressBar from "../../components/common/ProgressBar";
import { clearSignupMemory, setSignupMemory } from "../../lib/signup-memory";

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = "이메일을 입력해주세요";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "올바른 이메일 형식이 아니에요";
    }

    if (!nickname) {
      newErrors.nickname = "닉네임을 입력해주세요";
    } else if (nickname.length < 2) {
      newErrors.nickname = "2글자 이상 입력해주세요";
    }

    if (!password) {
      newErrors.password = "비밀번호를 입력해주세요";
    } else if (password.length < 8) {
      newErrors.password = "8자리 이상 입력해주세요";
    }

    if (!passwordConfirm) {
      newErrors.passwordConfirm = "비밀번호 확인을 입력해주세요";
    } else if (password !== passwordConfirm) {
      newErrors.passwordConfirm = "비밀번호가 일치하지 않아요";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      setSignupMemory({ email, nickname });
      router.push("/auth/profile-setup");
    } catch {
      clearSignupMemory();
      Alert.alert("오류", "회원가입에 실패했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
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
            <Ionicons name="map-outline" size={28} color={Theme.colors.primary} />
          </View>
          <Text style={styles.title}>TripMate 가입하기</Text>
          <Text style={styles.subtitle}>여행의 시작, 계정을 만들어볼까요?</Text>
        </View>

        <ProgressBar currentStep={1} totalSteps={6} />

        <View style={styles.form}>
          <Input
            label="이메일"
            iconName="mail-outline"
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="닉네임"
            iconName="person-outline"
            placeholder="여행에서 사용할 이름"
            value={nickname}
            onChangeText={setNickname}
            error={errors.nickname}
            maxLength={10}
          />

          <Input
            label="비밀번호"
            iconName="lock-closed-outline"
            placeholder="8자리 이상"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            isPassword
          />

          <Input
            label="비밀번호 확인"
            iconName="lock-closed-outline"
            placeholder="비밀번호를 한번 더 입력"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            error={errors.passwordConfirm}
            isPassword
          />
        </View>

        <View style={styles.buttonArea}>
          <Button
            title="다음 단계로"
            onPress={() => void handleSignup()}
            size="large"
            loading={loading}
            iconName="arrow-forward-outline"
            style={{ width: "100%" }}
          />

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>이미 계정이 있으신가요? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={styles.loginLink}>로그인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 10
  },
  brandMark: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: Theme.colors.textPrimary
  },
  subtitle: {
    fontSize: 15,
    color: Theme.colors.textSecondary,
    marginTop: 6
  },
  form: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 10
  },
  buttonArea: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.xl,
    alignItems: "center"
  },
  loginRow: {
    flexDirection: "row",
    marginTop: 20
  },
  loginText: {
    fontSize: 14,
    color: Theme.colors.textSecondary
  },
  loginLink: {
    fontSize: 14,
    color: Theme.colors.primary,
    fontWeight: "700"
  }
});
