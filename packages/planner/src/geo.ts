export interface Coordinate {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const isValidCoordinate = (coordinate: Coordinate): boolean =>
  Number.isFinite(coordinate.lat) &&
  Number.isFinite(coordinate.lng) &&
  Math.abs(coordinate.lat) <= 90 &&
  Math.abs(coordinate.lng) <= 180;

export const haversineDistanceKm = (from: Coordinate, to: Coordinate): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

// Backward-compatible alias for modules expecting `haversine`.
export const haversine = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number =>
  haversineDistanceKm(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng }
  );
