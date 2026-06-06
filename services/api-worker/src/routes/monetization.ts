import { Hono, type Context } from "hono";

import { verifyToken } from "../auth/tokens";
import type { AppBindings } from "../bindings";
import { createAuditLog } from "../db/audit";
import {
  createAdEvent,
  createAffiliateClick,
  listActiveEntitlements,
  upsertEntitlement,
  type EntitlementPlatform,
  type EntitlementStatus
} from "../db/monetization";
import { errorResponse } from "../http/errors";
import { requireAuth } from "../middleware/auth";

export const monetizationRoutes = new Hono<AppBindings>();

const ALLOWED_AD_EVENTS = new Set(["requested", "loaded", "shown", "clicked", "dismissed", "failed"]);
const ALLOWED_AD_PLACEMENTS = new Set([
  "plan_generated",
  "share_completed",
  "free_export",
  "schedule_bottom",
  "map_bottom"
]);
const ALLOWED_AFFILIATE_PROVIDERS = new Set([
  "hotel",
  "rental_car",
  "ticket",
  "insurance",
  "local_tour"
]);
const ALLOWED_ENTITLEMENT_PLATFORMS = new Set<EntitlementPlatform>(["apple", "google", "manual"]);
const ALLOWED_ENTITLEMENT_STATUSES = new Set<EntitlementStatus>([
  "active",
  "expired",
  "revoked",
  "pending"
]);

async function optionalUserId(c: Context<AppBindings>): Promise<string | undefined> {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length).trim();
  const payload = await verifyToken(c.env, token, "access");
  return payload?.sub;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const allowedKeys = ["tripId", "screen", "provider", "result", "reason", "styleKey"];
  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, source[key]] as const)
      .filter(([, entry]) => ["string", "number", "boolean"].includes(typeof entry))
  );
}

function isProductionEnvironment(c: Context<AppBindings>): boolean {
  return c.env.ENVIRONMENT === "production";
}

