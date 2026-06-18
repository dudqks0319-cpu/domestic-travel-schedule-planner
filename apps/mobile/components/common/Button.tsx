import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "small" | "medium" | "large" | "senior";
  disabled?: boolean;
  loading?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  color?: string;
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  iconName,
  style,
  textStyle,
  color
}: ButtonProps) {
  const foregroundColor =
    variant === "primary" ? Theme.colors.textOnPrimary : color ?? Theme.colors.primary;
  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    disabled && styles.disabled,
    color && variant === "primary" && { backgroundColor: color },
    color && variant === "outline" && { borderColor: color },
    style
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    disabled && styles.textDisabled,
    color && variant === "outline" && { color },
    textStyle
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={foregroundColor}
          size="small"
        />
      ) : (
        <>
          {iconName ? <Ionicons name={iconName} size={18} color={foregroundColor} /> : null}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 44
  },
  primary: {
    backgroundColor: Theme.colors.primary
  },
  secondary: {
    backgroundColor: Theme.colors.borderLight
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Theme.colors.primary
  },
  ghost: {
    backgroundColor: "transparent"
  },
  size_small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12
  },
  size_medium: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16
  },
  size_large: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 20
  },
  size_senior: {
    paddingVertical: 22,
    paddingHorizontal: 36,
    borderRadius: 20
  },
  disabled: {
    backgroundColor: Theme.colors.border,
    borderColor: Theme.colors.border
  },
  text: {
    fontWeight: "600"
  },
  text_primary: {
    color: Theme.colors.textOnPrimary
  },
  text_secondary: {
    color: Theme.colors.textPrimary
  },
  text_outline: {
    color: Theme.colors.primary
  },
  text_ghost: {
    color: Theme.colors.primary
  },
  textSize_small: {
    fontSize: 14
  },
  textSize_medium: {
    fontSize: 16
  },
  textSize_large: {
    fontSize: 18
  },
  textSize_senior: {
    fontSize: 22
  },
  textDisabled: {
    color: Theme.colors.textTertiary
  }
});
