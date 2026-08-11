/** Haversine distance (km) + partner ranking for Kinshasa logistics. */

import { SAFEFIND_DEFAULT_CONFIG, capacityStatusFromPct } from "./types";

export type GeoPoint = { lat: number; lng: number };

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateTransportCostCdf(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const base = 1500;
  const perKm = 800;
  return Math.round(base + distanceKm * perKm);
}

export type PartnerCandidate = {
  id: string;
  name: string;
  commune: string;
  latitude: number | null;
  longitude: number | null;
  securityScore: number;
  status: string;
  openingHours?: Record<string, unknown> | null;
  storageCapacity?: number | null;
  currentStorageCount?: number | null;
  capacityStatus?: string | null;
  documentTypesSupported?: string[] | null;
};

export type PartnerScoreWeights = {
  distance: number;
  capacity: number;
  security: number;
  hours: number;
};

export function defaultPartnerScoreWeights(): PartnerScoreWeights {
  return {
    distance: SAFEFIND_DEFAULT_CONFIG.SCORE_WEIGHT_DISTANCE,
    capacity: SAFEFIND_DEFAULT_CONFIG.SCORE_WEIGHT_CAPACITY,
    security: SAFEFIND_DEFAULT_CONFIG.SCORE_WEIGHT_SECURITY,
    hours: SAFEFIND_DEFAULT_CONFIG.SCORE_WEIGHT_HOURS,
  };
}

export function computePartnerSelectionScore(args: {
  distanceKm: number | null;
  securityScore: number;
  capacityPct: number | null;
  capacityStatus: string | null;
  openNow: boolean;
  weights?: PartnerScoreWeights;
}): number {
  const w = args.weights ?? defaultPartnerScoreWeights();
  const distScore =
    args.distanceKm == null
      ? 40
      : Math.max(0, 100 - Math.min(40, args.distanceKm * 4) * 2.5);
  let capScore = 70;
  if (args.capacityPct != null) {
    capScore = Math.max(0, 100 - args.capacityPct);
  }
  if (args.capacityStatus === "FULL" || args.capacityStatus === "SUSPENDED") {
    return -1000;
  }
  const secScore = Math.max(0, Math.min(100, args.securityScore));
  const hoursScore = args.openNow ? 100 : 30;
  const totalW = w.distance + w.capacity + w.security + w.hours || 1;
  return (
    (distScore * w.distance +
      capScore * w.capacity +
      secScore * w.security +
      hoursScore * w.hours) /
    totalW
  );
}

export function rankNearbyPartners(args: {
  origin: GeoPoint | null;
  partners: PartnerCandidate[];
  maxKm: number;
  documentType?: string | null;
  weights?: PartnerScoreWeights;
}): Array<
  PartnerCandidate & {
    distanceKm: number | null;
    estimatedTransportCostCdf: number | null;
    rankScore: number;
    capacityPct: number | null;
  }
> {
  const ranked = args.partners
    .filter((p) => p.status === "active")
    .filter((p) => {
      if (!args.documentType || !p.documentTypesSupported?.length) return true;
      return p.documentTypesSupported.includes(args.documentType);
    })
    .filter((p) => p.capacityStatus !== "FULL" && p.capacityStatus !== "SUSPENDED")
    .map((p) => {
      let distanceKm: number | null = null;
      if (
        args.origin &&
        p.latitude != null &&
        p.longitude != null &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude)
      ) {
        distanceKm = haversineKm(args.origin, {
          lat: p.latitude,
          lng: p.longitude,
        });
      }
      const transport =
        distanceKm != null ? estimateTransportCostCdf(distanceKm) : null;
      const cap =
        p.storageCapacity && p.storageCapacity > 0
          ? Math.round(
              ((p.currentStorageCount ?? 0) / p.storageCapacity) * 100,
            )
          : null;
      const capStatus =
        p.capacityStatus ??
        (cap != null ? capacityStatusFromPct(cap) : "AVAILABLE");
      const rankScore = computePartnerSelectionScore({
        distanceKm,
        securityScore: p.securityScore,
        capacityPct: cap,
        capacityStatus: capStatus,
        openNow: true,
        weights: args.weights,
      });
      return {
        ...p,
        distanceKm,
        estimatedTransportCostCdf: transport,
        rankScore,
        capacityPct: cap,
        capacityStatus: capStatus,
      };
    })
    .filter((p) => p.distanceKm == null || p.distanceKm <= args.maxKm)
    .sort((a, b) => b.rankScore - a.rankScore);

  return ranked;
}
