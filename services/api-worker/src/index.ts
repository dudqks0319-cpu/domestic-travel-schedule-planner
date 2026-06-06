import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppBindings } from "./bindings";
import { errorResponse } from "./http/errors";
import { requestIdMiddleware } from "./middleware/request-id";
import { healthRoutes } from "./routes/health";
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

export default app;
