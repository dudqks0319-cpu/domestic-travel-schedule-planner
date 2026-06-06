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
  benefits: {
    adsRemoved: boolean;
    unlimitedTrips: boolean;
    exportEnabled: boolean;
    advancedReplan: boolean;
    weatherAlternatives: boolean;
    collaborationReady: boolean;
  };
}

export const DEFAULT_FREE_ENTITLEMENT: PremiumEntitlementState = {
  premium: false,
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
    benefits: {
      ...DEFAULT_FREE_ENTITLEMENT.benefits,
      ...(data?.benefits ?? {})
    }
  };
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
