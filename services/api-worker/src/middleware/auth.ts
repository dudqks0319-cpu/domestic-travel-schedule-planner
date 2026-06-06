import { createMiddleware } from "hono/factory";

import type { AppBindings } from "../bindings";
import { errorResponse } from "../http/errors";

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "로그인이 필요한 기능입니다.");
  }

  await next();
});
