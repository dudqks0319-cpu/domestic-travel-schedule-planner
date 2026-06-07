import { createMiddleware } from "hono/factory";

import type { AppBindings } from "../bindings";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;

function safeRequestId(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !REQUEST_ID_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export const requestIdMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const requestId = safeRequestId(c.req.header("x-request-id")) ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
});
