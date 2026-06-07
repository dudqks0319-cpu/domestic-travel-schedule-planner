import apiClient from "./api";

export type MonetizationPlacement =
  | "plan_generated"
  | "share_completed"
  | "free_export"
  | "schedule_bottom"
  | "map_bottom";

export type AdEventType = "requested" | "loaded" | "shown" | "clicked" | "dismissed" | "failed";

export type AffiliateProvider = "hotel" | "rental_car" | "ticket" | "insurance" | "local_tour";

export interface PremiumEntitlementState {
  premium: boolean;
  entitlements?: Array<{
    id: string;
    platform: EntitlementPlatform;
    productId: string;
    status: EntitlementStatus;
    expiresAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  benefits: {
    adsRemoved: boolean;
    unlimitedTrips: boolean;
    exportEnabled: boolean;
    advancedReplan: boolean;
    weatherAlternatives: boolean;
    collaborationReady: boolean;
  };
}

export type EntitlementPlatform = "apple" | "google" | "manual";
export type EntitlementStatus = "active" | "expired" | "revoked" | "pending";

export interface VerifyEntitlementInput {
  platform: Exclude<EntitlementPlatform, "manual">;
  productId: string;
  receipt?: string;
  transactionId?: string;
  expiresAt?: string;
}

export interface VerifyEntitlementResult {
  entitlement: NonNullable<PremiumEntitlementState["entitlements"]>[number];
  premium: boolean;
  canUnlockPremium: boolean;
  verificationRequired: boolean;
  verificationMode: "store-validation-ready" | "store-validation-pending" | "manual-non-production";
  reason: string;
}

export const DEFAULT_FREE_ENTITLEMENT: PremiumEntitlementState = {
  premium: false,
  entitlements: [],
  benefits: {
    adsRemoved: false,
    unlimitedTrips: false,
    exportEnabled: false,
    advancedReplan: false,
    weatherAlternatives: false,
    collaborationReady: false
  }
};

export async function loadEntitlementState(): Promise<PremiumEntitlementState> {
  const response = await apiClient.get("/monetization/entitlements/me");
  const data = response.data?.data as Partial<PremiumEntitlementState> | undefined;
  return {
    premium: data?.premium === true,
    entitlements: data?.entitlements ?? [],
    benefits: {
      ...DEFAULT_FREE_ENTITLEMENT.benefits,
      ...(data?.benefits ?? {})
    }
  };
}

export async function verifyEntitlement(input: VerifyEntitlementInput): Promise<VerifyEntitlementResult> {
  const response = await apiClient.post("/monetization/entitlements/verify", input);
  return response.data?.data as VerifyEntitlementResult;
}

export async function logAdEvent(input: {
  placement: MonetizationPlacement;
  eventType: AdEventType;
  metadata?: Record<string, string | number | boolean | undefined>;
}): Promise<void> {
  await apiClient.post("/monetization/ad-events", {
    placement: input.placement,
    eventType: input.eventType,
    metadata: input.metadata ?? {}
  });
}

export async function logAffiliateClick(input: {
  provider: AffiliateProvider;
  placement: string;
  targetUrl: string;
  tripId?: string;
}): Promise<void> {
  await apiClient.post("/monetization/affiliate-clicks", input);
}
