import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import {
  createShareLink,
  createTripDay,
  createTripPlace,
  createTrip,
  deleteTripPlace,
  deleteTrip,
  getOwnedTrip,
  getSharedTrip,
  listTripDays,
  listTripPlaces,
  listTrips,
  toPublicTripDay,
  toPublicTripPlace,
  toPublicTrip,
  updateTripDay,
  updateTripPlace,
  updateTrip,
  type TripDayInput,
  type TripInput,
  type TripPlaceInput
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

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
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

function parseTripDayInput(
  raw: Record<string, unknown>,
  existing?: Partial<TripDayInput>
): TripDayInput | null {
  const dayNumber = numberValue(raw.dayNumber) ?? existing?.dayNumber;
  const date = stringValue(raw.date) ?? existing?.date;
  const title = stringValue(raw.title) ?? existing?.title;

  if (!dayNumber || dayNumber < 1 || !date || !title) {
    return null;
  }

  return { dayNumber, date, title };
}

function parseTripPlaceInput(
  raw: Record<string, unknown>,
  existing?: Partial<TripPlaceInput>
): TripPlaceInput | null {
  const name = stringValue(raw.name) ?? existing?.name;
  const category = stringValue(raw.category) ?? existing?.category;

  if (!name || !category) {
    return null;
  }

  const input: TripPlaceInput = { name, category };
  const dayId = stringValue(raw.dayId) ?? existing?.dayId;
  const providerPlaceId = stringValue(raw.providerPlaceId) ?? existing?.providerPlaceId;
  const address = stringValue(raw.address) ?? existing?.address;
  const lat = numberValue(raw.lat) ?? existing?.lat;
  const lng = numberValue(raw.lng) ?? existing?.lng;
  const dayNumber = numberValue(raw.dayNumber) ?? existing?.dayNumber;
  const sortOrder = numberValue(raw.sortOrder) ?? existing?.sortOrder;
  const startTime = stringValue(raw.startTime) ?? existing?.startTime;
  const endTime = stringValue(raw.endTime) ?? existing?.endTime;
  const memo = stringValue(raw.memo) ?? existing?.memo;
  const isSponsored = booleanValue(raw.isSponsored) ?? existing?.isSponsored;
  const sponsorLabel = stringValue(raw.sponsorLabel) ?? existing?.sponsorLabel;

  if (dayId) input.dayId = dayId;
  if (providerPlaceId) input.providerPlaceId = providerPlaceId;
  if (address) input.address = address;
  if (lat !== undefined) input.lat = lat;
  if (lng !== undefined) input.lng = lng;
  if (dayNumber !== undefined) input.dayNumber = dayNumber;
  if (sortOrder !== undefined) input.sortOrder = sortOrder;
  if (startTime) input.startTime = startTime;
  if (endTime) input.endTime = endTime;
  if (memo) input.memo = memo;
  if (isSponsored !== undefined) input.isSponsored = isSponsored;
  if (sponsorLabel) input.sponsorLabel = sponsorLabel;

  return input;
}

function parseTripDayPatch(raw: Record<string, unknown>): Partial<TripDayInput> | null {
  const input: Partial<TripDayInput> = {};
  const dayNumber = numberValue(raw.dayNumber);
  const date = stringValue(raw.date);
  const title = stringValue(raw.title);

  if (dayNumber !== null) input.dayNumber = dayNumber;
  if (date) input.date = date;
  if (title) input.title = title;

  return Object.keys(input).length ? input : null;
}

function parseTripPlacePatch(
  raw: Record<string, unknown>,
  forcedDayId?: string
): Partial<TripPlaceInput> | null {
  const input: Partial<TripPlaceInput> = {};
  const dayId = forcedDayId ?? stringValue(raw.dayId);
  const providerPlaceId = stringValue(raw.providerPlaceId);
  const name = stringValue(raw.name);
  const category = stringValue(raw.category);
  const address = stringValue(raw.address);
  const lat = numberValue(raw.lat);
  const lng = numberValue(raw.lng);
  const dayNumber = numberValue(raw.dayNumber);
  const sortOrder = numberValue(raw.sortOrder);
  const startTime = stringValue(raw.startTime);
  const endTime = stringValue(raw.endTime);
  const memo = stringValue(raw.memo);
  const isSponsored = booleanValue(raw.isSponsored);
  const sponsorLabel = stringValue(raw.sponsorLabel);

  if (dayId) input.dayId = dayId;
  if (providerPlaceId) input.providerPlaceId = providerPlaceId;
  if (name) input.name = name;
  if (category) input.category = category;
  if (address) input.address = address;
  if (lat !== null) input.lat = lat;
  if (lng !== null) input.lng = lng;
  if (dayNumber !== null) input.dayNumber = dayNumber;
  if (sortOrder !== null) input.sortOrder = sortOrder;
  if (startTime) input.startTime = startTime;
  if (endTime) input.endTime = endTime;
  if (memo) input.memo = memo;
  if (isSponsored !== undefined) input.isSponsored = isSponsored;
  if (sponsorLabel) input.sponsorLabel = sponsorLabel;

  return Object.keys(input).length ? input : null;
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

tripRoutes.get("/:tripId/days", async (c) => {
  const days = await listTripDays(c.env.DB, currentUserId(c), c.req.param("tripId"));
  if (!days) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  return c.json({ ok: true, days: days.map(toPublicTripDay), requestId: c.get("requestId") });
});

tripRoutes.post("/:tripId/days", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = parseTripDayInput(raw);
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_DAY_INPUT", "일차 필수값을 확인해주세요.");
  }

  const day = await createTripDay(c.env.DB, currentUserId(c), c.req.param("tripId"), input);
  if (!day) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  return c.json({ ok: true, day: toPublicTripDay(day), requestId: c.get("requestId") }, 201);
});

