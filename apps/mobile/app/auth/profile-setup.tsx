import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Button from "../../components/common/Button";
import SelectCard from "../../components/common/SelectCard";
import MultiSelectCard from "../../components/common/MultiSelectCard";
import ProgressBar from "../../components/common/ProgressBar";
import { clearSignupMemory, getSignupMemory } from "../../lib/signup-memory";
import { setAuthToken, setUserProfile } from "../../lib/secure-storage";

import type {
  CompanionType,
  TripPurpose,
  TravelStyle,
  TransportType,
  FoodPreference,
  ChildAgeGroup,
  UserSignupProfile
} from "../../types";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const signupMemoryRef = useRef(getSignupMemory());
  const invalidFlowHandledRef = useRef(false);

  const email = signupMemoryRef.current?.email ?? "";
  const nickname = signupMemoryRef.current?.nickname ?? "";
  const hasValidSignupData = Boolean(email.trim() && nickname.trim());

  const [step, setStep] = useState(1);
  const totalSetupSteps = 5;

  const [companion, setCompanion] = useState<CompanionType | null>(null);
  const [purpose, setPurpose] = useState<TripPurpose | null>(null);
  const [travelStyle, setTravelStyle] = useState<TravelStyle | null>(null);
  const [transport, setTransport] = useState<TransportType | null>(null);
  const [foods, setFoods] = useState<FoodPreference[]>([]);
  const [childAgeGroups, setChildAgeGroups] = useState<ChildAgeGroup[]>([]);

  useEffect(() => {
    if (hasValidSignupData || invalidFlowHandledRef.current) return;

    invalidFlowHandledRef.current = true;
    clearSignupMemory();
    Alert.alert("오류", "잘못된 가입 경로예요. 회원가입부터 다시 진행해주세요.", [
      { text: "확인", onPress: () => router.replace("/auth/signup") }
    ]);
  }, [hasValidSignupData, router]);

  const toggleFood = (food: FoodPreference) => {
    setFoods((prev) => (prev.includes(food) ? prev.filter((f) => f !== food) : [...prev, food]));
  };

  const toggleAgeGroup = (group: ChildAgeGroup) => {
    setChildAgeGroups((prev) =>
      prev.includes(group) ? prev.filter((value) => value !== group) : [...prev, group]
    );
  };

  const handleNext = () => {
    if (!hasValidSignupData) return;

    if (step === 1 && !companion) {
      Alert.alert("선택해주세요", "누구와 여행하는지 선택해주세요!");
      return;
    }

    if (step === 1 && companion === "family_kids" && childAgeGroups.length === 0) {
      Alert.alert("선택해주세요", "아이 나이대를 최소 1개 선택해주세요!");
      return;
    }

    if (step === 2 && !purpose) {
      Alert.alert("선택해주세요", "여행 목적을 선택해주세요!");
      return;
    }

    if (step === 3 && !travelStyle) {
      Alert.alert("선택해주세요", "여행 스타일을 선택해주세요!");
      return;
    }

    if (step === 4 && !transport) {
      Alert.alert("선택해주세요", "교통수단을 선택해주세요!");
      return;
    }

    if (step < totalSetupSteps) {
      setStep((prev) => prev + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    void handleComplete();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleComplete = async () => {
    if (!hasValidSignupData) {
      clearSignupMemory();
      Alert.alert("오류", "잘못된 가입 경로예요. 회원가입부터 다시 진행해주세요.", [
        { text: "확인", onPress: () => router.replace("/auth/signup") }
      ]);
      return;
    }

    if (!companion || !purpose || !travelStyle || !transport) {
      Alert.alert("오류", "필수 항목이 누락되었어요. 다시 시도해주세요.");
      return;
    }

    const userData: UserSignupProfile = {
      email,
      nickname,
      companion,
      purpose,
      travelStyle,
      transport,
      foods,
      childAgeGroups
    };

    try {
      await setUserProfile(userData);
      await setAuthToken("temp_token_12345");
      clearSignupMemory();
      router.replace("/(tabs)");
    } catch {
      Alert.alert("오류", "저장에 실패했어요. 다시 시도해주세요.");
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>👥</Text>
            <Text style={styles.stepTitle}>누구와 여행하나요?</Text>
            <Text style={styles.stepDescription}>함께하는 사람에 따라 추천이 달라져요!</Text>

            <View style={styles.cardGrid}>
              <SelectCard
                emoji="🧑"
                title="혼자"
                subtitle="자유로운 나홀로 여행"
                isSelected={companion === "solo"}
                onPress={() => setCompanion("solo")}
                size="large"
              />
              <SelectCard
                emoji="👫"
                title="친구와"
                subtitle="20-30대 친구 여행"
                isSelected={companion === "friends"}
                onPress={() => setCompanion("friends")}
                size="large"
              />
              <SelectCard
                emoji="💑"
                title="커플"
                subtitle="연인과 함께"
                isSelected={companion === "couple"}
                onPress={() => setCompanion("couple")}
                size="large"
              />
              <SelectCard
                emoji="👨‍👩‍👧‍👦"
                title="가족 (아이)"
                subtitle="아이와 함께하는 여행"
                isSelected={companion === "family_kids"}
                onPress={() => setCompanion("family_kids")}
                size="large"
                color={Colors.family.primary}
              />
              <SelectCard
                emoji="👨‍👩‍👧"
                title="가족"
                subtitle="아이 없는 가족여행"
                isSelected={companion === "family_no_kids"}
                onPress={() => setCompanion("family_no_kids")}
                size="large"
                color={Colors.family.primary}
              />
              <SelectCard
                emoji="👴👵"
                title="부모님과"
                subtitle="효도여행·시니어"
                isSelected={companion === "parents"}
                onPress={() => setCompanion("parents")}
                size="large"
                color={Colors.senior.primary}
              />
            </View>

            {companion === "family_kids" ? (
              <View style={styles.childAgeContainer}>
                <Text style={styles.childAgeTitle}>👶 아이 나이대를 선택해주세요 (복수 선택)</Text>
                <View style={styles.childAgeGrid}>
                  {[
                    { key: "0_2", emoji: "🍼", title: "0~2세 (영아)" },
                    { key: "3_5", emoji: "🧒", title: "3~5세 (유아)" },
                    { key: "6_7", emoji: "👦", title: "6~7세" },
                    { key: "8_10", emoji: "👧", title: "8~10세" },
                    { key: "11_13", emoji: "🧑", title: "11~13세" }
                  ].map((item) => (
                    <MultiSelectCard
                      key={item.key}
                      emoji={item.emoji}
                      title={item.title}
                      isSelected={childAgeGroups.includes(item.key as ChildAgeGroup)}
                      onPress={() => toggleAgeGroup(item.key as ChildAgeGroup)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🎯</Text>
            <Text style={styles.stepTitle}>여행 목적은?</Text>
            <Text style={styles.stepDescription}>목적에 맞는 장소를 추천해드려요!</Text>

            <View style={styles.cardGrid}>
              <SelectCard
                emoji="📸"
                title="관광"
                subtitle="관광지·포토존 중심"
                isSelected={purpose === "sightseeing"}
                onPress={() => setPurpose("sightseeing")}
                size="large"
              />
              <SelectCard
                emoji="🏖️"
                title="휴식·호캉스"
                subtitle="편하게 쉬는 여행"
                isSelected={purpose === "relaxation"}
                onPress={() => setPurpose("relaxation")}
                size="large"
              />
              <SelectCard
                emoji="🏄"
                title="액티비티"
                subtitle="체험·레포츠 중심"
                isSelected={purpose === "activity"}
                onPress={() => setPurpose("activity")}
                size="large"
              />
              <SelectCard
                emoji="🍽️"
                title="맛집투어"
                subtitle="먹방 여행"
                isSelected={purpose === "food_tour"}
                onPress={() => setPurpose("food_tour")}
                size="large"
              />
              <SelectCard
                emoji="🙏"
                title="효도여행"
                subtitle="부모님 모시고"
                isSelected={purpose === "filial"}
                onPress={() => setPurpose("filial")}
                size="large"
                color={Colors.senior.primary}
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🎒</Text>
            <Text style={styles.stepTitle}>여행 스타일은?</Text>
            <Text style={styles.stepDescription}>일정을 어떻게 짜드릴까요?</Text>

            <View style={styles.styleCardContainer}>
              <SelectCard
                emoji="📋"
                title="J형 (계획형)"
                subtitle="시간대별로 촘촘한 일정"
                isSelected={travelStyle === "J"}
                onPress={() => setTravelStyle("J")}
                size="large"
              />

              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              <SelectCard
                emoji="🌊"
                title="P형 (여유형)"
                subtitle="블록 단위 자유 일정"
                isSelected={travelStyle === "P"}
                onPress={() => setTravelStyle("P")}
                size="large"
              />
            </View>

            {travelStyle ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>
                  {travelStyle === "J" ? "📋 J형 일정표 예시" : "🌊 P형 일정표 예시"}
                </Text>
                {travelStyle === "J" ? (
                  <View>
                    <Text style={styles.previewItem}>09:00  🏔️ 성산일출봉 (90분)</Text>
                    <Text style={styles.previewItem}>↓ 🚗 10분</Text>
                    <Text style={styles.previewItem}>11:00  🐠 아쿠아리움 (120분)</Text>
                    <Text style={styles.previewItem}>↓ 🚗 5분</Text>
                    <Text style={styles.previewItem}>13:30  🍽️ 점심 (60분)</Text>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.previewItem}>🌅 오전  성산일출봉, 아쿠아리움</Text>
                    <Text style={styles.previewItem}>🍽️ 점심  근처 맛집 추천 3곳</Text>
                    <Text style={styles.previewItem}>🌇 오후  월정리 해변 + 카페</Text>
                    <Text style={styles.previewItem}>기분 가는 대로 다니세요.</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🚗</Text>
            <Text style={styles.stepTitle}>주로 어떻게 이동하나요?</Text>
            <Text style={styles.stepDescription}>교통수단에 따라 동선이 달라져요!</Text>

            <View style={styles.cardGrid}>
              <SelectCard
                emoji="🚗"
                title="자차 / 렌트카"
                subtitle="하루 5~8곳 가능"
                isSelected={transport === "car"}
                onPress={() => setTransport("car")}
                size="large"
              />
              <SelectCard
                emoji="🚌"
                title="대중교통"
                subtitle="버스·지하철 환승"
                isSelected={transport === "transit"}
                onPress={() => setTransport("transit")}
                size="large"
              />
              <SelectCard
                emoji="🚶"
                title="도보"
                subtitle="걸어서 여행"
                isSelected={transport === "walk"}
                onPress={() => setTransport("walk")}
                size="large"
              />
            </View>

            {transport ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>
                  {transport === "car" && "🚗 자차/렌트카 여행"}
                  {transport === "transit" && "🚌 대중교통 여행"}
                  {transport === "walk" && "🚶 도보 여행"}
                </Text>
                <Text style={styles.previewItem}>
                  {transport === "car" && "• 하루 5~8곳 방문\n• 먼 거리도 빠르게\n• 주차장 정보 제공"}
                  {transport === "transit" && "• 하루 3~5곳 방문\n• 환승 정보 안내\n• 노선 근처 우선 추천"}
                  {transport === "walk" && "• 하루 2~4곳 방문\n• 반경 2km 이내 추천\n• 산책 코스 연결"}
                </Text>
              </View>
            ) : null}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🍽️</Text>
            <Text style={styles.stepTitle}>좋아하는 음식은?</Text>
            <Text style={styles.stepDescription}>여러 개 선택할 수 있어요. 맛집 추천에 활용됩니다.</Text>

            <View style={styles.foodGrid}>
              {([
                { key: "korean", emoji: "🍚", title: "한식" },
                { key: "chinese", emoji: "🥟", title: "중식" },
                { key: "japanese", emoji: "🍣", title: "일식" },
                { key: "western", emoji: "🍝", title: "양식" },
                { key: "seafood", emoji: "🦐", title: "해산물" },
                { key: "meat", emoji: "🥩", title: "고기" },
                { key: "noodle", emoji: "🍜", title: "면류" },
                { key: "salad", emoji: "🥗", title: "샐러드" },
                { key: "cafe", emoji: "☕", title: "카페" },
                { key: "dessert", emoji: "🧁", title: "디저트" },
                { key: "pub", emoji: "🍺", title: "술집" },
                { key: "other", emoji: "🌮", title: "기타" }
              ] as { key: FoodPreference; emoji: string; title: string }[]).map((item) => (
                <MultiSelectCard
                  key={item.key}
                  emoji={item.emoji}
                  title={item.title}
                  isSelected={foods.includes(item.key)}
                  onPress={() => toggleFood(item.key)}
                />
              ))}
            </View>

            {foods.length > 0 ? <Text style={styles.foodCount}>✅ {foods.length}개 선택됨</Text> : null}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ProgressBar currentStep={step} totalSteps={totalSetupSteps} />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      <View style={styles.bottomButtons}>
        {step > 1 ? (
          <Button
            title="← 이전"
            onPress={handleBack}
            variant="outline"
            size="large"
            style={{ flex: 1, marginRight: 8 }}
          />
        ) : null}
        <Button
          title={step === totalSetupSteps ? "완료! 🎉" : "다음 →"}
          onPress={handleNext}
          size="large"
          style={{ flex: step > 1 ? 1 : undefined, width: step === 1 ? "100%" : undefined }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 50
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20
  },
  stepContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 10
  },
  stepEmoji: {
    fontSize: 50,
    textAlign: "center",
    marginBottom: 12
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.common.black,
    textAlign: "center",
    marginBottom: 8
  },
  stepDescription: {
    fontSize: 15,
    color: Colors.common.gray500,
    textAlign: "center",
    marginBottom: 28
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center"
  },
  styleCardContainer: {
    alignItems: "center",
    gap: 4
  },
  vsContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.common.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4
  },
  vsText: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.common.gray500
  },
  previewBox: {
    backgroundColor: Colors.common.gray50,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.common.gray200
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.common.gray800,
    marginBottom: 12
  },
  previewItem: {
    fontSize: 14,
    color: Colors.common.gray600,
    lineHeight: 24,
    marginBottom: 2
  },
  childAgeContainer: {
    marginTop: 24,
    padding: 20,
    backgroundColor: "#FFF9E6",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFE680"
  },
  childAgeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.common.gray800,
    marginBottom: 12
  },
  childAgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  foodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center"
  },
  foodCount: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: Colors.young.primary
  },
  bottomButtons: {
    flexDirection: "row",
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: Colors.common.gray100,
    backgroundColor: "#FFF"
  }
});
