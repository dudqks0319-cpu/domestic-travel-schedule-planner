import { createMiddleware } from "hono/factory";

import type { AppBindings } from "../bindings";
import { errorResponse } from "../http/errors";

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "로그인이 필요한 기능입니다.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const explicitUserId = c.req.header("x-tripmate-user-id")?.trim();
  const userId = explicitUserId || token;
  if (!userId) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "유효한 인증 정보가 필요합니다.");
  }

  c.set("userId", userId);
  await next();
});
