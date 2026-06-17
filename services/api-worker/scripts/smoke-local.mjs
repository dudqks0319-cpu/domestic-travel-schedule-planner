import worker from "../dist/index.js";

const baseUrl = "https://worker.local";
const jwtSecret = "local-worker-smoke-secret";

const env = {
  ENVIRONMENT: "local",
  CORS_ALLOWED_ORIGINS: "http://localhost:8081",
  JWT_ACCESS_SECRET: jwtSecret,
  DB: createMockD1(),
  PROVIDER_CACHE: {},
  SHARE_ASSETS: {}
};

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, init = {}) {
  return worker.fetch(new Request(`${baseUrl}${path}`, init), env);
}

async function main() {
  const checks = [];
  const userAToken = await createJwt({ sub: "user_a", exp: Math.floor(Date.now() / 1000) + 3600 });
  const userBToken = await createJwt({ sub: "user_b", exp: Math.floor(Date.now() / 1000) + 3600 });
  const expiredToken = await createJwt({ sub: "user_a", exp: Math.floor(Date.now() / 1000) - 60 });

  const rootHealth = await request("/health", {
    headers: { "x-request-id": "smoke-health-root" }
  });
  const rootHealthBody = await readJson(rootHealth);
  assert(rootHealth.status === 200, "GET /health should return 200");
  assert(rootHealthBody.status === "ok", "GET /health should return ok status");
  assert(rootHealth.headers.get("x-request-id") === "smoke-health-root", "GET /health should echo request id");
  checks.push("GET /health -> 200");

  const apiHealth = await request("/api/v1/health");
  const apiHealthBody = await readJson(apiHealth);
  assert(apiHealth.status === 200, "GET /api/v1/health should return 200");
  assert(apiHealthBody.bindings.d1 === true, "health should expose D1 binding presence");
  checks.push("GET /api/v1/health -> 200");

  const preflight = await request("/api/v1/trips", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:8081",
      "access-control-request-method": "POST"
    }
  });
  assert(preflight.status === 204, "OPTIONS preflight should return 204");
  assert(
    preflight.headers.get("access-control-allow-origin") === "http://localhost:8081",
    "OPTIONS should allow configured local origin"
  );
  checks.push("OPTIONS /api/v1/trips -> 204");

  const unauthenticatedTrips = await request("/api/v1/trips");
  const unauthenticatedTripsBody = await readJson(unauthenticatedTrips);
  assert(unauthenticatedTrips.status === 401, "GET /api/v1/trips without token should return 401");
  assert(
    unauthenticatedTripsBody.error.code === "unauthorized",
    "unauthenticated trips response should use unauthorized code"
  );
  checks.push("GET /api/v1/trips without token -> 401");

  const malformedTokenTrips = await request("/api/v1/trips", {
    headers: {
      authorization: "Bearer local-smoke-token"
    }
  });
  const malformedTokenTripsBody = await readJson(malformedTokenTrips);
  assert(malformedTokenTrips.status === 401, "GET /api/v1/trips with malformed token should return 401");
  assert(malformedTokenTripsBody.error.code === "invalid_token", "malformed token should use invalid_token code");
  checks.push("GET /api/v1/trips with malformed token -> 401");

  const expiredTokenTrips = await request("/api/v1/trips", {
    headers: {
      authorization: `Bearer ${expiredToken}`
    }
  });
  const expiredTokenTripsBody = await readJson(expiredTokenTrips);
  assert(expiredTokenTrips.status === 401, "GET /api/v1/trips with expired token should return 401");
  assert(expiredTokenTripsBody.error.code === "token_expired", "expired token should use token_expired code");
  checks.push("GET /api/v1/trips with expired token -> 401");

  const invalidCreateTrip = await request("/api/v1/trips", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ destinationName: "서울", startDate: "2026-06-20" })
  });
  const invalidCreateTripBody = await readJson(invalidCreateTrip);
  assert(invalidCreateTrip.status === 400, "POST /api/v1/trips with missing endDate should return 400");
  assert(
    invalidCreateTripBody.error.code === "validation_failed",
    "invalid create trip response should use validation_failed code"
  );
  checks.push("POST /api/v1/trips invalid payload -> 400");

  const createdTrip = await request("/api/v1/trips", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      destinationName: "서울",
      startDate: "2026-06-20",
      endDate: "2026-06-22",
      styleKey: "healing_trip"
    })
  });
  const createdTripBody = await readJson(createdTrip);
  assert(createdTrip.status === 201, "POST /api/v1/trips with valid token should return 201");
  assert(createdTripBody.item.destinationName === "서울", "created trip should preserve destinationName");
  assert(createdTripBody.item.styleKey === "healing_trip", "created trip should preserve styleKey");
  checks.push("POST /api/v1/trips valid payload -> 201");

  const listedTrips = await request("/api/v1/trips", {
    headers: {
      authorization: `Bearer ${userAToken}`
    }
  });
  const listedTripsBody = await readJson(listedTrips);
  assert(listedTrips.status === 200, "GET /api/v1/trips with valid token should return 200");
  assert(listedTripsBody.items.length === 1, "GET /api/v1/trips should return the user's created trip");
  checks.push("GET /api/v1/trips with valid token -> 200");

  const tripId = createdTripBody.item.id;
  const ownedTrip = await request(`/api/v1/trips/${tripId}`, {
    headers: {
      authorization: `Bearer ${userAToken}`
    }
  });
  const ownedTripBody = await readJson(ownedTrip);
  assert(ownedTrip.status === 200, "GET /api/v1/trips/:tripId for owner should return 200");
  assert(ownedTripBody.item.id === tripId, "owned trip response should return requested trip id");
  checks.push("GET /api/v1/trips/:tripId owner -> 200");

  const crossUserTrip = await request(`/api/v1/trips/${tripId}`, {
    headers: {
      authorization: `Bearer ${userBToken}`
    }
  });
  const crossUserTripBody = await readJson(crossUserTrip);
  assert(crossUserTrip.status === 404, "GET /api/v1/trips/:tripId for another user should return 404");
  assert(crossUserTripBody.error.code === "not_found", "cross-user trip response should not reveal ownership");
  checks.push("GET /api/v1/trips/:tripId cross-user -> 404");

  const invalidAdEvent = await request("/api/v1/monetization/ad-events", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ placement: "home_top", eventType: "unknown" })
  });
  const invalidAdEventBody = await readJson(invalidAdEvent);
  assert(invalidAdEvent.status === 400, "invalid ad event should return 400");
  assert(invalidAdEventBody.error.code === "validation_failed", "invalid ad event should use validation_failed");
  checks.push("POST /api/v1/monetization/ad-events invalid payload -> 400");

  const adEventPayload = JSON.stringify({
    placement: "home_top",
    eventType: "impression",
    metadata: { screen: "home", index: 1 }
  });
  const adEvent = await request("/api/v1/monetization/ad-events", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json",
      "x-idempotency-key": "ad-event-0001"
    },
    body: adEventPayload
  });
  const adEventBody = await readJson(adEvent);
  assert(adEvent.status === 201, "valid ad event should return 201");
  assert(adEventBody.item.placement === "home_top", "ad event should preserve placement");
  checks.push("POST /api/v1/monetization/ad-events valid payload -> 201");

  const adEventReplay = await request("/api/v1/monetization/ad-events", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json",
      "x-idempotency-key": "ad-event-0001"
    },
    body: adEventPayload
  });
  const adEventReplayBody = await readJson(adEventReplay);
  assert(adEventReplay.status === 201, "ad event idempotent replay should return 201");
  assert(
    adEventReplay.headers.get("x-idempotent-replay") === "true",
    "ad event idempotent replay should expose replay header"
  );
  assert(adEventReplayBody.item.id === adEventBody.item.id, "ad event replay should preserve original response");
  checks.push("POST /api/v1/monetization/ad-events idempotent replay -> 201");

  const invalidAffiliateClick = await request("/api/v1/monetization/affiliate-clicks", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ provider: "booking", targetUrl: "http://example.com/deal" })
  });
  const invalidAffiliateClickBody = await readJson(invalidAffiliateClick);
  assert(invalidAffiliateClick.status === 400, "non-HTTPS affiliate target should return 400");
  assert(
    invalidAffiliateClickBody.error.code === "validation_failed",
    "invalid affiliate click should use validation_failed"
  );
  checks.push("POST /api/v1/monetization/affiliate-clicks invalid payload -> 400");

  const crossUserAffiliateClick = await request("/api/v1/monetization/affiliate-clicks", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userBToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      provider: "booking",
      targetUrl: "https://example.com/deal?hotel=1",
      tripId
    })
  });
  const crossUserAffiliateClickBody = await readJson(crossUserAffiliateClick);
  assert(crossUserAffiliateClick.status === 404, "cross-user affiliate trip association should return 404");
  assert(
    crossUserAffiliateClickBody.error.code === "not_found",
    "cross-user affiliate click should hide trip ownership"
  );
  checks.push("POST /api/v1/monetization/affiliate-clicks cross-user trip -> 404");

  const affiliateClick = await request("/api/v1/monetization/affiliate-clicks", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      provider: "booking",
      targetUrl: "https://example.com/deal?hotel=1",
      tripId
    })
  });
  const affiliateClickBody = await readJson(affiliateClick);
  assert(affiliateClick.status === 201, "valid affiliate click should return 201");
  assert(affiliateClickBody.item.provider === "booking", "affiliate click should preserve provider");
  assert(affiliateClickBody.item.tripId === tripId, "affiliate click should preserve owned trip id");
  checks.push("POST /api/v1/monetization/affiliate-clicks valid payload -> 201");

  const invalidEntitlement = await request("/api/v1/monetization/entitlements/verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ store: "stripe", productId: "tripmate_pro" })
  });
  const invalidEntitlementBody = await readJson(invalidEntitlement);
  assert(invalidEntitlement.status === 400, "invalid entitlement verify should return 400");
  assert(
    invalidEntitlementBody.error.code === "validation_failed",
    "invalid entitlement verify should use validation_failed"
  );
  checks.push("POST /api/v1/monetization/entitlements/verify invalid payload -> 400");

  const entitlementPayload = JSON.stringify({
    store: "apple",
    productId: "tripmate_pro_monthly",
    transactionId: "tx-local-0001",
    receiptData: "raw-receipt-not-stored"
  });
  const entitlement = await request("/api/v1/monetization/entitlements/verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json",
      "x-idempotency-key": "entitlement-0001"
    },
    body: entitlementPayload
  });
  const entitlementBody = await readJson(entitlement);
  assert(entitlement.status === 200, "entitlement verify skeleton should return 200");
  assert(entitlementBody.item.status === "pending_verification", "entitlement should remain pending without store verification");
  assert(entitlementBody.item.active === false, "pending entitlement should not grant active premium");
  assert(entitlementBody.meta.receiptStored === false, "entitlement verify should not store receipt payloads");
  checks.push("POST /api/v1/monetization/entitlements/verify skeleton -> 200");

  const entitlementReplay = await request("/api/v1/monetization/entitlements/verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json",
      "x-idempotency-key": "entitlement-0001"
    },
    body: entitlementPayload
  });
  const entitlementReplayBody = await readJson(entitlementReplay);
  assert(entitlementReplay.status === 200, "entitlement idempotent replay should return 200");
  assert(
    entitlementReplay.headers.get("x-idempotent-replay") === "true",
    "entitlement idempotent replay should expose replay header"
  );
  assert(entitlementReplayBody.item.id === entitlementBody.item.id, "entitlement replay should preserve original response");
  checks.push("POST /api/v1/monetization/entitlements/verify idempotent replay -> 200");

  const myEntitlements = await request("/api/v1/monetization/entitlements/me", {
    headers: {
      authorization: `Bearer ${userAToken}`
    }
  });
  const myEntitlementsBody = await readJson(myEntitlements);
  assert(myEntitlements.status === 200, "GET entitlements/me should return 200");
  assert(myEntitlementsBody.items.length === 1, "GET entitlements/me should return stored entitlement");
  assert(myEntitlementsBody.active === false, "GET entitlements/me should not activate pending entitlement");
  checks.push("GET /api/v1/monetization/entitlements/me -> 200");

  const invalidUpdateTrip = await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ endDate: "2026-06-19" })
  });
  const invalidUpdateTripBody = await readJson(invalidUpdateTrip);
  assert(invalidUpdateTrip.status === 400, "PATCH /api/v1/trips/:tripId invalid date should return 400");
  assert(
    invalidUpdateTripBody.error.code === "validation_failed",
    "invalid update trip response should use validation_failed"
  );
  checks.push("PATCH /api/v1/trips/:tripId invalid payload -> 400");

  const updateTripPayload = JSON.stringify({
    title: "서울 주말 여행",
    status: "planned"
  });
  const updatedTrip = await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json",
      "x-idempotency-key": "trip-update-0001"
    },
    body: updateTripPayload
  });
  const updatedTripBody = await readJson(updatedTrip);
  assert(updatedTrip.status === 200, "PATCH /api/v1/trips/:tripId should return 200");
  assert(updatedTripBody.item.title === "서울 주말 여행", "updated trip should preserve title");
  assert(updatedTripBody.item.status === "planned", "updated trip should preserve status");
  checks.push("PATCH /api/v1/trips/:tripId owner -> 200");

  const replayedTripUpdate = await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json",
      "x-idempotency-key": "trip-update-0001"
    },
    body: updateTripPayload
  });
  const replayedTripUpdateBody = await readJson(replayedTripUpdate);
  assert(replayedTripUpdate.status === 200, "idempotent trip update replay should return 200");
  assert(
    replayedTripUpdate.headers.get("x-idempotent-replay") === "true",
    "idempotent trip update replay should expose replay header"
  );
  assert(
    replayedTripUpdateBody.item.updatedAt === updatedTripBody.item.updatedAt,
    "idempotent trip update replay should preserve original response"
  );
  checks.push("PATCH /api/v1/trips/:tripId idempotent replay -> 200");

  const conflictingTripUpdate = await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json",
      "x-idempotency-key": "trip-update-0001"
    },
    body: JSON.stringify({ title: "다른 제목" })
  });
  const conflictingTripUpdateBody = await readJson(conflictingTripUpdate);
  assert(conflictingTripUpdate.status === 409, "idempotency key reuse with different body should return 409");
  assert(
    conflictingTripUpdateBody.error.code === "idempotency_key_reuse",
    "idempotency conflict should use idempotency_key_reuse"
  );
  checks.push("PATCH /api/v1/trips/:tripId idempotency conflict -> 409");

  const crossUserUpdateTrip = await request(`/api/v1/trips/${tripId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userBToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ title: "다른 사용자" })
  });
  const crossUserUpdateTripBody = await readJson(crossUserUpdateTrip);
  assert(crossUserUpdateTrip.status === 404, "cross-user trip update should return 404");
  assert(crossUserUpdateTripBody.error.code === "not_found", "cross-user trip update should hide ownership");
  checks.push("PATCH /api/v1/trips/:tripId cross-user -> 404");

  const deletableTrip = await request("/api/v1/trips", {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      destinationName: "부산",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      styleKey: "drive_trip"
    })
  });
  const deletableTripBody = await readJson(deletableTrip);
  const deletableTripId = deletableTripBody.item.id;

  const crossUserDeleteTrip = await request(`/api/v1/trips/${tripId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${userBToken}`
    }
  });
  const crossUserDeleteTripBody = await readJson(crossUserDeleteTrip);
  assert(crossUserDeleteTrip.status === 404, "cross-user trip delete should return 404");
  assert(crossUserDeleteTripBody.error.code === "not_found", "cross-user trip delete should hide ownership");
  checks.push("DELETE /api/v1/trips/:tripId cross-user -> 404");

  const deletedTrip = await request(`/api/v1/trips/${deletableTripId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "x-idempotency-key": "trip-delete-0001"
    }
  });
  assert(deletedTrip.status === 204, "DELETE /api/v1/trips/:tripId owner should return 204");
  checks.push("DELETE /api/v1/trips/:tripId owner -> 204");

  const replayedTripDelete = await request(`/api/v1/trips/${deletableTripId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "x-idempotency-key": "trip-delete-0001"
    }
  });
  assert(replayedTripDelete.status === 204, "idempotent trip delete replay should return 204");
  assert(
    replayedTripDelete.headers.get("x-idempotent-replay") === "true",
    "idempotent trip delete replay should expose replay header"
  );
  checks.push("DELETE /api/v1/trips/:tripId idempotent replay -> 204");

  const deletedTripRead = await request(`/api/v1/trips/${deletableTripId}`, {
    headers: {
      authorization: `Bearer ${userAToken}`
    }
  });
  const deletedTripReadBody = await readJson(deletedTripRead);
  assert(deletedTripRead.status === 404, "GET deleted trip should return 404");
  assert(deletedTripReadBody.error.code === "not_found", "deleted trip read should use not_found");
  checks.push("GET /api/v1/trips/:tripId deleted -> 404");

  const invalidDay = await request(`/api/v1/trips/${tripId}/days`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ dayIndex: 0 })
  });
  const invalidDayBody = await readJson(invalidDay);
  assert(invalidDay.status === 400, "POST /api/v1/trips/:tripId/days invalid payload should return 400");
  assert(invalidDayBody.error.code === "validation_failed", "invalid day response should use validation_failed code");
  checks.push("POST /api/v1/trips/:tripId/days invalid payload -> 400");

  const createdDay = await request(`/api/v1/trips/${tripId}/days`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      dayIndex: 0,
      date: "2026-06-20",
      title: "서울 도착"
    })
  });
  const createdDayBody = await readJson(createdDay);
  assert(createdDay.status === 201, "POST /api/v1/trips/:tripId/days valid payload should return 201");
  assert(createdDayBody.item.date === "2026-06-20", "created day should preserve date");
  checks.push("POST /api/v1/trips/:tripId/days valid payload -> 201");

  const dayId = createdDayBody.item.id;
  const crossUserDay = await request(`/api/v1/trips/${tripId}/days`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userBToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ dayIndex: 1, date: "2026-06-21" })
  });
  const crossUserDayBody = await readJson(crossUserDay);
  assert(crossUserDay.status === 404, "cross-user day create should return 404");
  assert(crossUserDayBody.error.code === "not_found", "cross-user day response should hide ownership");
  checks.push("POST /api/v1/trips/:tripId/days cross-user -> 404");

  const updatedDay = await request(`/api/v1/trips/${tripId}/days/${dayId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ title: "한강 산책" })
  });
  const updatedDayBody = await readJson(updatedDay);
  assert(updatedDay.status === 200, "PATCH /api/v1/trips/:tripId/days/:dayId should return 200");
  assert(updatedDayBody.item.title === "한강 산책", "updated day should preserve title");
  checks.push("PATCH /api/v1/trips/:tripId/days/:dayId owner -> 200");

  const invalidPlaceDay = await request(`/api/v1/trips/${tripId}/places`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      dayId: "missing-day",
      title: "경복궁",
      category: "attraction",
      visitOrder: 0
    })
  });
  const invalidPlaceDayBody = await readJson(invalidPlaceDay);
  assert(invalidPlaceDay.status === 404, "POST /api/v1/trips/:tripId/places with missing day should return 404");
  assert(invalidPlaceDayBody.error.code === "not_found", "missing day place response should use not_found");
  checks.push("POST /api/v1/trips/:tripId/places missing day -> 404");

  const createdPlace = await request(`/api/v1/trips/${tripId}/places`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      dayId,
      title: "경복궁",
      category: "attraction",
      visitOrder: 0,
      lat: 37.5796,
      lng: 126.977,
      durationMinutes: 90
    })
  });
  const createdPlaceBody = await readJson(createdPlace);
  assert(createdPlace.status === 201, "POST /api/v1/trips/:tripId/places valid payload should return 201");
  assert(createdPlaceBody.item.title === "경복궁", "created place should preserve title");
  checks.push("POST /api/v1/trips/:tripId/places valid payload -> 201");

  const placeId = createdPlaceBody.item.id;
  const updatedPlace = await request(`/api/v1/trips/${tripId}/places/${placeId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ notes: "오전 방문", visitOrder: 1 })
  });
  const updatedPlaceBody = await readJson(updatedPlace);
  assert(updatedPlace.status === 200, "PATCH /api/v1/trips/:tripId/places/:placeId should return 200");
  assert(updatedPlaceBody.item.notes === "오전 방문", "updated place should preserve notes");
  checks.push("PATCH /api/v1/trips/:tripId/places/:placeId owner -> 200");

  const crossUserPlace = await request(`/api/v1/trips/${tripId}/places/${placeId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${userBToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ notes: "다른 사용자" })
  });
  const crossUserPlaceBody = await readJson(crossUserPlace);
  assert(crossUserPlace.status === 404, "cross-user place update should return 404");
  assert(crossUserPlaceBody.error.code === "not_found", "cross-user place response should hide ownership");
  checks.push("PATCH /api/v1/trips/:tripId/places/:placeId cross-user -> 404");

  const deletablePlace = await request(`/api/v1/trips/${tripId}/places`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      dayId,
      title: "삭제할 장소",
      category: "memo",
      visitOrder: 9
    })
  });
  const deletablePlaceBody = await readJson(deletablePlace);
  const deletedPlace = await request(`/api/v1/trips/${tripId}/places/${deletablePlaceBody.item.id}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${userAToken}`
    }
  });
  assert(deletedPlace.status === 204, "DELETE /api/v1/trips/:tripId/places/:placeId owner should return 204");
  checks.push("DELETE /api/v1/trips/:tripId/places/:placeId owner -> 204");

  const crossUserShare = await request(`/api/v1/trips/${tripId}/share`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userBToken}`
    }
  });
  const crossUserShareBody = await readJson(crossUserShare);
  assert(crossUserShare.status === 404, "cross-user share create should return 404");
  assert(crossUserShareBody.error.code === "not_found", "cross-user share response should hide ownership");
  checks.push("POST /api/v1/trips/:tripId/share cross-user -> 404");

  const invalidSharePayload = await request(`/api/v1/trips/${tripId}/share`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ expiresAt: 123 })
  });
  const invalidSharePayloadBody = await readJson(invalidSharePayload);
  assert(invalidSharePayload.status === 400, "invalid share payload should return 400");
  assert(
    invalidSharePayloadBody.error.code === "validation_failed",
    "invalid share payload should use validation_failed"
  );
  checks.push("POST /api/v1/trips/:tripId/share invalid payload -> 400");

  const createdShare = await request(`/api/v1/trips/${tripId}/share`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ expiresAt: "2026-07-01T00:00:00.000Z" })
  });
  const createdShareBody = await readJson(createdShare);
  assert(createdShare.status === 201, "POST /api/v1/trips/:tripId/share owner should return 201");
  assert(createdShareBody.item.shareId.startsWith("sh_"), "share id should use opaque sh_ token");
  checks.push("POST /api/v1/trips/:tripId/share owner -> 201");

  const publicShare = await request(`/api/v1/share/${createdShareBody.item.shareId}`);
  const publicShareBody = await readJson(publicShare);
  assert(publicShare.status === 200, "GET /api/v1/share/:shareId should return 200");
  assert(publicShareBody.item.days.length === 1, "public share should include days");
  assert(publicShareBody.item.places.length === 1, "public share should include non-deleted places");
  checks.push("GET /api/v1/share/:shareId public -> 200");

  const expiredShare = await request(`/api/v1/trips/${tripId}/share`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ expiresAt: "2020-01-01T00:00:00.000Z" })
  });
  const expiredShareBody = await readJson(expiredShare);
  const expiredPublicShare = await request(`/api/v1/share/${expiredShareBody.item.shareId}`);
  const expiredPublicShareBody = await readJson(expiredPublicShare);
  assert(expiredPublicShare.status === 404, "expired public share should return 404");
  assert(expiredPublicShareBody.error.code === "not_found", "expired share response should use not_found");
  checks.push("GET /api/v1/share/:shareId expired -> 404");

  const missing = await request("/unknown");
  const missingBody = await readJson(missing);
  assert(missing.status === 404, "unknown route should return 404");
  assert(missingBody.error.code === "not_found", "unknown route should use not_found code");
  checks.push("GET /unknown -> 404");

  for (const check of checks) {
    console.log(`✅ ${check}`);
  }
  console.log(`완료 / done: ${checks.length}/${checks.length} worker smoke checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function createJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createMockD1() {
  const state = {
    trips: [],
    tripDays: [],
    tripPlaces: [],
    shareLinks: [],
    idempotencyKeys: [],
    entitlements: [],
    adEvents: [],
    affiliateClicks: [],
    auditLogs: []
  };

  return {
    prepare(sql) {
      return createMockStatement(state, sql, []);
    }
  };
}

