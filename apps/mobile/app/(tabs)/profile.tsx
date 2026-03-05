import React from "react";
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Theme from "../../constants/Theme";
import { useAuth } from "../providers/auth-provider";

const EARN_ITEMS = [
  { id: "earn-review", icon: "create-outline" as const, label: "리뷰 작성", point: "+50P" },
  { id: "earn-photo", icon: "images-outline" as const, label: "사진 업로드", point: "+50P" },
  { id: "earn-daily", icon: "calendar-outline" as const, label: "매일 방문", point: "+50P" },
  { id: "earn-like", icon: "heart-outline" as const, label: "좋아요 클릭", point: "+50P" }
];

const USE_ITEMS = [
  { id: "use-premium", icon: "card-outline" as const, label: "프리미엄 구독", point: "2,000P" },
  { id: "use-coupon", icon: "ticket-outline" as const, label: "할인 쿠폰", point: "500P" },
  { id: "use-gift", icon: "cafe-outline" as const, label: "스타벅스", point: "300P" }
];

const TRIPS = [
  { id: "trip-1", title: "성산일출봉", image: "https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=500&q=80" },
  { id: "trip-2", title: "한라산", image: "https://images.unsplash.com/photo-1528127269322-539801943592?w=500&q=80" },
  { id: "trip-3", title: "우도", image: "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=500&q=80" }
];

function ActionCard({ icon, label, point }: { icon: keyof typeof Ionicons.glyphMap; label: string; point: string }) {
  return (
    <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
      <Ionicons name={icon} size={22} color={Theme.colors.textPrimary} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionPoint}>{point}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const point = 1850;
  const nextTierPoint = 2000;
  const progress = Math.min(1, point / nextTierPoint);

  const handleLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/login");
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTop}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" }}
            style={styles.avatar}
          />
          <View style={styles.nameRow}>
            <Text style={styles.name}>지현</Text>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={13} color="#111827" />
              <Text style={styles.badgeText}>Star Reviewer</Text>
            </View>
          </View>
        </View>

        <View style={styles.pointCard}>
          <Text style={styles.pointValue}>{point.toLocaleString()}P</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <Text style={styles.progressText}>프리미엄까지 {nextTierPoint - point}P</Text>

          <View style={styles.tierRow}>
            <Ionicons name="medal-outline" size={16} color={Theme.colors.textPrimary} />
            <Text style={styles.tierText}>실버 등급</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>포인트 적립</Text>
        <View style={styles.grid4}>
          {EARN_ITEMS.map((item) => (
            <ActionCard key={item.id} icon={item.icon} label={item.label} point={item.point} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>포인트 사용</Text>
        <View style={styles.grid3}>
          {USE_ITEMS.map((item) => (
            <ActionCard key={item.id} icon={item.icon} label={item.label} point={item.point} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>내 여행</Text>
        <View style={styles.tripRow}>
          {TRIPS.map((trip) => (
            <TouchableOpacity key={trip.id} style={styles.tripItem} activeOpacity={0.85}>
              <Image source={{ uri: trip.image }} style={styles.tripImage} />
              <Text style={styles.tripTitle}>{trip.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.75}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  content: {
    paddingTop: 42,
    paddingHorizontal: 20,
    paddingBottom: 30,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 500 : "100%",
    alignSelf: "center"
  },
  profileTop: {
    alignItems: "center",
    marginBottom: 16
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42
  },
  nameRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  name: {
    fontSize: 52,
    lineHeight: 56,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  pointCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 18,
    alignItems: "center",
    ...Theme.shadow.sm
  },
  pointValue: {
    fontSize: 66,
    lineHeight: 72,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  progressTrack: {
    marginTop: 12,
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#B0B0B0"
  },
  progressText: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  tierRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight,
    paddingTop: 10,
    width: "100%",
    justifyContent: "center"
  },
  tierText: {
    fontSize: 16,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 42,
    lineHeight: 46,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  grid4: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  grid3: {
    flexDirection: "row",
    gap: 10
  },
  actionCard: {
    flex: 1,
    minWidth: "22%",
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    ...Theme.shadow.sm
  },
  actionLabel: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 19,
    textAlign: "center",
    color: Theme.colors.textPrimary,
    fontWeight: "700"
  },
  actionPoint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
    color: Theme.colors.textSecondary,
    fontWeight: "700"
  },
  tripRow: {
    flexDirection: "row",
    gap: 10
  },
  tripItem: {
    flex: 1
  },
  tripImage: {
    width: "100%",
    height: 74,
    borderRadius: 10
  },
  tripTitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 18,
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    textAlign: "center"
  },
  logoutButton: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.error,
    paddingVertical: 12,
    alignItems: "center"
  },
  logoutText: {
    fontSize: 14,
    color: Theme.colors.error,
    fontWeight: "800"
  }
});
