import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { createAuditLog } from "../db/audit";
import {
  deactivateSponsoredPlace,
  listSponsoredPlaces,
  upsertSponsoredPlace,
  type SponsoredPlaceInput
} from "../db/sponsored-places";
import { errorResponse } from "../http/errors";
import {
  DEFAULT_AUDIT_RETENTION_DAYS,
  DEFAULT_OPERATIONAL_RETENTION_DAYS,
  runOpsRetention
} from "../ops/retention";

export const opsRoutes = new Hono<AppBindings>();

interface OperationalSummaryRow {
  event_type: string;
  target: string;
  status: string;
  count: number;
  avg_duration_ms: number | null;
  max_duration_ms: number | null;
}

interface AdEventSummaryRow {
  placement: string;
  event_type: string;
  count: number;
}

interface AffiliateSummaryRow {
  provider: string;
  placement: string;
  count: number;
}

interface EntitlementSummaryRow {
  platform: string;
  status: string;
  count: number;
}

function adminToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const authorization = c.req.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return c.req.header("x-ops-token")?.trim() ?? null;
}

function constantTimeTokenEquals(actual: string | null, expected: string): boolean {
  if (!actual) {
    return false;
  }

  const maxLength = Math.max(actual.length, expected.length);
  let diff = actual.length ^ expected.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }

  return diff === 0;
}

