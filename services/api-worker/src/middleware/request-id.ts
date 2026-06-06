import { createMiddleware } from "hono/factory";

import type { AppBindings } from "../bindings";

export const requestIdMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const incoming = c.req.header("x-request-id")?.trim();
  const requestId = incoming || crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
});
