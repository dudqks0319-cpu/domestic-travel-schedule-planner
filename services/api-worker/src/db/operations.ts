export interface OperationalEventInput {
  eventType: string;
  target: string;
  status: "success" | "warning" | "failure";
  durationMs?: number;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

const ALLOWED_METADATA_KEYS = new Set([
  "cacheStatus",
  "category",
  "durationBucket",
  "failureKind",
  "mode",
  "placeCount",
  "pointCount",
  "provider",
  "providerStatusCode",
  "segmentCount",
  "sponsoredCount",
  "styleKey",
  "warningCount"
]);

function sanitizeMetadata(
  metadata: OperationalEventInput["metadata"]
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

export async function recordOperationalEvent(
  db: D1Database,
  input: OperationalEventInput
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO operational_events (
          id, event_type, target, status, duration_ms, request_id, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.eventType,
        input.target,
        input.status,
        input.durationMs ?? null,
        input.requestId ?? null,
        JSON.stringify(sanitizeMetadata(input.metadata))
      )
      .run();
  } catch (error) {
    console.error(JSON.stringify({
      level: "warn",
      message: "operational_event_write_failed",
      target: input.target,
      requestId: input.requestId,
      error: error instanceof Error ? error.message : "unknown"
    }));
  }
}

export async function countOperationalEventsOlderThan(
  db: D1Database,
  retentionDays: number
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM operational_events
       WHERE created_at < datetime('now', ?)`
    )
    .bind(`-${retentionDays} days`)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

export async function deleteOperationalEventsOlderThan(
  db: D1Database,
  retentionDays: number
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM operational_events
       WHERE created_at < datetime('now', ?)`
    )
    .bind(`-${retentionDays} days`)
    .run();

  return result.meta.changes ?? 0;
}
