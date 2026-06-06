import { Hono, type Context } from "hono";

import type { AppBindings } from "../bindings";
import { createAuditLog } from "../db/audit";
import {
  createTripExport,
  getOwnedTripExport,
  toPublicTripExport,
  type TripExportFormat
} from "../db/exports";
import { listActiveEntitlements } from "../db/monetization";
import {
  countActiveTrips,
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
  listTripPlacesForUser,
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
import { rateLimit } from "../middleware/rate-limit";

export const tripRoutes = new Hono<AppBindings>();
export const shareRoutes = new Hono<AppBindings>();

const FREE_TRIP_SAVE_LIMIT = 3;

function setPublicShareResponseHeaders(c: Context<AppBindings>): void {
  c.header("cache-control", "private, no-store");
  c.header("x-robots-tag", "noindex, nofollow");
  c.header("referrer-policy", "no-referrer");
  c.header("x-content-type-options", "nosniff");
}

function currentUserId(c: { get: (key: "userId") => string | undefined }): string {
  const userId = c.get("userId");
  if (!userId) {
    throw new Error("Missing authenticated user id.");
  }
  return userId;
}

function requestId(c: { get: (key: "requestId") => string | undefined }): string {
  return c.get("requestId") ?? "unknown";
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

function parseExportFormat(value: unknown): TripExportFormat | null {
  if (value === "pdf" || value === "image") {
    return value;
  }

  return null;
}

function sqliteDateTimeAfterDays(days: number): string {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString().slice(0, 19).replace("T", " ");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildExportDownloadUrl(c: { req: { url: string } }, tripId: string, exportId: string): string {
  const origin = new URL(c.req.url).origin;
  return `${origin}/api/v1/trips/${encodeURIComponent(tripId)}/exports/${encodeURIComponent(exportId)}/download`;
}

function renderPrintableTripExport(input: {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  days: Array<ReturnType<typeof toPublicTripDay> & { places: Array<ReturnType<typeof toPublicTripPlace>> }>;
  unassignedPlaces: Array<ReturnType<typeof toPublicTripPlace>>;
}): string {
  const renderPlace = (place: ReturnType<typeof toPublicTripPlace>, index: number) => {
    const sponsoredLabel = place.isSponsored
      ? `<span class="sponsored">${escapeHtml(place.sponsorLabel ?? "스폰서")}</span>`
      : "";
    const time = [place.startTime, place.endTime].filter(Boolean).join(" - ");
    return `<li class="place">
      <div class="place-index">${index + 1}</div>
      <div class="place-body">
        <div class="place-title-row">
          <h3>${escapeHtml(place.name)}</h3>
          ${sponsoredLabel}
        </div>
        <p>${escapeHtml(place.category || "장소")}${time ? ` · ${escapeHtml(time)}` : ""}</p>
        ${place.address ? `<p>${escapeHtml(place.address)}</p>` : ""}
        ${place.memo ? `<p class="memo">${escapeHtml(place.memo)}</p>` : ""}
      </div>
    </li>`;
  };
  const daySections = input.days
    .map((day) => `<section class="day">
      <header>
        <div>
          <span>${day.dayNumber}일차</span>
          <h2>${escapeHtml(day.title)}</h2>
        </div>
        <strong>${escapeHtml(day.date)}</strong>
      </header>
      <ol>${day.places.length ? day.places.map(renderPlace).join("") : `<li class="empty">담긴 장소가 없습니다.</li>`}</ol>
    </section>`)
    .join("");
  const unassignedSection = input.unassignedPlaces.length
    ? `<section class="day"><header><div><span>미배정</span><h2>날짜가 정해지지 않은 장소</h2></div></header><ol>${input.unassignedPlaces.map(renderPlace).join("")}</ol></section>`
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} | TripMate Export</title>
  <style>
    @page { margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #fff; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 20px; }
    .brand { color: #2563eb; font-size: 13px; font-weight: 900; margin: 0 0 8px; }
    h1 { margin: 0; font-size: 34px; line-height: 1.16; letter-spacing: 0; }
    .summary { margin: 10px 0 0; color: #4b5563; line-height: 1.6; }
    .notice { margin-top: 12px; padding: 10px 12px; border: 1px solid #bfdbfe; border-radius: 12px; color: #1d4ed8; background: #eff6ff; font-size: 13px; font-weight: 700; }
    .day { break-inside: avoid; margin-top: 18px; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
    .day header { display: flex; justify-content: space-between; gap: 14px; padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
    .day span { color: #2563eb; font-size: 12px; font-weight: 900; }
    .day h2 { margin: 3px 0 0; font-size: 18px; }
    .day strong { color: #6b7280; font-size: 13px; white-space: nowrap; }
    ol { list-style: none; margin: 0; padding: 0; }
    .place { display: flex; gap: 12px; padding: 13px 16px; border-top: 1px solid #f3f4f6; }
    .place:first-child { border-top: 0; }
    .place-index { width: 28px; height: 28px; flex: 0 0 28px; border-radius: 999px; background: #dbeafe; color: #2563eb; display: grid; place-items: center; font-size: 12px; font-weight: 900; }
    .place-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    h3 { margin: 0; font-size: 16px; line-height: 1.35; }
    p { margin: 4px 0 0; color: #4b5563; font-size: 13px; line-height: 1.5; }
    .memo { color: #111827; }
    .sponsored { border: 1px solid #fed7aa; background: #fff7ed; color: #c2410c; border-radius: 999px; padding: 2px 7px; font-size: 11px; font-weight: 900; }
    .empty { padding: 16px; color: #6b7280; }
    footer { margin-top: 20px; color: #9ca3af; font-size: 12px; line-height: 1.5; }
    @media print { main { padding: 0; } .notice { color: #1e3a8a; } }
  </style>
</head>
<body>
  <main>
    <p class="brand">TripMate</p>
    <h1>${escapeHtml(input.title)}</h1>
    <p class="summary">${escapeHtml(input.destination)} · ${escapeHtml(input.startDate)} - ${escapeHtml(input.endDate)}</p>
    <p class="notice">PDF 저장용 인쇄 페이지입니다. 브라우저 또는 기기 공유 메뉴에서 PDF로 저장할 수 있습니다.</p>
    ${daySections || `<section class="day"><ol><li class="empty">표시할 일정이 없습니다.</li></ol></section>`}
    ${unassignedSection}
    <footer>생성 시각: ${escapeHtml(input.generatedAt)} · 장소 좌표 원문은 내보내기 화면에 표시하지 않습니다.</footer>
  </main>
</body>
</html>`;
}

function renderImageTripExport(input: {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  days: Array<ReturnType<typeof toPublicTripDay> & { places: Array<ReturnType<typeof toPublicTripPlace>> }>;
  unassignedPlaces: Array<ReturnType<typeof toPublicTripPlace>>;
}): string {
  const maxRows = 14;
  const rows = [
    ...input.days.flatMap((day) =>
      day.places.length
        ? day.places.map((place, index) => ({
          label: `${day.dayNumber}일차 ${index + 1}. ${place.name}`,
          meta: [place.category, place.startTime].filter(Boolean).join(" · ")
        }))
        : [{ label: `${day.dayNumber}일차`, meta: "담긴 장소가 없습니다." }]
    ),
    ...input.unassignedPlaces.map((place, index) => ({
      label: `미배정 ${index + 1}. ${place.name}`,
      meta: [place.category, place.address].filter(Boolean).join(" · ")
    }))
  ].slice(0, maxRows);
  const extraCount = Math.max(
    0,
    input.days.reduce((sum, day) => sum + Math.max(1, day.places.length), 0) +
      input.unassignedPlaces.length -
      rows.length
  );
  const rowHeight = 50;
  const height = 260 + rows.length * rowHeight + (extraCount ? 38 : 0);
  const rowSvg = rows.map((row, index) => {
    const y = 205 + index * rowHeight;
    return `<g>
      <circle cx="58" cy="${y - 4}" r="14" fill="#dbeafe" />
      <text x="58" y="${y}" text-anchor="middle" font-size="12" font-weight="800" fill="#2563eb">${index + 1}</text>
      <text x="88" y="${y - 8}" font-size="18" font-weight="800" fill="#111827">${escapeHtml(row.label)}</text>
      <text x="88" y="${y + 16}" font-size="13" fill="#64748b">${escapeHtml(row.meta || "장소")}</text>
    </g>`;
  }).join("");
  const extraSvg = extraCount
    ? `<text x="40" y="${215 + rows.length * rowHeight}" font-size="14" font-weight="700" fill="#2563eb">외 ${extraCount}개 일정은 앱 또는 PDF 내보내기에서 확인하세요.</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" role="img" aria-label="TripMate itinerary export">
  <rect width="1080" height="${height}" fill="#f8fafc" />
  <rect x="28" y="28" width="1024" height="${height - 56}" rx="28" fill="#ffffff" stroke="#e5e7eb" />
  <text x="40" y="76" font-size="24" font-weight="900" fill="#2563eb">TripMate</text>
  <text x="40" y="122" font-size="42" font-weight="900" fill="#111827">${escapeHtml(input.title)}</text>
  <text x="40" y="158" font-size="20" fill="#475569">${escapeHtml(input.destination)} · ${escapeHtml(input.startDate)} - ${escapeHtml(input.endDate)}</text>
  <rect x="40" y="176" width="1000" height="1" fill="#e5e7eb" />
  ${rowSvg || `<text x="40" y="218" font-size="18" fill="#64748b">표시할 일정이 없습니다.</text>`}
  ${extraSvg}
  <text x="40" y="${height - 52}" font-size="13" fill="#94a3b8">생성 시각: ${escapeHtml(input.generatedAt)} · 장소 좌표 원문은 이미지에 표시하지 않습니다.</text>
</svg>`;
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

interface TripPlaceReorderInput {
  placeId: string;
  dayNumber: number;
  sortOrder: number;
}

interface TripPlaceSyncInput {
  clientId: string;
  tripPlaceId?: string;
  providerPlaceId?: string;
  name: string;
  category: string;
  address?: string;
  lat: number;
  lng: number;
  dayNumber: number;
  sortOrder: number;
  isSponsored?: boolean;
  sponsorLabel?: string;
}

function positiveIntegerValue(value: unknown): number | null {
  const parsed = numberValue(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function tripPlaceMatchKey(input: {
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string | null {
  if (!input.name || typeof input.lat !== "number" || typeof input.lng !== "number") {
    return null;
  }

  return [
    input.name.trim().toLowerCase(),
    input.lat.toFixed(5),
    input.lng.toFixed(5)
  ].join(":");
}

function parseTripPlaceReorderInput(raw: Record<string, unknown>): TripPlaceReorderInput[] | null {
  const places = raw.places;
  if (!Array.isArray(places) || places.length === 0 || places.length > 200) {
    return null;
  }

  const seenPlaceIds = new Set<string>();
  const parsed: TripPlaceReorderInput[] = [];
  for (const item of places) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const record = item as Record<string, unknown>;
    const placeId = stringValue(record.placeId);
    const dayNumber = positiveIntegerValue(record.dayNumber);
    const sortOrder = positiveIntegerValue(record.sortOrder);
    if (!placeId || dayNumber === null || sortOrder === null || seenPlaceIds.has(placeId)) {
      return null;
    }

    seenPlaceIds.add(placeId);
    parsed.push({ placeId, dayNumber, sortOrder });
  }

  return parsed;
}

function parseTripPlaceSyncInput(raw: Record<string, unknown>): TripPlaceSyncInput[] | null {
  const places = raw.places;
  if (!Array.isArray(places) || places.length === 0 || places.length > 200) {
    return null;
  }

  const seenClientIds = new Set<string>();
  const parsed: TripPlaceSyncInput[] = [];
  for (const item of places) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const record = item as Record<string, unknown>;
    const clientId = stringValue(record.clientId);
    const tripPlaceId = stringValue(record.tripPlaceId);
    const providerPlaceId = stringValue(record.providerPlaceId);
    const name = stringValue(record.name);
    const category = stringValue(record.category);
    const address = stringValue(record.address);
    const lat = numberValue(record.lat);
    const lng = numberValue(record.lng);
    const dayNumber = positiveIntegerValue(record.dayNumber);
    const sortOrder = positiveIntegerValue(record.sortOrder);
    const isSponsored = booleanValue(record.isSponsored);
    const sponsorLabel = stringValue(record.sponsorLabel);

    if (
      !clientId ||
      seenClientIds.has(clientId) ||
      !name ||
      !category ||
      lat === null ||
      lng === null ||
      dayNumber === null ||
      sortOrder === null
    ) {
      return null;
    }

    seenClientIds.add(clientId);
    parsed.push({
      clientId,
      ...(tripPlaceId ? { tripPlaceId } : {}),
      ...(providerPlaceId ? { providerPlaceId } : {}),
      name,
      category,
      ...(address ? { address } : {}),
      lat,
      lng,
      dayNumber,
      sortOrder,
      ...(isSponsored !== undefined ? { isSponsored } : {}),
      ...(sponsorLabel ? { sponsorLabel } : {})
    });
  }

  return parsed;
}

tripRoutes.use("*", requireAuth);
tripRoutes.use("/:tripId/exports", rateLimit({
  keyPrefix: "trip_exports",
  limit: 20,
  windowSeconds: 3600,
  methods: ["POST"]
}));

tripRoutes.get("/", async (c) => {
  const userId = currentUserId(c);
  const trips = await listTrips(c.env.DB, userId);
  const includePlaces = c.req.query("include") === "places" || c.req.query("includePlaces") === "true";

  if (!includePlaces) {
    return c.json({ ok: true, trips: trips.map(toPublicTrip), requestId: c.get("requestId") });
  }

  const places = await listTripPlacesForUser(c.env.DB, userId);
  const placesByTripId = new Map<string, ReturnType<typeof toPublicTripPlace>[]>();
  for (const place of places) {
    const publicPlace = toPublicTripPlace(place);
    const current = placesByTripId.get(place.trip_id) ?? [];
    current.push(publicPlace);
    placesByTripId.set(place.trip_id, current);
  }

  return c.json({
    ok: true,
    trips: trips.map((trip) => ({
      ...toPublicTrip(trip),
      places: placesByTripId.get(trip.id) ?? []
    })),
    requestId: c.get("requestId")
  });
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

  const userId = currentUserId(c);
  const [activeTripCount, entitlements] = await Promise.all([
    countActiveTrips(c.env.DB, userId),
    listActiveEntitlements(c.env.DB, userId)
  ]);

  if (!entitlements.length && activeTripCount >= FREE_TRIP_SAVE_LIMIT) {
    await createAuditLog(c.env.DB, {
      userId,
      action: "trip.create_denied",
      entityType: "trip",
      requestId: requestId(c),
      metadata: {
        reason: "free_trip_limit",
        activeTripCount,
        freeLimit: FREE_TRIP_SAVE_LIMIT
      }
    });
    return errorResponse(
      c,
      403,
      "FREE_TRIP_LIMIT_REACHED",
      `무료 플랜은 저장 여행 ${FREE_TRIP_SAVE_LIMIT}개까지 지원합니다. 프리미엄에서 무제한 저장을 사용할 수 있어요.`
    );
  }

  const trip = await createTrip(c.env.DB, userId, input);
  await createAuditLog(c.env.DB, {
    userId,
    action: "trip.create",
    entityType: "trip",
    entityId: trip.id,
    requestId: requestId(c),
    metadata: {
      plan: entitlements.length ? "premium" : "free",
      activeTripCountBeforeCreate: activeTripCount,
      freeLimit: FREE_TRIP_SAVE_LIMIT
    }
  });
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

  const userId = currentUserId(c);
  const day = await createTripDay(c.env.DB, userId, c.req.param("tripId"), input);
  if (!day) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_day.create",
    entityType: "trip_day",
    entityId: day.id,
    requestId: requestId(c),
    metadata: { dayNumber: day.day_number }
  });
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

  const userId = currentUserId(c);
  const day = await updateTripDay(
    c.env.DB,
    userId,
    c.req.param("tripId"),
    c.req.param("dayId"),
    input
  );
  if (!day) {
    return errorResponse(c, 404, "TRIP_DAY_NOT_FOUND", "일차를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_day.update",
    entityType: "trip_day",
    entityId: day.id,
    requestId: requestId(c),
    metadata: { dayNumber: day.day_number }
  });
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

  const userId = currentUserId(c);
  const place = await createTripPlace(c.env.DB, userId, c.req.param("tripId"), input);
  if (!place) {
    return errorResponse(c, 404, "TRIP_OR_DAY_NOT_FOUND", "여행 또는 일차를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.create",
    entityType: "trip_place",
    entityId: place.id,
    requestId: requestId(c),
    metadata: { dayNumber: place.day_number, hasSponsored: place.is_sponsored === 1 }
  });
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

  const userId = currentUserId(c);
  const place = await createTripPlace(c.env.DB, userId, c.req.param("tripId"), input);
  if (!place) {
    return errorResponse(c, 404, "TRIP_OR_DAY_NOT_FOUND", "여행 또는 일차를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.create",
    entityType: "trip_place",
    entityId: place.id,
    requestId: requestId(c),
    metadata: { dayNumber: place.day_number, hasSponsored: place.is_sponsored === 1 }
  });
  return c.json({ ok: true, place: toPublicTripPlace(place), requestId: c.get("requestId") }, 201);
});

tripRoutes.patch("/:tripId/places/sync", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const syncItems = parseTripPlaceSyncInput(raw);
  if (!syncItems) {
    return errorResponse(c, 400, "INVALID_TRIP_PLACE_SYNC_INPUT", "장소 동기화 값을 확인해주세요.");
  }
  const pruneMissing = raw.pruneMissing === true;

  const userId = currentUserId(c);
  const tripId = c.req.param("tripId");
  const existingPlaces = await listTripPlaces(c.env.DB, userId, tripId);
  if (!existingPlaces) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  const existingById = new Map(existingPlaces.map((place) => [place.id, place]));
  const existingByProviderPlaceId = new Map<string, typeof existingPlaces[number]>();
  const existingByMatchKey = new Map<string, typeof existingPlaces[number]>();
  for (const place of existingPlaces) {
    if (place.provider_place_id) {
      existingByProviderPlaceId.set(place.provider_place_id, place);
    }
    const matchKey = tripPlaceMatchKey({
      name: place.name,
      lat: place.lat,
      lng: place.lng
    });
    if (matchKey) {
      existingByMatchKey.set(matchKey, place);
    }
  }

  let created = 0;
  let relinked = 0;
  const syncedItems = [];
  for (const item of syncItems) {
    const existingByTripPlaceId = item.tripPlaceId ? existingById.get(item.tripPlaceId) : undefined;
    const existingByProvider = item.providerPlaceId
      ? existingByProviderPlaceId.get(item.providerPlaceId)
      : undefined;
    const existingByKey = existingByMatchKey.get(tripPlaceMatchKey(item) ?? "");
    const matchedPlace = existingByTripPlaceId ?? existingByProvider ?? existingByKey;

    if (matchedPlace) {
      syncedItems.push({
        clientId: item.clientId,
        tripPlaceId: matchedPlace.id,
        created: false,
        relinked: !item.tripPlaceId || item.tripPlaceId !== matchedPlace.id
      });
      if (!item.tripPlaceId || item.tripPlaceId !== matchedPlace.id) {
        relinked += 1;
      }
      continue;
    }

    const createdPlace = await createTripPlace(c.env.DB, userId, tripId, {
      providerPlaceId: item.providerPlaceId ?? item.clientId,
      name: item.name,
      category: item.category,
      ...(item.address ? { address: item.address } : {}),
      lat: item.lat,
      lng: item.lng,
      dayNumber: item.dayNumber,
      sortOrder: item.sortOrder,
      isSponsored: item.isSponsored === true,
      ...(item.sponsorLabel ? { sponsorLabel: item.sponsorLabel } : {})
    });
    if (!createdPlace) {
      return errorResponse(c, 409, "TRIP_PLACE_SYNC_CREATE_FAILED", "새 장소를 저장하지 못했습니다.");
    }

    existingById.set(createdPlace.id, createdPlace);
    if (createdPlace.provider_place_id) {
      existingByProviderPlaceId.set(createdPlace.provider_place_id, createdPlace);
    }
    const createdMatchKey = tripPlaceMatchKey({
      name: createdPlace.name,
      lat: createdPlace.lat,
      lng: createdPlace.lng
    });
    if (createdMatchKey) {
      existingByMatchKey.set(createdMatchKey, createdPlace);
    }

    syncedItems.push({
      clientId: item.clientId,
      tripPlaceId: createdPlace.id,
      created: true,
      relinked: false
    });
    created += 1;
  }

  const updatedPlaces = [];
  const syncedTripPlaceIds = new Set<string>();
  for (const item of syncItems) {
    const syncedItem = syncedItems.find((result) => result.clientId === item.clientId);
    if (!syncedItem) {
      continue;
    }
    syncedTripPlaceIds.add(syncedItem.tripPlaceId);

    const place = await updateTripPlace(c.env.DB, userId, tripId, syncedItem.tripPlaceId, {
      dayNumber: item.dayNumber,
      sortOrder: item.sortOrder
    });
    if (!place) {
      return errorResponse(c, 409, "TRIP_PLACE_SYNC_REORDER_FAILED", "장소 순서를 저장하지 못했습니다.");
    }
    updatedPlaces.push(place);
  }

  let pruned = 0;
  if (pruneMissing) {
    for (const existingPlace of existingPlaces) {
      if (syncedTripPlaceIds.has(existingPlace.id)) {
        continue;
      }

      const deleted = await deleteTripPlace(c.env.DB, userId, tripId, existingPlace.id);
      if (deleted) {
        pruned += 1;
      }
    }
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.sync",
    entityType: "trip",
    entityId: tripId,
    requestId: requestId(c),
    metadata: { placeCount: updatedPlaces.length, created, relinked, pruned }
  });

  return c.json({
    ok: true,
    places: updatedPlaces.map(toPublicTripPlace),
    sync: {
      created,
      relinked,
      updated: updatedPlaces.length,
      pruned,
      skipped: syncItems.length - updatedPlaces.length,
      items: syncedItems
    },
    requestId: c.get("requestId")
  });
});

tripRoutes.patch("/:tripId/places/reorder", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!raw) {
    return errorResponse(c, 400, "INVALID_JSON", "요청 본문을 확인해주세요.");
  }

  const reorderItems = parseTripPlaceReorderInput(raw);
  if (!reorderItems) {
    return errorResponse(c, 400, "INVALID_TRIP_PLACE_REORDER_INPUT", "장소 순서 변경 값을 확인해주세요.");
  }

  const userId = currentUserId(c);
  const tripId = c.req.param("tripId");
  const existingPlaces = await listTripPlaces(c.env.DB, userId, tripId);
  if (!existingPlaces) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  const existingPlaceIds = new Set(existingPlaces.map((place) => place.id));
  const missingPlace = reorderItems.find((item) => !existingPlaceIds.has(item.placeId));
  if (missingPlace) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  const updatedPlaces = [];
  for (const item of reorderItems) {
    const place = await updateTripPlace(c.env.DB, userId, tripId, item.placeId, {
      dayNumber: item.dayNumber,
      sortOrder: item.sortOrder
    });
    if (!place) {
      return errorResponse(c, 409, "TRIP_PLACE_REORDER_FAILED", "장소 순서를 저장하지 못했습니다.");
    }
    updatedPlaces.push(place);
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.reorder",
    entityType: "trip",
    entityId: tripId,
    requestId: requestId(c),
    metadata: { placeCount: updatedPlaces.length }
  });

  return c.json({
    ok: true,
    places: updatedPlaces.map(toPublicTripPlace),
    requestId: c.get("requestId")
  });
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

  const userId = currentUserId(c);
  const place = await updateTripPlace(
    c.env.DB,
    userId,
    c.req.param("tripId"),
    c.req.param("placeId"),
    input
  );
  if (!place) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.update",
    entityType: "trip_place",
    entityId: place.id,
    requestId: requestId(c),
    metadata: { dayNumber: place.day_number, hasSponsored: place.is_sponsored === 1 }
  });
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

  const userId = currentUserId(c);
  const place = await updateTripPlace(
    c.env.DB,
    userId,
    c.req.param("tripId"),
    c.req.param("placeId"),
    input
  );
  if (!place) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.update",
    entityType: "trip_place",
    entityId: place.id,
    requestId: requestId(c),
    metadata: { dayNumber: place.day_number, hasSponsored: place.is_sponsored === 1 }
  });
  return c.json({ ok: true, place: toPublicTripPlace(place), requestId: c.get("requestId") });
});

tripRoutes.delete("/:tripId/places/:placeId", async (c) => {
  const userId = currentUserId(c);
  const deleted = await deleteTripPlace(
    c.env.DB,
    userId,
    c.req.param("tripId"),
    c.req.param("placeId")
  );
  if (!deleted) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.delete",
    entityType: "trip_place",
    entityId: c.req.param("placeId"),
    requestId: requestId(c)
  });
  return c.json({ ok: true, deleted: true, requestId: c.get("requestId") });
});

tripRoutes.delete("/:tripId/days/:dayId/places/:placeId", async (c) => {
  const userId = currentUserId(c);
  const deleted = await deleteTripPlace(
    c.env.DB,
    userId,
    c.req.param("tripId"),
    c.req.param("placeId")
  );
  if (!deleted) {
    return errorResponse(c, 404, "TRIP_PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_place.delete",
    entityType: "trip_place",
    entityId: c.req.param("placeId"),
    requestId: requestId(c)
  });
  return c.json({ ok: true, deleted: true, requestId: c.get("requestId") });
});

tripRoutes.post("/:tripId/exports", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const format = parseExportFormat(raw.format) ?? "pdf";
  const userId = currentUserId(c);
  const tripId = c.req.param("tripId");

  const entitlements = await listActiveEntitlements(c.env.DB, userId);
  if (!entitlements.length) {
    return errorResponse(c, 403, "PREMIUM_REQUIRED", "내보내기는 프리미엄 기능입니다.");
  }

  const trip = await getOwnedTrip(c.env.DB, userId, tripId);
  if (!trip) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "내보낼 여행을 찾을 수 없습니다.");
  }

  const [days, places] = await Promise.all([
    listTripDays(c.env.DB, userId, tripId),
    listTripPlaces(c.env.DB, userId, tripId)
  ]);
  const exportId = crypto.randomUUID();
  const manifestKey = `exports/${userId}/${tripId}/${exportId}.json`;
  const assetKey = `exports/${userId}/${tripId}/${exportId}.${format === "pdf" ? "html" : "svg"}`;
  const expiresAt = sqliteDateTimeAfterDays(7);
  const publicPlaces = (places ?? []).map(toPublicTripPlace);
  const publicDays = (days ?? []).map((day) => {
    const publicDay = toPublicTripDay(day);
    return {
      ...publicDay,
      places: publicPlaces.filter((place) => place.dayId === publicDay.id)
    };
  });
  const assignedDayIds = new Set(publicDays.map((day) => day.id));
  const unassignedPlaces = publicPlaces.filter((place) => !place.dayId || !assignedDayIds.has(place.dayId));
  const generatedAt = new Date().toISOString();
  const manifest = {
    kind: "trip_export_manifest",
    version: 1,
    exportId,
    format,
    generatedAt,
    expiresAt,
    requestId: c.get("requestId"),
    trip: {
      ...toPublicTrip(trip),
      days: publicDays,
      places: publicPlaces
    }
  };

  await c.env.TRIPMATE_ASSETS.put(manifestKey, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json; charset=utf-8" }
  });

  if (format === "pdf") {
    const printableHtml = renderPrintableTripExport({
      title: trip.title,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      generatedAt,
      days: publicDays,
      unassignedPlaces
    });
    await c.env.TRIPMATE_ASSETS.put(assetKey, printableHtml, {
      httpMetadata: {
        contentType: "text/html; charset=utf-8",
        contentDisposition: `inline; filename="tripmate-export-${exportId}.html"`
      }
    });
  } else {
    const imageSvg = renderImageTripExport({
      title: trip.title,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      generatedAt,
      days: publicDays,
      unassignedPlaces
    });
    await c.env.TRIPMATE_ASSETS.put(assetKey, imageSvg, {
      httpMetadata: {
        contentType: "image/svg+xml; charset=utf-8",
        contentDisposition: `inline; filename="tripmate-export-${exportId}.svg"`
      }
    });
  }

  const exportRecord = await createTripExport(c.env.DB, {
    id: exportId,
    userId,
    tripId,
    format,
    status: "ready",
    manifestKey,
    assetKey,
    expiresAt
  });

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip_export.create",
    entityType: "trip_export",
    entityId: exportRecord.id,
    requestId: requestId(c),
    metadata: { format: exportRecord.format, status: exportRecord.status, placeCount: publicPlaces.length }
  });
  return c.json({
    ok: true,
    export: toPublicTripExport(
      exportRecord,
      exportRecord.status === "ready" && exportRecord.asset_key
        ? buildExportDownloadUrl(c, tripId, exportRecord.id)
        : null
    ),
    requestId: c.get("requestId")
  }, 202);
});

tripRoutes.get("/:tripId/exports/:exportId/download", async (c) => {
  const userId = currentUserId(c);
  const exportRecord = await getOwnedTripExport(
    c.env.DB,
    userId,
    c.req.param("tripId"),
    c.req.param("exportId")
  );

  if (!exportRecord) {
    return errorResponse(c, 404, "EXPORT_NOT_FOUND", "내보내기 작업을 찾을 수 없습니다.");
  }

  if (exportRecord.status !== "ready" || !exportRecord.asset_key) {
    return errorResponse(c, 409, "EXPORT_NOT_READY", "내보내기 파일이 아직 준비되지 않았습니다.");
  }

  const object = await c.env.TRIPMATE_ASSETS.get(exportRecord.asset_key);
  if (!object) {
    return errorResponse(c, 404, "EXPORT_ASSET_NOT_FOUND", "내보내기 파일을 찾을 수 없습니다.");
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  return new Response(object.body, { headers });
});

tripRoutes.get("/:tripId/exports/:exportId", async (c) => {
  const exportRecord = await getOwnedTripExport(
    c.env.DB,
    currentUserId(c),
    c.req.param("tripId"),
    c.req.param("exportId")
  );

  if (!exportRecord) {
    return errorResponse(c, 404, "EXPORT_NOT_FOUND", "내보내기 작업을 찾을 수 없습니다.");
  }

  return c.json({
    ok: true,
    export: toPublicTripExport(
      exportRecord,
      exportRecord.status === "ready" && exportRecord.asset_key
        ? buildExportDownloadUrl(c, exportRecord.trip_id, exportRecord.id)
        : null
    ),
    requestId: c.get("requestId")
  });
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

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip.update",
    entityType: "trip",
    entityId: trip.id,
    requestId: requestId(c)
  });
  return c.json({ ok: true, trip: toPublicTrip(trip), requestId: c.get("requestId") });
});

tripRoutes.delete("/:tripId", async (c) => {
  const userId = currentUserId(c);
  const deleted = await deleteTrip(c.env.DB, userId, c.req.param("tripId"));
  if (!deleted) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "trip.delete",
    entityType: "trip",
    entityId: c.req.param("tripId"),
    requestId: requestId(c)
  });
  return c.json({ ok: true, deleted: true, requestId: c.get("requestId") });
});

tripRoutes.post("/:tripId/share", async (c) => {
  const userId = currentUserId(c);
  const shareLink = await createShareLink(c.env.DB, userId, c.req.param("tripId"));
  if (!shareLink) {
    return errorResponse(c, 404, "TRIP_NOT_FOUND", "공유할 여행을 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "share_link.create",
    entityType: "share_link",
    entityId: shareLink.id,
    requestId: requestId(c)
  });
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
  setPublicShareResponseHeaders(c);

  const sharedTrip = await getSharedTrip(c.env.DB, c.req.param("shareId"));
  if (!sharedTrip) {
    return errorResponse(c, 404, "SHARE_NOT_FOUND", "공유 링크를 찾을 수 없습니다.");
  }

  const [days, places] = await Promise.all([
    listTripDays(c.env.DB, sharedTrip.user_id, sharedTrip.id),
    listTripPlaces(c.env.DB, sharedTrip.user_id, sharedTrip.id)
  ]);
  const publicPlaces = (places ?? []).map(toPublicTripPlace);
  const publicDays = (days ?? []).map((day) => {
    const publicDay = toPublicTripDay(day);
    return {
      ...publicDay,
      places: publicPlaces.filter((place) => place.dayId === publicDay.id)
    };
  });

  return c.json({
    ok: true,
    share: {
      id: sharedTrip.share_id,
      expiresAt: sharedTrip.share_expires_at
    },
    trip: {
      ...toPublicTrip(sharedTrip),
      days: publicDays,
      places: publicPlaces
    },
    requestId: c.get("requestId")
  });
});
