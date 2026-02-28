#!/usr/bin/env node

const DEFAULT_PORT = 4000;
const DEFAULT_API_PREFIX = "/api/v1";
const REQUEST_TIMEOUT_MS = 5000;

function normalizePrefix(prefix) {
  if (!prefix || typeof prefix !== "string") {
    return DEFAULT_API_PREFIX;
  }

  const trimmed = prefix.trim();
  if (!trimmed) {
    return DEFAULT_API_PREFIX;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function createBaseUrl() {
  const rawBase = process.env.SMOKE_BASE_URL?.trim();
  if (rawBase) {
    return rawBase.replace(/\/+$/, "");
  }

  const rawPort = process.env.SMOKE_PORT ?? process.env.PORT;
  const parsedPort = Number.parseInt(String(rawPort ?? DEFAULT_PORT), 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : DEFAULT_PORT;
  return `http://127.0.0.1:${port}`;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, timeoutId };
}

async function requestJson(url, init = {}) {
  const { signal, timeoutId } = withTimeout(REQUEST_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(url, {
        ...init,
        signal,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {})
        }
      });
    } catch (error) {
      const method = String(init.method ?? "GET").toUpperCase();
      const path = new URL(url).pathname;
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new Error(`${method} ${path} request failed (${reason})`);
    }

    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return { status: response.status, body };
  } finally {
    clearTimeout(timeoutId);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const baseUrl = createBaseUrl();
  const apiPrefix = normalizePrefix(process.env.SMOKE_API_PREFIX ?? process.env.API_PREFIX);
  const optimizePath = `${apiPrefix}/route/optimize`;
  const tests = [];

  tests.push(async () => {
    const { status, body } = await requestJson(`${baseUrl}/health`, { method: "GET" });
    assert(status === 200, `GET /health expected 200 but got ${status}`);
    assert(body && body.status === "ok", "GET /health expected { status: 'ok' }");
    return "GET /health -> 200";
  });

  tests.push(async () => {
    const payload = {
      start: { name: "Seoul Station", lat: 37.55595, lng: 126.97231 },
      waypoints: [{ name: "City Hall", lat: 37.56629, lng: 126.97795 }],
      mode: "driving",
      roundTrip: false
    };

    const { status, body } = await requestJson(`${baseUrl}${optimizePath}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    assert(status === 200, `POST ${optimizePath} valid expected 200 but got ${status}`);
    assert(body && body.success === true, `POST ${optimizePath} expected success=true`);
    return `POST ${optimizePath} valid -> 200`;
  });

  tests.push(async () => {
    const invalidPayload = {
      start: { lat: 999, lng: 126.97231 }
    };

    const { status } = await requestJson(`${baseUrl}${optimizePath}`, {
      method: "POST",
      body: JSON.stringify(invalidPayload)
    });

    assert(status === 400, `POST ${optimizePath} invalid expected 400 but got ${status}`);
    return `POST ${optimizePath} invalid -> 400`;
  });

  tests.push(async () => {
    const tourismSearchPath = `${apiPrefix}/tourism/search?keyword=${encodeURIComponent("부산")}`;
    const { status, body } = await requestJson(`${baseUrl}${tourismSearchPath}`, {
      method: "GET"
    });

    assert(status === 200, `GET ${tourismSearchPath} expected 200 but got ${status}`);
    assert(body && Array.isArray(body.items), `GET ${tourismSearchPath} expected items array`);
    return `GET ${tourismSearchPath} -> 200`;
  });

  tests.push(async () => {
    const restaurantSearchPath = `${apiPrefix}/restaurants/search?query=${encodeURIComponent("부산 맛집")}`;
    const { status, body } = await requestJson(`${baseUrl}${restaurantSearchPath}`, {
      method: "GET"
    });

    assert(status === 200, `GET ${restaurantSearchPath} expected 200 but got ${status}`);
    assert(body && Array.isArray(body.items), `GET ${restaurantSearchPath} expected items array`);
    return `GET ${restaurantSearchPath} -> 200`;
  });

  console.log(`Smoke test 시작 / start: ${baseUrl}`);

  let passed = 0;

  for (let i = 0; i < tests.length; i += 1) {
    const testNumber = i + 1;
    const total = tests.length;

    try {
      const message = await tests[i]();
      passed += 1;
      console.log(`✅ [${testNumber}/${total}] ${message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.log(`❌ [${testNumber}/${total}] ${message}`);
    }
  }

  if (passed === tests.length) {
    console.log(`완료 / done: ${passed}/${tests.length} passed`);
    process.exit(0);
  }

  console.log(`실패 / failed: ${passed}/${tests.length} passed`);
  process.exit(1);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.log(`❌ smoke test failed: ${message}`);
  process.exit(1);
});
