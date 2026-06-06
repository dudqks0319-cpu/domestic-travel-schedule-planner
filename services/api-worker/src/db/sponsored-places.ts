import type { NormalizedPlace } from "../providers/types";

interface SponsoredPlaceRecord {
  id?: string;
  provider_place_id: string | null;
  name: string;
  sponsor_label: string;
  disclosure_text: string;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SponsoredPlaceInput {
  id?: string;
  providerPlaceId?: string;
  name: string;
  sponsorLabel: string;
  disclosureText?: string;
  startsAt?: string;
  endsAt?: string;
  status?: "active" | "paused" | "inactive";
}

export interface SponsoredPlace {
  id: string;
  providerPlaceId?: string;
  name: string;
  sponsorLabel: string;
  disclosureText: string;
  startsAt?: string;
  endsAt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function disclosureLabel(record: SponsoredPlaceRecord): string {
  return record.disclosure_text || record.sponsor_label || "스폰서";
}

function toSponsoredPlace(record: SponsoredPlaceRecord & {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}): SponsoredPlace {
  return {
    id: record.id,
    ...(record.provider_place_id ? { providerPlaceId: record.provider_place_id } : {}),
    name: record.name,
    sponsorLabel: record.sponsor_label,
    disclosureText: record.disclosure_text,
    ...(record.starts_at ? { startsAt: record.starts_at } : {}),
    ...(record.ends_at ? { endsAt: record.ends_at } : {}),
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

function matchesSponsor(place: NormalizedPlace, sponsor: SponsoredPlaceRecord): boolean {
  if (sponsor.provider_place_id && sponsor.provider_place_id === (place.providerPlaceId ?? place.id)) {
    return true;
  }

  return normalizeName(sponsor.name) === normalizeName(place.name);
}

export async function applySponsoredPlaces(
  db: D1Database,
  places: NormalizedPlace[]
): Promise<NormalizedPlace[]> {
  if (places.length === 0) {
    return places;
  }

  const records = await db
    .prepare(
      `SELECT provider_place_id, name, sponsor_label, disclosure_text
       FROM sponsored_places
       WHERE status = 'active'
         AND deleted_at IS NULL
         AND (starts_at IS NULL OR starts_at <= datetime('now'))
         AND (ends_at IS NULL OR ends_at > datetime('now'))`
    )
    .all<SponsoredPlaceRecord>();
  const sponsors = records.results ?? [];
  if (sponsors.length === 0) {
    return places;
  }

  return places.map((place) => {
    const sponsor = sponsors.find((record) => matchesSponsor(place, record));
    if (!sponsor) {
      return place;
    }

    return {
      ...place,
      isSponsored: true,
      sponsorLabel: disclosureLabel(sponsor),
      tags: Array.from(new Set([...place.tags, "sponsored"]))
    };
  });
}

export async function listSponsoredPlaces(db: D1Database): Promise<SponsoredPlace[]> {
  const result = await db
    .prepare(
      `SELECT id, provider_place_id, name, sponsor_label, disclosure_text,
              starts_at, ends_at, status, created_at, updated_at
       FROM sponsored_places
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 100`
    )
    .all<SponsoredPlaceRecord & {
      id: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>();

  return (result.results ?? []).map(toSponsoredPlace);
}

export async function upsertSponsoredPlace(
  db: D1Database,
  input: SponsoredPlaceInput
): Promise<SponsoredPlace> {
  const id = input.id ?? crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO sponsored_places (
        id, provider_place_id, name, sponsor_label, disclosure_text, starts_at, ends_at, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        provider_place_id = excluded.provider_place_id,
        name = excluded.name,
        sponsor_label = excluded.sponsor_label,
        disclosure_text = excluded.disclosure_text,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = excluded.status,
        updated_at = datetime('now'),
        deleted_at = NULL`
    )
    .bind(
      id,
      input.providerPlaceId ?? null,
      input.name,
      input.sponsorLabel,
      input.disclosureText ?? "스폰서",
      input.startsAt ?? null,
      input.endsAt ?? null,
      input.status ?? "active"
    )
    .run();

  const record = await db
    .prepare(
      `SELECT id, provider_place_id, name, sponsor_label, disclosure_text,
              starts_at, ends_at, status, created_at, updated_at
       FROM sponsored_places
       WHERE id = ?
         AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(id)
    .first<SponsoredPlaceRecord & {
      id: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>();

  if (!record) {
    throw new Error("Sponsored place could not be loaded.");
  }

  return toSponsoredPlace(record);
}

export async function deactivateSponsoredPlace(
  db: D1Database,
  sponsorId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE sponsored_places
       SET status = 'inactive',
           updated_at = datetime('now'),
           deleted_at = datetime('now')
       WHERE id = ?
         AND deleted_at IS NULL`
    )
    .bind(sponsorId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}
