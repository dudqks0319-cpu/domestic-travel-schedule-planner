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

import Colors from "../../constants/Colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "small" | "medium" | "large" | "senior";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
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
  icon,
  style,
  textStyle,
  color
}: ButtonProps) {
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
          color={variant === "primary" ? "#FFF" : Colors.young.primary}
          size="small"
        />
      ) : (
        <Text style={textStyles}>{icon ? `${icon} ${title}` : title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  primary: {
    backgroundColor: Colors.young.primary
  },
  secondary: {
    backgroundColor: Colors.common.gray100
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: Colors.young.primary
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
    backgroundColor: Colors.common.gray300,
    borderColor: Colors.common.gray300
  },
  text: {
    fontWeight: "600"
  },
  text_primary: {
    color: "#FFFFFF"
  },
  text_secondary: {
    color: Colors.common.gray700
  },
  text_outline: {
    color: Colors.young.primary
  },
  text_ghost: {
    color: Colors.young.primary
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
    color: Colors.common.gray500
  }
});
