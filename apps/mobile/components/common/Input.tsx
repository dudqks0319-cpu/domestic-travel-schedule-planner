import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps
} from "react-native";

import Colors from "../../constants/Colors";
import HIG from "../../constants/HIG";
import Spacing from "../../constants/Spacing";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: string;
  isPassword?: boolean;
  size?: "normal" | "senior";
}

export default function Input({
  label,
  error,
  icon,
  isPassword = false,
  size = "normal",
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSenior = size === "senior";

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isSenior && styles.labelSenior]}>
        {icon ? `${icon} ${label}` : label}
      </Text>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
          isSenior && styles.inputContainerSenior
        ]}
      >
        <TextInput
          style={[styles.input, isSenior && styles.inputSenior]}
          placeholderTextColor={Colors.common.gray400}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...rest}
        />

        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            <Text style={{ fontSize: isSenior ? 22 : 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={[styles.error, isSenior && styles.errorSenior]}>⚠️ {error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.common.gray700,
    marginBottom: Spacing.sm
  },
  labelSenior: {
    fontSize: 20,
    marginBottom: Spacing.md
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: HIG.minTouchTarget,
    backgroundColor: Colors.common.gray50,
    borderRadius: HIG.cornerRadiusLarge,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: Spacing.lg
  },
  inputContainerSenior: {
    borderRadius: 18,
    paddingHorizontal: Spacing.xl
  },
  inputFocused: {
    borderColor: Colors.young.primary,
    backgroundColor: "#FFFFFF"
  },
  inputError: {
    borderColor: Colors.common.error,
    backgroundColor: "#FFF5F5"
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    color: Colors.common.black
  },
  inputSenior: {
    fontSize: 22,
    paddingVertical: 18
  },
  eyeButton: {
    padding: 4
  },
  error: {
    fontSize: 12,
    color: Colors.common.error,
    marginTop: 4
  },
  errorSenior: {
    fontSize: 16
  }
});
