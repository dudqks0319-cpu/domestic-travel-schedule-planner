import { createCorsHeaders, errorResponse, jsonResponse } from "./http.js";
import { prepareIdempotency, storeIdempotencyResult } from "./idempotency.js";
import type { AuthenticatedUser, D1Database, RequestContext, RouteHandler } from "./types.js";

interface TripDayRow {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface TripPlaceRow {
  id: string;
  trip_id: string;
  day_id: string;
  provider_place_id: string | null;
  source_place_id: string | null;
  title: string;
  category: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  visit_order: number;
  starts_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SharedTripRow {
  share_token: string;
  expires_at: string | null;
  trip_id: string;
  title: string;
  destination_name: string;
  start_date: string;
  end_date: string;
  style_key: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TripDayInput {
  dayIndex: number;
  date: string;
  title?: string;
}

interface TripPlaceInput {
  dayId: string;
  title: string;
  category: string;
  visitOrder: number;
  providerPlaceId?: string;
  sourcePlaceId?: string;
  lat?: number;
  lng?: number;
  address?: string;
  startsAt?: string;
  durationMinutes?: number;
  notes?: string;
}

const DAY_COLUMNS = [
  "id",
  "trip_id",
  "day_index",
  "date",
  "title",
  "created_at",
  "updated_at"
].join(", ");

const PLACE_COLUMNS = [
  "id",
  "trip_id",
  "day_id",
  "provider_place_id",
  "source_place_id",
  "title",
  "category",
  "lat",
  "lng",
  "address",
  "visit_order",
  "starts_at",
  "duration_minutes",
  "notes",
  "created_at",
  "updated_at"
].join(", ");

export const createTripDayHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  if (!tripId || !(await userOwnsTrip(context.env.DB, user.id, tripId))) {
    return notFound(request, context, "Trip not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const input = parseTripDayInput(requestBodyText, request, context);
  if (input instanceof Response) {
    return input;
  }

  const now = new Date().toISOString();
  const dayId = crypto.randomUUID();
  const result = await context.env.DB
    .prepare(
      `INSERT INTO trip_days (
        id, trip_id, day_index, date, title, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(dayId, tripId, input.dayIndex, input.date, input.title || null, now, now)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }

  if (!(await writeAuditLog(context.env.DB, user.id, "trip_day.create", "trip_day", dayId))) {
    return databaseError(request, context);
  }

  const body = {
    item: {
      id: dayId,
      tripId,
      dayIndex: input.dayIndex,
      date: input.date,
      title: input.title || null,
      createdAt: now,
      updatedAt: now
    }
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 201, body))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, body, 201, context.requestId);
};

export const updateTripDayHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  const dayId = params.dayId;
  if (!tripId || !dayId || !(await userOwnsTrip(context.env.DB, user.id, tripId))) {
    return notFound(request, context, "Trip day not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const body = parseJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const date = body.date === undefined ? undefined : getString(body.date);
  const title = body.title === null ? null : body.title === undefined ? undefined : getString(body.title);
  if (date !== undefined && !isDateOnly(date)) {
    return validationError(request, context, "date must be YYYY-MM-DD.");
  }
  if (date === undefined && title === undefined) {
    return validationError(request, context, "date or title is required.");
  }

  const existing = await context.env.DB
    .prepare(`SELECT ${DAY_COLUMNS} FROM trip_days WHERE id = ? AND trip_id = ?`)
    .bind(dayId, tripId)
    .first<TripDayRow>();
  if (!existing) {
    return notFound(request, context, "Trip day not found.");
  }

  const updatedDate = date || existing.date;
  const updatedTitle = title === undefined ? existing.title : title;
  const updatedAt = new Date().toISOString();
  const result = await context.env.DB
    .prepare("UPDATE trip_days SET date = ?, title = ?, updated_at = ? WHERE id = ? AND trip_id = ?")
    .bind(updatedDate, updatedTitle, updatedAt, dayId, tripId)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }
  if (!(await writeAuditLog(context.env.DB, user.id, "trip_day.update", "trip_day", dayId))) {
    return databaseError(request, context);
  }

  const responseBody = {
    item: toDayResponse({ ...existing, date: updatedDate, title: updatedTitle, updated_at: updatedAt })
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 200, responseBody))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, responseBody, 200, context.requestId);
};

export const createTripPlaceHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  if (!tripId || !(await userOwnsTrip(context.env.DB, user.id, tripId))) {
    return notFound(request, context, "Trip not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const input = parseTripPlaceInput(requestBodyText, request, context);
  if (input instanceof Response) {
    return input;
  }

  if (!(await dayBelongsToTrip(context.env.DB, input.dayId, tripId))) {
    return notFound(request, context, "Trip day not found.");
  }

  const now = new Date().toISOString();
  const placeId = crypto.randomUUID();
  const result = await context.env.DB
    .prepare(
      `INSERT INTO trip_places (
        id, trip_id, day_id, provider_place_id, source_place_id, title, category, lat, lng, address,
        visit_order, starts_at, duration_minutes, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      placeId,
      tripId,
      input.dayId,
      input.providerPlaceId || null,
      input.sourcePlaceId || null,
      input.title,
      input.category,
      input.lat ?? null,
      input.lng ?? null,
      input.address || null,
      input.visitOrder,
      input.startsAt || null,
      input.durationMinutes ?? null,
      input.notes || null,
      now,
      now
    )
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }

  if (!(await writeAuditLog(context.env.DB, user.id, "trip_place.create", "trip_place", placeId))) {
    return databaseError(request, context);
  }

  const body = {
    item: toPlaceResponse({
      id: placeId,
      trip_id: tripId,
      day_id: input.dayId,
      provider_place_id: input.providerPlaceId || null,
      source_place_id: input.sourcePlaceId || null,
      title: input.title,
      category: input.category,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      address: input.address || null,
      visit_order: input.visitOrder,
      starts_at: input.startsAt || null,
      duration_minutes: input.durationMinutes ?? null,
      notes: input.notes || null,
      created_at: now,
      updated_at: now
    })
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 201, body))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, body, 201, context.requestId);
};

export const updateTripPlaceHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  const placeId = params.placeId;
  if (!tripId || !placeId || !(await userOwnsTrip(context.env.DB, user.id, tripId))) {
    return notFound(request, context, "Trip place not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const existing = await getTripPlace(context.env.DB, tripId, placeId);
  if (!existing) {
    return notFound(request, context, "Trip place not found.");
  }

  const body = parseJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const title = body.title === undefined ? existing.title : getString(body.title);
  const category = body.category === undefined ? existing.category : getString(body.category);
  const visitOrder = body.visitOrder === undefined ? existing.visit_order : getInteger(body.visitOrder);
  const notes = body.notes === undefined
    ? existing.notes
    : body.notes === null
      ? null
      : getString(body.notes);
  const startsAt = body.startsAt === undefined
    ? existing.starts_at
    : body.startsAt === null
      ? null
      : getString(body.startsAt);
  const durationMinutes = body.durationMinutes === null
    ? null
    : body.durationMinutes === undefined
      ? existing.duration_minutes
      : getNonNegativeInteger(body.durationMinutes);

  if (
    title === undefined ||
    category === undefined ||
    visitOrder === undefined ||
    notes === undefined ||
    startsAt === undefined ||
    durationMinutes === undefined
  ) {
    return validationError(
      request,
      context,
      "title, category, visitOrder, startsAt, durationMinutes, and notes must be valid when provided."
    );
  }

  const updatedAt = new Date().toISOString();
  const result = await context.env.DB
    .prepare(
      `UPDATE trip_places
       SET title = ?, category = ?, visit_order = ?, starts_at = ?, duration_minutes = ?, notes = ?, updated_at = ?
       WHERE id = ? AND trip_id = ?`
    )
    .bind(title, category, visitOrder, startsAt, durationMinutes, notes, updatedAt, placeId, tripId)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }
  if (!(await writeAuditLog(context.env.DB, user.id, "trip_place.update", "trip_place", placeId))) {
    return databaseError(request, context);
  }

  const responseBody = {
    item: toPlaceResponse({
      ...existing,
      title,
      category,
      visit_order: visitOrder,
      starts_at: startsAt,
      duration_minutes: durationMinutes,
      notes,
      updated_at: updatedAt
    })
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 200, responseBody))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, responseBody, 200, context.requestId);
};

