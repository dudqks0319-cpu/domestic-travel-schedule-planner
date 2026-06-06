import { logAdEvent } from "./monetization";

export type RewardedAdPlacement = "free_export";

export type RewardedAdUnlockResult =
  | { status: "earned"; placement: RewardedAdPlacement }
  | { status: "unavailable"; placement: RewardedAdPlacement; reason: "sdk_not_configured" | "load_failed" };

export async function requestRewardedExportUnlock(input: {
  screen: string;
  format: "image" | "pdf";
}): Promise<RewardedAdUnlockResult> {
  await logAdEvent({
    placement: "free_export",
    eventType: "requested",
    metadata: {
      screen: input.screen,
      result: "rewarded_export_requested",
      format: input.format
    }
  }).catch(() => undefined);

  await logAdEvent({
    placement: "free_export",
    eventType: "failed",
    metadata: {
      screen: input.screen,
      result: "rewarded_export_unavailable",
      reason: "sdk_not_configured",
      format: input.format
    }
  }).catch(() => undefined);

  return {
    status: "unavailable",
    placement: "free_export",
    reason: "sdk_not_configured"
  };
}
