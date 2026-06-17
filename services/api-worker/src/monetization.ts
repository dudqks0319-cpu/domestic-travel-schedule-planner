import { errorResponse, jsonResponse } from "./http.js";
import { prepareIdempotency, storeIdempotencyResult } from "./idempotency.js";
import { verifyStorePurchase } from "./store-verification.js";
import type { AuthenticatedUser, D1Database, RequestContext, RouteHandler } from "./types.js";

interface EntitlementRow {
  id: string;
  store: string;
  product_id: string;
  transaction_id: string;
  status: string;
  expires_at: string | null;
  verified_at: string;
  created_at: string;
  updated_at: string;
}

interface AdEventInput {
  placement: string;
  eventType: string;
  metadata: Record<string, string> | null;
}

interface AffiliateClickInput {
  provider: string;
  targetUrl: string;
  tripId: string | null;
}

interface EntitlementVerifyInput {
  store: "apple" | "google";
  productId: string;
  transactionId: string;
  receiptData: string | null;
}

const ENTITLEMENT_COLUMNS = [
  "id",
  "store",
  "product_id",
  "transaction_id",
  "status",
  "expires_at",
  "verified_at",
  "created_at",
  "updated_at"
].join(", ");

const AD_EVENT_TYPES = new Set(["impression", "click", "reward_earned", "dismissed"]);
const MAX_METADATA_KEYS = 12;
const MAX_METADATA_VALUE_LENGTH = 240;

export const createAdEventHandler: RouteHandler = async (request, context) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const input = parseAdEventInput(requestBodyText, request, context);
  if (input instanceof Response) {
    return input;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const result = await context.env.DB
    .prepare(
      `INSERT INTO ad_events (
        id, user_id, placement, event_type, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, input.placement, input.eventType, stringifyMetadata(input.metadata), now)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }

  const body = {
    item: {
      id,
      placement: input.placement,
      eventType: input.eventType,
      createdAt: now
    }
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 201, body))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, body, 201, context.requestId);
};

export const createAffiliateClickHandler: RouteHandler = async (request, context) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const input = parseAffiliateClickInput(requestBodyText, request, context);
  if (input instanceof Response) {
    return input;
  }

  if (input.tripId && !(await userOwnsTrip(context.env.DB, user.id, input.tripId))) {
    return notFound(request, context, "Trip not found.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const targetUrlHash = await hashText(input.targetUrl);
  const result = await context.env.DB
    .prepare(
      `INSERT INTO affiliate_clicks (
        id, user_id, provider, target_url_hash, trip_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, input.provider, targetUrlHash, input.tripId, now)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }

  const body = {
    item: {
      id,
      provider: input.provider,
      tripId: input.tripId,
      createdAt: now
    }
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 201, body))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, body, 201, context.requestId);
};

export const verifyEntitlementHandler: RouteHandler = async (request, context) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const input = parseEntitlementVerifyInput(requestBodyText, request, context);
  if (input instanceof Response) {
    return input;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const transactionHash = await hashText(`${input.store}:${input.transactionId}`);
  const verification = await verifyStorePurchase(input, context.env);
  const status = toEntitlementStatus(verification.status);
  const expiresAt = verification.status === "verified" ? verification.expiresAt : null;
  const result = await context.env.DB
    .prepare(
      `INSERT INTO subscription_entitlements (
        id, user_id, store, product_id, transaction_id, status, expires_at, verified_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(store, transaction_id) DO UPDATE SET
        user_id = excluded.user_id,
        product_id = excluded.product_id,
        status = excluded.status,
        expires_at = excluded.expires_at,
        verified_at = excluded.verified_at,
        updated_at = excluded.updated_at`
    )
    .bind(id, user.id, input.store, input.productId, transactionHash, status, expiresAt, now, now, now)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }

  const entitlement = await getEntitlementByTransaction(context.env.DB, input.store, transactionHash);
  if (!entitlement) {
    return databaseError(request, context);
  }

  const body = {
    item: toEntitlementResponse(entitlement),
    meta: {
      receiptStored: false,
      serverVerified: verification.status === "verified",
      verificationStatus: verification.providerStatus
    }
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 200, body))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, body, 200, context.requestId);
};

