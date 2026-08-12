import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, safefindPartners } from "@/db";
import { rankNearbyPartners } from "@/lib/safefind/geo";
import { findNearestPartners } from "@/lib/safefind/location/nearby";
import { SAFEFIND_DEFAULT_CONFIG } from "@/lib/safefind/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const commune = url.searchParams.get("commune");
  const documentType = url.searchParams.get("documentType");

  if (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  ) {
    const partners = await findNearestPartners({
      lat: Number(lat),
      lng: Number(lng),
      limit: 20,
      documentType,
    });
    return NextResponse.json({
      engine: "location_intelligence",
      partners: partners.map((p) => ({
        id: p.id,
        name: p.name,
        commune: p.commune,
        address: p.address ?? null,
        distanceKm: p.distanceKm,
        securityScore: p.securityScore,
        capacityStatus: p.capacityStatus,
      })),
    });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(safefindPartners)
    .where(eq(safefindPartners.status, "active"));

  let filtered = rows;
  if (commune) {
    const c = commune.trim().toLowerCase();
    filtered = rows.filter((p) => p.commune.toLowerCase().includes(c));
  }

  const ranked = rankNearbyPartners({
    origin: null,
    partners: filtered.map((p) => ({
      id: p.id,
      name: p.name,
      commune: p.commune,
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      securityScore: p.securityScore,
      status: p.status,
      openingHours: p.openingHours as Record<string, unknown>,
      storageCapacity: p.storageCapacity ?? null,
      currentStorageCount: p.currentStorageCount ?? null,
      capacityStatus: p.capacityStatus ?? null,
      documentTypesSupported: (p.documentTypesSupported as string[] | null) ?? null,
    })),
    maxKm: SAFEFIND_DEFAULT_CONFIG.NEARBY_PARTNER_RADIUS_KM * 3,
    documentType,
  });

  return NextResponse.json({
    engine: "commune_fallback",
    partners: ranked.slice(0, 20).map((p) => {
      const row = filtered.find((r) => r.id === p.id);
      return {
        id: p.id,
        name: p.name,
        commune: p.commune,
        address: row?.address ?? null,
        distanceKm: p.distanceKm,
        securityScore: p.securityScore,
        openingHours: p.openingHours,
        capacityStatus: p.capacityStatus,
      };
    }),
  });
}
