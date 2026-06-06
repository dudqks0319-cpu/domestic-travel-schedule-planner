import { createMiddleware } from "hono/factory";

import type { AppBindings } from "../bindings";
import { errorResponse } from "../http/errors";

interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
  methods?: string[];
}

function clientIdentifier(c: {
  get: (key: "userId") => string | undefined;
  req: { header: (name: string) => string | undefined };
}): string {
  const userId = c.get("userId");
  if (userId) {
    return `user:${userId}`;
  }

  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) {
    return `ip:${cfIp}`;
  }

  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) {
    return `ip:${forwardedFor}`;
  }

  return "anonymous";
}

function shouldLimit(method: string, allowedMethods: string[] | undefined): boolean {
  if (!allowedMethods?.length) {
    return true;
  }

  return allowedMethods.includes(method.toUpperCase());
}

export function rateLimit(options: RateLimitOptions) {
  return createMiddleware<AppBindings>(async (c, next) => {
    if (!shouldLimit(c.req.method, options.methods)) {
      await next();
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSeconds / options.windowSeconds);
    const resetAt = (bucket + 1) * options.windowSeconds;
    const identifier = clientIdentifier(c);
    const key = `rl:${options.keyPrefix}:${identifier}:${bucket}`;
    const currentValue = await c.env.PLACE_CACHE.get(key);
    const currentCount = currentValue ? Number(currentValue) : 0;
    const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;
    const remaining = Math.max(0, options.limit - nextCount);

    c.header("x-ratelimit-limit", String(options.limit));
    c.header("x-ratelimit-remaining", String(remaining));
    c.header("x-ratelimit-reset", String(resetAt));

    if (nextCount > options.limit) {
      return errorResponse(c, 429, "RATE_LIMITED", "요청이 많습니다. 잠시 후 다시 시도해주세요.");
    }

    await c.env.PLACE_CACHE.put(key, String(nextCount), {
      expirationTtl: options.windowSeconds + 60
    });

    await next();
  });
}
