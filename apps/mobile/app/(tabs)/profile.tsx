import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Button from "../../components/common/Button";
import { getUserProfile } from "../../lib/secure-storage";
import { useAuth } from "../providers/auth-provider";
import { tripsApi } from "../../services/api";

import type { UserSignupProfile } from "../../types";

const companionLabel: Record<string, string> = {
  solo: "혼자", friends: "친구", couple: "커플",
  family_kids: "가족(아이)", family_no_kids: "가족", parents: "부모님과",
};
const styleLabel: Record<string, string> = { J: "계획형", P: "여유형" };
const transportLabel: Record<string, string> = { car: "자차", transit: "대중교통", walk: "도보" };

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [userData, setUserData] = useState<UserSignupProfile | null>(null);
  const [tripCount, setTripCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getUserProfile<UserSignupProfile>();
      if (data) setUserData(data);
    } catch { setUserData(null); }

    try {
      const res = await tripsApi.list();
      setTripCount(res.data.trips?.length ?? 0);
    } catch { setTripCount(0); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const confirmLogout = async () => {
    try { await logout(); router.replace("/auth/login"); }
    catch { Alert.alert("오류", "로그아웃에 실패했어요."); }
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => { void confirmLogout(); } },
    ]);
  };

  const initial = userData?.nickname?.[0]?.toUpperCase() ?? "?";
  const tags: string[] = [];
  if (userData?.companion) tags.push(companionLabel[userData.companion] ?? userData.companion);
  if (userData?.travelStyle) tags.push(styleLabel[userData.travelStyle] ?? userData.travelStyle);
  if (userData?.transport) tags.push(transportLabel[userData.transport] ?? userData.transport);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>
        <Text style={styles.nickname}>{userData?.nickname ?? "여행자"}</Text>
        <Text style={styles.email}>{userData?.email ?? ""}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tripCount}</Text>
            <Text style={styles.statLabel}>여행</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>리뷰</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0P</Text>
            <Text style={styles.statLabel}>포인트</Text>
          </View>
        </View>
      </View>

      {tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>나의 여행 스타일</Text>
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.menuSection}>
        {[
          { emoji: "📅", title: "내 여행 일정", value: `${tripCount}개` },
          { emoji: "🔔", title: "알림 설정", value: "" },
          { emoji: "📱", title: "앱 정보", value: "v0.1.0" },
          { emoji: "📝", title: "피드백 보내기", value: "" },
        ].map((item, index, arr) => (
          <TouchableOpacity
            key={item.title}
            style={[styles.menuItem, index === arr.length - 1 && styles.menuItemLast]}
            activeOpacity={0.7}
          >
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <Text style={styles.menuTitle}>{item.title}</Text>
            {item.value ? <Text style={styles.menuValue}>{item.value}</Text> : null}
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.logoutArea}>
        <Button
          title="로그아웃"
          onPress={handleLogout}
          variant="outline"
          size="medium"
          color={Colors.common.error}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { paddingTop: 60, paddingBottom: 40 },
  profileCard: {
    backgroundColor: "#FFF", marginHorizontal: Spacing.screenPadding,
    borderRadius: 24, padding: 28, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
  },
  avatarRing: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 3,
    borderColor: Colors.young.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.young.primary, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#FFF" },
  nickname: { fontSize: 22, fontWeight: "800", color: Colors.common.black },
  email: { fontSize: 14, color: Colors.common.gray500, marginTop: 4 },
  statsRow: {
    flexDirection: "row", marginTop: 20, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: Colors.common.gray100, width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: Colors.young.primary },
  statLabel: { fontSize: 12, color: Colors.common.gray500, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: Colors.common.gray200 },
  section: { marginTop: 24, paddingHorizontal: Spacing.screenPadding },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: Colors.common.gray800, marginBottom: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: "#EBF5FF", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  tagText: { fontSize: 14, fontWeight: "600", color: Colors.young.primary },
  menuSection: {
    marginTop: 24, marginHorizontal: Spacing.screenPadding,
    backgroundColor: "#FFF", borderRadius: 20, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.common.gray100,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuEmoji: { fontSize: 22, marginRight: 14 },
  menuTitle: { flex: 1, fontSize: 16, fontWeight: "500", color: Colors.common.gray700 },
  menuValue: { fontSize: 14, color: Colors.common.gray400, marginRight: 8 },
  menuArrow: { fontSize: 22, color: Colors.common.gray400 },
  logoutArea: { marginTop: 28, paddingHorizontal: Spacing.screenPadding, alignItems: "center" },
});
