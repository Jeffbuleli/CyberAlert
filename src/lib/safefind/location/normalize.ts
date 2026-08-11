import {
  KINSHASA_COMMUNE_CENTROIDS,
  type LocationPrecision,
  type StructuredLocationInput,
} from "./types";

export function normalizeManualLocation(args: {
  commune?: string;
  quartier?: string;
  landmark?: string;
  latitude?: number | null;
  longitude?: number | null;
  precision?: LocationPrecision;
  source?: StructuredLocationInput["source"];
  label?: string;
}): StructuredLocationInput {
  const commune = args.commune?.trim() || undefined;
  const centroid =
    commune && KINSHASA_COMMUNE_CENTROIDS[commune]
      ? KINSHASA_COMMUNE_CENTROIDS[commune]
      : null;
  const lat = args.latitude ?? centroid?.lat ?? null;
  const lng = args.longitude ?? centroid?.lng ?? null;
  let precision: LocationPrecision =
    args.precision ??
    (lat != null && args.latitude != null
      ? "EXACT"
      : args.landmark
        ? "LANDMARK"
        : args.quartier
          ? "QUARTER"
          : commune
            ? "COMMUNE"
            : "APPROXIMATE");
  const parts = [
    args.landmark,
    args.quartier,
    commune,
    "Kinshasa",
  ].filter(Boolean);
  return {
    country: "RDC",
    province: "Kinshasa",
    city: "Kinshasa",
    commune,
    quartier: args.quartier?.trim() || undefined,
    landmark: args.landmark?.trim() || undefined,
    placeId: null,
    latitude: lat,
    longitude: lng,
    accuracyMeters: precision === "EXACT" ? 30 : precision === "COMMUNE" ? 5000 : null,
    precision,
    source: args.source ?? "manual_hierarchy",
    label: args.label ?? parts.join(", "),
    rawQuery: null,
  };
}

export function geoMatchSignal(args: {
  lostLat: number | null;
  lostLng: number | null;
  foundLat: number | null;
  foundLng: number | null;
  lostCommune?: string | null;
  foundCommune?: string | null;
  distanceKm?: number | null;
}): { score: number; label: "high" | "medium" | "low" | "none"; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (
    args.lostCommune &&
    args.foundCommune &&
    args.lostCommune.trim().toLowerCase() ===
      args.foundCommune.trim().toLowerCase()
  ) {
    score += 40;
    reasons.push("same_commune");
  }
  if (
    args.distanceKm != null &&
    Number.isFinite(args.distanceKm)
  ) {
    if (args.distanceKm <= 1.5) {
      score += 45;
      reasons.push("within_1_5km");
    } else if (args.distanceKm <= 3) {
      score += 30;
      reasons.push("within_3km");
    } else if (args.distanceKm <= 6) {
      score += 15;
      reasons.push("within_6km");
    }
  } else if (
    args.lostLat != null &&
    args.lostLng != null &&
    args.foundLat != null &&
    args.foundLng != null
  ) {
    // caller should pass distanceKm; leave mild signal
    score += 10;
    reasons.push("both_geocoded");
  }
  const label =
    score >= 70 ? "high" : score >= 40 ? "medium" : score > 0 ? "low" : "none";
  return { score: Math.min(100, score), label, reasons };
}
