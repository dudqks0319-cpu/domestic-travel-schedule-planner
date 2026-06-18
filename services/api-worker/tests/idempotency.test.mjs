import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareIdempotency, storeIdempotencyResult } from "../dist/idempotency.js";

describe("Worker idempotency helpers", () => {
  it("disables storage when no X-Idempotency-Key is provided", async () => {
    const db = createIdempotencyDb();
    const request = new Request("https://worker.local/api/v1/trips", { method: "POST" });
    const decision = await prepareIdempotency(request, context(db), "user_a", "{}");

    assert.deepEqual(decision, { enabled: false });
    assert.equal(await storeIdempotencyResult(db, decision, 201, { item: { id: "trip_1" } }), true);
    assert.equal(db.rows.length, 0);
  });

  it("stores and replays the original response for the same user, route, key, and body", async () => {
    const db = createIdempotencyDb();
    const request = new Request("https://worker.local/api/v1/trips", {
      method: "POST",
      headers: { "x-idempotency-key": "trip-create-0001" }
    });
    const decision = await prepareIdempotency(request, context(db), "user_a", '{"destinationName":"서울"}');

    assert.equal(decision.enabled, true);
    assert.equal(
      await storeIdempotencyResult(db, decision, 201, { item: { id: "trip_1", destinationName: "서울" } }),
      true
    );

    const replay = await prepareIdempotency(request, context(db), "user_a", '{"destinationName":"서울"}');

    assert.ok(replay instanceof Response);
    assert.equal(replay.status, 201);
    assert.equal(replay.headers.get("x-idempotent-replay"), "true");
    assert.deepEqual(await replay.json(), { item: { id: "trip_1", destinationName: "서울" } });
  });

  it("rejects key reuse with a different payload for the same user and route", async () => {
    const db = createIdempotencyDb();
    const request = new Request("https://worker.local/api/v1/trips", {
      method: "POST",
      headers: { "x-idempotency-key": "trip-create-0001" }
    });
    const decision = await prepareIdempotency(request, context(db), "user_a", '{"destinationName":"서울"}');
    assert.equal(decision.enabled, true);
    assert.equal(await storeIdempotencyResult(db, decision, 201, { item: { id: "trip_1" } }), true);

    const conflict = await prepareIdempotency(request, context(db), "user_a", '{"destinationName":"부산"}');

    assert.ok(conflict instanceof Response);
    assert.equal(conflict.status, 409);
    const body = await conflict.json();
    assert.equal(body.error.code, "idempotency_key_reuse");
  });

  it("scopes identical keys by user and route", async () => {
    const db = createIdempotencyDb();
    const createRequest = new Request("https://worker.local/api/v1/trips", {
      method: "POST",
      headers: { "x-idempotency-key": "shared-key-0001" }
    });
    const firstDecision = await prepareIdempotency(createRequest, context(db), "user_a", "{}");
    assert.equal(firstDecision.enabled, true);
    assert.equal(await storeIdempotencyResult(db, firstDecision, 201, { item: { id: "trip_1" } }), true);

    const otherUserDecision = await prepareIdempotency(createRequest, context(db), "user_b", "{}");
    assert.equal(otherUserDecision.enabled, true);
    assert.equal(otherUserDecision.userId, "user_b");

    const otherRouteDecision = await prepareIdempotency(
      new Request("https://worker.local/api/v1/trips/trip_1/share", {
        method: "POST",
        headers: { "x-idempotency-key": "shared-key-0001" }
      }),
      context(db),
      "user_a",
      "{}"
    );
    assert.equal(otherRouteDecision.enabled, true);
    assert.equal(otherRouteDecision.routeKey, "POST /api/v1/trips/trip_1/share");
  });

  it("validates key length and character set before touching storage", async () => {
    const db = createIdempotencyDb();
    const invalid = await prepareIdempotency(
      new Request("https://worker.local/api/v1/trips", {
        method: "POST",
        headers: { "x-idempotency-key": "bad key" }
      }),
      context(db),
      "user_a",
      "{}"
    );

    assert.ok(invalid instanceof Response);
    assert.equal(invalid.status, 400);
    assert.equal(db.rows.length, 0);
    const body = await invalid.json();
    assert.equal(body.error.code, "invalid_idempotency_key");
  });
});

function context(db) {
  return {
    requestId: "unit-request",
    authenticated: true,
    env: {
      DB: db,
      CORS_ALLOWED_ORIGINS: "https://app.local",
      ENVIRONMENT: "local",
      PROVIDER_CACHE: {},
      SHARE_ASSETS: {}
    }
  };
}

function createIdempotencyDb() {
  const rows = [];
  return {
    rows,
    prepare(query) {
      return createStatement(query, rows);
    },
    dump() {
      return Promise.resolve(new ArrayBuffer(0));
    },
    batch() {
      return Promise.resolve([]);
    },
    exec() {
      return Promise.resolve({ success: true, meta: {} });
    }
  };
}

function createStatement(query, rows) {
  let bindings = [];
  return {
    bind(...values) {
      bindings = values;
      return this;
    },
    first() {
      if (query.toLowerCase().includes("from idempotency_keys")) {
        const [userId, routeKey, idempotencyKey] = bindings;
        return Promise.resolve(
          rows.find(
            (row) =>
              row.user_id === userId &&
              row.route_key === routeKey &&
              row.idempotency_key === idempotencyKey
          ) || null
        );
      }
      return Promise.resolve(null);
    },
    run() {
      if (query.toLowerCase().startsWith("insert into idempotency_keys")) {
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
        rows.push({
          id,
          user_id,
          route_key,
          idempotency_key,
          request_hash,
          response_status,
          response_body_json,
          created_at
        });
      }
      return Promise.resolve({ success: true, meta: {} });
    },
    all() {
      return Promise.resolve({ success: true, meta: {}, results: [] });
    }
  };
}
