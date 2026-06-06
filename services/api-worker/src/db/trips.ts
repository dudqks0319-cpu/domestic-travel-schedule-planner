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

export interface TripDayRecord {
  id: string;
  trip_id: string;
  user_id: string;
  day_number: number;
  date: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TripDayInput {
  dayNumber: number;
  date: string;
  title: string;
}

export interface TripPlaceRecord {
  id: string;
  trip_id: string;
  day_id: string | null;
  user_id: string;
  provider_place_id: string | null;
  name: string;
  category: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  day_number: number | null;
  sort_order: number;
  start_time: string | null;
  end_time: string | null;
  memo: string | null;
  is_sponsored: number;
  sponsor_label: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TripPlaceInput {
  dayId?: string;
  providerPlaceId?: string;
  name: string;
  category: string;
  address?: string;
  lat?: number;
  lng?: number;
  dayNumber?: number;
  sortOrder?: number;
  startTime?: string;
  endTime?: string;
  memo?: string;
  isSponsored?: boolean;
  sponsorLabel?: string;
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

export function toPublicTripDay(record: TripDayRecord) {
  return {
    id: record.id,
    tripId: record.trip_id,
    dayNumber: record.day_number,
    date: record.date,
    title: record.title,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function toPublicTripPlace(record: TripPlaceRecord) {
  return {
    id: record.id,
    tripId: record.trip_id,
    dayId: record.day_id,
    providerPlaceId: record.provider_place_id,
    name: record.name,
    category: record.category,
    address: record.address,
    lat: record.lat,
    lng: record.lng,
    dayNumber: record.day_number,
    sortOrder: record.sort_order,
    startTime: record.start_time,
    endTime: record.end_time,
    memo: record.memo,
    isSponsored: record.is_sponsored === 1,
    sponsorLabel: record.sponsor_label,
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

export async function listTripDays(
  db: D1Database,
  userId: string,
  tripId: string
): Promise<TripDayRecord[] | null> {
  const trip = await getOwnedTrip(db, userId, tripId);
  if (!trip) {
    return null;
  }

  const result = await db
    .prepare(
      `SELECT * FROM trip_days
       WHERE trip_id = ? AND user_id = ? AND deleted_at IS NULL
       ORDER BY day_number ASC`
    )
    .bind(tripId, userId)
    .all<TripDayRecord>();

  return result.results ?? [];
}

export async function getOwnedTripDay(
  db: D1Database,
  userId: string,
  tripId: string,
  dayId: string
): Promise<TripDayRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM trip_days
       WHERE id = ? AND trip_id = ? AND user_id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(dayId, tripId, userId)
    .first<TripDayRecord>();

  return record ?? null;
}

function addDays(dateText: string, days: number): string {
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateText;
  }

  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

async function getTripDayByNumber(
  db: D1Database,
  userId: string,
  tripId: string,
  dayNumber: number
): Promise<TripDayRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM trip_days
       WHERE trip_id = ? AND user_id = ? AND day_number = ? AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .bind(tripId, userId, dayNumber)
    .first<TripDayRecord>();

  return record ?? null;
}

async function ensureTripDayForNumber(
  db: D1Database,
  userId: string,
  trip: TripRecord,
  dayNumber: number
): Promise<TripDayRecord | null> {
  if (!Number.isFinite(dayNumber) || dayNumber < 1) {
    return null;
  }

  const existing = await getTripDayByNumber(db, userId, trip.id, dayNumber);
  if (existing) {
    return existing;
  }

  return createTripDay(db, userId, trip.id, {
    dayNumber,
    date: addDays(trip.start_date, dayNumber - 1),
    title: `${dayNumber}일차`
  });
}

export async function createTripDay(
  db: D1Database,
  userId: string,
  tripId: string,
  input: TripDayInput
): Promise<TripDayRecord | null> {
  const trip = await getOwnedTrip(db, userId, tripId);
  if (!trip) {
    return null;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO trip_days (id, trip_id, user_id, day_number, date, title)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, tripId, userId, input.dayNumber, input.date, input.title)
    .run();

  return getOwnedTripDay(db, userId, tripId, id);
}

export async function updateTripDay(
  db: D1Database,
  userId: string,
  tripId: string,
  dayId: string,
  input: Partial<TripDayInput>
): Promise<TripDayRecord | null> {
  const existing = await getOwnedTripDay(db, userId, tripId, dayId);
  if (!existing) {
    return null;
  }

  await db
    .prepare(
      `UPDATE trip_days
       SET day_number = ?, date = ?, title = ?, updated_at = datetime('now')
       WHERE id = ? AND trip_id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(
      input.dayNumber ?? existing.day_number,
      input.date ?? existing.date,
      input.title ?? existing.title,
      dayId,
      tripId,
      userId
    )
    .run();

  return getOwnedTripDay(db, userId, tripId, dayId);
}

export async function listTripPlaces(
  db: D1Database,
  userId: string,
  tripId: string,
  dayId?: string
): Promise<TripPlaceRecord[] | null> {
  const trip = await getOwnedTrip(db, userId, tripId);
  if (!trip) {
    return null;
  }

  const sql = dayId
    ? `SELECT * FROM trip_places
       WHERE trip_id = ? AND day_id = ? AND user_id = ? AND deleted_at IS NULL
       ORDER BY day_number ASC, sort_order ASC`
    : `SELECT * FROM trip_places
       WHERE trip_id = ? AND user_id = ? AND deleted_at IS NULL
       ORDER BY day_number ASC, sort_order ASC`;
  const statement = db.prepare(sql);
  const result = dayId
    ? await statement.bind(tripId, dayId, userId).all<TripPlaceRecord>()
    : await statement.bind(tripId, userId).all<TripPlaceRecord>();

  return result.results ?? [];
}

export async function getOwnedTripPlace(
  db: D1Database,
  userId: string,
  tripId: string,
  placeId: string
): Promise<TripPlaceRecord | null> {
  const record = await db
    .prepare(
      `SELECT * FROM trip_places
       WHERE id = ? AND trip_id = ? AND user_id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(placeId, tripId, userId)
    .first<TripPlaceRecord>();

  return record ?? null;
}

export async function createTripPlace(
  db: D1Database,
  userId: string,
  tripId: string,
  input: TripPlaceInput
): Promise<TripPlaceRecord | null> {
  const trip = await getOwnedTrip(db, userId, tripId);
  if (!trip) {
    return null;
  }

  let resolvedDayId = input.dayId;
  let resolvedDayNumber = input.dayNumber;

  if (resolvedDayId) {
    const day = await getOwnedTripDay(db, userId, tripId, resolvedDayId);
    if (!day) {
      return null;
    }
    resolvedDayNumber = day.day_number;
  } else if (resolvedDayNumber !== undefined) {
    const day = await ensureTripDayForNumber(db, userId, trip, resolvedDayNumber);
    if (!day) {
      return null;
    }
    resolvedDayId = day.id;
    resolvedDayNumber = day.day_number;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO trip_places (
        id, trip_id, day_id, user_id, provider_place_id, name, category, address,
        lat, lng, day_number, sort_order, start_time, end_time, memo,
        is_sponsored, sponsor_label
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      tripId,
      resolvedDayId ?? null,
      userId,
      input.providerPlaceId ?? null,
      input.name,
      input.category,
      input.address ?? null,
      input.lat ?? null,
      input.lng ?? null,
      resolvedDayNumber ?? null,
      input.sortOrder ?? 0,
      input.startTime ?? null,
      input.endTime ?? null,
      input.memo ?? null,
      input.isSponsored ? 1 : 0,
      input.sponsorLabel ?? null
    )
    .run();

  return getOwnedTripPlace(db, userId, tripId, id);
}

export async function updateTripPlace(
  db: D1Database,
  userId: string,
  tripId: string,
  placeId: string,
  input: Partial<TripPlaceInput>
): Promise<TripPlaceRecord | null> {
  const existing = await getOwnedTripPlace(db, userId, tripId, placeId);
  if (!existing) {
    return null;
  }

  if (input.dayId) {
    const day = await getOwnedTripDay(db, userId, tripId, input.dayId);
    if (!day) {
      return null;
    }
  }

  const trip = await getOwnedTrip(db, userId, tripId);
  if (!trip) {
    return null;
  }

  let resolvedDayId = input.dayId ?? existing.day_id;
  let resolvedDayNumber = input.dayNumber ?? existing.day_number;

  if (input.dayId) {
    const day = await getOwnedTripDay(db, userId, tripId, input.dayId);
    if (!day) {
      return null;
    }
    resolvedDayId = day.id;
    resolvedDayNumber = day.day_number;
  } else if (input.dayNumber !== undefined) {
    const day = await ensureTripDayForNumber(db, userId, trip, input.dayNumber);
    if (!day) {
      return null;
    }
    resolvedDayId = day.id;
    resolvedDayNumber = day.day_number;
  }

  await db
    .prepare(
      `UPDATE trip_places
       SET day_id = ?, provider_place_id = ?, name = ?, category = ?, address = ?,
           lat = ?, lng = ?, day_number = ?, sort_order = ?, start_time = ?,
           end_time = ?, memo = ?, is_sponsored = ?, sponsor_label = ?,
           updated_at = datetime('now')
       WHERE id = ? AND trip_id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(
      resolvedDayId,
      input.providerPlaceId ?? existing.provider_place_id,
      input.name ?? existing.name,
      input.category ?? existing.category,
      input.address ?? existing.address,
      input.lat ?? existing.lat,
      input.lng ?? existing.lng,
      resolvedDayNumber,
      input.sortOrder ?? existing.sort_order,
      input.startTime ?? existing.start_time,
      input.endTime ?? existing.end_time,
      input.memo ?? existing.memo,
      input.isSponsored === undefined ? existing.is_sponsored : input.isSponsored ? 1 : 0,
      input.sponsorLabel ?? existing.sponsor_label,
      placeId,
      tripId,
      userId
    )
    .run();

  return getOwnedTripPlace(db, userId, tripId, placeId);
}

export async function deleteTripPlace(
  db: D1Database,
  userId: string,
  tripId: string,
  placeId: string
): Promise<boolean> {
  const existing = await getOwnedTripPlace(db, userId, tripId, placeId);
  if (!existing) {
    return false;
  }

  await db
    .prepare(
      `UPDATE trip_places
       SET status = 'deleted', deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND trip_id = ? AND user_id = ? AND deleted_at IS NULL`
    )
    .bind(placeId, tripId, userId)
    .run();

  return true;
}
