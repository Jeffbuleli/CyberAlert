/** Structured location model for SafeFind (Kinshasa-first). */

export const LOCATION_PRECISIONS = [
  "EXACT",
  "BUILDING",
  "STREET",
  "LANDMARK",
  "QUARTER",
  "COMMUNE",
  "APPROXIMATE",
] as const;

export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const LOCATION_SOURCES = [
  "geoapify",
  "local_cache",
  "gps",
  "map_pin",
  "manual_hierarchy",
  "partner_fixed",
  /** legacy — kept for rows already stored */
  "google_places",
  "google_geocode",
  "serpapi_maps",
] as const;

export type LocationSource = (typeof LOCATION_SOURCES)[number];

export type StructuredLocationInput = {
  country?: string;
  province?: string;
  city?: string;
  commune?: string;
  quartier?: string;
  landmark?: string;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  precision: LocationPrecision;
  source: LocationSource;
  label?: string | null;
  rawQuery?: string | null;
};

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  latitude?: number | null;
  longitude?: number | null;
  dataId?: string | null;
  /** local_cache | geoapify | manual */
  provider?: string;
};

/** Kinshasa communes seed (admin hierarchy, offline-capable). */
export const KINSHASA_COMMUNES = [
  "Bandalungwa",
  "Barumbu",
  "Bumbu",
  "Gombe",
  "Kalamu",
  "Kasa-Vubu",
  "Kimbanseke",
  "Kinshasa",
  "Kintambo",
  "Kisenso",
  "Lemba",
  "Limete",
  "Lingwala",
  "Makala",
  "Maluku",
  "Masina",
  "Matete",
  "Mont-Ngafula",
  "Ndjili",
  "Ngaba",
  "Ngaliema",
  "Ngiri-Ngiri",
  "Nsele",
  "Selembao",
] as const;

/** Approx centroids for offline commune fallback (rough). */
export const KINSHASA_COMMUNE_CENTROIDS: Record<
  string,
  { lat: number; lng: number }
> = {
  Gombe: { lat: -4.305, lng: 15.313 },
  Ngaliema: { lat: -4.327, lng: 15.266 },
  Selembao: { lat: -4.37, lng: 15.28 },
  Limete: { lat: -4.35, lng: 15.35 },
  Lingwala: { lat: -4.32, lng: 15.3 },
  Kalamu: { lat: -4.34, lng: 15.31 },
  Lemba: { lat: -4.39, lng: 15.32 },
  Masina: { lat: -4.37, lng: 15.4 },
  Ndjili: { lat: -4.4, lng: 15.38 },
  Ngaba: { lat: -4.36, lng: 15.31 },
  Kintambo: { lat: -4.32, lng: 15.27 },
  Bandalungwa: { lat: -4.34, lng: 15.28 },
};