export const deleteTripPlaceHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  const placeId = params.placeId;
  if (!tripId || !placeId || !(await userOwnsTrip(context.env.DB, user.id, tripId))) {
    return notFound(request, context, "Trip place not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const existing = await getTripPlace(context.env.DB, tripId, placeId);
  if (!existing) {
    return notFound(request, context, "Trip place not found.");
  }

  const result = await context.env.DB
    .prepare("DELETE FROM trip_places WHERE id = ? AND trip_id = ?")
    .bind(placeId, tripId)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }

  if (!(await writeAuditLog(context.env.DB, user.id, "trip_place.delete", "trip_place", placeId))) {
    return databaseError(request, context);
  }

  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 204, undefined))) {
    return databaseError(request, context);
  }

  const headers = createCorsHeaders(request, context.env);
  headers.set("X-Request-Id", context.requestId);
  return new Response(null, {
    status: 204,
    headers
  });
};

export const createShareLinkHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  if (!tripId || !(await userOwnsTrip(context.env.DB, user.id, tripId))) {
    return notFound(request, context, "Trip not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const body = parseOptionalJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const rawExpiresAt = body?.expiresAt;
  const expiresAt = rawExpiresAt === undefined ? null : getString(rawExpiresAt);
  if (rawExpiresAt !== undefined && expiresAt === undefined) {
    return validationError(request, context, "expiresAt must be an ISO date-time string.");
  }

  const normalizedExpiresAt = expiresAt ?? null;
  if (normalizedExpiresAt !== null && Number.isNaN(Date.parse(normalizedExpiresAt))) {
    return validationError(request, context, "expiresAt must be an ISO date-time string.");
  }

  const now = new Date().toISOString();
  const shareToken = createShareToken();
  const shareId = crypto.randomUUID();
  const result = await context.env.DB
    .prepare(
      `INSERT INTO share_links (
        id, trip_id, share_token, expires_at, revoked_at, created_at
      ) VALUES (?, ?, ?, ?, NULL, ?)`
    )
    .bind(shareId, tripId, shareToken, normalizedExpiresAt, now)
    .run();

  if (!result.success) {
    return databaseError(request, context);
  }
  if (!(await writeAuditLog(context.env.DB, user.id, "share_link.create", "share_link", shareId))) {
    return databaseError(request, context);
  }

  const responseBody = {
    item: {
      id: shareId,
      tripId,
      shareId: shareToken,
      sharePath: `/api/v1/share/${shareToken}`,
      expiresAt: normalizedExpiresAt,
      createdAt: now
    }
  };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 201, responseBody))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, responseBody, 201, context.requestId);
};

