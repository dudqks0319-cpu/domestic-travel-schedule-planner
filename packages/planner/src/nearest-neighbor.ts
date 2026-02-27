import { haversineDistanceKm } from "./geo";

export interface TspLocation {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  category?: string;
  duration?: number;
}

export interface TspResult {
  orderedIds: string[];
  totalDistanceKm: number;
}

function buildDistanceMatrix(locations: TspLocation[]): number[][] {
  const size = locations.length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      const from = locations[i];
      const to = locations[j];
      if (!from || !to) continue;

      const distance = haversineDistanceKm(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng }
      );

      const forwardRow = matrix[i];
      const backwardRow = matrix[j];

      if (!forwardRow || !backwardRow) {
        continue;
      }

      forwardRow[j] = distance;
      backwardRow[i] = distance;
    }
  }

  return matrix;
}

export function nearestNeighborTsp(locations: TspLocation[], startIdx = 0): number[] {
  if (locations.length <= 1) {
    return locations.map((_, index) => index);
  }

  const matrix = buildDistanceMatrix(locations);
  const visited = new Set<number>([startIdx]);
  const route: number[] = [startIdx];
  let current = startIdx;

  while (visited.size < locations.length) {
    let nextIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let candidate = 0; candidate < locations.length; candidate += 1) {
      if (visited.has(candidate)) continue;
      const distance = matrix[current]?.[candidate] ?? Number.POSITIVE_INFINITY;
      if (distance < bestDistance) {
        bestDistance = distance;
        nextIndex = candidate;
      }
    }

    if (nextIndex === -1) {
      break;
    }

    route.push(nextIndex);
    visited.add(nextIndex);
    current = nextIndex;
  }

  return route;
}

function routeDistance(route: number[], matrix: number[][]): number {
  if (route.length <= 1) return 0;

  let total = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const fromIndex = route[i];
    const toIndex = route[i + 1];
    if (fromIndex === undefined || toIndex === undefined) {
      continue;
    }

    const segment = matrix[fromIndex]?.[toIndex] ?? 0;
    total += segment;
  }
  return total;
}

// 2-opt local improvement: reverse subsections when total distance decreases.
export function improveRouteTwoOpt(route: number[], matrix: number[][]): number[] {
  if (route.length <= 3) {
    return [...route];
  }

  let best = [...route];
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 1; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1)
        ];

        if (routeDistance(candidate, matrix) < routeDistance(best, matrix)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }

  return best;
}

export function optimizeOrder(
  locations: TspLocation[],
  startLocation?: TspLocation | null
): TspResult {
  if (locations.length === 0) {
    return { orderedIds: [], totalDistanceKm: 0 };
  }

  const all = startLocation ? [startLocation, ...locations] : [...locations];
  const startIndex = 0;
  const matrix = buildDistanceMatrix(all);
  const initial = nearestNeighborTsp(all, startIndex);
  const improved = improveRouteTwoOpt(initial, matrix);

  const totalDistanceKm = Math.round(routeDistance(improved, matrix) * 10) / 10;

  return {
    orderedIds: improved.map((index) => all[index]?.id).filter((id): id is string => Boolean(id)),
    totalDistanceKm
  };
}
