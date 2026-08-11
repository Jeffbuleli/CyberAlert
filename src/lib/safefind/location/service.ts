import { eq } from "drizzle-orm";
import { getDb, safefindLocations } from "@/db";
import type { StructuredLocationInput } from "./types";
import { normalizeManualLocation } from "./normalize";
import {
  autocompletePlaces,
  geocodeAddress,
  googleMapsConfigured,
  resolvePlaceId,
} from "./places-google";
import { findNearestPartners } from "./nearby";
import { haversineKm } from "../geo";
import { geoMatchSignal } from "./normalize";

export async function persistLocation(
  input: StructuredLocationInput,
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(safefindLocations)
    .values({
      country: input.country ?? "RDC",
      province: input.province ?? "Kinshasa",
      city: input.city ?? "Kinshasa",
      commune: input.commune ?? null,
      quartier: input.quartier ?? null,
      landmark: input.landmark ?? null,
      placeId: input.placeId ?? null,
      latitude: input.latitude != null ? String(input.latitude) : null,
      longitude: input.longitude != null ? String(input.longitude) : null,
      accuracyMeters:
        input.accuracyMeters != null ? String(input.accuracyMeters) : null,
      precision: input.precision,
      source: input.source,
      label: input.label ?? null,
      rawQuery: input.rawQuery ?? null,
    })
    .returning({ id: safefindLocations.id });
  return row.id;
}

export async function resolveAndPersist(args: {
  mode: "place_id" | "gps" | "map_pin" | "manual" | "geocode";
  placeId?: string;
  latitude?: number;
  longitude?: number;
  commune?: string;
  quartier?: string;
  landmark?: string;
  address?: string;
  precision?: StructuredLocationInput["precision"];
}): Promise<{ locationId: string; location: StructuredLocationInput; partners: Awaited<ReturnType<typeof findNearestPartners>> }> {
  let loc: StructuredLocationInput | null = null;

  if (args.mode === "place_id" && args.placeId) {
    loc = await resolvePlaceId(args.placeId);
  } else if (args.mode === "geocode" && args.address) {
    loc = googleMapsConfigured()
      ? await geocodeAddress(args.address)
      : null;
    if (!loc) {
      loc = normalizeManualLocation({
        landmark: args.address,
        commune: args.commune,
        precision: "APPROXIMATE",
        source: "manual_hierarchy",
      });
    }
  } else if (args.mode === "gps" || args.mode === "map_pin") {
    loc = normalizeManualLocation({
      latitude: args.latitude,
      longitude: args.longitude,
      commune: args.commune,
      quartier: args.quartier,
      landmark: args.landmark,
      precision: args.precision ?? (args.mode === "gps" ? "EXACT" : "APPROXIMATE"),
      source: args.mode === "gps" ? "gps" : "map_pin",
    });
  } else {
    loc = normalizeManualLocation({
      commune: args.commune,
      quartier: args.quartier,
      landmark: args.landmark,
      latitude: args.latitude,
      longitude: args.longitude,
      precision: args.precision,
      source: "manual_hierarchy",
    });
  }

  if (!loc) throw new Error("location_resolve_failed");
  const locationId = await persistLocation(loc);
  let partners: Awaited<ReturnType<typeof findNearestPartners>> = [];
  if (loc.latitude != null && loc.longitude != null) {
    partners = await findNearestPartners({
      lat: loc.latitude,
      lng: loc.longitude,
      limit: 5,
    });
  }
  return { locationId, location: loc, partners };
}

export { autocompletePlaces, googleMapsConfigured, geoMatchSignal, haversineKm };

export async function getLocationById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(safefindLocations)
    .where(eq(safefindLocations.id, id))
    .limit(1);
  return row ?? null;
}