export const getSharedTripHandler: RouteHandler = async (request, context, params) => {
  const shareId = params.shareId;
  if (!shareId) {
    return notFound(request, context, "Shared trip not found.");
  }

  const shared = await context.env.DB
    .prepare(
      `SELECT
        s.share_token, s.expires_at,
        t.id AS trip_id, t.title, t.destination_name, t.start_date, t.end_date, t.style_key, t.status,
        t.created_at, t.updated_at
       FROM share_links s
       INNER JOIN trips t ON t.id = s.trip_id
       WHERE s.share_token = ? AND s.revoked_at IS NULL`
    )
    .bind(shareId)
    .first<SharedTripRow>();

  if (!shared || isExpired(shared.expires_at)) {
    return notFound(request, context, "Shared trip not found.");
  }

  const days = await context.env.DB
    .prepare(`SELECT ${DAY_COLUMNS} FROM trip_days WHERE trip_id = ? ORDER BY day_index ASC`)
    .bind(shared.trip_id)
    .all<TripDayRow>();
  const places = await context.env.DB
    .prepare(`SELECT ${PLACE_COLUMNS} FROM trip_places WHERE trip_id = ? ORDER BY visit_order ASC`)
    .bind(shared.trip_id)
    .all<TripPlaceRow>();

  if (!days.success || !places.success) {
    return databaseError(request, context);
  }

  return jsonResponse(
    request,
    context.env,
    {
      item: {
        shareId: shared.share_token,
        expiresAt: shared.expires_at,
        trip: {
          id: shared.trip_id,
          title: shared.title,
          destinationName: shared.destination_name,
          startDate: shared.start_date,
          endDate: shared.end_date,
          styleKey: shared.style_key,
          status: shared.status,
          createdAt: shared.created_at,
          updatedAt: shared.updated_at
        },
        days: (days.results || []).map(toDayResponse),
        places: (places.results || []).map(toPlaceResponse)
      }
    },
    200,
    context.requestId
  );
};

