export type EntitlementPlatform = "apple" | "google" | "manual";
export type EntitlementStatus = "active" | "expired" | "revoked" | "pending";

export interface EntitlementRecord {
  id: string;
  user_id: string;
  platform: EntitlementPlatform;
  product_id: string;
  status: EntitlementStatus;
  expires_at: string | null;
  raw_receipt_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdEventInput {
  userId?: string;
  placement: string;
  eventType: string;
  metadata: Record<string, unknown>;
}

export interface AffiliateClickInput {
  userId?: string;
  tripId?: string;
  provider: string;
  targetUrlHash: string;
  placement: string;
}

export interface UpsertEntitlementInput {
  userId: string;
  platform: EntitlementPlatform;
  productId: string;
  status: EntitlementStatus;
  expiresAt?: string;
  receiptHash?: string;
}

export async function createAdEvent(db: D1Database, input: AdEventInput): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ad_events (id, user_id, placement, event_type, metadata_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId ?? null,
      input.placement,
      input.eventType,
      JSON.stringify(input.metadata)
    )
    .run();

  return id;
}

export async function createAffiliateClick(
  db: D1Database,
  input: AffiliateClickInput
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO affiliate_clicks (id, user_id, trip_id, provider, target_url_hash, placement)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId ?? null,
      input.tripId ?? null,
      input.provider,
      input.targetUrlHash,
      input.placement
    )
    .run();

  return id;
}

export async function upsertEntitlement(
  db: D1Database,
  input: UpsertEntitlementInput
): Promise<EntitlementRecord> {
  const existing = await db
    .prepare(
      `SELECT * FROM subscription_entitlements
       WHERE user_id = ? AND platform = ? AND product_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(input.userId, input.platform, input.productId)
    .first<EntitlementRecord>();

  if (existing) {
    await db
      .prepare(
        `UPDATE subscription_entitlements
         SET status = ?, expires_at = ?, raw_receipt_hash = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      )
      .bind(
        input.status,
        input.expiresAt ?? null,
        input.receiptHash ?? existing.raw_receipt_hash,
        existing.id,
        input.userId
      )
      .run();

    const updated = await getEntitlementById(db, input.userId, existing.id);
    if (!updated) {
      throw new Error("Updated entitlement could not be loaded.");
    }
    return updated;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO subscription_entitlements (
        id, user_id, platform, product_id, status, expires_at, raw_receipt_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId,
      input.platform,
      input.productId,
      input.status,
      input.expiresAt ?? null,
      input.receiptHash ?? null
    )
    .run();

  const created = await getEntitlementById(db, input.userId, id);
  if (!created) {
    throw new Error("Created entitlement could not be loaded.");
  }
  return created;
}

export async function getEntitlementById(
  db: D1Database,
  userId: string,
  entitlementId: string
): Promise<EntitlementRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM subscription_entitlements
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(entitlementId, userId)
    .first<EntitlementRecord>();

  return record ?? null;
}

export async function listActiveEntitlements(
  db: D1Database,
  userId: string
): Promise<EntitlementRecord[]> {
  const result = await db
    .prepare(
      `SELECT * FROM subscription_entitlements
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY updated_at DESC`
    )
    .bind(userId)
    .all<EntitlementRecord>();

  return result.results ?? [];
}
