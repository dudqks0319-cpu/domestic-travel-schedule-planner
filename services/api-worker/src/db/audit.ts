export interface AuditLogInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const ALLOWED_METADATA_KEYS = new Set([
  "format",
  "status",
  "platform",
  "productId",
  "verificationMode",
  "reason",
  "dayNumber",
  "placeCount",
  "hasSponsored",
  "windowHours",
  "auditRetentionDays",
  "operationalRetentionDays",
  "matchedAuditLogs",
  "matchedOperationalEvents",
  "matchedTripExports",
  "matchedExportObjects",
  "deletedAuditLogs",
  "deletedOperationalEvents",
  "deletedExportObjects",
  "expiredTripExports",
  "dryRun"
]);

function sanitizeMetadata(
  metadata: AuditLogInput["metadata"]
): Record<string, string | number | boolean | null> {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => ALLOWED_METADATA_KEYS.has(key) && value !== undefined)
      .map(([key, value]) => [key, value ?? null])
  );
}

export async function createAuditLog(db: D1Database, input: AuditLogInput): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO audit_logs (
        id, user_id, action, entity_type, entity_id, request_id, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.requestId ?? null,
      JSON.stringify(sanitizeMetadata(input.metadata))
    )
    .run();

  return id;
}

export async function anonymizeAuditLogsForUser(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE audit_logs
       SET user_id = NULL
       WHERE user_id = ?`
    )
    .bind(userId)
    .run();
}

export async function countAuditLogsOlderThan(db: D1Database, retentionDays: number): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM audit_logs
       WHERE created_at < datetime('now', ?)`
    )
    .bind(`-${retentionDays} days`)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

export async function deleteAuditLogsOlderThan(db: D1Database, retentionDays: number): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM audit_logs
       WHERE created_at < datetime('now', ?)`
    )
    .bind(`-${retentionDays} days`)
    .run();

  return result.meta.changes ?? 0;
}
