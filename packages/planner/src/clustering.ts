import { Coordinate, haversineDistanceKm, isValidCoordinate } from "./geo";

export interface RegionPoint {
  id: string;
  coordinate: Coordinate;
  weight?: number;
}

export interface RegionCluster {
  id: string;
  centroid: Coordinate;
  pointIds: string[];
  totalWeight: number;
}

export interface RegionClusterOptions {
  maxClusterRadiusKm?: number;
  minClusterSize?: number;
}

interface ClusterAccumulator {
  id: string;
  centroid: Coordinate;
  pointIds: string[];
  totalWeight: number;
  weightedLatSum: number;
  weightedLngSum: number;
}

const asPositiveWeight = (weight: number | undefined): number => {
  const normalized = weight ?? 1;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Point weight must be a finite positive number.");
  }

  return normalized;
};

const createAccumulator = (id: string, point: RegionPoint, weight: number): ClusterAccumulator => ({
  id,
  centroid: point.coordinate,
  pointIds: [point.id],
  totalWeight: weight,
  weightedLatSum: point.coordinate.lat * weight,
  weightedLngSum: point.coordinate.lng * weight
});

const updateAccumulator = (
  cluster: ClusterAccumulator,
  point: RegionPoint,
  weight: number
): ClusterAccumulator => {
  const weightedLatSum = cluster.weightedLatSum + point.coordinate.lat * weight;
  const weightedLngSum = cluster.weightedLngSum + point.coordinate.lng * weight;
  const totalWeight = cluster.totalWeight + weight;

  return {
    ...cluster,
    pointIds: [...cluster.pointIds, point.id],
    totalWeight,
    weightedLatSum,
    weightedLngSum,
    centroid: {
      lat: weightedLatSum / totalWeight,
      lng: weightedLngSum / totalWeight
    }
  };
};

export const clusterRegionsByCoordinates = (
  points: RegionPoint[],
  options: RegionClusterOptions = {}
): RegionCluster[] => {
  const maxClusterRadiusKm = options.maxClusterRadiusKm ?? 5;
  const minClusterSize = options.minClusterSize ?? 1;

  if (!Number.isFinite(maxClusterRadiusKm) || maxClusterRadiusKm <= 0) {
    throw new Error("maxClusterRadiusKm must be a finite positive number.");
  }

  if (!Number.isInteger(minClusterSize) || minClusterSize <= 0) {
    throw new Error("minClusterSize must be a positive integer.");
  }

  const seenPointIds = new Set<string>();
  const clusters: ClusterAccumulator[] = [];

  for (const point of points) {
    if (!point.id) {
      throw new Error("Every point must have a non-empty id.");
    }
    if (seenPointIds.has(point.id)) {
      throw new Error(`Duplicate point id: ${point.id}`);
    }
    if (!isValidCoordinate(point.coordinate)) {
      throw new Error(`Invalid coordinate for point id ${point.id}`);
    }

    seenPointIds.add(point.id);

    const weight = asPositiveWeight(point.weight);
    let bestClusterIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < clusters.length; i += 1) {
      const candidate = clusters[i];
      if (!candidate) {
        continue;
      }

      const distance = haversineDistanceKm(point.coordinate, candidate.centroid);
      if (distance > maxClusterRadiusKm) {
        continue;
      }
      if (distance < bestDistance) {
        bestDistance = distance;
        bestClusterIndex = i;
      }
    }

    if (bestClusterIndex === -1) {
      clusters.push(createAccumulator(`region-${clusters.length + 1}`, point, weight));
      continue;
    }

    const selectedCluster = clusters[bestClusterIndex];
    if (!selectedCluster) {
      clusters.push(createAccumulator(`region-${clusters.length + 1}`, point, weight));
      continue;
    }

    clusters[bestClusterIndex] = updateAccumulator(selectedCluster, point, weight);
  }

  return clusters
    .filter((cluster) => cluster.pointIds.length >= minClusterSize)
    .map((cluster) => ({
      id: cluster.id,
      centroid: cluster.centroid,
      pointIds: [...cluster.pointIds],
      totalWeight: cluster.totalWeight
    }));
};
