import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  color?: string;
}

export default function ProgressBar({
  currentStep,
  totalSteps,
  color = Colors.young.primary
}: ProgressBarProps) {
  const safeCurrent = Math.min(Math.max(currentStep, 0), totalSteps);
  const progress = totalSteps > 0 ? (safeCurrent / totalSteps) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.text}>
        {safeCurrent} / {totalSteps}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  barBackground: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.common.gray200,
    borderRadius: 3,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: 3
  },
  text: {
    marginLeft: 12,
    fontSize: 13,
    color: Colors.common.gray500,
    fontWeight: "600"
  }
});
