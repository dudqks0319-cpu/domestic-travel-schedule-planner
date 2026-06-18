import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Theme from "../../constants/Theme";
import { monetizationApi, type EntitlementItem } from "../../services/api";
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

type PremiumLoadState = "idle" | "loading" | "ready" | "error";
type PremiumTone = "active" | "pending" | "failed" | "locked" | "idle";

function formatEntitlementDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function getPrimaryEntitlement(items: EntitlementItem[]): EntitlementItem | null {
  return items.find((item) => item.active) ?? items[0] ?? null;
}

function getPremiumTone(item: EntitlementItem | null, hasActivePremium: boolean): PremiumTone {
  if (hasActivePremium) {
    return "active";
  }

  if (!item) {
    return "locked";
  }

  if (item.status === "pending_verification") {
    return "pending";
  }

  if (item.status === "verification_failed") {
    return "failed";
  }

  return "locked";
}

function ActionCard({
  icon,
  label,
  point,
  disabled = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  point: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, disabled && styles.actionCardDisabled]}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Ionicons
        name={icon}
        size={22}
        color={disabled ? Theme.colors.textTertiary : Theme.colors.textPrimary}
      />
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionPoint}>{point}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, status: authStatus, user } = useAuth();
  const [premiumLoadState, setPremiumLoadState] = useState<PremiumLoadState>("idle");
  const [entitlements, setEntitlements] = useState<EntitlementItem[]>([]);

  const point = 1850;
  const nextTierPoint = 2000;
  const progress = Math.min(1, point / nextTierPoint);
  const profileName = user?.nickname?.trim() || "여행자";
  const profileImage =
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80";

  const loadPremiumStatus = useCallback(async () => {
    if (authStatus !== "authenticated") {
      setEntitlements([]);
      setPremiumLoadState("idle");
      return;
    }

    setPremiumLoadState("loading");
    try {
      const response = await monetizationApi.getEntitlements();
      setEntitlements(Array.isArray(response.data.items) ? response.data.items : []);
      setPremiumLoadState("ready");
    } catch {
      setEntitlements([]);
      setPremiumLoadState("error");
    }
  }, [authStatus]);

  useEffect(() => {
    void loadPremiumStatus();
  }, [loadPremiumStatus]);

  const primaryEntitlement = useMemo(
    () => getPrimaryEntitlement(entitlements),
    [entitlements]
  );
  const hasActivePremium = entitlements.some((item) => item.active);
  const premiumTone = getPremiumTone(primaryEntitlement, hasActivePremium);
  const premiumExpiresAt = formatEntitlementDate(primaryEntitlement?.expiresAt ?? null);
  const isPremiumUseLocked = !hasActivePremium;

  const premiumCopy = useMemo(() => {
    if (authStatus !== "authenticated") {
      return {
        icon: "lock-closed-outline" as const,
        title: "프리미엄 잠김",
        message: "로그인 후 구독 상태를 확인할 수 있어요.",
        meta: "고급 경로 비교, 광고 숨김, 우선 재생성"
      };
    }

    if (premiumLoadState === "loading") {
      return {
        icon: "sync-outline" as const,
        title: "구독 확인 중",
        message: "서버에서 결제 검증 상태를 불러오고 있어요.",
        meta: "검증 전에는 프리미엄 기능이 잠겨요."
      };
    }

    if (premiumLoadState === "error") {
      return {
        icon: "warning-outline" as const,
        title: "구독 확인 실패",
        message: "네트워크가 복구되면 다시 확인해 주세요.",
        meta: "확인 실패 상태에서는 프리미엄 기능이 잠겨요."
      };
    }

    if (premiumTone === "active") {
      return {
        icon: "shield-checkmark-outline" as const,
        title: "프리미엄 활성",
        message: premiumExpiresAt
          ? `${premiumExpiresAt}까지 고급 기능을 사용할 수 있어요.`
          : "고급 경로 비교와 광고 숨김이 열려 있어요.",
        meta: "서버 검증 완료"
      };
    }

    if (premiumTone === "pending") {
      return {
        icon: "time-outline" as const,
        title: "검증 대기",
        message: "스토어 검증이 끝나기 전까지 고급 기능은 잠겨요.",
        meta: "중복 결제 없이 다시 확인 가능"
      };
    }

    if (premiumTone === "failed") {
      return {
        icon: "alert-circle-outline" as const,
        title: "검증 실패",
        message: "스토어에서 구매를 확인하지 못했어요.",
        meta: "구매 내역 확인 후 재시도"
      };
    }

    return {
      icon: "lock-closed-outline" as const,
      title: "프리미엄 잠김",
      message: "활성 구독이 확인되면 고급 기능이 열려요.",
      meta: "서버 검증된 구독만 활성화"
    };
  }, [authStatus, premiumExpiresAt, premiumLoadState, premiumTone]);

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
            source={{ uri: profileImage }}
            style={styles.avatar}
          />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profileName}</Text>
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

        <View style={[styles.premiumCard, styles[`premiumCard_${premiumTone}`]]}>
          <View style={styles.premiumHeader}>
            <View style={[styles.premiumIcon, styles[`premiumIcon_${premiumTone}`]]}>
              <Ionicons
                name={premiumCopy.icon}
                size={22}
                color={premiumTone === "active" ? Theme.colors.success : Theme.colors.textPrimary}
              />
            </View>
            <View style={styles.premiumTextWrap}>
              <Text style={styles.premiumTitle}>{premiumCopy.title}</Text>
              <Text style={styles.premiumMessage}>{premiumCopy.message}</Text>
            </View>
            {premiumLoadState === "loading" ? (
              <ActivityIndicator color={Theme.colors.primary} />
            ) : (
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={loadPremiumStatus}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="프리미엄 상태 새로고침"
              >
                <Ionicons name="refresh-outline" size={19} color={Theme.colors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.premiumGateRow}>
            <Ionicons
              name={hasActivePremium ? "lock-open-outline" : "lock-closed-outline"}
              size={17}
              color={hasActivePremium ? Theme.colors.success : Theme.colors.textSecondary}
            />
            <Text style={styles.premiumGateText}>{premiumCopy.meta}</Text>
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
            <ActionCard
              key={item.id}
              icon={item.id === "use-premium" && isPremiumUseLocked ? "lock-closed-outline" : item.icon}
              label={item.label}
              point={item.id === "use-premium" && isPremiumUseLocked ? "잠김" : item.point}
              disabled={item.id === "use-premium" && isPremiumUseLocked}
            />
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
  actionCardDisabled: {
    backgroundColor: Theme.colors.borderLight,
    borderColor: Theme.colors.borderLight
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
  premiumCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    ...Theme.shadow.sm
  },
  premiumCard_active: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0"
  },
  premiumCard_pending: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A"
  },
  premiumCard_failed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA"
  },
  premiumCard_locked: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border
  },
  premiumCard_idle: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  premiumIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  premiumIcon_active: {
    backgroundColor: "#D1FAE5"
  },
  premiumIcon_pending: {
    backgroundColor: "#FEF3C7"
  },
  premiumIcon_failed: {
    backgroundColor: "#FEE2E2"
  },
  premiumIcon_locked: {
    backgroundColor: "#F3F4F6"
  },
  premiumIcon_idle: {
    backgroundColor: "#F3F4F6"
  },
  premiumTextWrap: {
    flex: 1,
    minWidth: 0
  },
  premiumTitle: {
    fontSize: 18,
    lineHeight: 22,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  premiumMessage: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: Theme.colors.borderLight
  },
  premiumGateRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(17,24,39,0.08)",
    paddingTop: 12
  },
  premiumGateText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
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