function hasStoreValidationSecret(c: Context<AppBindings>, platform: EntitlementPlatform): boolean {
  if (platform === "apple") {
    return Boolean(c.env.APPLE_SHARED_SECRET);
  }

  if (platform === "google") {
    return Boolean(c.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  }

  return false;
}

function resolveEntitlementVerification(input: {
  c: Context<AppBindings>;
  platform: EntitlementPlatform;
  requestedStatus: EntitlementStatus;
  receipt?: string;
  transactionId?: string;
}): {
  status: EntitlementStatus;
  verificationMode: "store-validation-ready" | "store-validation-pending" | "manual-non-production";
  reason: string;
} {
  if (input.platform === "manual") {
    if (isProductionEnvironment(input.c)) {
      return {
        status: "pending",
        verificationMode: "store-validation-pending",
        reason: "manual_entitlements_disabled_in_production"
      };
    }

    return {
      status: input.requestedStatus,
      verificationMode: "manual-non-production",
      reason: "manual_entitlement_allowed_outside_production"
    };
  }

  if (!input.receipt && !input.transactionId) {
    return {
      status: "pending",
      verificationMode: "store-validation-pending",
      reason: "missing_store_receipt"
    };
  }

  if (!hasStoreValidationSecret(input.c, input.platform)) {
    return {
      status: "pending",
      verificationMode: "store-validation-pending",
      reason: "store_validation_secret_missing"
    };
  }

  return {
    status: "pending",
    verificationMode: "store-validation-ready",
    reason: "live_store_validation_not_yet_implemented"
  };
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toPublicEntitlement(record: Awaited<ReturnType<typeof listActiveEntitlements>>[number]) {
  return {
    id: record.id,
    platform: record.platform,
    productId: record.product_id,
    status: record.status,
    expiresAt: record.expires_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

monetizationRoutes.post("/ad-events", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const placement = stringValue(body?.placement);
  const eventType = stringValue(body?.eventType);

  if (!placement || !ALLOWED_AD_PLACEMENTS.has(placement)) {
    return errorResponse(c, 400, "INVALID_AD_PLACEMENT", "지원하지 않는 광고 위치입니다.");
  }

  if (!eventType || !ALLOWED_AD_EVENTS.has(eventType)) {
    return errorResponse(c, 400, "INVALID_AD_EVENT", "지원하지 않는 광고 이벤트입니다.");
  }

  const userId = await optionalUserId(c);
  const eventId = await createAdEvent(c.env.DB, {
    ...(userId ? { userId } : {}),
    placement,
    eventType,
    metadata: sanitizeMetadata(body?.metadata)
  });

  return c.json({ data: { id: eventId, accepted: true } }, 201);
});

monetizationRoutes.post("/affiliate-clicks", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const provider = stringValue(body?.provider);
  const placement = stringValue(body?.placement);
  const targetUrl = stringValue(body?.targetUrl);
  const tripId = stringValue(body?.tripId);

  if (!provider || !ALLOWED_AFFILIATE_PROVIDERS.has(provider)) {
    return errorResponse(c, 400, "INVALID_AFFILIATE_PROVIDER", "지원하지 않는 제휴 유형입니다.");
  }

  if (!placement) {
    return errorResponse(c, 400, "INVALID_AFFILIATE_PLACEMENT", "제휴 클릭 위치가 필요합니다.");
  }

  if (!targetUrl || !/^https:\/\//.test(targetUrl)) {
    return errorResponse(c, 400, "INVALID_AFFILIATE_TARGET", "안전한 외부 예약 링크가 필요합니다.");
  }

  const userId = await optionalUserId(c);
  const clickId = await createAffiliateClick(c.env.DB, {
    ...(userId ? { userId } : {}),
    ...(tripId ? { tripId } : {}),
    provider,
    targetUrlHash: await sha256Hex(targetUrl),
    placement
  });

  return c.json({ data: { id: clickId, accepted: true } }, 201);
});

monetizationRoutes.post("/entitlements/verify", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "로그인이 필요한 기능입니다.");
  }

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const platform = stringValue(body?.platform) as EntitlementPlatform | undefined;
  const productId = stringValue(body?.productId);
  const requestedStatus = (stringValue(body?.status) ?? "pending") as EntitlementStatus;
  const receipt = stringValue(body?.receipt);
  const transactionId = stringValue(body?.transactionId);
  const expiresAt = stringValue(body?.expiresAt);

  if (!platform || !ALLOWED_ENTITLEMENT_PLATFORMS.has(platform)) {
    return errorResponse(c, 400, "INVALID_ENTITLEMENT_PLATFORM", "지원하지 않는 결제 플랫폼입니다.");
  }

  if (!productId) {
    return errorResponse(c, 400, "INVALID_PRODUCT", "상품 ID가 필요합니다.");
  }

  if (!ALLOWED_ENTITLEMENT_STATUSES.has(requestedStatus)) {
    return errorResponse(c, 400, "INVALID_ENTITLEMENT_STATUS", "지원하지 않는 권한 상태입니다.");
  }

  const verification = resolveEntitlementVerification({
    c,
    platform,
    requestedStatus,
    ...(receipt ? { receipt } : {}),
    ...(transactionId ? { transactionId } : {})
  });
  const receiptSource = receipt ?? transactionId;
  const entitlement = await upsertEntitlement(c.env.DB, {
    userId,
    platform,
    productId,
    status: verification.status,
    ...(expiresAt ? { expiresAt } : {}),
    ...(receiptSource ? { receiptHash: await sha256Hex(receiptSource) } : {})
  });

  await createAuditLog(c.env.DB, {
    userId,
    action: "entitlement.verify",
    entityType: "subscription_entitlement",
    entityId: entitlement.id,
    requestId: c.get("requestId"),
    metadata: {
      platform,
      productId,
      status: entitlement.status,
      verificationMode: verification.verificationMode,
      reason: verification.reason
    }
  });

  return c.json({
    data: {
      entitlement: toPublicEntitlement(entitlement),
      premium: entitlement.status === "active",
      verificationMode: verification.verificationMode,
      reason: verification.reason
    }
  });
});

monetizationRoutes.get("/entitlements/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "로그인이 필요한 기능입니다.");
  }

  const entitlements = await listActiveEntitlements(c.env.DB, userId);
  return c.json({
    data: {
      premium: entitlements.length > 0,
      entitlements: entitlements.map(toPublicEntitlement),
      benefits: {
        adsRemoved: entitlements.length > 0,
        unlimitedTrips: entitlements.length > 0,
        exportEnabled: entitlements.length > 0,
        advancedReplan: entitlements.length > 0,
        weatherAlternatives: entitlements.length > 0,
        collaborationReady: entitlements.length > 0
      }
    }
  });
});