tripRoutes.patch("/:tripId/days/:dayId", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = parseTripDayPatch(raw);
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_DAY_INPUT", "일차 수정 값을 확인해주세요.");
  }

  const day = await updateTripDay(
    c.env.DB,
    currentUserId(c),
    c.req.param("tripId"),
    c.req.param("dayId"),
    input
  );
  if (!day) {
    return errorResponse(c, 404, "TRIP_DAY_NOT_FOUND", "일차를 찾을 수 없습니다.");
  }

  return c.json({ ok: true, day: toPublicTripDay(day), requestId: c.get("requestId") });
});

tripRoutes.get("/:tripId/places", async (c) => {
  const places = await listTripPlaces(c.env.DB, currentUserId(c), c.req.param("tripId"));
  if (!places) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  return c.json({ ok: true, places: places.map(toPublicTripPlace), requestId: c.get("requestId") });
});

tripRoutes.get("/:tripId/days/:dayId/places", async (c) => {
  const places = await listTripPlaces(
    c.env.DB,
    currentUserId(c),
    c.req.param("tripId"),
    c.req.param("dayId")
  );
  if (!places) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  return c.json({ ok: true, places: places.map(toPublicTripPlace), requestId: c.get("requestId") });
});

tripRoutes.post("/:tripId/places", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = parseTripPlaceInput(raw);
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_PLACE_INPUT", "장소 필수값을 확인해주세요.");
  }

  const place = await createTripPlace(c.env.DB, currentUserId(c), c.req.param("tripId"), input);
  if (!place) {
    return errorResponse(c, 404, "TRIP_OR_DAY_NOT_FOUND", "여행 또는 일차를 찾을 수 없습니다.");
  }

  return c.json({ ok: true, place: toPublicTripPlace(place), requestId: c.get("requestId") }, 201);
});

tripRoutes.post("/:tripId/days/:dayId/places", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = parseTripPlaceInput({ ...raw, dayId: c.req.param("dayId") });
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_PLACE_INPUT", "장소 필수값을 확인해주세요.");
  }

  const place = await createTripPlace(c.env.DB, currentUserId(c), c.req.param("tripId"), input);
  if (!place) {
    return errorResponse(c, 404, "TRIP_OR_DAY_NOT_FOUND", "여행 또는 일차를 찾을 수 없습니다.");
  }

  return c.json({ ok: true, place: toPublicTripPlace(place), requestId: c.get("requestId") }, 201);
});

tripRoutes.patch("/:tripId/places/:placeId", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = parseTripPlacePatch(raw);
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_PLACE_INPUT", "장소 수정 값을 확인해주세요.");
  }

  const place = await updateTripPlace(
    c.env.DB,
    currentUserId(c),
    c.req.param("tripId"),
    c.req.param("placeId"),
    input
  );
  if (!place) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  return c.json({ ok: true, place: toPublicTripPlace(place), requestId: c.get("requestId") });
});

tripRoutes.patch("/:tripId/days/:dayId/places/:placeId", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const input = parseTripPlacePatch(raw, c.req.param("dayId"));
  if (!input) {
    return errorResponse(c, 400, "INVALID_TRIP_PLACE_INPUT", "장소 수정 값을 확인해주세요.");
  }

  const place = await updateTripPlace(
    c.env.DB,
    currentUserId(c),
    c.req.param("tripId"),
    c.req.param("placeId"),
    input
  );
  if (!place) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  return c.json({ ok: true, place: toPublicTripPlace(place), requestId: c.get("requestId") });
});

tripRoutes.delete("/:tripId/places/:placeId", async (c) => {
  const deleted = await deleteTripPlace(
    c.env.DB,
    currentUserId(c),
    c.req.param("tripId"),
    c.req.param("placeId")
  );
  if (!deleted) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  return c.json({ ok: true, deleted: true, requestId: c.get("requestId") });
});

tripRoutes.delete("/:tripId/days/:dayId/places/:placeId", async (c) => {
  const deleted = await deleteTripPlace(
    c.env.DB,
    currentUserId(c),
    c.req.param("tripId"),
    c.req.param("placeId")
  );
  if (!deleted) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  return c.json({ ok: true, deleted: true, requestId: c.get("requestId") });
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
