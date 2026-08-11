/**
 * Local Kinshasa place memory — aliases + verified landmarks.
 * Queried BEFORE external Geoapify to save credits and learn local names.
 */
import { sql, desc } from "drizzle-orm";
import { getDb, safefindKnownPlaces } from "@/db";
import type { PlaceSuggestion, StructuredLocationInput } from "./types";

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export async function searchKnownPlaces(
  query: string,
  limit = 6,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const db = getDb();
  const n = norm(q);
  try {
    const rows = await db
      .select()
      .from(safefindKnownPlaces)
      .where(
        sql`(
          lower(${safefindKnownPlaces.name}) like ${`%${n}%`}
          or exists (
            select 1 from jsonb_array_elements_text(coalesce(${safefindKnownPlaces.aliases}, '[]'::jsonb)) a
            where lower(a) like ${`%${n}%`}
          )
        )`,
      )
      .orderBy(desc(safefindKnownPlaces.hitCount))
      .limit(limit);

    return rows.map((r) => ({
      placeId: r.externalPlaceId
        ? String(r.externalPlaceId)
        : `local:${r.id}`,
      primaryText: r.name,
      secondaryText: [r.quartier, r.commune, "Kinshasa"]
        .filter(Boolean)
        .join(", "),
      fullText: r.label ?? r.name,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      provider: "local_cache",
    }));
  } catch (e) {
    console.warn("[safefind/local-cache] search failed", e);
    return [];
  }
}

export async function rememberPlace(input: StructuredLocationInput): Promise<void> {
  const name = (input.landmark || input.label || "").trim();
  if (!name || input.latitude == null || input.longitude == null) return;
  const db = getDb();
  try {
    const existing = await db
      .select({ id: safefindKnownPlaces.id, hitCount: safefindKnownPlaces.hitCount })
      .from(safefindKnownPlaces)
      .where(sql`lower(${safefindKnownPlaces.name}) = ${norm(name)}`)
      .limit(1);
    if (existing[0]) {
      await db
        .update(safefindKnownPlaces)
        .set({
          hitCount: (existing[0].hitCount ?? 0) + 1,
          updatedAt: new Date(),
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          commune: input.commune ?? null,
          quartier: input.quartier ?? null,
          externalPlaceId: input.placeId ?? null,
          label: input.label ?? name,
        })
        .where(sql`${safefindKnownPlaces.id} = ${existing[0].id}`);
      return;
    }
    await db.insert(safefindKnownPlaces).values({
      name,
      aliases: [],
      commune: input.commune ?? null,
      quartier: input.quartier ?? null,
      landmark: input.landmark ?? null,
      externalPlaceId: input.placeId ?? null,
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      label: input.label ?? name,
      source: input.source,
      verified: false,
      hitCount: 1,
    });
  } catch (e) {
    console.warn("[safefind/local-cache] remember failed", e);
  }
}

export async function resolveLocalPlaceId(
  placeId: string,
): Promise<StructuredLocationInput | null> {
  if (!placeId.startsWith("local:")) return null;
  const id = placeId.slice("local:".length);
  const db = getDb();
  const [row] = await db
    .select()
    .from(safefindKnownPlaces)
    .where(sql`${safefindKnownPlaces.id}::text = ${id}`)
    .limit(1);
  if (!row) return null;
  await db
    .update(safefindKnownPlaces)
    .set({ hitCount: (row.hitCount ?? 0) + 1, updatedAt: new Date() })
    .where(sql`${safefindKnownPlaces.id} = ${row.id}`);
  return {
    country: "RDC",
    province: "Kinshasa",
    city: "Kinshasa",
    commune: row.commune ?? undefined,
    quartier: row.quartier ?? undefined,
    landmark: row.landmark ?? row.name,
    placeId: row.externalPlaceId ?? `local:${row.id}`,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    accuracyMeters: null,
    precision: "LANDMARK",
    source: "local_cache",
    label: row.label ?? row.name,
    rawQuery: null,
  };
}
