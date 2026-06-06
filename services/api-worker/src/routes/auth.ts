import { Hono } from "hono";

import { verifyKakaoAccessToken } from "../auth/kakao";
import { refreshTokenExpiresAt, sha256Hex, signToken, verifyToken } from "../auth/tokens";
import type { AppBindings, Env } from "../bindings";
import { anonymizeAuditLogsForUser, createAuditLog } from "../db/audit";
import { listUserTripExportObjectKeys } from "../db/exports";
import {
  createUserSession,
  deleteUserData,
  getActiveSessionByRefreshHash,
  getUserById,
  revokeSession,
  rotateUserSession,
  toPublicUser,
  upsertKakaoUser,
  type UserRecord
} from "../db/users";
import { errorResponse } from "../http/errors";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";

export const authRoutes = new Hono<AppBindings>();

authRoutes.use("/login/kakao", rateLimit({
  keyPrefix: "auth_kakao_login",
  limit: 10,
  windowSeconds: 60,
  methods: ["POST"]
}));

authRoutes.use("/refresh", rateLimit({
  keyPrefix: "auth_refresh",
  limit: 30,
  windowSeconds: 60,
  methods: ["POST"]
}));

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function issueSessionTokens(env: Env, user: UserRecord, sessionId?: string) {
  const nextSessionId = sessionId ?? crypto.randomUUID();
  const accessToken = await signToken(env, {
    userId: user.id,
    kind: "access",
    sessionId: nextSessionId
  });
  const refreshToken = await signToken(env, {
    userId: user.id,
    kind: "refresh",
    sessionId: nextSessionId
  });

  return { accessToken, refreshToken, sessionId: nextSessionId };
}

authRoutes.post("/login/kakao", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  const kakaoAccessToken = stringValue(raw?.kakaoAccessToken);
  if (!kakaoAccessToken) {
    return errorResponse(c, 400, "INVALID_KAKAO_TOKEN", "카카오 로그인 토큰이 필요합니다.");
  }

  const profile = await verifyKakaoAccessToken(c.env, kakaoAccessToken);
  if (!profile) {
    return errorResponse(c, 401, "KAKAO_AUTH_FAILED", "카카오 로그인 정보를 확인할 수 없습니다.");
  }

  const user = await upsertKakaoUser(c.env.DB, profile);
  const tokens = await issueSessionTokens(c.env, user);
  await createUserSession(c.env.DB, {
    id: tokens.sessionId,
    userId: user.id,
    refreshTokenHash: await sha256Hex(tokens.refreshToken),
    expiresAt: refreshTokenExpiresAt()
  });

  return c.json({
    ok: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: toPublicUser(user),
    requestId: c.get("requestId")
  });
});

authRoutes.post("/refresh", async (c) => {
  const raw = await c.req.json<Record<string, unknown>>().catch(() => null);
  const refreshToken = stringValue(raw?.refreshToken);
  if (!refreshToken) {
    return errorResponse(c, 400, "INVALID_REFRESH_TOKEN", "refresh token이 필요합니다.");
  }

  const payload = await verifyToken(c.env, refreshToken, "refresh");
  if (!payload?.sid) {
    return errorResponse(c, 401, "REFRESH_EXPIRED", "다시 로그인해주세요.");
  }

  const user = await getUserById(c.env.DB, payload.sub);
  if (!user) {
    return errorResponse(c, 401, "REFRESH_EXPIRED", "다시 로그인해주세요.");
  }

  const existing = await getActiveSessionByRefreshHash(
    c.env.DB,
    user.id,
    await sha256Hex(refreshToken)
  );
  if (!existing || existing.id !== payload.sid) {
    return errorResponse(c, 401, "REFRESH_EXPIRED", "다시 로그인해주세요.");
  }

  const tokens = await issueSessionTokens(c.env, user, existing.id);
  await rotateUserSession(c.env.DB, {
    sessionId: existing.id,
    userId: user.id,
    refreshTokenHash: await sha256Hex(tokens.refreshToken),
    expiresAt: refreshTokenExpiresAt()
  });

  return c.json({
    ok: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: toPublicUser(user),
    requestId: c.get("requestId")
  });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "로그인이 필요한 기능입니다.");
  }

  const user = await getUserById(c.env.DB, userId);
  if (!user) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "유효한 인증 정보가 필요합니다.");
  }

  return c.json({ ok: true, user: toPublicUser(user), requestId: c.get("requestId") });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const userId = c.get("userId");
  const sessionId = c.get("sessionId");
  if (userId && sessionId) {
    await revokeSession(c.env.DB, sessionId, userId);
  }

  return c.json({ ok: true, loggedOut: true, requestId: c.get("requestId") });
});

authRoutes.delete("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return errorResponse(c, 401, "AUTH_REQUIRED", "로그인이 필요한 기능입니다.");
  }

  const exportObjectKeys = await listUserTripExportObjectKeys(c.env.DB, userId);
  await Promise.all(exportObjectKeys.map((key) => c.env.TRIPMATE_ASSETS.delete(key)));

  const deleted = await deleteUserData(c.env.DB, userId);
  if (!deleted) {
    return errorResponse(c, 404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  }

  await createAuditLog(c.env.DB, {
    userId,
    action: "user.delete",
    entityType: "user",
    entityId: userId,
    requestId: c.get("requestId") ?? "unknown"
  });
  await anonymizeAuditLogsForUser(c.env.DB, userId);

  return c.json({ ok: true, deleted: true, requestId: c.get("requestId") });
});
