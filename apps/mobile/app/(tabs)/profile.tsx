import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Button from "../../components/common/Button";

import type { UserSignupProfile } from "../../types";

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserSignupProfile | null>(null);

  useEffect(() => {
    void loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await AsyncStorage.getItem("userData");
      if (data) {
        setUserData(JSON.parse(data) as UserSignupProfile);
      }
    } catch {
      setUserData(null);
    }
  };

  const handleLogout = async () => {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("userToken");
          await AsyncStorage.removeItem("userData");
          router.replace("/auth/login");
        }
      }
    ]);
  };

  const companionLabel: Record<string, string> = {
    solo: "🧑 혼자",
    friends: "👫 친구",
    couple: "💑 커플",
    family_kids: "👨‍👩‍👧‍👦 가족(아이)",
    family_no_kids: "👨‍👩‍👧 가족",
    parents: "👴👵 부모님과"
  };

  const styleLabel: Record<string, string> = {
    J: "📋 J형 (계획형)",
    P: "🌊 P형 (여유형)"
  };

  const transportLabel: Record<string, string> = {
    car: "🚗 자차/렌트카",
    transit: "🚌 대중교통",
    walk: "🚶 도보"
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userData?.nickname?.[0] ?? "?"}</Text>
        </View>
        <Text style={styles.nickname}>{userData?.nickname ?? "여행자"}</Text>
        <Text style={styles.email}>{userData?.email ?? ""}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 내 여행 스타일</Text>
        <View style={styles.tagRow}>
          {userData?.companion ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{companionLabel[userData.companion]}</Text>
            </View>
          ) : null}
          {userData?.travelStyle ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{styleLabel[userData.travelStyle]}</Text>
            </View>
          ) : null}
          {userData?.transport ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{transportLabel[userData.transport]}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.menuSection}>
        {[
          { emoji: "📅", title: "내 여행 일정", count: "0개" },
          { emoji: "⭐", title: "내 리뷰", count: "0개" },
          { emoji: "💰", title: "포인트", count: "0P" },
          { emoji: "⚙️", title: "설정", count: "" }
        ].map((item, index, arr) => (
          <TouchableOpacity
            key={item.title}
            style={[styles.menuItem, index === arr.length - 1 && styles.menuItemLast]}
            activeOpacity={0.7}
          >
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuCount}>{item.count}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.logoutArea}>
        <Button
          title="로그아웃"
          onPress={() => void handleLogout()}
          variant="outline"
          size="medium"
          color={Colors.common.error}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: 60
  },
  profileCard: {
    backgroundColor: "#FFF",
    marginHorizontal: Spacing.screenPadding,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.young.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF"
  },
  nickname: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.common.black
  },
  email: {
    fontSize: 14,
    color: Colors.common.gray500,
    marginTop: 4
  },
  section: {
    marginTop: 24,
    paddingHorizontal: Spacing.screenPadding
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.common.gray800,
    marginBottom: 12
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tag: {
    backgroundColor: "#EBF5FF",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.young.primary
  },
  menuSection: {
    marginTop: 24,
    marginHorizontal: Spacing.screenPadding,
    backgroundColor: "#FFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.common.gray100
  },
  menuItemLast: {
    borderBottomWidth: 0
  },
  menuEmoji: {
    fontSize: 22,
    marginRight: 14
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: Colors.common.gray700
  },
  menuCount: {
    fontSize: 14,
    color: Colors.common.gray400,
    marginRight: 8
  },
  menuArrow: {
    fontSize: 22,
    color: Colors.common.gray400
  },
  logoutArea: {
    marginTop: 28,
    paddingHorizontal: Spacing.screenPadding,
    alignItems: "center"
  }
});
