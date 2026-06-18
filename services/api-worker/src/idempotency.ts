import { createCorsHeaders, errorResponse, jsonResponse } from "./http.js";
import type { D1Database, RequestContext } from "./types.js";

interface IdempotencyRow {
  idempotency_key: string;
  request_hash: string;
  response_status: number;
  response_body_json: string | null;
}

export type IdempotencyDecision =
  | { enabled: false }
  | {
      enabled: true;
      userId: string;
      routeKey: string;
      key: string;
      requestHash: string;
    };

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

export async function prepareIdempotency(
  request: Request,
  context: RequestContext,
  userId: string,
  requestBodyText: string
): Promise<IdempotencyDecision | Response> {
  const key = request.headers.get("x-idempotency-key")?.trim();
  if (!key) {
    return { enabled: false };
  }

  if (key.length < 8 || key.length > 128 || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return errorResponse(
      request,
      context.env,
      context.requestId,
      400,
      "invalid_idempotency_key",
      "X-Idempotency-Key must be 8-128 characters using letters, numbers, dot, underscore, colon, or hyphen."
    );
  }

  const routeKey = `${request.method.toUpperCase()} ${new URL(request.url).pathname}`;
  const requestHash = await hashText(`${routeKey}\n${requestBodyText}`);
  const existing = await context.env.DB
    .prepare(
      `SELECT idempotency_key, request_hash, response_status, response_body_json
       FROM idempotency_keys
       WHERE user_id = ? AND route_key = ? AND idempotency_key = ?`
    )
    .bind(userId, routeKey, key)
    .first<IdempotencyRow>();

  if (!existing) {
    return {
      enabled: true,
      userId,
      routeKey,
      key,
      requestHash
    };
  }

  if (existing.request_hash !== requestHash) {
    return errorResponse(
      request,
      context.env,
      context.requestId,
      409,
      "idempotency_key_reuse",
      "X-Idempotency-Key was already used for a different request payload."
    );
  }

  return createReplayResponse(request, context, existing);
}

export async function storeIdempotencyResult(
  db: D1Database,
  decision: IdempotencyDecision,
  status: number,
  body: unknown
): Promise<boolean> {
  if (!decision.enabled) {
    return true;
  }

  const result = await db
    .prepare(
      `INSERT INTO idempotency_keys (
        id, user_id, route_key, idempotency_key, request_hash, response_status, response_body_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      decision.userId,
      decision.routeKey,
      decision.key,
      decision.requestHash,
      status,
      body === undefined ? null : JSON.stringify(body),
      new Date().toISOString()
    )
    .run();

  return result.success;
}

function createReplayResponse(
  request: Request,
  context: RequestContext,
  row: IdempotencyRow
): Response {
  if (row.response_body_json) {
    let body: unknown;
    try {
      body = JSON.parse(row.response_body_json);
    } catch {
      return errorResponse(
        request,
        context.env,
        context.requestId,
        500,
        "idempotency_replay_error",
        "Stored idempotent response could not be decoded."
      );
    }

    const response = jsonResponse(request, context.env, body, row.response_status, context.requestId);
    response.headers.set("X-Idempotent-Replay", "true");
    return response;
  }

  const headers = createCorsHeaders(request, context.env);
  headers.set("X-Request-Id", context.requestId);
  headers.set("X-Idempotent-Replay", "true");
  return new Response(null, {
    status: row.response_status,
    headers
  });
}

async function hashText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
