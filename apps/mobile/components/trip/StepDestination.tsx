import React, { useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import Input from "../common/Input";

interface StepDestinationProps {
  destination: string;
  onChangeDestination: (destination: string) => void;
}

const dummyDestinations = [
  "제주도",
  "부산",
  "서울",
  "강릉",
  "여수",
  "경주"
] as const;

const mapDestinations = [
  { name: "서울", left: "53%", top: "22%" },
  { name: "인천", left: "41%", top: "25%" },
  { name: "강릉", left: "72%", top: "28%" },
  { name: "경주", left: "69%", top: "49%" },
  { name: "부산", left: "73%", top: "61%" },
  { name: "여수", left: "54%", top: "62%" },
  { name: "제주도", left: "37%", top: "82%" }
] as const;

const randomDestinationPool = [...dummyDestinations, "전주", "인천", "속초", "포항"] as const;

const ROULETTE_SIZE = 232;
const ROULETTE_RADIUS = 88;
const ROULETTE_LABEL_WIDTH = 56;

export default function StepDestination({ destination, onChangeDestination }: StepDestinationProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [randomMessage, setRandomMessage] = useState("");
  const spinValue = useRef(new Animated.Value(0)).current;

  const needleRotation = spinValue.interpolate({
    inputRange: [0, 8],
    outputRange: ["0deg", "2880deg"]
  });

  const rouletteNodes = useMemo(
    () =>
      randomDestinationPool.map((name, index) => {
        const angle = (Math.PI * 2 * index) / randomDestinationPool.length - Math.PI / 2;

        return {
          name,
          left: ROULETTE_SIZE / 2 + Math.cos(angle) * ROULETTE_RADIUS - ROULETTE_LABEL_WIDTH / 2,
          top: ROULETTE_SIZE / 2 + Math.sin(angle) * ROULETTE_RADIUS - 10
        };
      }),
    []
  );

  const getRandomDestination = () =>
    randomDestinationPool[Math.floor(Math.random() * randomDestinationPool.length)];

  const handleRandomDraw = () => {
    const picked = getRandomDestination();

    setRandomMessage(`랜덤 뽑기 결과: ${picked}`);
    onChangeDestination(picked);
  };

  const handleSpinRoulette = () => {
    if (isSpinning) {
      return;
    }

    const selectedIndex = Math.floor(Math.random() * randomDestinationPool.length);
    const picked = randomDestinationPool[selectedIndex];
    const spinRounds = 4 + Math.floor(Math.random() * 3);
    const stopPosition = selectedIndex / randomDestinationPool.length;

    setIsSpinning(true);
    setRandomMessage("룰렛이 돌고 있어요...");
    spinValue.setValue(0);

    Animated.timing(spinValue, {
      toValue: spinRounds + stopPosition,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start(() => {
      setIsSpinning(false);
      setRandomMessage(`룰렛 결과: ${picked}`);
      onChangeDestination(picked);
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>어디로 떠나시나요?</Text>
      <Text style={styles.description}>여행지를 입력하거나 지도/룰렛으로 재미있게 골라보세요.</Text>

      <Input
        label="여행지"
        icon="🧭"
        placeholder="예: 제주도"
        value={destination}
        onChangeText={onChangeDestination}
      />

      <Text style={styles.quickLabel}>빠른 선택</Text>
      <View style={styles.chipContainer}>
        {dummyDestinations.map((item) => {
          const isSelected = destination.trim() === item;

          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onChangeDestination(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>대한민국 지도 선택</Text>
        <Text style={styles.sectionDescription}>지도의 핀을 눌러 목적지를 바로 입력할 수 있어요.</Text>
        <View style={styles.mapCard}>
          <View style={styles.mapBody} pointerEvents="none" />
          <View style={styles.mapNorthWest} pointerEvents="none" />
          <View style={styles.mapEast} pointerEvents="none" />
          <View style={styles.mapSouthWest} pointerEvents="none" />
          {mapDestinations.map((item) => {
            const isSelected = destination.trim() === item.name;

            return (
              <TouchableOpacity
                key={item.name}
                style={[styles.mapPin, { left: item.left, top: item.top }]}
                onPress={() => onChangeDestination(item.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.mapPinDot, isSelected && styles.mapPinDotSelected]} />
                <Text style={[styles.mapPinLabel, isSelected && styles.mapPinLabelSelected]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>랜덤 목적지 미니게임</Text>
        <Text style={styles.sectionDescription}>랜덤 뽑기 또는 룰렛으로 여행지를 정해보세요.</Text>
        <View style={styles.randomButtonRow}>
          <TouchableOpacity
            style={[styles.randomButton, styles.randomDrawButton]}
            onPress={handleRandomDraw}
            activeOpacity={0.8}
          >
            <Text style={styles.randomDrawButtonText}>랜덤 뽑기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.randomButton, styles.randomSpinButton, isSpinning && styles.randomSpinDisabled]}
            onPress={handleSpinRoulette}
            activeOpacity={0.8}
            disabled={isSpinning}
          >
            <Text style={styles.randomSpinButtonText}>
              {isSpinning ? "룰렛 회전 중..." : "룰렛 돌리기"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rouletteContainer}>
          <View style={styles.rouletteBoard}>
            {rouletteNodes.map((item) => {
              const isSelected = destination.trim() === item.name;

              return (
                <View key={item.name} style={[styles.rouletteNode, { left: item.left, top: item.top }]}>
                  <Text style={[styles.rouletteNodeText, isSelected && styles.rouletteNodeTextSelected]}>
                    {item.name}
                  </Text>
                </View>
              );
            })}

            <Animated.View style={[styles.rouletteNeedleWrap, { transform: [{ rotate: needleRotation }] }]}>
              <View style={styles.rouletteNeedle} />
              <View style={styles.rouletteNeedleTip} />
            </Animated.View>
            <View style={styles.roulettePivot} />
            <Text style={styles.rouletteCenterText}>SPIN</Text>
          </View>
        </View>
      </View>

      {randomMessage ? <Text style={styles.randomResult}>{randomMessage}</Text> : null}
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
  quickLabel: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray600,
    fontWeight: "700",
    marginBottom: Spacing.sm
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.lg
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    backgroundColor: Colors.common.gray100,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm
  },
  chipSelected: {
    backgroundColor: "#E8F4FD"
  },
  chipText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray700,
    fontWeight: "600"
  },
  chipTextSelected: {
    color: Colors.young.primary
  },
  sectionLabel: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray700,
    fontWeight: "700",
    marginBottom: Spacing.xs
  },
  sectionDescription: {
    ...Typography.normal.caption,
    color: Colors.common.gray500,
    marginBottom: Spacing.sm
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.white,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  mapCard: {
    position: "relative",
    height: 270,
    borderRadius: 16,
    backgroundColor: "#F6FAFF",
    borderWidth: 1,
    borderColor: "#D5E7FF",
    overflow: "hidden"
  },
  mapBody: {
    position: "absolute",
    left: "50%",
    top: 26,
    width: 104,
    height: 208,
    marginLeft: -52,
    borderRadius: 52,
    backgroundColor: "#EAF4FF",
    borderWidth: 1,
    borderColor: "#CFE3FA"
  },
  mapNorthWest: {
    position: "absolute",
    left: "50%",
    top: 6,
    width: 78,
    height: 44,
    marginLeft: -62,
    borderRadius: 24,
    backgroundColor: "#EAF4FF",
    borderWidth: 1,
    borderColor: "#CFE3FA"
  },
  mapEast: {
    position: "absolute",
    left: "50%",
    top: 74,
    width: 34,
    height: 110,
    marginLeft: 22,
    borderRadius: 18,
    backgroundColor: "#EAF4FF",
    borderWidth: 1,
    borderColor: "#CFE3FA"
  },
  mapSouthWest: {
    position: "absolute",
    left: "50%",
    top: 166,
    width: 44,
    height: 96,
    marginLeft: -66,
    borderRadius: 20,
    backgroundColor: "#EAF4FF",
    borderWidth: 1,
    borderColor: "#CFE3FA"
  },
  mapPin: {
    position: "absolute",
    width: 78,
    marginLeft: -39,
    marginTop: -10,
    alignItems: "center"
  },
  mapPinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.young.primary,
    borderWidth: 2,
    borderColor: Colors.common.white,
    marginBottom: 5
  },
  mapPinDotSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.young.primaryDark
  },
  mapPinLabel: {
    ...Typography.normal.caption,
    color: Colors.common.gray700,
    fontWeight: "700",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.common.white,
    borderWidth: 1,
    borderColor: "#DCEBFF"
  },
  mapPinLabelSelected: {
    color: Colors.young.primaryDark,
    borderColor: Colors.young.primaryLight,
    backgroundColor: "#ECF5FF"
  },
  randomButtonRow: {
    flexDirection: "row",
    marginBottom: Spacing.md
  },
  randomButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  randomDrawButton: {
    backgroundColor: "#FFF5E8",
    marginRight: Spacing.sm
  },
  randomDrawButtonText: {
    ...Typography.normal.bodySmall,
    color: "#A15B00",
    fontWeight: "700"
  },
  randomSpinButton: {
    backgroundColor: Colors.young.primary
  },
  randomSpinButtonText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.white,
    fontWeight: "700"
  },
  randomSpinDisabled: {
    opacity: 0.65
  },
  rouletteContainer: {
    alignItems: "center",
    marginBottom: Spacing.xs
  },
  rouletteBoard: {
    width: ROULETTE_SIZE,
    height: ROULETTE_SIZE,
    borderRadius: ROULETTE_SIZE / 2,
    borderWidth: 4,
    borderColor: "#DDEBFC",
    backgroundColor: "#F5FAFF",
    position: "relative"
  },
  rouletteNode: {
    position: "absolute",
    width: ROULETTE_LABEL_WIDTH,
    alignItems: "center"
  },
  rouletteNodeText: {
    ...Typography.normal.caption,
    color: Colors.common.gray700,
    fontWeight: "700"
  },
  rouletteNodeTextSelected: {
    color: Colors.young.primaryDark
  },
  rouletteNeedleWrap: {
    position: "absolute",
    left: ROULETTE_SIZE / 2,
    top: ROULETTE_SIZE / 2,
    width: 0,
    height: 0
  },
  rouletteNeedle: {
    position: "absolute",
    left: -1,
    top: -70,
    width: 2,
    height: 70,
    borderRadius: 999,
    backgroundColor: Colors.common.gray700
  },
  rouletteNeedleTip: {
    position: "absolute",
    left: -6,
    top: -80,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.common.error
  },
  roulettePivot: {
    position: "absolute",
    left: ROULETTE_SIZE / 2 - 10,
    top: ROULETTE_SIZE / 2 - 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.common.gray700,
    borderWidth: 3,
    borderColor: Colors.common.white
  },
  rouletteCenterText: {
    ...Typography.normal.caption,
    position: "absolute",
    left: ROULETTE_SIZE / 2 - 16,
    top: ROULETTE_SIZE / 2 + 16,
    color: Colors.common.gray500,
    fontWeight: "700"
  },
  randomResult: {
    ...Typography.normal.bodySmall,
    color: Colors.young.primaryDark,
    fontWeight: "700",
    textAlign: "center",
    marginTop: Spacing.md
  }
});
