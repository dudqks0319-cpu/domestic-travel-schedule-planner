import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import {
  getSharedTrip,
  listTripDays,
  listTripPlaces,
  toPublicTrip,
  toPublicTripDay,
  toPublicTripPlace
} from "../db/trips";

export const sharePageRoutes = new Hono<AppBindings>();

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "날짜 미정";
  }

  return text;
}

function renderNotFoundPage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TripMate 공유 일정</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f6f8; color: #1a1a2e; }
    main { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
    .empty { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; }
    h1 { margin: 0 0 10px; font-size: 24px; line-height: 1.25; }
    p { margin: 0; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <section class="empty">
      <h1>공유 일정을 찾을 수 없습니다</h1>
      <p>링크가 만료되었거나 삭제된 여행일 수 있습니다.</p>
    </section>
  </main>
</body>
</html>`;
}

function renderSharePage(input: {
  shareToken: string;
  shareExpiresAt: string | null;
  trip: ReturnType<typeof toPublicTrip>;
  days: Array<ReturnType<typeof toPublicTripDay> & { places: Array<ReturnType<typeof toPublicTripPlace>> }>;
  unassignedPlaces: Array<ReturnType<typeof toPublicTripPlace>>;
}): string {
  const daySections = input.days
    .map((day) => {
      const rows = day.places.length
        ? day.places
            .map((place, index) => {
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
                  <p class="meta">${escapeHtml(place.category || "장소")}${time ? ` · ${escapeHtml(time)}` : ""}</p>
                  ${place.address ? `<p class="address">${escapeHtml(place.address)}</p>` : ""}
                  ${place.memo ? `<p class="memo">${escapeHtml(place.memo)}</p>` : ""}
                </div>
              </li>`;
            })
            .join("")
        : `<li class="empty-place">담긴 장소가 없습니다.</li>`;

      return `<section class="day">
        <div class="day-header">
          <div>
            <p class="eyebrow">${day.dayNumber}일차</p>
            <h2>${escapeHtml(day.title)}</h2>
          </div>
          <span>${escapeHtml(formatDate(day.date))}</span>
        </div>
        <ol>${rows}</ol>
      </section>`;
    })
    .join("");

  const unassignedSection = input.unassignedPlaces.length
    ? `<section class="day">
        <div class="day-header">
          <div>
            <p class="eyebrow">미배정</p>
            <h2>날짜가 정해지지 않은 장소</h2>
          </div>
        </div>
        <ol>${input.unassignedPlaces
          .map(
            (place, index) => `<li class="place">
              <div class="place-index">${index + 1}</div>
              <div class="place-body">
                <h3>${escapeHtml(place.name)}</h3>
                <p class="meta">${escapeHtml(place.category || "장소")}</p>
                ${place.address ? `<p class="address">${escapeHtml(place.address)}</p>` : ""}
              </div>
            </li>`
          )
          .join("")}</ol>
      </section>`
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.trip.title)} | TripMate</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f6f8; color: #1a1a2e; }
    main { max-width: 860px; margin: 0 auto; padding: 28px 18px 44px; }
    header { padding: 26px 0 18px; }
    .brand { margin: 0 0 10px; color: #4a90e2; font-weight: 800; font-size: 14px; letter-spacing: 0; }
    h1 { margin: 0; font-size: clamp(28px, 6vw, 44px); line-height: 1.14; letter-spacing: 0; }
    .summary { margin-top: 12px; color: #6b7280; line-height: 1.6; font-size: 15px; }
    .notice { margin-top: 16px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 14px; padding: 12px 14px; color: #1e40af; font-weight: 700; font-size: 13px; }
    .day { margin-top: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .day-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 16px 16px 13px; background: #f8fbff; border-bottom: 1px solid #eef2f7; }
    .day-header h2 { margin: 3px 0 0; font-size: 18px; line-height: 1.3; }
    .day-header span { color: #6b7280; font-size: 13px; font-weight: 700; white-space: nowrap; }
    .eyebrow { margin: 0; color: #4a90e2; font-size: 12px; font-weight: 800; }
    ol { margin: 0; padding: 0; list-style: none; }
    .place { display: flex; gap: 12px; padding: 15px 16px; border-top: 1px solid #f3f4f6; }
    .place:first-child { border-top: 0; }
    .place-index { flex: 0 0 28px; width: 28px; height: 28px; border-radius: 14px; display: grid; place-items: center; background: #ebf3ff; color: #4a90e2; font-size: 12px; font-weight: 900; }
    .place-body { min-width: 0; flex: 1; }
    .place-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    h3 { margin: 0; font-size: 16px; line-height: 1.35; }
    .meta, .address, .memo { margin: 4px 0 0; color: #6b7280; font-size: 13px; line-height: 1.5; }
    .memo { color: #374151; }
    .sponsored { display: inline-flex; border-radius: 999px; background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; padding: 3px 7px; font-size: 11px; font-weight: 800; }
    .empty-place { padding: 16px; color: #6b7280; font-size: 14px; }
    footer { margin-top: 24px; color: #9ca3af; font-size: 12px; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="brand">TripMate 공유 일정</p>
      <h1>${escapeHtml(input.trip.title)}</h1>
      <p class="summary">${escapeHtml(input.trip.destination)} · ${escapeHtml(formatDate(input.trip.startDate))} - ${escapeHtml(formatDate(input.trip.endDate))}</p>
      <p class="notice">이 페이지는 읽기 전용 공유 일정입니다. 장소 좌표 원문은 표시하지 않습니다.</p>
    </header>
    ${daySections || `<section class="day"><div class="empty-place">표시할 일정이 없습니다.</div></section>`}
    ${unassignedSection}
    <footer>공유 토큰: ${escapeHtml(input.shareToken.slice(0, 8))}...${input.shareExpiresAt ? ` · 만료: ${escapeHtml(input.shareExpiresAt)}` : ""}</footer>
  </main>
</body>
</html>`;
}

sharePageRoutes.get("/:shareId", async (c) => {
  const sharedTrip = await getSharedTrip(c.env.DB, c.req.param("shareId"));
  if (!sharedTrip) {
    return c.html(renderNotFoundPage(), 404);
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
  const assignedDayIds = new Set(publicDays.map((day) => day.id));
  const unassignedPlaces = publicPlaces.filter((place) => !place.dayId || !assignedDayIds.has(place.dayId));

  return c.html(renderSharePage({
    shareToken: sharedTrip.share_token,
    shareExpiresAt: sharedTrip.share_expires_at,
    trip: toPublicTrip(sharedTrip),
    days: publicDays,
    unassignedPlaces
  }));
});
