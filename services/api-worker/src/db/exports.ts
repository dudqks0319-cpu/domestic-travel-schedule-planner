export type TripExportFormat = "pdf" | "image";
export type TripExportStatus = "queued" | "ready" | "failed" | "expired";

export interface TripExportRecord {
  id: string;
  user_id: string;
  trip_id: string;
  format: TripExportFormat;
  status: TripExportStatus;
  manifest_key: string;
  asset_key: string | null;
  error_code: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TripExportInput {
  id: string;
  userId: string;
  tripId: string;
  format: TripExportFormat;
  status: TripExportStatus;
  manifestKey: string;
  assetKey?: string;
  expiresAt?: string;
}

export function toPublicTripExport(record: TripExportRecord, downloadUrl?: string | null) {
  return {
    id: record.id,
    tripId: record.trip_id,
    format: record.format,
    status: record.status,
    expiresAt: record.expires_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    downloadUrl: downloadUrl ?? null
  };
}

export async function createTripExport(
  db: D1Database,
  input: TripExportInput
): Promise<TripExportRecord> {
  await db
    .prepare(
      `INSERT INTO trip_exports (
        id, user_id, trip_id, format, status, manifest_key, asset_key, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.id,
      input.userId,
      input.tripId,
      input.format,
      input.status,
      input.manifestKey,
      input.assetKey ?? null,
      input.expiresAt ?? null
    )
    .run();

  const record = await getOwnedTripExport(db, input.userId, input.tripId, input.id);
  if (!record) {
    throw new Error("Created trip export could not be loaded.");
  }

  return record;
}

export async function getOwnedTripExport(
  db: D1Database,
  userId: string,
  tripId: string,
  exportId: string
): Promise<TripExportRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM trip_exports
       WHERE id = ?
         AND user_id = ?
         AND trip_id = ?
         AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(exportId, userId, tripId)
    .first<TripExportRecord>();

  return record ?? null;
}

export async function listUserTripExportObjectKeys(
  db: D1Database,
  userId: string
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT manifest_key, asset_key
       FROM trip_exports
       WHERE user_id = ?
         AND deleted_at IS NULL`
    )
    .bind(userId)
    .all<Pick<TripExportRecord, "manifest_key" | "asset_key">>();

  const keys = (result.results ?? []).flatMap((record) => [
    record.manifest_key,
    ...(record.asset_key ? [record.asset_key] : [])
  ]);

  return Array.from(new Set(keys));
}
