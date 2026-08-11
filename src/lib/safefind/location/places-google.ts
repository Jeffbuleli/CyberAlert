/**
 * Google Places Autocomplete + Place Details / Geocoding.
 * Server-side only. Falls back to empty when GOOGLE_MAPS_API_KEY missing.
 */
import type { PlaceSuggestion, StructuredLocationInput } from "./types";

function apiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    ""
  );
}

export function googleMapsConfigured(): boolean {
  return Boolean(apiKey());
}

/** Autocomplete (New) Places API - Kinshasa bias. */
export async function autocompletePlaces(args: {
  input: string;
  sessionToken?: string;
  language?: string;
}): Promise<PlaceSuggestion[]> {
  const key = apiKey();
  const q = args.input.trim();
  if (!key || q.length < 2) return [];

  const body = {
    input: q,
    languageCode: args.language ?? "fr",
    includedRegionCodes: ["CD"],
    locationBias: {
      circle: {
        center: { latitude: -4.325, longitude: 15.312 },
        radius: 45000.0,
      },
    },
  };

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
        ...(args.sessionToken
          ? { "X-Goog-Maps-Session-Token": args.sessionToken }
          : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.warn("[safefind/places] autocomplete http", res.status);
    return [];
  }
  const json = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };
  const out: PlaceSuggestion[] = [];
  for (const s of json.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    out.push({
      placeId: p.placeId,
      primaryText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      fullText: p.text?.text ?? "",
    });
  }
  return out.slice(0, 8);
}

export async function resolvePlaceId(
  placeId: string,
): Promise<StructuredLocationInput | null> {
  const key = apiKey();
  if (!key || !placeId) return null;
  const id = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
  const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,addressComponents",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    addressComponents?: Array<{
      longText?: string;
      shortText?: string;
      types?: string[];
    }>;
  };
  const comps = json.addressComponents ?? [];
  const findType = (t: string) =>
    comps.find((c) => c.types?.includes(t))?.longText ?? null;

  return {
    country: findType("country") ?? "RDC",
    province: findType("administrative_area_level_1") ?? "Kinshasa",
    city: findType("locality") ?? "Kinshasa",
    commune:
      findType("administrative_area_level_2") ??
      findType("sublocality") ??
      findType("sublocality_level_1") ??
      undefined,
    quartier:
      findType("neighborhood") ?? findType("sublocality_level_2") ?? undefined,
    landmark: json.displayName?.text ?? undefined,
    placeId: json.id ?? placeId,
    latitude: json.location?.latitude ?? null,
    longitude: json.location?.longitude ?? null,
    accuracyMeters: null,
    precision: "LANDMARK",
    source: "google_places",
    label: json.formattedAddress ?? json.displayName?.text ?? null,
    rawQuery: null,
  };
}

export async function geocodeAddress(
  address: string,
): Promise<StructuredLocationInput | null> {
  const key = apiKey();
  if (!key || !address.trim()) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", "cd");
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", key);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: Array<{
      place_id?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: Array<{
        long_name?: string;
        types?: string[];
      }>;
    }>;
  };
  const r = json.results?.[0];
  if (!r) return null;
  const comps = r.address_components ?? [];
  const findType = (t: string) =>
    comps.find((c) => c.types?.includes(t))?.long_name ?? null;
  return {
    country: findType("country") ?? "RDC",
    province: findType("administrative_area_level_1") ?? "Kinshasa",
    city: findType("locality") ?? "Kinshasa",
    commune:
      findType("administrative_area_level_2") ??
      findType("sublocality") ??
      undefined,
    quartier: findType("neighborhood") ?? undefined,
    landmark: undefined,
    placeId: r.place_id ?? null,
    latitude: r.geometry?.location?.lat ?? null,
    longitude: r.geometry?.location?.lng ?? null,
    accuracyMeters: null,
    precision: "APPROXIMATE",
    source: "google_geocode",
    label: r.formatted_address ?? address,
    rawQuery: address,
  };
}