async function userOwnsTrip(db: D1Database, userId: string, tripId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM trips WHERE id = ? AND user_id = ?")
    .bind(tripId, userId)
    .first<{ id: string }>();

  return Boolean(row);
}

async function dayBelongsToTrip(db: D1Database, dayId: string, tripId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM trip_days WHERE id = ? AND trip_id = ?")
    .bind(dayId, tripId)
    .first<{ id: string }>();

  return Boolean(row);
}

async function getTripPlace(
  db: D1Database,
  tripId: string,
  placeId: string
): Promise<TripPlaceRow | null> {
  return db
    .prepare(`SELECT ${PLACE_COLUMNS} FROM trip_places WHERE id = ? AND trip_id = ?`)
    .bind(placeId, tripId)
    .first<TripPlaceRow>();
}

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

function parseTripDayInput(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): TripDayInput | Response {
  const body = parseJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const dayIndex = getNonNegativeInteger(body.dayIndex);
  const date = getString(body.date);
  const title = body.title === undefined ? undefined : getString(body.title);
  if (dayIndex === undefined || !date || !isDateOnly(date)) {
    return validationError(request, context, "dayIndex and YYYY-MM-DD date are required.");
  }

  return { dayIndex, date, title };
}

function parseTripPlaceInput(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): TripPlaceInput | Response {
  const body = parseJsonObject(requestBodyText, request, context);
  if (body instanceof Response) {
    return body;
  }

  const dayId = getString(body.dayId);
  const title = getString(body.title);
  const category = getString(body.category);
  const visitOrder = getNonNegativeInteger(body.visitOrder);
  const lat = body.lat === undefined ? undefined : getNumber(body.lat);
  const lng = body.lng === undefined ? undefined : getNumber(body.lng);
  const durationMinutes = body.durationMinutes === undefined
    ? undefined
    : getNonNegativeInteger(body.durationMinutes);

  if (!dayId || !title || !category || visitOrder === undefined) {
    return validationError(request, context, "dayId, title, category, and visitOrder are required.");
  }
  if (lat === undefined && body.lat !== undefined) {
    return validationError(request, context, "lat must be a number when provided.");
  }
  if (lng === undefined && body.lng !== undefined) {
    return validationError(request, context, "lng must be a number when provided.");
  }
  if (durationMinutes === undefined && body.durationMinutes !== undefined) {
    return validationError(request, context, "durationMinutes must be a non-negative integer when provided.");
  }

  return {
    dayId,
    title,
    category,
    visitOrder,
    providerPlaceId: getString(body.providerPlaceId),
    sourcePlaceId: getString(body.sourcePlaceId),
    lat,
    lng,
    address: getString(body.address),
    startsAt: getString(body.startsAt),
    durationMinutes,
    notes: getString(body.notes)
  };
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

function parseOptionalJsonObject(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): Record<string, unknown> | undefined | Response {
  if (!requestBodyText.trim()) {
    return undefined;
  }

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

async function writeAuditLog(
  db: D1Database,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), actorUserId, action, entityType, entityId, null, new Date().toISOString())
    .run();
  return result.success;
}

function toDayResponse(row: TripDayRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayIndex: row.day_index,
    date: row.date,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPlaceResponse(row: TripPlaceRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayId: row.day_id,
    providerPlaceId: row.provider_place_id,
    sourcePlaceId: row.source_place_id,
    title: row.title,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    visitOrder: row.visit_order,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createShareToken(): string {
  return `sh_${crypto.randomUUID().replace(/-/g, "")}`;
}

function isExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function getNonNegativeInteger(value: unknown): number | undefined {
  const integer = getInteger(value);
  return integer !== undefined && integer >= 0 ? integer : undefined;
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
