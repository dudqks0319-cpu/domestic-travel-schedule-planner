import React, { useEffect, useState } from "react";
import { Alert, Image, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Theme from "../../constants/Theme";
import { buildTripShareUrl, tripsApi, type TripWithPlacesDto } from "../../services/api";
import { hydrateCurrentTripFromServerTrip } from "../../services/tripHydration";
import {
  DEFAULT_FREE_ENTITLEMENT,
  loadEntitlementState,
  type PremiumEntitlementState
} from "../../services/monetization";
import { restorePremiumPurchase, startPremiumPurchase } from "../../services/iap";
import { clearLocalTripDraftDataForTrip } from "../../services/localTripStorage";
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
  const { deleteAccount, logout, user } = useAuth();
  const [entitlement, setEntitlement] = useState<PremiumEntitlementState>(DEFAULT_FREE_ENTITLEMENT);
  const [entitlementStatus, setEntitlementStatus] = useState<"loading" | "ready" | "guest">("loading");
  const [premiumActionStatus, setPremiumActionStatus] = useState<"idle" | "purchasing" | "restoring">("idle");
  const [premiumNotice, setPremiumNotice] = useState<string | null>(null);
  const [savedTrips, setSavedTrips] = useState<TripWithPlacesDto[]>([]);
  const [tripsStatus, setTripsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tripActionId, setTripActionId] = useState<string | null>(null);
  const [tripNotice, setTripNotice] = useState<string | null>(null);

  const point = 1850;
  const nextTierPoint = 2000;
  const progress = Math.min(1, point / nextTierPoint);
  const profileName = user?.nickname?.trim() || "여행자";
  const profileEmail = user?.email?.trim() || null;
  const profileImage = user?.profileImage?.trim() || null;
  const profileInitial = profileName.slice(0, 1).toUpperCase() || "T";

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const nextEntitlement = await loadEntitlementState();
        if (mounted) {
          setEntitlement(nextEntitlement);
          setEntitlementStatus("ready");
        }
      } catch {
        if (mounted) {
          setEntitlement(DEFAULT_FREE_ENTITLEMENT);
          setEntitlementStatus("guest");
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const loadSavedTrips = async () => {
    setTripsStatus("loading");
    try {
      const response = await tripsApi.listWithPlaces();
      setSavedTrips(response.data.trips ?? []);
      setTripsStatus("ready");
    } catch {
      setSavedTrips([]);
      setTripsStatus("error");
    }
  };

  useEffect(() => {
    void loadSavedTrips();
  }, []);

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃하면 이 기기에 저장된 임시 일정과 경로 캐시도 함께 삭제됩니다.", [
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

  const handleDeleteAccount = () => {
    Alert.alert("계정 삭제", "저장된 여행, 공유 링크, 세션, 내보내기 파일, 로컬 임시 일정 데이터가 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAccount();
            router.replace("/auth/login");
          } catch {
            Alert.alert("계정 삭제", "계정 삭제 요청에 실패했어요. 잠시 후 다시 시도해주세요.");
          }
        }
      }
    ]);
  };

  const handleStartPremium = async () => {
    setPremiumNotice(null);
    setPremiumActionStatus("purchasing");
    try {
      const result = await startPremiumPurchase();
      if ("entitlementState" in result && result.entitlementState) {
        setEntitlement(result.entitlementState);
        setEntitlementStatus("ready");
      }
      setPremiumNotice(result.message);
    } catch {
      setPremiumNotice("프리미엄 구매를 시작하지 못했어요. 로그인 상태나 네트워크를 확인해주세요.");
    } finally {
      setPremiumActionStatus("idle");
    }
  };

  const handleRestorePremium = async () => {
    setPremiumNotice(null);
    setPremiumActionStatus("restoring");
    try {
      const result = await restorePremiumPurchase();
      if ("entitlementState" in result && result.entitlementState) {
        setEntitlement(result.entitlementState);
        setEntitlementStatus("ready");
      }
      setPremiumNotice(result.message);
    } catch {
      setPremiumNotice("프리미엄 권한 상태를 확인하지 못했어요. 로그인 상태나 네트워크를 확인해주세요.");
    } finally {
      setPremiumActionStatus("idle");
    }
  };

  const openTrip = async (trip: TripWithPlacesDto) => {
    setTripActionId(trip.id);
    setTripNotice(null);
    try {
      await hydrateCurrentTripFromServerTrip(trip);
      router.push("/trip/schedule");
    } catch {
      setTripNotice("저장된 여행을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setTripActionId(null);
    }
  };

  const shareTrip = async (trip: TripWithPlacesDto) => {
    setTripActionId(trip.id);
    setTripNotice(null);
    try {
      const response = await tripsApi.createShare(trip.id);
      const shareUrl = buildTripShareUrl(response.data.share.token);
      const message = `${trip.title}\n${shareUrl}`;
      if (Platform.OS === "web") {
        const clipboard = (globalThis as { navigator?: { clipboard?: { writeText(text: string): Promise<void> } } })
          .navigator?.clipboard;
        if (clipboard) {
          await clipboard.writeText(shareUrl);
          setTripNotice("공유 링크를 클립보드에 복사했어요.");
        } else {
          setTripNotice(`공유 링크가 생성됐어요: ${shareUrl}`);
        }
      } else {
        await Share.share({ title: trip.title, message, url: shareUrl });
        setTripNotice("공유 링크를 만들었어요.");
      }
    } catch {
      setTripNotice("공유 링크를 만들지 못했어요. 로그인 상태나 네트워크를 확인해주세요.");
    } finally {
      setTripActionId(null);
    }
  };

  const deleteTrip = (trip: TripWithPlacesDto) => {
    Alert.alert("여행 삭제", `${trip.title} 여행을 삭제할까요? 공유 링크와 이 기기의 열린 일정도 함께 정리됩니다.`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          setTripActionId(trip.id);
          setTripNotice(null);
          try {
            await tripsApi.delete(trip.id);
            let localCleanupStatus: "cleared" | "failed" | "skipped" = "skipped";
            try {
              localCleanupStatus = await clearLocalTripDraftDataForTrip(trip.id) ? "cleared" : "skipped";
            } catch {
              localCleanupStatus = "failed";
            }
            setSavedTrips((current) => current.filter((item) => item.id !== trip.id));
            if (localCleanupStatus === "cleared") {
              setTripNotice("여행을 삭제했고 이 기기의 열린 일정도 정리했어요.");
            } else if (localCleanupStatus === "failed") {
              setTripNotice("여행은 삭제됐지만 이 기기의 열린 일정 정리는 실패했어요. 로그아웃하면 로컬 임시 데이터가 정리됩니다.");
            } else {
              setTripNotice("여행을 삭제했어요.");
            }
          } catch {
            setTripNotice("여행을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
          } finally {
            setTripActionId(null);
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileTop}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{profileInitial}</Text>
            </View>
          )}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{profileName}</Text>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={13} color="#111827" />
              <Text style={styles.badgeText}>{entitlement.premium ? "Premium" : "Free"}</Text>
            </View>
          </View>
          {profileEmail ? <Text style={styles.emailText} numberOfLines={1}>{profileEmail}</Text> : null}
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

        <View style={styles.premiumCard}>
          <View style={styles.premiumHeader}>
            <View>
              <Text style={styles.premiumEyebrow}>TripMate Premium</Text>
              <Text style={styles.premiumTitle}>
                {entitlement.premium ? "프리미엄 활성화됨" : "무료 플랜 사용 중"}
              </Text>
            </View>
            <View style={[styles.planBadge, entitlement.premium ? styles.planBadgePremium : null]}>
              <Text style={[styles.planBadgeText, entitlement.premium ? styles.planBadgeTextPremium : null]}>
                {entitlement.premium ? "PREMIUM" : "FREE"}
              </Text>
            </View>
          </View>
          <Text style={styles.premiumDescription}>
            {entitlementStatus === "loading"
              ? "권한 상태를 확인하고 있습니다."
              : entitlement.premium
                ? "광고 제거, 무제한 저장, 내보내기, 고급 재생성을 사용할 수 있습니다."
                : "저장/공유는 유지하고, 내보내기와 고급 재생성은 로그인 및 프리미엄에서 열립니다."}
          </Text>
          <View style={styles.benefitGrid}>
            <Text style={styles.benefitItem}>
              광고 제거 {entitlement.benefits.adsRemoved ? "ON" : "OFF"}
            </Text>
            <Text style={styles.benefitItem}>
              무제한 저장 {entitlement.benefits.unlimitedTrips ? "ON" : "OFF"}
            </Text>
            <Text style={styles.benefitItem}>
              PDF/이미지 {entitlement.benefits.exportEnabled ? "ON" : "OFF"}
            </Text>
            <Text style={styles.benefitItem}>
              날씨 대체코스 {entitlement.benefits.weatherAlternatives ? "ON" : "OFF"}
            </Text>
          </View>
          {premiumNotice ? <Text style={styles.premiumNotice}>{premiumNotice}</Text> : null}
          <View style={styles.premiumActionRow}>
            {!entitlement.premium ? (
              <TouchableOpacity
                style={styles.premiumActionButton}
                onPress={() => { void handleStartPremium(); }}
                disabled={premiumActionStatus !== "idle"}
                activeOpacity={0.78}
              >
                <Text style={styles.premiumActionText}>
                  {premiumActionStatus === "purchasing" ? "결제 준비 중..." : "프리미엄 시작"}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.premiumActionButton, styles.premiumSecondaryButton]}
              onPress={() => { void handleRestorePremium(); }}
              disabled={premiumActionStatus !== "idle"}
              activeOpacity={0.78}
            >
              <Text style={[styles.premiumActionText, styles.premiumSecondaryText]}>
                {premiumActionStatus === "restoring" ? "권한 확인 중..." : "구매 복원"}
              </Text>
            </TouchableOpacity>
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
        <View style={styles.tripListCard}>
          {tripNotice ? <Text style={styles.tripNotice}>{tripNotice}</Text> : null}
          {tripsStatus === "loading" ? (
            <Text style={styles.tripEmptyText}>저장된 여행을 불러오는 중...</Text>
          ) : null}
          {tripsStatus === "error" ? (
            <View style={styles.tripEmptyWrap}>
              <Text style={styles.tripEmptyTitle}>저장된 여행을 불러오지 못했어요.</Text>
              <TouchableOpacity style={styles.retryTripButton} onPress={() => { void loadSavedTrips(); }}>
                <Text style={styles.retryTripButtonText}>다시 불러오기</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {tripsStatus === "ready" && savedTrips.length === 0 ? (
            <View style={styles.tripEmptyWrap}>
              <Text style={styles.tripEmptyTitle}>저장된 여행이 아직 없어요.</Text>
              <Text style={styles.tripEmptyText}>지역, 날짜, 스타일만 골라 첫 일정을 만들어보세요.</Text>
              <TouchableOpacity style={styles.retryTripButton} onPress={() => router.push("/trip/create")}>
                <Text style={styles.retryTripButtonText}>일정 만들기</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {savedTrips.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripCardHeader}>
                <View style={styles.tripIconCircle}>
                  <Ionicons name="map-outline" size={18} color={Theme.colors.primary} />
                </View>
                <View style={styles.tripCardBody}>
                  <Text style={styles.tripCardTitle} numberOfLines={1}>{trip.title}</Text>
                  <Text style={styles.tripCardMeta} numberOfLines={1}>
                    {trip.destination} · {trip.startDate} - {trip.endDate}
                  </Text>
                  <Text style={styles.tripCardMeta}>{`${trip.places.length}개 장소 저장됨`}</Text>
                </View>
              </View>
              <View style={styles.tripActionRow}>
                <TouchableOpacity
                  style={styles.tripActionButton}
                  onPress={() => { void openTrip(trip); }}
                  disabled={tripActionId === trip.id}
                >
                  <Text style={styles.tripActionText}>열기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tripActionButton}
                  onPress={() => { void shareTrip(trip); }}
                  disabled={tripActionId === trip.id}
                >
                  <Text style={styles.tripActionText}>공유</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tripActionButton, styles.tripDeleteActionButton]}
                  onPress={() => deleteTrip(trip)}
                  disabled={tripActionId === trip.id}
                >
                  <Text style={[styles.tripActionText, styles.tripDeleteActionText]}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.75}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} activeOpacity={0.75}>
          <Text style={styles.deleteText}>계정 및 데이터 삭제</Text>
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
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: Theme.colors.primaryLight
  },
  avatarInitial: {
    fontSize: 34,
    lineHeight: 40,
    color: Theme.colors.primary,
    fontWeight: "800"
  },
  nameRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%"
  },
  name: {
    flexShrink: 1,
    maxWidth: "72%",
    fontSize: 34,
    lineHeight: 40,
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
  emailText: {
    marginTop: 4,
    maxWidth: "88%",
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textSecondary
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
  premiumCard: {
    marginTop: 14,
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    ...Theme.shadow.sm
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  premiumEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "800"
  },
  premiumTitle: {
    marginTop: 3,
    fontSize: 20,
    lineHeight: 26,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  planBadge: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  planBadgePremium: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primaryLight
  },
  planBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: Theme.colors.textSecondary,
    fontWeight: "900",
    letterSpacing: 0
  },
  planBadgeTextPremium: {
    color: Theme.colors.primaryDark
  },
  premiumDescription: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  benefitGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  benefitItem: {
    width: "48%",
    borderRadius: 8,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  premiumNotice: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: Theme.colors.primaryLight,
    color: Theme.colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  premiumActionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  premiumActionButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  premiumSecondaryButton: {
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface
  },
  premiumActionText: {
    fontSize: 13,
    lineHeight: 17,
    color: Theme.colors.textOnPrimary,
    fontWeight: "900",
    textAlign: "center"
  },
  premiumSecondaryText: {
    color: Theme.colors.primary
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
  tripListCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    gap: 10,
    ...Theme.shadow.sm
  },
  tripNotice: {
    borderRadius: 10,
    backgroundColor: Theme.colors.primaryLight,
    color: Theme.colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  tripEmptyWrap: {
    borderRadius: 12,
    backgroundColor: Theme.colors.background,
    padding: 14
  },
  tripEmptyTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  tripEmptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  retryTripButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  retryTripButtonText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textOnPrimary,
    fontWeight: "800"
  },
  tripCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: "#FAFCFF",
    padding: 12
  },
  tripCardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  tripIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  tripCardBody: {
    flex: 1,
    minWidth: 0
  },
  tripCardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  tripCardMeta: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textSecondary,
    fontWeight: "600"
  },
  tripActionRow: {
    marginTop: 11,
    flexDirection: "row",
    gap: 8
  },
  tripActionButton: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    paddingVertical: 9,
    alignItems: "center"
  },
  tripActionText: {
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  tripDeleteActionButton: {
    borderColor: "#FCA5A5"
  },
  tripDeleteActionText: {
    color: Theme.colors.error
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
  },
  deleteButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 12,
    alignItems: "center"
  },
  deleteText: {
    fontSize: 14,
    color: Theme.colors.error,
    fontWeight: "800"
  }
});
