import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import SelectCard from "../common/SelectCard";

import type { TransportType } from "../../types";

interface StepTransportProps {
  transport: TransportType | null;
  onSelectTransport: (transport: TransportType) => void;
}

const transportOptions: { key: TransportType; emoji: string; title: string; subtitle: string }[] = [
  { key: "car", emoji: "🚗", title: "자차/렌트카", subtitle: "넓은 이동 반경" },
  { key: "transit", emoji: "🚌", title: "대중교통", subtitle: "환승 기반 이동" },
  { key: "walk", emoji: "🚶", title: "도보", subtitle: "근거리 중심 일정" }
];

export default function StepTransport({ transport, onSelectTransport }: StepTransportProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🚦</Text>
      <Text style={styles.title}>주 이동수단을 선택해주세요</Text>
      <Text style={styles.description}>이동 방식에 따라 하루 방문 가능한 장소 수가 달라져요.</Text>

      <View style={styles.grid}>
        {transportOptions.map((item) => (
          <SelectCard
            key={item.key}
            emoji={item.emoji}
            title={item.title}
            subtitle={item.subtitle}
            isSelected={transport === item.key}
            onPress={() => onSelectTransport(item.key)}
            size="large"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm
  },
  emoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: Spacing.sm
  },
  title: {
    ...Typography.normal.h2,
    color: Colors.common.black,
    textAlign: "center",
    marginBottom: Spacing.xs
  },
  description: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray500,
    textAlign: "center",
    marginBottom: Spacing.xxl
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center"
  }
});
