import { createCorsHeaders, errorResponse, jsonResponse } from "./http.js";
import { prepareIdempotency, storeIdempotencyResult } from "./idempotency.js";
import type { AuthenticatedUser, D1Database, RequestContext, RouteHandler } from "./types.js";

interface TripRow {
  id: string;
  user_id: string;
  title: string;
  destination_name: string;
  start_date: string;
  end_date: string;
  style_key: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TripResponse {
  id: string;
  title: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  styleKey: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TripCreateInput {
  title: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  styleKey: string;
}

interface TripUpdateInput {
  title?: string;
  destinationName?: string;
  startDate?: string;
  endDate?: string;
  styleKey?: string;
  status?: string;
  changedFields: string[];
}

const TRIP_COLUMNS = [
  "id",
  "user_id",
  "title",
  "destination_name",
  "start_date",
  "end_date",
  "style_key",
  "status",
  "created_at",
  "updated_at"
].join(", ");

export const listTripsHandler: RouteHandler = async (request, context) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const result = await context.env.DB
    .prepare(`SELECT ${TRIP_COLUMNS} FROM trips WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(user.id)
    .all<TripRow>();

  if (!result.success) {
    return databaseError(request, context);
  }

  return jsonResponse(
    request,
    context.env,
    { items: (result.results || []).map(toTripResponse) },
    200,
    context.requestId
  );
};

export const createTripHandler: RouteHandler = async (request, context) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const input = await parseTripCreateInput(request, context);
  if (input instanceof Response) {
    return input;
  }

  const now = new Date().toISOString();
  const tripId = crypto.randomUUID();
  const insertResult = await context.env.DB
    .prepare(
      `INSERT INTO trips (
        id, user_id, title, destination_name, start_date, end_date, style_key, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      tripId,
      user.id,
      input.title,
      input.destinationName,
      input.startDate,
      input.endDate,
      input.styleKey,
      "draft",
      now,
      now
    )
    .run();

  if (!insertResult.success) {
    return databaseError(request, context);
  }

  const auditLogged = await writeAuditLog(context.env.DB, user.id, "trip.create", "trip", tripId, {
    destinationName: input.destinationName,
    styleKey: input.styleKey
  });
  if (!auditLogged) {
    return databaseError(request, context);
  }

  return jsonResponse(
    request,
    context.env,
    {
      item: {
        id: tripId,
        title: input.title,
        destinationName: input.destinationName,
        startDate: input.startDate,
        endDate: input.endDate,
        styleKey: input.styleKey,
        status: "draft",
        createdAt: now,
        updatedAt: now
      }
    },
    201,
    context.requestId
  );
};

export const getTripHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  if (!tripId) {
    return errorResponse(request, context.env, context.requestId, 404, "not_found", "Trip not found.");
  }

  const row = await context.env.DB
    .prepare(`SELECT ${TRIP_COLUMNS} FROM trips WHERE id = ? AND user_id = ?`)
    .bind(tripId, user.id)
    .first<TripRow>();

  if (!row) {
    return errorResponse(request, context.env, context.requestId, 404, "not_found", "Trip not found.");
  }

  return jsonResponse(request, context.env, { item: toTripResponse(row) }, 200, context.requestId);
};

export const updateTripHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  if (!tripId) {
    return notFound(request, context, "Trip not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const input = parseTripUpdateInput(requestBodyText, request, context);
  if (input instanceof Response) {
    return input;
  }

  const existing = await getOwnedTrip(context.env.DB, tripId, user.id);
  if (!existing) {
    return notFound(request, context, "Trip not found.");
  }

  const updatedStartDate = input.startDate ?? existing.start_date;
  const updatedEndDate = input.endDate ?? existing.end_date;
  if (!isDateOnly(updatedStartDate) || !isDateOnly(updatedEndDate) || updatedEndDate < updatedStartDate) {
    return validationError(
      request,
      context,
      "startDate and endDate must be YYYY-MM-DD and endDate must not be earlier."
    );
  }

  const updatedAt = new Date().toISOString();
  const updatedRow: TripRow = {
    ...existing,
    title: input.title ?? existing.title,
    destination_name: input.destinationName ?? existing.destination_name,
    start_date: updatedStartDate,
    end_date: updatedEndDate,
    style_key: input.styleKey ?? existing.style_key,
    status: input.status ?? existing.status,
    updated_at: updatedAt
  };

  const updateResult = await context.env.DB
    .prepare(
      `UPDATE trips
       SET title = ?, destination_name = ?, start_date = ?, end_date = ?, style_key = ?, status = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(
      updatedRow.title,
      updatedRow.destination_name,
      updatedRow.start_date,
      updatedRow.end_date,
      updatedRow.style_key,
      updatedRow.status,
      updatedRow.updated_at,
      tripId,
      user.id
    )
    .run();

  if (!updateResult.success) {
    return databaseError(request, context);
  }

  const auditLogged = await writeAuditLog(context.env.DB, user.id, "trip.update", "trip", tripId, {
    fields: input.changedFields.join(",")
  });
  if (!auditLogged) {
    return databaseError(request, context);
  }

  const body = { item: toTripResponse(updatedRow) };
  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 200, body))) {
    return databaseError(request, context);
  }

  return jsonResponse(request, context.env, body, 200, context.requestId);
};

export const deleteTripHandler: RouteHandler = async (request, context, params) => {
  const user = requireUser(request, context);
  if (user instanceof Response) {
    return user;
  }

  const tripId = params.tripId;
  if (!tripId) {
    return notFound(request, context, "Trip not found.");
  }

  const requestBodyText = await request.text();
  const idempotency = await prepareIdempotency(request, context, user.id, requestBodyText);
  if (idempotency instanceof Response) {
    return idempotency;
  }

  const existing = await getOwnedTrip(context.env.DB, tripId, user.id);
  if (!existing) {
    return notFound(request, context, "Trip not found.");
  }

  const deleteResult = await context.env.DB
    .prepare("DELETE FROM trips WHERE id = ? AND user_id = ?")
    .bind(tripId, user.id)
    .run();

  if (!deleteResult.success) {
    return databaseError(request, context);
  }

  const auditLogged = await writeAuditLog(context.env.DB, user.id, "trip.delete", "trip", tripId, {
    destinationName: existing.destination_name
  });
  if (!auditLogged) {
    return databaseError(request, context);
  }

  if (!(await storeIdempotencyResult(context.env.DB, idempotency, 204, undefined))) {
    return databaseError(request, context);
  }

  const headers = createCorsHeaders(request, context.env);
  headers.set("X-Request-Id", context.requestId);
  return new Response(null, { status: 204, headers });
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

async function parseTripCreateInput(
  request: Request,
  context: RequestContext
): Promise<TripCreateInput | Response> {
  let body: unknown;
  try {
    body = await request.json();
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

  const destinationName = getString(body.destinationName) || getString(body.destination);
  const startDate = getString(body.startDate);
  const endDate = getString(body.endDate);
  const styleKey = getString(body.styleKey) || "balanced_trip";
  const title = getString(body.title) || (destinationName ? `${destinationName} 여행` : undefined);

  if (!title || !destinationName || !startDate || !endDate) {
    return validationError(
      request,
      context,
      "title, destinationName, startDate, and endDate are required."
    );
  }

  if (!isDateOnly(startDate) || !isDateOnly(endDate) || endDate < startDate) {
    return validationError(
      request,
      context,
      "startDate and endDate must be YYYY-MM-DD and endDate must not be earlier."
    );
  }

  return {
    title,
    destinationName,
    startDate,
    endDate,
    styleKey
  };
}

function parseTripUpdateInput(
  requestBodyText: string,
  request: Request,
  context: RequestContext
): TripUpdateInput | Response {
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

  const changedFields: string[] = [];
  const input: TripUpdateInput = { changedFields };
  const rawTitle = body.title;
  const rawDestinationName = body.destinationName ?? body.destination;
  const rawStartDate = body.startDate;
  const rawEndDate = body.endDate;
  const rawStyleKey = body.styleKey;
  const rawStatus = body.status;

  if (rawTitle !== undefined) {
    const title = getString(rawTitle);
    if (!title) {
      return validationError(request, context, "title must be a non-empty string when provided.");
    }
    input.title = title;
    changedFields.push("title");
  }

  if (rawDestinationName !== undefined) {
    const destinationName = getString(rawDestinationName);
    if (!destinationName) {
      return validationError(request, context, "destinationName must be a non-empty string when provided.");
    }
    input.destinationName = destinationName;
    changedFields.push("destinationName");
  }

  if (rawStartDate !== undefined) {
    const startDate = getString(rawStartDate);
    if (!startDate || !isDateOnly(startDate)) {
      return validationError(request, context, "startDate must be YYYY-MM-DD when provided.");
    }
    input.startDate = startDate;
    changedFields.push("startDate");
  }

  if (rawEndDate !== undefined) {
    const endDate = getString(rawEndDate);
    if (!endDate || !isDateOnly(endDate)) {
      return validationError(request, context, "endDate must be YYYY-MM-DD when provided.");
    }
    input.endDate = endDate;
    changedFields.push("endDate");
  }

  if (rawStyleKey !== undefined) {
    const styleKey = getString(rawStyleKey);
    if (!styleKey) {
      return validationError(request, context, "styleKey must be a non-empty string when provided.");
    }
    input.styleKey = styleKey;
    changedFields.push("styleKey");
  }

  if (rawStatus !== undefined) {
    const status = getString(rawStatus);
    if (!status || !["draft", "planned", "active", "archived"].includes(status)) {
      return validationError(request, context, "status must be one of draft, planned, active, or archived.");
    }
    input.status = status;
    changedFields.push("status");
  }

  if (changedFields.length === 0) {
    return validationError(
      request,
      context,
      "At least one of title, destinationName, startDate, endDate, styleKey, or status is required."
    );
  }

  return input;
}

function validationError(request: Request, context: RequestContext, message: string): Response {
  return errorResponse(
    request,
    context.env,
    context.requestId,
    400,
    "validation_failed",
    message
  );
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

function getOwnedTrip(db: D1Database, tripId: string, userId: string): Promise<TripRow | null> {
  return db
    .prepare(`SELECT ${TRIP_COLUMNS} FROM trips WHERE id = ? AND user_id = ?`)
    .bind(tripId, userId)
    .first<TripRow>();
}

async function writeAuditLog(
  db: D1Database,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, string>
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      actorUserId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      new Date().toISOString()
    )
    .run();
  return result.success;
}

function toTripResponse(row: TripRow): TripResponse {
  return {
    id: row.id,
    title: row.title,
    destinationName: row.destination_name,
    startDate: row.start_date,
    endDate: row.end_date,
    styleKey: row.style_key,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
