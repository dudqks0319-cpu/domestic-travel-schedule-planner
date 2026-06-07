import { Platform } from "react-native";

import {
  loadEntitlementState,
  verifyEntitlement,
  type PremiumEntitlementState,
  type VerifyEntitlementResult
} from "./monetization";

export const TRIPMATE_PREMIUM_PRODUCT_ID = "tripmate_premium_monthly";

export type StorePlatform = "apple" | "google";
export type IapIntegrationStatus = "disabled" | "sdk-configured";

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

export function readIapIntegrationStatus(): IapIntegrationStatus {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;
  const value = maybeProcess?.env?.EXPO_PUBLIC_IAP_STATUS?.trim();
  return value === "sdk-configured" ? "sdk-configured" : "disabled";
}

function storeVerificationMessage(verification: VerifyEntitlementResult): string {
  if (verification.premium && verification.canUnlockPremium) {
    return "프리미엄 권한이 활성화됐어요.";
  }

  if (verification.reason === "missing_store_receipt") {
    return "스토어 거래 ID 또는 영수증이 필요해요. 결제 SDK가 반환한 값을 제출해주세요.";
  }

  if (verification.reason === "store_validation_secret_missing") {
    return "스토어 검증 서버 설정이 아직 완료되지 않아 권한이 대기 상태로 저장됐어요.";
  }

  if (verification.reason === "live_store_validation_not_yet_implemented") {
    return "스토어 구매 정보는 접수됐지만 실제 스토어 검증 연동 전까지 권한은 대기 상태입니다.";
  }

  return verification.verificationRequired
    ? "스토어 구매 정보가 서버에 접수됐고 검증 대기 상태입니다."
    : "프리미엄 권한 상태를 확인했어요.";
}

export async function startPremiumPurchase(): Promise<PremiumPurchaseResult> {
  const platform = resolveStorePlatform();
  const iapStatus = readIapIntegrationStatus();
  if (!platform) {
    return {
      status: "unavailable",
      message: "웹에서는 앱스토어/플레이 결제를 시작할 수 없어요."
    };
  }

  if (iapStatus === "disabled") {
    return {
      status: "unavailable",
      message: "현재 빌드는 스토어 결제 SDK가 비활성화되어 있어 구매를 시작할 수 없어요."
    };
  }

  return {
    status: "unavailable",
    message: "스토어 결제 SDK 상태는 활성으로 설정됐지만 native purchase bridge가 아직 연결되지 않았어요."
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
    message: storeVerificationMessage(verification)
  };
}
