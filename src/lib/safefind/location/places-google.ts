/**
 * Compatibility facade — SafeFind location uses LocationProvider (Geoapify).
 * Do not call Google / SerpAPI from here.
 */
import {
  getLocationProvider,
  googleMapsConfigured,
  locationProviderConfigured,
} from "./provider";
import type { PlaceSuggestion, StructuredLocationInput } from "./types";
import {
  rememberPlace,
  resolveLocalPlaceId,
  searchKnownPlaces,
} from "./local-cache";

export { googleMapsConfigured, locationProviderConfigured };

export async function autocompletePlaces(args: {
  input: string;
  sessionToken?: string;
  language?: string;
}): Promise<PlaceSuggestion[]> {
  const q = args.input.trim();
  if (q.length < 3) return [];

  const local = await searchKnownPlaces(q, 6);
  const provider = getLocationProvider();
  const remote = provider.configured
    ? await provider.autocomplete({
        input: q,
        language: args.language ?? "fr",
      })
    : [];

  const seen = new Set<string>();
  const merged: PlaceSuggestion[] = [];
  for (const s of [...local, ...remote]) {
    const key = `${s.primaryText}|${s.latitude}|${s.longitude}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged.slice(0, 10);
}

export async function resolvePlaceId(
  placeId: string,
): Promise<StructuredLocationInput | null> {
  const local = await resolveLocalPlaceId(placeId);
  if (local) return local;
  const loc = await getLocationProvider().resolvePlaceId(placeId);
  if (loc) await rememberPlace(loc);
  return loc;
}

export async function geocodeAddress(
  address: string,
): Promise<StructuredLocationInput | null> {
  const localHits = await searchKnownPlaces(address, 1);
  if (
    localHits[0]?.latitude != null &&
    localHits[0]?.longitude != null &&
    localHits[0].provider === "local_cache"
  ) {
    const s = localHits[0];
    return {
      country: "RDC",
      province: "Kinshasa",
      city: "Kinshasa",
      landmark: s.primaryText,
      placeId: s.placeId,
      latitude: s.latitude,
      longitude: s.longitude,
      accuracyMeters: null,
      precision: "LANDMARK",
      source: "local_cache",
      label: s.fullText,
      rawQuery: address,
    };
  }
  const loc = await getLocationProvider().geocode(address);
  if (loc) await rememberPlace(loc);
  return loc;
}
