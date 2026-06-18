import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  size?: "normal" | "senior";
}

export default function Input({
  label,
  error,
  iconName,
  isPassword = false,
  size = "normal",
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSenior = size === "senior";

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isSenior && styles.labelSenior]}>{label}</Text>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
          isSenior && styles.inputContainerSenior
        ]}
      >
        {iconName ? (
          <Ionicons
            name={iconName}
            size={isSenior ? 24 : 18}
            color={isFocused ? Theme.colors.primary : Theme.colors.textTertiary}
            style={styles.leadingIcon}
          />
        ) : null}
        <TextInput
          style={[styles.input, isSenior && styles.inputSenior]}
          placeholderTextColor={Theme.colors.textTertiary}
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={isSenior ? 24 : 20}
              color={Theme.colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={Theme.colors.error} />
          <Text style={[styles.error, isSenior && styles.errorSenior]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.lg
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.sm
  },
  labelSenior: {
    fontSize: 20,
    marginBottom: Theme.spacing.md
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.lg,
    minHeight: 52
  },
  inputContainerSenior: {
    borderRadius: 18,
    paddingHorizontal: Theme.spacing.xl
  },
  inputFocused: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface
  },
  inputError: {
    borderColor: Theme.colors.error,
    backgroundColor: "#FFF5F5"
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    color: Theme.colors.textPrimary
  },
  inputSenior: {
    fontSize: 22,
    paddingVertical: 18
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  leadingIcon: {
    marginRight: Theme.spacing.sm
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5
  },
  error: {
    fontSize: 12,
    color: Theme.colors.error
  },
  errorSenior: {
    fontSize: 16
  }
});
