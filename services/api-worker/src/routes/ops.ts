import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { createAuditLog } from "../db/audit";
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

opsRoutes.use("*", async (c, next) => {
  const expectedToken = c.env.OPS_ADMIN_TOKEN;
  if (!expectedToken) {
    return errorResponse(c, 501, "OPS_NOT_CONFIGURED", "운영 API 토큰이 설정되지 않았습니다.");
  }

  if (adminToken(c) !== expectedToken) {
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
