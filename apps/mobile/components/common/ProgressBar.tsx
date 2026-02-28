import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  color?: string;
  labels?: string[];
}

export default function ProgressBar({
  currentStep, totalSteps, color = Colors.young.primary, labels,
}: ProgressBarProps) {
  const safeCurrent = Math.min(Math.max(currentStep, 0), totalSteps);
  const progress = totalSteps > 0 ? (safeCurrent / totalSteps) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${progress}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.stepText}>
          <Text style={[styles.stepCurrent, { color }]}>{safeCurrent}</Text>
          <Text style={styles.stepDivider}> / </Text>
          <Text style={styles.stepTotal}>{totalSteps}</Text>
        </Text>
      </View>

      {labels && labels.length > 0 && (
        <View style={styles.labelRow}>
          {labels.map((label, index) => {
            const isDone = index < safeCurrent;
            const isCurrent = index === safeCurrent - 1;
            return (
              <View key={label} style={styles.labelItem}>
                <View style={[
                  styles.labelDot,
                  isDone && { backgroundColor: color },
                  isCurrent && styles.labelDotCurrent,
                ]} />
                <Text style={[
                  styles.labelText,
                  isDone && { color },
                  isCurrent && styles.labelTextCurrent,
                ]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingVertical: 12 },
  barRow: { flexDirection: "row", alignItems: "center" },
  barBackground: { flex: 1, height: 8, backgroundColor: "#E9ECEF", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  stepText: { marginLeft: 12 },
  stepCurrent: { fontSize: 15, fontWeight: "800" },
  stepDivider: { fontSize: 13, color: "#ADB5BD" },
  stepTotal: { fontSize: 13, fontWeight: "600", color: "#ADB5BD" },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  labelItem: { alignItems: "center", flex: 1 },
  labelDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#DEE2E6", marginBottom: 4 },
  labelDotCurrent: { width: 8, height: 8, borderRadius: 4 },
  labelText: { fontSize: 10, color: "#ADB5BD" },
  labelTextCurrent: { fontWeight: "700" },
});
