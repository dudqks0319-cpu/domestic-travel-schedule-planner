import type { NormalizedPlace } from "./types";

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function dedupePlaces(places: NormalizedPlace[]): NormalizedPlace[] {
  const seen = new Set<string>();
  const result: NormalizedPlace[] = [];

  for (const place of places) {
    const key = `${place.name}:${place.lat.toFixed(5)}:${place.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
  }

  return result.sort((left, right) => right.score - left.score);
}

export function safeTags(...values: Array<string | undefined>): string[] {
  return values
    .flatMap((value) => (value ?? "").split(/[>,\s]+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
}
