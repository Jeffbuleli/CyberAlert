/**
 * Proximity engine: PostGIS when available, else haversine (geo.ts).
 * Google is NOT used for distance - only for place understanding.
 */
import { sql, eq } from "drizzle-orm";
import { getDb, safefindPartners } from "@/db";
import {
  haversineKm,
  rankNearbyPartners,
  type PartnerCandidate,
} from "../geo";
import { SAFEFIND_DEFAULT_CONFIG } from "../types";

let postgisChecked: boolean | null = null;

function asRowArray(rows: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(rows)) return rows as Array<Record<string, unknown>>;
  if (rows && typeof rows === "object" && Symbol.iterator in (rows as object)) {
    return Array.from(rows as Iterable<Record<string, unknown>>);
  }
  return [];
}

export async function isPostgisAvailable(): Promise<boolean> {
  if (postgisChecked != null) return postgisChecked;
  try {
    const db = getDb();
    const rows = await db.execute(
      sql`select 1 as ok from pg_extension where extname = 'postgis' limit 1`,
    );
    postgisChecked = asRowArray(rows).length > 0;
  } catch {
    postgisChecked = false;
  }
  return postgisChecked;
}

export async function findNearestPartners(args: {
  lat: number;
  lng: number;
  limit?: number;
  documentType?: string | null;
  maxKm?: number;
}): Promise<
  Array<{
    id: string;
    name: string;
    commune: string;
    distanceKm: number;
    capacityStatus: string | null;
    securityScore: number;
    address?: string | null;
  }>
> {
  const limit = args.limit ?? 5;
  const maxKm = args.maxKm ?? SAFEFIND_DEFAULT_CONFIG.NEARBY_PARTNER_RADIUS_KM * 3;
  const db = getDb();
  const usePostgis = await isPostgisAvailable();

  if (usePostgis) {
    try {
      const rows = await db.execute(sql`
        select
          id,
          name,
          commune,
          address,
          security_score,
          capacity_status,
          storage_capacity,
          current_storage_count,
          ST_Distance(
            geography(ST_MakePoint(longitude::float8, latitude::float8)),
            geography(ST_MakePoint(${args.lng}::float8, ${args.lat}::float8))
          ) / 1000.0 as distance_km
        from safefind_partners
        where status = 'active'
          and latitude is not null
          and longitude is not null
          and coalesce(capacity_status, 'AVAILABLE') not in ('FULL', 'SUSPENDED')
        order by distance_km asc
        limit ${limit * 3}
      `);
      const list = asRowArray(rows)
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          commune: String(r.commune),
          address: r.address != null ? String(r.address) : null,
          distanceKm: Number(r.distance_km),
          capacityStatus:
            r.capacity_status != null ? String(r.capacity_status) : null,
          securityScore: Number(r.security_score ?? 50),
        }))
        .filter((r) => Number.isFinite(r.distanceKm) && r.distanceKm <= maxKm)
        .slice(0, limit);
      if (list.length) return list;
    } catch (e) {
      console.warn("[safefind/nearby] postgis query failed, fallback haversine", e);
    }
  }

  const partners = await db
    .select()
    .from(safefindPartners)
    .where(eq(safefindPartners.status, "active"));

  const candidates: PartnerCandidate[] = partners.map((p) => ({
    id: p.id,
    name: p.name,
    commune: p.commune,
    latitude: p.latitude != null ? Number(p.latitude) : null,
    longitude: p.longitude != null ? Number(p.longitude) : null,
    securityScore: p.securityScore,
    status: p.status,
    storageCapacity: p.storageCapacity,
    currentStorageCount: p.currentStorageCount,
    capacityStatus: p.capacityStatus,
    documentTypesSupported: p.documentTypesSupported as string[] | null,
  }));

  const addressById = new Map(partners.map((p) => [p.id, p.address]));

  const ranked = rankNearbyPartners({
    origin: { lat: args.lat, lng: args.lng },
    partners: candidates,
    maxKm,
    documentType: args.documentType,
  });

  return ranked.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    commune: p.commune,
    address: addressById.get(p.id) ?? null,
    distanceKm:
      p.distanceKm ??
      haversineKm(
        { lat: args.lat, lng: args.lng },
        { lat: p.latitude!, lng: p.longitude! },
      ),
    capacityStatus: p.capacityStatus ?? null,
    securityScore: p.securityScore,
  }));
}
