import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppBindings, Env } from "./bindings";
import { errorResponse } from "./http/errors";
import { requestIdMiddleware } from "./middleware/request-id";
import { recordOperationalEvent } from "./db/operations";
import { runOpsRetention } from "./ops/retention";
import { healthRoutes } from "./routes/health";
import { sharePageRoutes } from "./routes/share-page";
import { v1Routes } from "./routes/v1";

function allowedOrigins(rawOrigins: string | undefined): string[] {
  return (rawOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const app = new Hono<AppBindings>();

app.use("*", requestIdMiddleware);
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = allowedOrigins(c.env.ALLOWED_ORIGINS);
      if (!origin || allowed.length === 0) {
        return origin;
      }
      return allowed.includes(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-request-id"],
    exposeHeaders: ["x-request-id"],
    maxAge: 600
  })
);

app.route("/health", healthRoutes);
app.route("/share", sharePageRoutes);
app.route("/api/v1", v1Routes);

app.notFound((c) => errorResponse(c, 404, "NOT_FOUND", "요청한 API를 찾을 수 없습니다."));

app.onError((error, c) => {
  console.error(JSON.stringify({
    level: "error",
    requestId: c.get("requestId"),
    message: error.message
  }));
  return errorResponse(c, 500, "INTERNAL_ERROR", "일시적인 오류가 발생했습니다.");
});

async function runScheduledRetention(
  controller: ScheduledController,
  env: Env
): Promise<void> {
  const startedAt = Date.now();
  const requestId = `scheduled-retention-${controller.scheduledTime}`;

  try {
    const result = await runOpsRetention({
      db: env.DB,
      assets: env.TRIPMATE_ASSETS,
      requestId,
      action: "ops.retention.scheduled"
    });
    await recordOperationalEvent(env.DB, {
      eventType: "retention",
      target: "ops.retention.scheduled",
      status: "success",
      durationMs: Date.now() - startedAt,
      requestId
    });
    console.log(JSON.stringify({
      level: "info",
      message: "scheduled_retention_completed",
      requestId,
      deleted: result.deleted
    }));
  } catch (error) {
    await recordOperationalEvent(env.DB, {
      eventType: "retention",
      target: "ops.retention.scheduled",
      status: "failure",
      durationMs: Date.now() - startedAt,
      requestId
    });
    console.error(JSON.stringify({
      level: "error",
      message: "scheduled_retention_failed",
      requestId,
      error: error instanceof Error ? error.message : "unknown"
    }));
    throw error;
  }
}

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  scheduled: (controller, env, ctx) => {
    ctx.waitUntil(runScheduledRetention(controller, env));
  }
} satisfies ExportedHandler<Env>;
