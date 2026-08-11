/**
 * LocationProvider abstraction — Geoapify now, swap later without rewriting SafeFind.
 * Never send PII (names, document numbers) to external providers.
 */
import type { PlaceSuggestion, StructuredLocationInput } from "./types";
import { createGeoapifyProvider } from "./providers/geoapify";

export type LocationProviderId = "geoapify" | "none";

export type LocationProvider = {
  id: LocationProviderId;
  configured: boolean;
  autocomplete(args: {
    input: string;
    language?: string;
  }): Promise<PlaceSuggestion[]>;
  resolvePlaceId(placeId: string): Promise<StructuredLocationInput | null>;
  geocode(address: string): Promise<StructuredLocationInput | null>;
};

const noneProvider: LocationProvider = {
  id: "none",
  configured: false,
  async autocomplete() {
    return [];
  },
  async resolvePlaceId() {
    return null;
  },
  async geocode() {
    return null;
  },
};

export function getLocationProvider(): LocationProvider {
  const geo = createGeoapifyProvider();
  if (geo.configured) return geo;
  return noneProvider;
}

export function locationProviderConfigured(): boolean {
  return getLocationProvider().configured;
}

/** @deprecated use locationProviderConfigured */
export function googleMapsConfigured(): boolean {
  return locationProviderConfigured();
}
