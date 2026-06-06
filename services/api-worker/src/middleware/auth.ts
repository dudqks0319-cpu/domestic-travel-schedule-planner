import { createMiddleware } from "hono/factory";

import { verifyToken } from "../auth/tokens";
import type { AppBindings } from "../bindings";
import { getSessionById, getUserById } from "../db/users";
import { errorResponse } from "../http/errors";

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "로그인이 필요한 기능입니다.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const payload = await verifyToken(c.env, token, "access");
  if (!payload) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "유효한 인증 정보가 필요합니다.");
  }

  if (!payload.sid) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "유효한 세션 정보가 필요합니다.");
  }

  const user = await getUserById(c.env.DB, payload.sub);
  if (!user) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "유효한 인증 정보가 필요합니다.");
  }

  const session = await getSessionById(c.env.DB, payload.sid);
  if (
    !session ||
    session.user_id !== user.id ||
    session.status !== "active" ||
    session.expires_at <= new Date().toISOString().slice(0, 19).replace("T", " ")
  ) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "유효한 세션 정보가 필요합니다.");
  }

  c.set("userId", user.id);
  c.set("sessionId", payload.sid);
  await next();
});