function createMockStatement(state, sql, bindings) {
  return {
    bind(...values) {
      return createMockStatement(state, sql, values);
    },
    async all() {
      const normalized = normalizeSql(sql);
      if (normalized.includes("from trips") && normalized.includes("where user_id = ?")) {
        const [userId] = bindings;
        return {
          success: true,
          meta: {},
          results: state.trips
            .filter((trip) => trip.user_id === userId)
            .sort((left, right) => right.created_at.localeCompare(left.created_at))
        };
      }

      if (normalized.includes("from trip_days") && normalized.includes("where trip_id = ?")) {
        const [tripId] = bindings;
        return {
          success: true,
          meta: {},
          results: state.tripDays
            .filter((day) => day.trip_id === tripId)
            .sort((left, right) => left.day_index - right.day_index)
        };
      }

      if (normalized.includes("from trip_places") && normalized.includes("where trip_id = ?")) {
        const [tripId] = bindings;
        return {
          success: true,
          meta: {},
          results: state.tripPlaces
            .filter((place) => place.trip_id === tripId)
            .sort((left, right) => left.visit_order - right.visit_order)
        };
      }

      if (normalized.includes("from subscription_entitlements") && normalized.includes("where user_id = ?")) {
        const [userId] = bindings;
        return {
          success: true,
          meta: {},
          results: state.entitlements
            .filter((item) => item.user_id === userId)
            .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        };
      }

      throw new Error(`Mock D1 all() does not support query: ${sql}`);
    },
    async first() {
      const normalized = normalizeSql(sql);
      if (
        normalized.includes("from trips") &&
        normalized.includes("where id = ? and user_id = ?")
      ) {
        const [tripId, userId] = bindings;
        return state.trips.find((trip) => trip.id === tripId && trip.user_id === userId) || null;
      }

      if (
        normalized.includes("from trip_days") &&
        normalized.includes("where id = ? and trip_id = ?")
      ) {
        const [dayId, tripId] = bindings;
        return state.tripDays.find((day) => day.id === dayId && day.trip_id === tripId) || null;
      }

      if (
        normalized.includes("from trip_places") &&
        normalized.includes("where id = ? and trip_id = ?")
      ) {
        const [placeId, tripId] = bindings;
        return state.tripPlaces.find((place) => place.id === placeId && place.trip_id === tripId) || null;
      }

      if (normalized.includes("from share_links") && normalized.includes("inner join trips")) {
        const [shareToken] = bindings;
        const share = state.shareLinks.find((link) => link.share_token === shareToken && link.revoked_at === null);
        if (!share) {
          return null;
        }
        const trip = state.trips.find((item) => item.id === share.trip_id);
        if (!trip) {
          return null;
        }
        return {
          share_token: share.share_token,
          expires_at: share.expires_at,
          trip_id: trip.id,
          title: trip.title,
          destination_name: trip.destination_name,
          start_date: trip.start_date,
          end_date: trip.end_date,
          style_key: trip.style_key,
          status: trip.status,
          created_at: trip.created_at,
          updated_at: trip.updated_at
        };
      }

      if (normalized.includes("from idempotency_keys")) {
        const [userId, routeKey, idempotencyKey] = bindings;
        return state.idempotencyKeys.find(
          (item) =>
            item.user_id === userId &&
            item.route_key === routeKey &&
            item.idempotency_key === idempotencyKey
        ) || null;
      }

      if (
        normalized.includes("from subscription_entitlements") &&
        normalized.includes("where store = ? and transaction_id = ?")
      ) {
        const [store, transactionId] = bindings;
        return state.entitlements.find(
          (item) => item.store === store && item.transaction_id === transactionId
        ) || null;
      }

      throw new Error(`Mock D1 first() does not support query: ${sql}`);
    },
    async run() {
      const normalized = normalizeSql(sql);
      if (normalized.startsWith("insert into trips")) {
        const [
          id,
          user_id,
          title,
          destination_name,
          start_date,
          end_date,
          style_key,
          status,
          created_at,
          updated_at
        ] = bindings;
        state.trips.push({
          id,
          user_id,
          title,
          destination_name,
          start_date,
          end_date,
          style_key,
          status,
          created_at,
          updated_at
        });
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("update trips")) {
        const [
          title,
          destination_name,
          start_date,
          end_date,
          style_key,
          status,
          updated_at,
          tripId,
          userId
        ] = bindings;
        const trip = state.trips.find((item) => item.id === tripId && item.user_id === userId);
        if (trip) {
          trip.title = title;
          trip.destination_name = destination_name;
          trip.start_date = start_date;
          trip.end_date = end_date;
          trip.style_key = style_key;
          trip.status = status;
          trip.updated_at = updated_at;
        }
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("delete from trips")) {
        const [tripId, userId] = bindings;
        state.trips = state.trips.filter((trip) => !(trip.id === tripId && trip.user_id === userId));
        state.tripDays = state.tripDays.filter((day) => day.trip_id !== tripId);
        state.tripPlaces = state.tripPlaces.filter((place) => place.trip_id !== tripId);
        state.shareLinks = state.shareLinks.filter((link) => link.trip_id !== tripId);
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into trip_days")) {
        const [id, trip_id, day_index, date, title, created_at, updated_at] = bindings;
        state.tripDays.push({ id, trip_id, day_index, date, title, created_at, updated_at });
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("update trip_days")) {
        const [date, title, updated_at, dayId, tripId] = bindings;
        const day = state.tripDays.find((item) => item.id === dayId && item.trip_id === tripId);
        if (day) {
          day.date = date;
          day.title = title;
          day.updated_at = updated_at;
        }
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into trip_places")) {
        const [
          id,
          trip_id,
          day_id,
          provider_place_id,
          source_place_id,
          title,
          category,
          lat,
          lng,
          address,
          visit_order,
          starts_at,
          duration_minutes,
          notes,
          created_at,
          updated_at
        ] = bindings;
        state.tripPlaces.push({
          id,
          trip_id,
          day_id,
          provider_place_id,
          source_place_id,
          title,
          category,
          lat,
          lng,
          address,
          visit_order,
          starts_at,
          duration_minutes,
          notes,
          created_at,
          updated_at
        });
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("update trip_places")) {
        const [title, category, visit_order, starts_at, duration_minutes, notes, updated_at, placeId, tripId] = bindings;
        const place = state.tripPlaces.find((item) => item.id === placeId && item.trip_id === tripId);
        if (place) {
          place.title = title;
          place.category = category;
          place.visit_order = visit_order;
          place.starts_at = starts_at;
          place.duration_minutes = duration_minutes;
          place.notes = notes;
          place.updated_at = updated_at;
        }
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("delete from trip_places")) {
        const [placeId, tripId] = bindings;
        state.tripPlaces = state.tripPlaces.filter(
          (place) => !(place.id === placeId && place.trip_id === tripId)
        );
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into share_links")) {
        const [id, trip_id, share_token, expires_at, created_at] = bindings;
        state.shareLinks.push({
          id,
          trip_id,
          share_token,
          expires_at,
          revoked_at: null,
          created_at
        });
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into ad_events")) {
        const [id, user_id, placement, event_type, metadata_json, created_at] = bindings;
        state.adEvents.push({ id, user_id, placement, event_type, metadata_json, created_at });
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into affiliate_clicks")) {
        const [id, user_id, provider, target_url_hash, trip_id, created_at] = bindings;
        if (String(target_url_hash).includes("example.com")) {
          return { success: false, meta: {}, error: "raw affiliate URL was stored" };
        }
        state.affiliateClicks.push({ id, user_id, provider, target_url_hash, trip_id, created_at });
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into subscription_entitlements")) {
        const [
          id,
          user_id,
          store,
          product_id,
          transaction_id,
          status,
          expires_at,
          verified_at,
          created_at,
          updated_at
        ] = bindings;
        if (String(transaction_id).includes("tx-local")) {
          return { success: false, meta: {}, error: "raw transaction id was stored" };
        }
        const existing = state.entitlements.find(
          (item) => item.store === store && item.transaction_id === transaction_id
        );
        if (existing) {
          existing.user_id = user_id;
          existing.product_id = product_id;
          existing.status = status;
          existing.expires_at = expires_at;
          existing.verified_at = verified_at;
          existing.updated_at = updated_at;
        } else {
          state.entitlements.push({
            id,
            user_id,
            store,
            product_id,
            transaction_id,
            status,
            expires_at,
            verified_at,
            created_at,
            updated_at
          });
        }
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into audit_logs")) {
        state.auditLogs.push(bindings);
        return { success: true, meta: {} };
      }

      if (normalized.startsWith("insert into idempotency_keys")) {
        const [
          id,
          user_id,
          route_key,
          idempotency_key,
          request_hash,
          response_status,
          response_body_json,
          created_at
        ] = bindings;
        state.idempotencyKeys.push({
          id,
          user_id,
          route_key,
          idempotency_key,
          request_hash,
          response_status,
          response_body_json,
          created_at
        });
        return { success: true, meta: {} };
      }

      throw new Error(`Mock D1 run() does not support query: ${sql}`);
    }
  };
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}
