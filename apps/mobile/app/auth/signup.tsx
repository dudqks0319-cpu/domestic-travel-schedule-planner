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

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ProgressBar from "../../components/common/ProgressBar";
import { clearSignupMemory, setSignupMemory } from "../../lib/signup-memory";

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
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
      Alert.alert("오류", "게스트 프로필 설정을 시작하지 못했어요. 다시 시도해주세요.");
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
          <Text style={styles.emoji}>🗺️</Text>
          <Text style={styles.title}>게스트 프로필 만들기</Text>
          <Text style={styles.subtitle}>로그인 전에도 취향을 저장하고 일정 초안을 만들 수 있어요</Text>
        </View>

        <ProgressBar currentStep={1} totalSteps={6} />

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
            label="닉네임"
            icon="😊"
            placeholder="여행에서 사용할 이름"
            value={nickname}
            onChangeText={setNickname}
            error={errors.nickname}
            maxLength={10}
          />
        </View>

        <View style={styles.buttonArea}>
          <Button
            title="취향 설정 계속하기 →"
            onPress={() => void handleSignup()}
            size="large"
            loading={loading}
            style={{ width: "100%" }}
          />

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>저장/공유까지 사용하려면 </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={styles.loginLink}>카카오 로그인</Text>
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
    backgroundColor: "#FFFFFF"
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
  emoji: {
    fontSize: 50,
    marginBottom: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.common.black
  },
  subtitle: {
    fontSize: 15,
    color: Colors.common.gray500,
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
    color: Colors.common.gray500
  },
  loginLink: {
    fontSize: 14,
    color: Colors.young.primary,
    fontWeight: "700"
  }
});
