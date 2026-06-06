export interface TripRecord {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  style_key: string;
  transport_mode: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TripInput {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  styleKey: string;
  transportMode: string;
}

export interface ShareLinkRecord {
  id: string;
  trip_id: string;
  user_id: string;
  token: string;
  expires_at: string | null;
  status: string;
  created_at: string;
}

export interface SharedTripRecord extends TripRecord {
  share_id: string;
  share_token: string;
  share_expires_at: string | null;
}

export function toPublicTrip(record: TripRecord) {
  return {
    id: record.id,
    title: record.title,
    destination: record.destination,
    startDate: record.start_date,
    endDate: record.end_date,
    styleKey: record.style_key,
    transportMode: record.transport_mode,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export async function listTrips(db: D1Database, userId: string): Promise<TripRecord[]> {
  const result = await db
    .prepare(
      `SELECT * FROM trips
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<TripRecord>();

  return result.results ?? [];
}

export async function getOwnedTrip(
  db: D1Database,
  userId: string,
  tripId: string
): Promise<TripRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM trips
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(tripId, userId)
    .first<TripRecord>();

  return record ?? null;
}

export async function createTrip(
  db: D1Database,
  userId: string,
  input: TripInput
): Promise<TripRecord> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO trips (
        id, user_id, title, destination, start_date, end_date, style_key, transport_mode
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      input.title,
      input.destination,
      input.startDate,
      input.endDate,
      input.styleKey,
      input.transportMode
    )
    .run();

  const created = await getOwnedTrip(db, userId, id);
  if (!created) {
    throw new Error("Created trip could not be loaded.");
  }

  return created;
}

export async function updateTrip(
  db: D1Database,
  userId: string,
  tripId: string,
  input: Partial<TripInput>
): Promise<TripRecord | null> {
  const existing = await getOwnedTrip(db, userId, tripId);
  if (!existing) {
    return null;
  }

  await db
    .prepare(
      `UPDATE trips
       SET title = ?, destination = ?, start_date = ?, end_date = ?,
           style_key = ?, transport_mode = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(
      input.title ?? existing.title,
      input.destination ?? existing.destination,
      input.startDate ?? existing.start_date,
      input.endDate ?? existing.end_date,
      input.styleKey ?? existing.style_key,
      input.transportMode ?? existing.transport_mode,
      tripId,
      userId
    )
    .run();

  return getOwnedTrip(db, userId, tripId);
}

export async function deleteTrip(db: D1Database, userId: string, tripId: string): Promise<boolean> {
  const existing = await getOwnedTrip(db, userId, tripId);
  if (!existing) {
    return false;
  }

  await db
    .prepare(
      `UPDATE trips
       SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(tripId, userId)
    .run();

  return true;
}

export async function createShareLink(
  db: D1Database,
  userId: string,
  tripId: string
): Promise<ShareLinkRecord | null> {
  const trip = await getOwnedTrip(db, userId, tripId);
  if (!trip) {
    return null;
  }

  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replaceAll("-", "");
  await db
    .prepare(
      `INSERT INTO share_links (id, trip_id, user_id, token)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, tripId, userId, token)
    .run();

  return db
    .prepare(
      `SELECT * FROM share_links
       WHERE id = ? AND user_id = ? AND status = 'active'
       LIMIT 1`
    )
    .bind(id, userId)
    .first<ShareLinkRecord>();
}

export async function getSharedTrip(
  db: D1Database,
  shareId: string
): Promise<SharedTripRecord | null> {
  const record = await db
    .prepare(
      `SELECT
        trips.*,
        share_links.id AS share_id,
        share_links.token AS share_token,
        share_links.expires_at AS share_expires_at
       FROM share_links
       JOIN trips ON trips.id = share_links.trip_id
       WHERE share_links.token = ?
         AND share_links.status = 'active'
         AND share_links.deleted_at IS NULL
         AND trips.deleted_at IS NULL
         AND (share_links.expires_at IS NULL OR share_links.expires_at > datetime('now'))
       LIMIT 1`
    )
    .bind(shareId)
    .first<SharedTripRecord>();

  return record ?? null;
}
