/** Haversine distance (km) + partner ranking for Kinshasa logistics. */

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

/** Rough CDF estimate for moto/taxi within Kinshasa — configurable later. */
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
};

export function rankNearbyPartners(args: {
  origin: GeoPoint | null;
  partners: PartnerCandidate[];
  maxKm: number;
}): Array<
  PartnerCandidate & {
    distanceKm: number | null;
    estimatedTransportCostCdf: number | null;
    rankScore: number;
  }
> {
  const ranked = args.partners
    .filter((p) => p.status === "active")
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
      const distPenalty =
        distanceKm == null ? 30 : Math.min(40, distanceKm * 4);
      const rankScore = p.securityScore - distPenalty;
      return {
        ...p,
        distanceKm,
        estimatedTransportCostCdf: transport,
        rankScore,
      };
    })
    .filter((p) => p.distanceKm == null || p.distanceKm <= args.maxKm)
    .sort((a, b) => b.rankScore - a.rankScore);

  return ranked;
}
