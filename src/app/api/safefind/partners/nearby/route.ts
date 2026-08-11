import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, safefindPartners } from "@/db";
import { rankNearbyPartners } from "@/lib/safefind/geo";
import { SAFEFIND_DEFAULT_CONFIG } from "@/lib/safefind/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const commune = url.searchParams.get("commune");

  const db = getDb();
  const rows = await db
    .select()
    .from(safefindPartners)
    .where(eq(safefindPartners.status, "active"));

  const origin =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : null;

  let filtered = rows;
  if (commune) {
    const c = commune.trim().toLowerCase();
    filtered = rows.filter((p) => p.commune.toLowerCase().includes(c));
  }

  const ranked = rankNearbyPartners({
    origin,
    partners: filtered.map((p) => ({
      id: p.id,
      name: p.name,
      commune: p.commune,
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      securityScore: p.securityScore,
      status: p.status,
      openingHours: p.openingHours as Record<string, unknown>,
    })),
    maxKm: SAFEFIND_DEFAULT_CONFIG.NEARBY_PARTNER_RADIUS_KM * 3,
  });

  return NextResponse.json({
    partners: ranked.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      commune: p.commune,
      distanceKm: p.distanceKm,
      estimatedTransportCostCdf: p.estimatedTransportCostCdf,
      securityScore: p.securityScore,
      openingHours: p.openingHours,
    })),
  });
}
