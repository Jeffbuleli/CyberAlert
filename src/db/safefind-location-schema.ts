/**
 * SafeFind Location Intelligence — structured places (Google-assisted, PostGIS-ready).
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";

export const safefindLocations = pgTable(
  "safefind_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    country: varchar("country", { length: 64 }).notNull().default("RDC"),
    province: varchar("province", { length: 120 }).notNull().default("Kinshasa"),
    city: varchar("city", { length: 120 }).notNull().default("Kinshasa"),
    commune: varchar("commune", { length: 120 }),
    quartier: varchar("quartier", { length: 120 }),
    landmark: varchar("landmark", { length: 200 }),
    placeId: varchar("place_id", { length: 256 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    accuracyMeters: numeric("accuracy_meters", { precision: 12, scale: 2 }),
    /** EXACT | BUILDING | STREET | LANDMARK | QUARTER | COMMUNE | APPROXIMATE */
    precision: varchar("precision", { length: 32 }).notNull().default("APPROXIMATE"),
    /** google_places | google_geocode | gps | map_pin | manual_hierarchy | partner_fixed */
    source: varchar("source", { length: 32 }).notNull().default("manual_hierarchy"),
    label: text("label"),
    rawQuery: text("raw_query"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_locations_commune_idx").on(t.commune),
    index("safefind_locations_place_id_idx").on(t.placeId),
    index("safefind_locations_latlng_idx").on(t.latitude, t.longitude),
  ],
);

/** Offline-capable admin hierarchy (commune / quartier). */
export const safefindGeoAreas = pgTable(
  "safefind_geo_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    level: varchar("level", { length: 32 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    parentCode: varchar("parent_code", { length: 64 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_geo_areas_level_idx").on(t.level),
    index("safefind_geo_areas_parent_idx").on(t.parentCode),
  ],
);
