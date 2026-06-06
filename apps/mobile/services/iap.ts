import { Platform } from "react-native";

import {
  loadEntitlementState,
  verifyEntitlement,
  type PremiumEntitlementState,
  type VerifyEntitlementResult
} from "./monetization";

export const TRIPMATE_PREMIUM_PRODUCT_ID = "tripmate_premium_monthly";

export type StorePlatform = "apple" | "google";

export interface StoreVerificationPayload {
  productId?: string;
  receipt?: string;
  transactionId?: string;
  expiresAt?: string;
}

export type PremiumPurchaseResult =
  | {
      status: "unavailable";
      message: string;
    }
  | {
      status: "pending";
      message: string;
      verification?: VerifyEntitlementResult;
    }
  | {
      status: "active";
      message: string;
      entitlementState?: PremiumEntitlementState;
      verification?: VerifyEntitlementResult;
    };

export function resolveStorePlatform(): StorePlatform | null {
  if (Platform.OS === "ios") {
    return "apple";
  }

  if (Platform.OS === "android") {
    return "google";
  }

  return null;
}

export async function startPremiumPurchase(): Promise<PremiumPurchaseResult> {
  const platform = resolveStorePlatform();
  if (!platform) {
    return {
      status: "unavailable",
      message: "웹에서는 앱스토어/플레이 결제를 시작할 수 없어요."
    };
  }

  return {
    status: "unavailable",
    message: "프리미엄 구매는 스토어 결제 SDK 연결 후 사용할 수 있어요. 현재 빌드는 구매 복원과 서버 권한 확인만 지원합니다."
  };
}

export async function restorePremiumPurchase(): Promise<PremiumPurchaseResult> {
  const platform = resolveStorePlatform();
  if (!platform) {
    return {
      status: "unavailable",
      message: "웹에서는 앱스토어/플레이 결제 복원을 실행할 수 없어요."
    };
  }

  const entitlementState = await loadEntitlementState();
  return {
    status: entitlementState.premium ? "active" : "pending",
    entitlementState,
    message: entitlementState.premium
      ? "프리미엄 권한이 활성화됐어요."
      : "구매 복원은 스토어 SDK 연결 후 실제 영수증으로 검증됩니다. 현재 빌드는 권한 상태만 새로 확인했어요."
  };
}

export async function submitStoreVerification(
  payload: StoreVerificationPayload
): Promise<PremiumPurchaseResult> {
  const platform = resolveStorePlatform();
  if (!platform) {
    return {
      status: "unavailable",
      message: "웹에서는 스토어 영수증 검증을 실행할 수 없어요."
    };
  }

  const verification = await verifyEntitlement({
    platform,
    productId: payload.productId ?? TRIPMATE_PREMIUM_PRODUCT_ID,
    ...(payload.receipt ? { receipt: payload.receipt } : {}),
    ...(payload.transactionId ? { transactionId: payload.transactionId } : {}),
    ...(payload.expiresAt ? { expiresAt: payload.expiresAt } : {})
  });

  return {
    status: verification.premium ? "active" : "pending",
    verification,
    message: verification.premium
      ? "프리미엄 권한이 활성화됐어요."
      : "스토어 구매 정보가 서버에 접수됐고 검증 대기 상태입니다."
  };
}
