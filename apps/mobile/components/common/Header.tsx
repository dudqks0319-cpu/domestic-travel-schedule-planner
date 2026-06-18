import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Spacing from "../../constants/Spacing";
import Theme from "../../constants/Theme";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
}

export default function Header({ title, subtitle, onBack, rightLabel, onRightPress }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}> 
      <View style={styles.row}>
        <View style={styles.sideSlot}>
          {onBack ? (
            <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={Theme.colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.sideSlot}>
          {rightLabel && onRightPress ? (
            <TouchableOpacity style={styles.rightButton} onPress={onRightPress} activeOpacity={0.7}>
              <Text style={styles.rightButtonText}>{rightLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Theme.colors.surface, paddingHorizontal: Spacing.screenPadding, paddingBottom: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52 },
  sideSlot: { width: 52, alignItems: "flex-start", justifyContent: "center" },
  iconButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Theme.colors.background, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Theme.colors.border,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { ...Theme.typography.h3, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 2 },
  rightButton: { minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.sm },
  rightButtonText: { ...Theme.typography.body2, fontWeight: "700", color: Theme.colors.primary },
});
