import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import {
  createShareLink,
  createTrip,
  deleteTrip,
  getOwnedTrip,
  getSharedTrip,
  listTrips,
  toPublicTrip,
  updateTrip,
  type TripInput
} from "../db/trips";
import { errorResponse } from "../http/errors";
import { requireAuth } from "../middleware/auth";

export const tripRoutes = new Hono<AppBindings>();
export const shareRoutes = new Hono<AppBindings>();

function currentUserId(c: { get: (key: "userId") => string | undefined }): string {
  const userId = c.get("userId");
  if (!userId) {
    throw new Error("Missing authenticated user id.");
  }
  return userId;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseTripInput(raw: Record<string, unknown>, existing?: Partial<TripInput>): TripInput | null {
  const title = stringValue(raw.title) ?? existing?.title;
  const destination = stringValue(raw.destination) ?? existing?.destination;
  const startDate = stringValue(raw.startDate) ?? existing?.startDate;
  const endDate = stringValue(raw.endDate) ?? existing?.endDate;
  const styleKey = stringValue(raw.styleKey) ?? existing?.styleKey;
  const transportMode = stringValue(raw.transportMode) ?? existing?.transportMode ?? "driving";

  if (!title || !destination || !startDate || !endDate || !styleKey || !transportMode) {
    return null;
  }

  return { title, destination, startDate, endDate, styleKey, transportMode };
}

tripRoutes.use("*", requireAuth);

tripRoutes.get("/", async (c) => {
  const trips = await listTrips(c.env.DB, currentUserId(c));
  return c.json({ ok: true, trips: trips.map(toPublicTrip), requestId: c.get("requestId") });
});

tripRoutes.post("/", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = parseTripInput(raw);
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_INPUT", "여행 생성 필수값이 부족합니다.");
  }

  const trip = await createTrip(c.env.DB, currentUserId(c), input);
  return c.json({ ok: true, trip: toPublicTrip(trip), requestId: c.get("requestId") }, 201);
});

tripRoutes.get("/:tripId", async (c) => {
  const trip = await getOwnedTrip(c.env.DB, currentUserId(c), c.req.param("tripId"));
  if (!trip) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  return c.json({ ok: true, trip: toPublicTrip(trip), requestId: c.get("requestId") });
});

tripRoutes.patch("/:tripId", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const userId = currentUserId(c);
  const existing = await getOwnedTrip(c.env.DB, userId, c.req.param("tripId"));
  if (!existing) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  const input = parseTripInput(raw, {
    title: existing.title,
    destination: existing.destination,
    startDate: existing.start_date,
    endDate: existing.end_date,
    styleKey: existing.style_key,
    transportMode: existing.transport_mode
  });
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_INPUT", "여행 수정 값을 확인해주세요.");
  }

  const trip = await updateTrip(c.env.DB, userId, c.req.param("tripId"), input);
  if (!trip) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  return c.json({ ok: true, trip: toPublicTrip(trip), requestId: c.get("requestId") });
});

tripRoutes.delete("/:tripId", async (c) => {
  const deleted = await deleteTrip(c.env.DB, currentUserId(c), c.req.param("tripId"));
  if (!deleted) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  return c.json({ ok: true, deleted: true, requestId: c.get("requestId") });
});

tripRoutes.post("/:tripId/share", async (c) => {
  const shareLink = await createShareLink(c.env.DB, currentUserId(c), c.req.param("tripId"));
  if (!shareLink) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "공유할 여행을 찾을 수 없습니다.");
  }

  return c.json({
    ok: true,
    share: {
      id: shareLink.id,
      token: shareLink.token,
      tripId: shareLink.trip_id,
      expiresAt: shareLink.expires_at,
      createdAt: shareLink.created_at
    },
    requestId: c.get("requestId")
  }, 201);
});

shareRoutes.get("/:shareId", async (c) => {
  const sharedTrip = await getSharedTrip(c.env.DB, c.req.param("shareId"));
  if (!sharedTrip) {
    return errorResponse(c, 404, "SHARE_NOT_FOUND", "공유 링크를 찾을 수 없습니다.");
  }

  return c.json({
    ok: true,
    share: {
      id: sharedTrip.share_id,
      token: sharedTrip.share_token,
      expiresAt: sharedTrip.share_expires_at
    },
    trip: toPublicTrip(sharedTrip),
    requestId: c.get("requestId")
  });
});
