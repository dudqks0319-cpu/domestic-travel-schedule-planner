export interface UserRecord {
  id: string;
  kakao_user_id: string | null;
  nickname: string | null;
  email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserSessionRecord {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface KakaoUserInput {
  kakaoUserId: string;
  nickname: string;
  email?: string;
}

export function toPublicUser(record: UserRecord) {
  return {
    id: record.id,
    nickname: record.nickname ?? "여행자",
    email: record.email,
    provider: record.kakao_user_id ? "kakao" : "guest",
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export async function upsertKakaoUser(db: D1Database, input: KakaoUserInput): Promise<UserRecord> {
  const existing = await db
    .prepare(
      `SELECT * FROM users
       WHERE kakao_user_id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(input.kakaoUserId)
    .first<UserRecord>();

  if (existing) {
    await db
      .prepare(
        `UPDATE users
         SET nickname = ?, email = ?, status = 'active', updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(input.nickname, input.email ?? existing.email, existing.id)
      .run();

    const updated = await getUserById(db, existing.id);
    if (!updated) {
      throw new Error("Updated user could not be loaded.");
    }
    return updated;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, kakao_user_id, nickname, email)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, input.kakaoUserId, input.nickname, input.email ?? null)
    .run();

  const created = await getUserById(db, id);
  if (!created) {
    throw new Error("Created user could not be loaded.");
  }
  return created;
}

export async function getUserById(db: D1Database, userId: string): Promise<UserRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM users
       WHERE id = ? AND deleted_at IS NULL AND status = 'active'
       LIMIT 1`
    )
    .bind(userId)
    .first<UserRecord>();

  return record ?? null;
}

export async function createUserSession(
  db: D1Database,
  input: { id?: string; userId: string; refreshTokenHash: string; expiresAt: string }
): Promise<UserSessionRecord> {
  const id = input.id ?? crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, input.userId, input.refreshTokenHash, input.expiresAt)
    .run();

  const created = await getSessionById(db, id);
  if (!created) {
    throw new Error("Created session could not be loaded.");
  }
  return created;
}

export async function getSessionById(
  db: D1Database,
  sessionId: string
): Promise<UserSessionRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM user_sessions
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(sessionId)
    .first<UserSessionRecord>();

  return record ?? null;
}

export async function getActiveSessionByRefreshHash(
  db: D1Database,
  userId: string,
  refreshTokenHash: string
): Promise<UserSessionRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM user_sessions
       WHERE user_id = ?
         AND refresh_token_hash = ?
         AND status = 'active'
         AND deleted_at IS NULL
         AND expires_at > datetime('now')
       LIMIT 1`
    )
    .bind(userId, refreshTokenHash)
    .first<UserSessionRecord>();

  return record ?? null;
}

export async function rotateUserSession(
  db: D1Database,
  input: {
    sessionId: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE user_sessions
       SET refresh_token_hash = ?, expires_at = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(input.refreshTokenHash, input.expiresAt, input.sessionId, input.userId)
    .run();
}

export async function revokeSession(db: D1Database, sessionId: string, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_sessions
       SET status = 'revoked', deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(sessionId, userId)
    .run();
}

export async function deleteUserData(db: D1Database, userId: string): Promise<boolean> {
  const user = await getUserById(db, userId);
  if (!user) {
    return false;
  }

  const batch = [
    db
      .prepare(
        `UPDATE users
         SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE user_sessions
         SET status = 'revoked', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE trips
         SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE trip_days
         SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE trip_places
         SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE share_links
         SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE trip_exports
         SET status = 'expired', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE subscription_entitlements
         SET status = 'revoked', deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE ad_events
         SET user_id = NULL
         WHERE user_id = ?`
      )
      .bind(userId),
    db
      .prepare(
        `UPDATE affiliate_clicks
         SET user_id = NULL, trip_id = NULL
         WHERE user_id = ?`
      )
      .bind(userId)
  ];

  await db.batch(batch);
  return true;
}
