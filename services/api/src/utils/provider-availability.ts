import { env } from "../config/env";

export type ProviderId = "data-go-kr" | "naver-local";
export type ProviderUnavailableReason = "disabled" | "missing_credentials";

export interface ProviderAvailability {
  provider: ProviderId;
  available: boolean;
  reason?: ProviderUnavailableReason;
}

export interface ProviderFallbackMeta {
  degraded: true;
  provider: ProviderId;
  reason: ProviderUnavailableReason;
  retryable: false;
}

const PLACEHOLDER_CREDENTIALS = [
  /^replace-with-/i,
  /^local-placeholder$/i,
  /^placeholder$/i,
  /^change-me$/i,
  /^changeme$/i
];

function hasUsableCredential(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !PLACEHOLDER_CREDENTIALS.some((pattern) => pattern.test(trimmed));
}

function getProviderAvailability(
  provider: ProviderId,
  enabled: boolean,
  credentials: string[]
): ProviderAvailability {
  if (!enabled) {
    return { provider, available: false, reason: "disabled" };
  }

  if (!credentials.every(hasUsableCredential)) {
    return { provider, available: false, reason: "missing_credentials" };
  }

  return { provider, available: true };
}

export function getDataGoKrProviderAvailability(): ProviderAvailability {
  return getProviderAvailability("data-go-kr", env.providerFlags.dataGoKr, [
    env.dataGoKrApiKey
  ]);
}

export function getNaverLocalProviderAvailability(): ProviderAvailability {
  return getProviderAvailability("naver-local", env.providerFlags.naverLocal, [
    env.naverClientId,
    env.naverClientSecret
  ]);
}

export function createProviderFallbackMeta(
  availability: ProviderAvailability
): ProviderFallbackMeta | undefined {
  if (availability.available || !availability.reason) {
    return undefined;
  }

  return {
    degraded: true,
    provider: availability.provider,
    reason: availability.reason,
    retryable: false
  };
}

export function createProviderListResponse<T>(
  items: T[],
  availability: ProviderAvailability
): { items: T[]; meta?: ProviderFallbackMeta } {
  const meta = createProviderFallbackMeta(availability);
  return meta ? { items, meta } : { items };
}

export function logProviderUnavailable(context: string, availability: ProviderAvailability): void {
  if (availability.available || !availability.reason) {
    return;
  }

  console.warn(
    `[provider:${availability.provider}] ${context} skipped: ${availability.reason}`
  );
}
