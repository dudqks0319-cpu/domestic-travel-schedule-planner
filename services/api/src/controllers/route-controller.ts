import { Request, Response } from "express";

import {
  OptimizeRouteInput,
  RoutePoint,
  RouteTransportMode,
  optimizeRoute
} from "../services/route-optimizer";
import { normalizeRouteErrorMessage } from "../utils/response-safety";

interface ValidationSuccess {
  ok: true;
  value: OptimizeRouteInput;
}

interface ValidationFailure {
  ok: false;
  message: string;
  details: string[];
}

type ValidationResult = ValidationSuccess | ValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readOptionalString(value: unknown, maxLength = 120): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function parsePoint(raw: unknown, label: string, errors: string[]): RoutePoint | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (!isRecord(raw)) {
    errors.push(`${label} must be an object.`);
    return undefined;
  }

  const lat = toFiniteNumber(raw.lat ?? raw.latitude ?? raw.y);
  const lng = toFiniteNumber(raw.lng ?? raw.lon ?? raw.longitude ?? raw.x);

  if (lat === null || lat < -90 || lat > 90) {
    errors.push(`${label}.lat must be a valid number between -90 and 90.`);
  }

  if (lng === null || lng < -180 || lng > 180) {
    errors.push(`${label}.lng must be a valid number between -180 and 180.`);
  }

  if (lat === null || lng === null) {
    return undefined;
  }

  return {
    id: readOptionalString(raw.id),
    name: readOptionalString(raw.name ?? raw.title),
    lat,
    lng
  };
}

function parsePointArray(raw: unknown, label: string, errors: string[]): RoutePoint[] {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (!Array.isArray(raw)) {
    errors.push(`${label} must be an array.`);
    return [];
  }

  if (raw.length > 25) {
    errors.push(`${label} can include at most 25 points.`);
  }

  const cappedRaw = raw.slice(0, 25);
  const points: RoutePoint[] = [];

  cappedRaw.forEach((item, index) => {
    const parsed = parsePoint(item, `${label}[${index}]`, errors);
    if (parsed) {
      points.push(parsed);
    }
  });

  return points;
}

function parseMode(raw: unknown, errors: string[]): RouteTransportMode {
  if (raw === undefined || raw === null || raw === "") {
    return "driving";
  }

  if (typeof raw !== "string") {
    errors.push("mode must be a string.");
    return "driving";
  }

  const normalized = raw.trim().toLowerCase();

  if (["driving", "drive", "car", "auto"].includes(normalized)) {
    return "driving";
  }

  if (["transit", "public", "public-transit", "bus", "subway"].includes(normalized)) {
    return "transit";
  }

  if (["walking", "walk", "pedestrian"].includes(normalized)) {
    return "walking";
  }

  errors.push("mode must be one of driving, transit, or walking.");
  return "driving";
}

function parseRoundTrip(raw: unknown, errors: string[]): boolean {
  if (raw === undefined || raw === null || raw === "") {
    return false;
  }

  if (typeof raw === "boolean") {
    return raw;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  errors.push("roundTrip must be a boolean.");
  return false;
}

function validateOptimizeRouteBody(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object.",
      details: []
    };
  }

  const errors: string[] = [];

  const start = parsePoint(body.start ?? body.origin, "start", errors);
  const end = parsePoint(body.end ?? body.destination, "end", errors);
  const waypoints = parsePointArray(
    body.waypoints ?? body.points ?? body.stops,
    "waypoints",
    errors
  );
  const mode = parseMode(body.mode ?? body.transportMode, errors);
  const roundTrip = parseRoundTrip(body.roundTrip, errors);

  let normalizedStart = start;
  let normalizedEnd = end;
  const normalizedWaypoints = [...waypoints];

  if (!normalizedStart && normalizedWaypoints.length > 0) {
    normalizedStart = normalizedWaypoints.shift();
  }

  if (roundTrip && normalizedStart && !normalizedEnd) {
    normalizedEnd = normalizedStart;
  }

  const totalPoints =
    (normalizedStart ? 1 : 0) +
    normalizedWaypoints.length +
    (normalizedEnd ? 1 : 0);

  if (!normalizedStart) {
    errors.push(
      "A start/origin point is required. Provide start/origin or include waypoints/points with at least one item."
    );
  }

  if (totalPoints < 2) {
    errors.push("At least two points are required to optimize a route.");
  }

  if (errors.length > 0 || !normalizedStart) {
    return {
      ok: false,
      message: "Invalid optimize route payload.",
      details: errors
    };
  }

  return {
    ok: true,
    value: {
      start: normalizedStart,
      waypoints: normalizedWaypoints,
      end: normalizedEnd,
      roundTrip,
      mode
    }
  };
}

export async function optimizeRouteHandler(req: Request, res: Response): Promise<void> {
  const validation = validateOptimizeRouteBody(req.body);

  if (!validation.ok) {
    res.status(400).json({
      error: "Bad Request",
      message: validation.message,
      details: validation.details
    });
    return;
  }

  try {
    const result = await optimizeRoute(validation.value);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    const message = normalizeRouteErrorMessage(error);
    console.error("[route-optimize] failed", error);

    res.status(500).json({
      error: "Internal Server Error",
      message
    });
  }
}
