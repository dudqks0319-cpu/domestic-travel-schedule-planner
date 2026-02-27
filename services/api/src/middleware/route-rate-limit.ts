import { NextFunction, Request, Response } from "express";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const buckets = new Map<string, RateLimitBucket>();

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function cleanupBuckets(now: number): void {
  if (buckets.size < 2000) {
    return;
  }

  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function optimizeRouteRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  cleanupBuckets(now);

  const clientKey = getClientKey(req);
  const current = buckets.get(clientKey);

  if (!current || current.resetAt <= now) {
    buckets.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  current.count += 1;
  buckets.set(clientKey, current);

  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error: "Too Many Requests",
      message: "Route optimization rate limit exceeded. Please retry shortly."
    });
    return;
  }

  next();
}
