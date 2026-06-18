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
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";
import Button from "../../components/common/Button";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    iconName: "map-outline" as const,
    title: "나에게 딱 맞는\n여행을 만들어요",
    description: "동행자, 이동 방식, 취향을 반영해 바로 실행 가능한 일정을 만듭니다.",
    backgroundColor: Theme.colors.primary,
    secondaryColor: Theme.colors.primaryLight
  },
  {
    id: "2",
    iconName: "navigate-outline" as const,
    title: "가장 효율적인\n동선을 짜드려요",
    description: "지도 위 장소와 이동 시간을 함께 보고 하루 동선을 빠르게 정리합니다.",
    backgroundColor: "#0D9488",
    secondaryColor: "#CCFBF1"
  },
  {
    id: "3",
    iconName: "restaurant-outline" as const,
    title: "비행기부터 맛집까지\nA to Z 한번에",
    description: "관광지, 숙소, 맛집, 카페 후보를 일정 흐름 안에서 비교합니다.",
    backgroundColor: "#F59E0B",
    secondaryColor: "#FEF3C7"
  },
  {
    id: "4",
    iconName: "medkit-outline" as const,
    title: "안전한 여행을\n도와드려요",
    description: "병원, 약국, 가족 편의 정보를 필요할 때 바로 확인합니다.",
    backgroundColor: "#2563EB",
    secondaryColor: "#DBEAFE"
  }
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToOffset({ offset: nextIndex * width, animated: true });
      setCurrentIndex(nextIndex);
      return;
    }

    void handleFinish();
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace("/(tabs)");
  };

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
              <View style={styles.iconPanel}>
                <Ionicons name={item.iconName} size={58} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </View>
        )}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false
        })}
        onMomentumScrollEnd={(event) => {
          const offsetX = event.nativeEvent.contentOffset.x;
          const nextIndex = Math.round(offsetX / width);
          setCurrentIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
        }}
        onScrollToIndexFailed={(info) => {
          const safeIndex = Math.max(0, Math.min(info.index, slides.length - 1));
          flatListRef.current?.scrollToOffset({ offset: safeIndex * width, animated: true });
          setCurrentIndex(safeIndex);
        }}
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
                    backgroundColor: slides[currentIndex]?.backgroundColor ?? Theme.colors.primary
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
            title={currentIndex === slides.length - 1 ? "로그인 없이 시작" : "다음"}
            onPress={handleNext}
            size="large"
            iconName={currentIndex === slides.length - 1 ? "arrow-forward-outline" : undefined}
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
    backgroundColor: Theme.colors.surface
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
  iconPanel: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28
  },
  title: {
    fontSize: 29,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 42,
    marginBottom: 16
  },
  description: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 25,
    fontWeight: "600"
  },
  bottomContainer: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 20,
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
    color: Theme.colors.textSecondary,
    fontWeight: "500"
  }
});
