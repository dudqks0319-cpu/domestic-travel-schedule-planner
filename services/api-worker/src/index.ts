import { verifyAccessToken } from "./auth.js";
import { createCorsHeaders, errorResponse, jsonResponse } from "./http.js";
import {
  createShareLinkHandler,
  createTripDayHandler,
  createTripPlaceHandler,
  deleteTripPlaceHandler,
  getSharedTripHandler,
  updateTripDayHandler,
  updateTripPlaceHandler
} from "./itinerary.js";
import {
  createTripHandler,
  deleteTripHandler,
  getTripHandler,
  listTripsHandler,
  updateTripHandler
} from "./trips.js";
import type { Env, RequestContext, RouteHandler } from "./types.js";

interface RouteDefinition {
  method: string;
  pattern: RegExp;
  auth: "public" | "required";
  handler: RouteHandler;
}

const API_VERSION = "v1";

function createRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming || crypto.randomUUID();
}

function extractBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return undefined;
  }

  return token.trim();
}

function healthHandler(request: Request, context: RequestContext): Response {
  return jsonResponse(
    request,
    context.env,
    {
      status: "ok",
      service: "tripmate-api-worker",
      version: "0.1.0",
      apiVersion: API_VERSION,
      environment: context.env.ENVIRONMENT || "unknown",
      requestId: context.requestId,
      bindings: {
        d1: Boolean(context.env.DB),
        providerCache: Boolean(context.env.PROVIDER_CACHE),
        shareAssets: Boolean(context.env.SHARE_ASSETS)
      }
    },
    200,
    context.requestId
  );
}

function notImplementedHandler(request: Request, context: RequestContext): Response {
  return errorResponse(
    request,
    context.env,
    context.requestId,
    501,
    "not_implemented",
    "This Cloudflare Worker route is registered but not implemented yet."
  );
}

function pattern(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = escaped.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "(?<$1>[^/]+)");
  return new RegExp(`^${named}/?$`);
}

const routes: RouteDefinition[] = [
  { method: "GET", pattern: pattern("/health"), auth: "public", handler: healthHandler },
  { method: "GET", pattern: pattern("/api/v1/health"), auth: "public", handler: healthHandler },
  { method: "GET", pattern: pattern("/api/v1/places/search"), auth: "public", handler: notImplementedHandler },
  { method: "GET", pattern: pattern("/api/v1/places/:placeId"), auth: "public", handler: notImplementedHandler },
  { method: "POST", pattern: pattern("/api/v1/planner/generate"), auth: "required", handler: notImplementedHandler },
  { method: "POST", pattern: pattern("/api/v1/planner/replan"), auth: "required", handler: notImplementedHandler },
  { method: "POST", pattern: pattern("/api/v1/routes/optimize"), auth: "required", handler: notImplementedHandler },
  { method: "GET", pattern: pattern("/api/v1/trips"), auth: "required", handler: listTripsHandler },
  { method: "POST", pattern: pattern("/api/v1/trips"), auth: "required", handler: createTripHandler },
  { method: "GET", pattern: pattern("/api/v1/trips/:tripId"), auth: "required", handler: getTripHandler },
  { method: "PATCH", pattern: pattern("/api/v1/trips/:tripId"), auth: "required", handler: updateTripHandler },
  { method: "DELETE", pattern: pattern("/api/v1/trips/:tripId"), auth: "required", handler: deleteTripHandler },
  { method: "POST", pattern: pattern("/api/v1/trips/:tripId/days"), auth: "required", handler: createTripDayHandler },
  { method: "PATCH", pattern: pattern("/api/v1/trips/:tripId/days/:dayId"), auth: "required", handler: updateTripDayHandler },
  { method: "POST", pattern: pattern("/api/v1/trips/:tripId/places"), auth: "required", handler: createTripPlaceHandler },
  { method: "PATCH", pattern: pattern("/api/v1/trips/:tripId/places/:placeId"), auth: "required", handler: updateTripPlaceHandler },
  { method: "DELETE", pattern: pattern("/api/v1/trips/:tripId/places/:placeId"), auth: "required", handler: deleteTripPlaceHandler },
  { method: "POST", pattern: pattern("/api/v1/trips/:tripId/share"), auth: "required", handler: createShareLinkHandler },
  { method: "GET", pattern: pattern("/api/v1/share/:shareId"), auth: "public", handler: getSharedTripHandler },
  { method: "POST", pattern: pattern("/api/v1/monetization/ad-events"), auth: "required", handler: notImplementedHandler },
  { method: "POST", pattern: pattern("/api/v1/monetization/affiliate-clicks"), auth: "required", handler: notImplementedHandler },
  { method: "POST", pattern: pattern("/api/v1/monetization/entitlements/verify"), auth: "required", handler: notImplementedHandler },
  { method: "GET", pattern: pattern("/api/v1/monetization/entitlements/me"), auth: "required", handler: notImplementedHandler }
];

function matchRoute(request: Request): { route: RouteDefinition; params: Record<string, string> } | undefined {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const match = route.pattern.exec(url.pathname);
    if (match) {
      return {
        route,
        params: match.groups || {}
      };
    }
  }

  return undefined;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const requestId = createRequestId(request);

  if (request.method.toUpperCase() === "OPTIONS") {
    const headers = createCorsHeaders(request, env);
    headers.set("X-Request-Id", requestId);
    return new Response(null, { status: 204, headers });
  }

  const matched = matchRoute(request);
  if (!matched) {
    return errorResponse(request, env, requestId, 404, "not_found", "Route not found.");
  }

  const token = extractBearerToken(request);
  let user: RequestContext["user"];
  if (matched.route.auth === "required") {
    if (!token) {
      return errorResponse(
        request,
        env,
        requestId,
        401,
        "unauthorized",
        "A bearer access token is required for this route."
      );
    }

    const authResult = await verifyAccessToken(token, env);
    if (!authResult.ok) {
      return errorResponse(
        request,
        env,
        requestId,
        authResult.status,
        authResult.code,
        authResult.message
      );
    }

    user = authResult.user;
  }

  const context: RequestContext = {
    requestId,
    env,
    authenticated: Boolean(user),
    user
  };

  return matched.route.handler(request, context, matched.params);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};
