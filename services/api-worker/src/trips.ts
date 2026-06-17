import { errorResponse, jsonResponse } from "./http.js";
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
