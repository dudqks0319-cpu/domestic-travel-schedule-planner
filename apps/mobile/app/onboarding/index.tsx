import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  TouchableOpacity
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Button from "../../components/common/Button";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    emoji: "🗺️",
    title: "나에게 딱 맞는\n여행을 만들어요",
    description: "혼자, 가족, 부모님과...\n누구와 가든 맞춤 추천!",
    backgroundColor: "#4A90E2",
    secondaryColor: "#74B3FF"
  },
  {
    id: "2",
    emoji: "📍",
    title: "가장 효율적인\n동선을 짜드려요",
    description: "지도 위에 최적 경로를 그려주고\n이동시간까지 자동 계산!",
    backgroundColor: "#7ED321",
    secondaryColor: "#A8E86C"
  },
  {
    id: "3",
    emoji: "✈️",
    title: "비행기부터 맛집까지\nA to Z 한번에",
    description: "항공권, 숙소, 렌트카, 맛집, 카페\n하나의 앱에서 전부 해결!",
    backgroundColor: "#F5A623",
    secondaryColor: "#FFD280"
  },
  {
    id: "4",
    emoji: "🏥",
    title: "안전한 여행을\n도와드려요",
    description: "가까운 병원, 약국, 기저귀갈이대\n어디서든 바로 찾아줘요!",
    backgroundColor: "#0D9488",
    secondaryColor: "#2DD4BF"
  }
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      return;
    }

    void handleFinish();
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace("/auth/signup");
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && typeof viewableItems[0].index === "number") {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.slide, { backgroundColor: item.backgroundColor }]}>
            <View style={[styles.bgCircle1, { backgroundColor: item.secondaryColor }]} />
            <View style={[styles.bgCircle2, { backgroundColor: `${item.secondaryColor}40` }]} />
            <View style={styles.slideContent}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </View>
        )}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      <View style={styles.bottomContainer}>
        <View style={styles.pagination}>
          {slides.map((_, index) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(index - 1) * width, index * width, (index + 1) * width],
              outputRange: [8, 24, 8],
              extrapolate: "clamp"
            });

            const dotOpacity = scrollX.interpolate({
              inputRange: [(index - 1) * width, index * width, (index + 1) * width],
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp"
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: slides[currentIndex]?.backgroundColor ?? Colors.young.primary
                  }
                ]}
              />
            );
          })}
        </View>

        <View style={styles.buttonContainer}>
          {currentIndex < slides.length - 1 ? (
            <TouchableOpacity onPress={() => void handleFinish()} style={styles.skipButton}>
              <Text style={styles.skipText}>건너뛰기</Text>
            </TouchableOpacity>
          ) : null}

          <Button
            title={currentIndex === slides.length - 1 ? "시작하기! 🎉" : "다음"}
            onPress={handleNext}
            size="large"
            color={slides[currentIndex]?.backgroundColor}
            style={{ flex: currentIndex === slides.length - 1 ? 1 : undefined, minWidth: 120 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF"
  },
  slide: {
    width,
    height: height * 0.72,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  bgCircle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -50,
    right: -80,
    opacity: 0.3
  },
  bgCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: 20,
    left: -60,
    opacity: 0.3
  },
  slideContent: {
    alignItems: "center",
    paddingHorizontal: 40
  },
  emoji: {
    fontSize: 100,
    marginBottom: 30
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 42,
    marginBottom: 16
  },
  description: {
    fontSize: 17,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 26
  },
  bottomContainer: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 30,
    justifyContent: "space-between",
    paddingBottom: 40
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center"
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  skipText: {
    fontSize: 16,
    color: Colors.common.gray500,
    fontWeight: "500"
  }
});
