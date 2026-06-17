import type { ApiErrorBody, Env } from "./types.js";

export function createCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  const allowWildcard = env.ENVIRONMENT !== "production" && allowedOrigins.includes("*");

  if (origin && (allowWildcard || allowedOrigins.includes(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-Id");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function jsonResponse(
  request: Request,
  env: Env,
  body: unknown,
  status = 200,
  requestId?: string
): Response {
  const headers = createCorsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (requestId) {
    headers.set("X-Request-Id", requestId);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(
  request: Request,
  env: Env,
  requestId: string,
  status: number,
  code: string,
  message: string
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      requestId
    }
  };

  return jsonResponse(request, env, body, status, requestId);
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
