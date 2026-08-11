import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/** Local landmark memory (Kinshasa aliases) — grows with SafeFind usage. */
export const safefindKnownPlaces = pgTable(
  "safefind_known_places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    commune: varchar("commune", { length: 120 }),
    quartier: varchar("quartier", { length: 120 }),
    landmark: varchar("landmark", { length: 200 }),
    externalPlaceId: varchar("external_place_id", { length: 256 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    label: text("label"),
    source: varchar("source", { length: 32 }).notNull().default("local_cache"),
    verified: boolean("verified").notNull().default(false),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_known_places_name_idx").on(t.name),
    index("safefind_known_places_commune_idx").on(t.commune),
  ],
);