export const getMyEntitlementsHandler: RouteHandler = async (request, context) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const result = await context.env.DB
    .prepare(
      `SELECT ${ENTITLEMENT_COLUMNS}
       FROM subscription_entitlements
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .bind(user.id)
    .all<EntitlementRow>();

  if (!result.success) {
    return databaseError(request, context);
  }

  const items = (result.results || []).map(toEntitlementResponse);
  return jsonResponse(
    request,
    context.env,
    {
      items,
      active: items.some((item) => item.active)
    },
    200,
    context.requestId
  );
};

function requireUser(request: Request, context: RequestContext): AuthenticatedUser | Response {
  if (context.user) {
    return context.user;
  }

  return errorResponse(
    request,
    context.env,
    context.requestId,
    500,
    "auth_context_missing",
    "Authenticated user context is missing."
  );
}

function parseAdEventInput(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): AdEventInput | Response {
  const body = parseJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const placement = getToken(body.placement);
  const eventType = getToken(body.eventType ?? body.type);
  if (!placement || !eventType) {
    return validationError(request, context, "placement and eventType are required.");
  }
  if (!AD_EVENT_TYPES.has(eventType)) {
    return validationError(request, context, "eventType must be one of impression, click, reward_earned, or dismissed.");
  }

  const metadata = body.metadata === undefined ? null : parseMetadata(body.metadata, request, context);
  if (metadata instanceof Response) {
    return metadata;
  }

  return { placement, eventType, metadata };
}

function parseAffiliateClickInput(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): AffiliateClickInput | Response {
  const body = parseJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const provider = getToken(body.provider);
  const targetUrl = getUrl(body.targetUrl ?? body.url);
  const tripId = body.tripId === undefined || body.tripId === null ? null : getString(body.tripId);
  if (!provider || !targetUrl) {
    return validationError(request, context, "provider and HTTPS targetUrl are required.");
  }
  if (body.tripId !== undefined && body.tripId !== null && !tripId) {
    return validationError(request, context, "tripId must be a non-empty string when provided.");
  }

  return { provider, targetUrl, tripId };
}

function parseEntitlementVerifyInput(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): EntitlementVerifyInput | Response {
  const body = parseJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const store = getToken(body.store);
  const productId = getToken(body.productId);
  const transactionId = getString(body.transactionId ?? body.originalTransactionId ?? body.purchaseToken);
  const receiptData = body.receiptData === undefined || body.receiptData === null ? null : getString(body.receiptData);

  if (store !== "apple" && store !== "google") {
    return validationError(request, context, "store must be apple or google.");
  }
  if (!productId || !transactionId) {
    return validationError(request, context, "productId and transactionId are required.");
  }
  if (body.receiptData !== undefined && body.receiptData !== null && !receiptData) {
    return validationError(request, context, "receiptData must be a non-empty string when provided.");
  }

  return { store, productId, transactionId, receiptData };
}

function parseJsonObject(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): Record<string, unknown> | Response {
  let body: unknown;
  try {
    body = JSON.parse(requestBodyText);
  } catch {
    return errorResponse(
      request,
      context.env,
      context.requestId,
      400,
      "invalid_json",
      "Request body must be valid JSON."
    );
  }

  if (!isRecord(body)) {
    return validationError(request, context, "Request body must be a JSON object.");
  }

  return body;
}

function parseMetadata(value: unknown, request: Request, context: RequestContext): Record<string, string> | Response {
  if (!isRecord(value)) {
    return validationError(request, context, "metadata must be an object when provided.");
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_METADATA_KEYS) {
    return validationError(request, context, `metadata can contain at most ${MAX_METADATA_KEYS} keys.`);
  }

  const metadata: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    const normalizedKey = getToken(key);
    if (!normalizedKey) {
      return validationError(request, context, "metadata keys must be non-empty token strings.");
    }

    if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") {
      return validationError(request, context, "metadata values must be strings, numbers, or booleans.");
    }

    metadata[normalizedKey] = String(rawValue).slice(0, MAX_METADATA_VALUE_LENGTH);
  }

  return metadata;
}

function validationError(request: Request, context: RequestContext, message: string): Response {
  return errorResponse(request, context.env, context.requestId, 400, "validation_failed", message);
}

function databaseError(request: Request, context: RequestContext): Response {
  return errorResponse(
    request,
    context.env,
    context.requestId,
    500,
    "database_error",
    "The database operation failed."
  );
}

function notFound(request: Request, context: RequestContext, message: string): Response {
  return errorResponse(request, context.env, context.requestId, 404, "not_found", message);
}

async function userOwnsTrip(db: D1Database, userId: string, tripId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM trips WHERE id = ? AND user_id = ?")
    .bind(tripId, userId)
    .first<{ id: string }>();
  return Boolean(row);
}

function getEntitlementByTransaction(
  db: D1Database,
  store: string,
  transactionHash: string
): Promise<EntitlementRow | null> {
  return db
    .prepare(`SELECT ${ENTITLEMENT_COLUMNS} FROM subscription_entitlements WHERE store = ? AND transaction_id = ?`)
    .bind(store, transactionHash)
    .first<EntitlementRow>();
}

function toEntitlementResponse(row: EntitlementRow) {
  return {
    id: row.id,
    store: row.store,
    productId: row.product_id,
    status: row.status,
    active: isActiveEntitlement(row),
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isActiveEntitlement(row: EntitlementRow): boolean {
  if (row.status !== "active" && row.status !== "verified") {
    return false;
  }

  return !row.expires_at || Date.parse(row.expires_at) > Date.now();
}

function toEntitlementStatus(verificationStatus: "verified" | "pending" | "failed"): string {
  if (verificationStatus === "verified") {
    return "active";
  }

  return verificationStatus === "failed" ? "verification_failed" : "pending_verification";
}

function stringifyMetadata(metadata: Record<string, string> | null): string | null {
  return metadata ? JSON.stringify(metadata) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getToken(value: unknown): string | null {
  const text = getString(value);
  if (!text || text.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(text)) {
    return null;
  }

  return text;
}

function getUrl(value: unknown): string | null {
  const text = getString(value);
  if (!text || text.length > 2048) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  return url.protocol === "https:" ? url.toString() : null;
}

async function hashText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