function hoursParam(value: string | undefined): number {
  if (!value) {
    return 24;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.min(168, Math.max(1, Math.floor(parsed)));
}

function daysParam(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function booleanParam(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function statusValue(value: unknown): NonNullable<SponsoredPlaceInput["status"]> {
  return value === "active" || value === "paused" || value === "inactive" ? value : "active";
}

function optionalDateTime(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) {
    return undefined;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return text;
}

function sponsoredPlaceInput(raw: Record<string, unknown>, existingId?: string): SponsoredPlaceInput | null {
  const name = stringValue(raw.name);
  const sponsorLabel = stringValue(raw.sponsorLabel ?? raw.sponsor_label);
  if (!name || !sponsorLabel) {
    return null;
  }

  const providerPlaceId = stringValue(raw.providerPlaceId ?? raw.provider_place_id);
  const startsAt = optionalDateTime(raw.startsAt ?? raw.starts_at);
  const endsAt = optionalDateTime(raw.endsAt ?? raw.ends_at);
  const input: SponsoredPlaceInput = {
    ...(existingId ? { id: existingId } : {}),
    name,
    sponsorLabel,
    disclosureText: stringValue(raw.disclosureText ?? raw.disclosure_text) ?? "스폰서",
    status: statusValue(raw.status)
  };
  if (providerPlaceId) input.providerPlaceId = providerPlaceId;
  if (startsAt) input.startsAt = startsAt;
  if (endsAt) input.endsAt = endsAt;

  return input;
}

opsRoutes.use("*", async (c, next) => {
  const expectedToken = c.env.OPS_ADMIN_TOKEN?.trim();
  if (!expectedToken) {
    return errorResponse(c, 501, "OPS_NOT_CONFIGURED", "운영 API 토큰이 설정되지 않았습니다.");
  }

  if (!constantTimeTokenEquals(adminToken(c), expectedToken)) {
    return errorResponse(c, 403, "OPS_FORBIDDEN", "운영 API 권한이 없습니다.");
  }

  await next();
});

opsRoutes.get("/summary", async (c) => {
  const hours = hoursParam(c.req.query("hours"));
  const sinceModifier = `-${hours} hours`;
  const [operationalEvents, adEvents, affiliateClicks, entitlements] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT
          event_type,
          target,
          status,
          COUNT(*) AS count,
          ROUND(AVG(duration_ms)) AS avg_duration_ms,
          MAX(duration_ms) AS max_duration_ms
         FROM operational_events
         WHERE created_at >= datetime('now', ?)
         GROUP BY event_type, target, status
         ORDER BY target ASC, status ASC`
      )
      .bind(sinceModifier)
      .all<OperationalSummaryRow>(),
    c.env.DB
      .prepare(
        `SELECT placement, event_type, COUNT(*) AS count
         FROM ad_events
         WHERE created_at >= datetime('now', ?)
         GROUP BY placement, event_type
         ORDER BY placement ASC, event_type ASC`
      )
      .bind(sinceModifier)
      .all<AdEventSummaryRow>(),
    c.env.DB
      .prepare(
        `SELECT provider, placement, COUNT(*) AS count
         FROM affiliate_clicks
         WHERE created_at >= datetime('now', ?)
         GROUP BY provider, placement
         ORDER BY provider ASC, placement ASC`
      )
      .bind(sinceModifier)
      .all<AffiliateSummaryRow>(),
    c.env.DB
      .prepare(
        `SELECT platform, status, COUNT(*) AS count
         FROM subscription_entitlements
         WHERE deleted_at IS NULL
         GROUP BY platform, status
         ORDER BY platform ASC, status ASC`
      )
      .all<EntitlementSummaryRow>()
  ]);

  await createAuditLog(c.env.DB, {
    action: "ops.summary.read",
    entityType: "ops_summary",
    requestId: c.get("requestId") ?? "unknown",
    metadata: {
      windowHours: hours
    }
  });

  return c.json({
    ok: true,
    window: {
      hours,
      since: sinceModifier
    },
    operationalEvents: operationalEvents.results ?? [],
    adEvents: adEvents.results ?? [],
    affiliateClicks: affiliateClicks.results ?? [],
    entitlements: entitlements.results ?? [],
    requestId: c.get("requestId")
  });
});

opsRoutes.post("/retention", async (c) => {
  const result = await runOpsRetention({
    db: c.env.DB,
    assets: c.env.TRIPMATE_ASSETS,
    auditRetentionDays: daysParam(c.req.query("auditDays"), DEFAULT_AUDIT_RETENTION_DAYS, 30, 2555),
    operationalRetentionDays: daysParam(
      c.req.query("operationalDays"),
      DEFAULT_OPERATIONAL_RETENTION_DAYS,
      7,
      730
    ),
    dryRun: booleanParam(c.req.query("dryRun")),
    action: "ops.retention.run",
    requestId: c.get("requestId") ?? "unknown"
  });

  return c.json({
    ok: true,
    ...result,
    requestId: c.get("requestId")
  });
});

opsRoutes.get("/sponsored-places", async (c) => {
  const sponsoredPlaces = await listSponsoredPlaces(c.env.DB);
  await createAuditLog(c.env.DB, {
    action: "ops.sponsored_places.list",
    entityType: "sponsored_place",
    requestId: c.get("requestId") ?? "unknown",
    metadata: {
      placeCount: sponsoredPlaces.length,
      hasSponsored: sponsoredPlaces.length > 0
    }
  });

  return c.json({
    ok: true,
    sponsoredPlaces,
    requestId: c.get("requestId")
  });
});

opsRoutes.post("/sponsored-places", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = sponsoredPlaceInput(raw);
  if (!input) {
    return errorResponse(c, 400, "INVALID_SPONSORED_PLACE", "스폰서 장소명과 표시 라벨이 필요합니다.");
  }

  const sponsoredPlace = await upsertSponsoredPlace(c.env.DB, input);
  await createAuditLog(c.env.DB, {
    action: "ops.sponsored_places.create",
    entityType: "sponsored_place",
    entityId: sponsoredPlace.id,
    requestId: c.get("requestId") ?? "unknown",
    metadata: {
      status: sponsoredPlace.status,
      hasSponsored: true
    }
  });

  return c.json({
    ok: true,
    sponsoredPlace,
    requestId: c.get("requestId")
  }, 201);
});

opsRoutes.patch("/sponsored-places/:sponsorId", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = sponsoredPlaceInput(raw, c.req.param("sponsorId"));
  if (!input) {
    return errorResponse(c, 400, "INVALID_SPONSORED_PLACE", "스폰서 장소명과 표시 라벨이 필요합니다.");
  }

  const sponsoredPlace = await upsertSponsoredPlace(c.env.DB, input);
  await createAuditLog(c.env.DB, {
    action: "ops.sponsored_places.update",
    entityType: "sponsored_place",
    entityId: sponsoredPlace.id,
    requestId: c.get("requestId") ?? "unknown",
    metadata: {
      status: sponsoredPlace.status,
      hasSponsored: true
    }
  });

  return c.json({
    ok: true,
    sponsoredPlace,
    requestId: c.get("requestId")
  });
});

opsRoutes.delete("/sponsored-places/:sponsorId", async (c) => {
  const sponsorId = c.req.param("sponsorId");
  const deactivated = await deactivateSponsoredPlace(c.env.DB, sponsorId);
  if (!deactivated) {
    return errorResponse(c, 404, "SPONSORED_PLACE_NOT_FOUND", "스폰서 장소를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    action: "ops.sponsored_places.delete",
    entityType: "sponsored_place",
    entityId: sponsorId,
    requestId: c.get("requestId") ?? "unknown",
    metadata: {
      status: "inactive",
      hasSponsored: false
    }
  });

  return c.json({
    ok: true,
    deactivated: true,
    requestId: c.get("requestId")
  });
});
