import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";

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
              <Ionicons name="chevron-back" size={22} color={Colors.common.gray700} />
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
  container: { backgroundColor: Colors.common.white, paddingHorizontal: Spacing.screenPadding, paddingBottom: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52 },
  sideSlot: { width: 52, alignItems: "flex-start", justifyContent: "center" },
  iconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.common.gray50, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.common.gray200,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { ...Typography.normal.h3, color: Colors.common.black },
  subtitle: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 2 },
  rightButton: { minWidth: 40, minHeight: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.sm },
  rightButtonText: { ...Typography.normal.bodySmall, fontWeight: "600", color: Colors.young.primary },
});
