import type { NormalizedPlace } from "../providers/types";

interface SponsoredPlaceRecord {
  provider_place_id: string | null;
  name: string;
  sponsor_label: string;
  disclosure_text: string;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function disclosureLabel(record: SponsoredPlaceRecord): string {
  return record.disclosure_text || record.sponsor_label || "스폰서";
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
