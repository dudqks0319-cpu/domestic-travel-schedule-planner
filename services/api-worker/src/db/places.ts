import type { NormalizedPlace, ProviderKind } from "../providers/types";

interface ProviderPlaceRecord {
  id: string;
  provider: ProviderKind;
  provider_place_id: string | null;
  name: string;
  category: string;
  address: string | null;
  road_address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  image_url: string | null;
  source_url: string | null;
  description: string | null;
  tags_json: string;
  score: number;
  is_sponsored: number;
  sponsor_label: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const PROVIDER_PLACE_TTL_DAYS = 7;

function expiresAt(): string {
  return new Date(Date.now() + PROVIDER_PLACE_TTL_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function stablePlaceId(place: NormalizedPlace): string {
  return `${place.provider}:${place.providerPlaceId ?? place.id}`;
}

function toNormalizedPlace(record: ProviderPlaceRecord): NormalizedPlace {
  const tags = JSON.parse(record.tags_json || "[]") as unknown;
  return {
    id: record.id,
    provider: record.provider,
    ...(record.provider_place_id ? { providerPlaceId: record.provider_place_id } : {}),
    name: record.name,
    category: record.category,
    ...(record.address ? { address: record.address } : {}),
    ...(record.road_address ? { roadAddress: record.road_address } : {}),
    lat: record.lat,
    lng: record.lng,
    ...(record.phone ? { phone: record.phone } : {}),
    ...(record.image_url ? { imageUrl: record.image_url } : {}),
    ...(record.source_url ? { sourceUrl: record.source_url } : {}),
    ...(record.description ? { description: record.description } : {}),
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [],
    score: record.score,
    isSponsored: record.is_sponsored === 1,
    ...(record.sponsor_label ? { sponsorLabel: record.sponsor_label } : {})
  };
}

export async function upsertProviderPlaces(
  db: D1Database,
  places: NormalizedPlace[]
): Promise<NormalizedPlace[]> {
  const saved: NormalizedPlace[] = [];
  const expiry = expiresAt();

  for (const place of places) {
    const id = stablePlaceId(place);
    await db
      .prepare(
        `INSERT INTO provider_places (
          id, provider, provider_place_id, name, category, address, road_address,
          lat, lng, phone, image_url, source_url, description, tags_json,
          score, is_sponsored, sponsor_label, expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          category = excluded.category,
          address = excluded.address,
          road_address = excluded.road_address,
          lat = excluded.lat,
          lng = excluded.lng,
          phone = excluded.phone,
          image_url = excluded.image_url,
          source_url = excluded.source_url,
          description = excluded.description,
          tags_json = excluded.tags_json,
          score = excluded.score,
          is_sponsored = excluded.is_sponsored,
          sponsor_label = excluded.sponsor_label,
          expires_at = excluded.expires_at,
          updated_at = datetime('now'),
          deleted_at = NULL`
      )
      .bind(
        id,
        place.provider,
        place.providerPlaceId ?? null,
        place.name,
        place.category,
        place.address ?? null,
        place.roadAddress ?? null,
        place.lat,
        place.lng,
        place.phone ?? null,
        place.imageUrl ?? null,
        place.sourceUrl ?? null,
        place.description ?? null,
        JSON.stringify(place.tags),
        place.score,
        place.isSponsored ? 1 : 0,
        place.sponsorLabel ?? null,
        expiry
      )
      .run();

    const stored = await getProviderPlace(db, id);
    if (stored) {
      saved.push(stored);
    }
  }

  return saved;
}

export async function getProviderPlace(
  db: D1Database,
  placeId: string
): Promise<NormalizedPlace | null> {
  const record = await db
    .prepare(
      `SELECT * FROM provider_places
       WHERE id = ?
         AND deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       LIMIT 1`
    )
    .bind(placeId)
    .first<ProviderPlaceRecord>();

  return record ? toNormalizedPlace(record) : null;
}
