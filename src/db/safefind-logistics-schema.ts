/**
 * SafeFind logistics extension: storage, pickup reservations, delivery.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { safefindCases, safefindPartners } from "./safefind-schema";

export const safefindStorageZones = pgTable(
  "safefind_storage_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => safefindPartners.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    active: boolean("active").notNull().default(true),
    preferredDocumentTypes: jsonb("preferred_document_types")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("safefind_storage_zones_partner_code_uidx").on(
      t.partnerId,
      t.code,
    ),
    index("safefind_storage_zones_partner_idx").on(t.partnerId),
  ],
);

export const safefindStorageLocations = pgTable(
  "safefind_storage_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => safefindPartners.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => safefindStorageZones.id, { onDelete: "cascade" }),
    rackCode: varchar("rack_code", { length: 32 }).notNull(),
    binCode: varchar("bin_code", { length: 32 }).notNull(),
    positionCode: varchar("position_code", { length: 32 }),
    label: varchar("label", { length: 120 }),
    occupied: boolean("occupied").notNull().default(false),
    caseId: uuid("case_id").references(() => safefindCases.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("safefind_storage_loc_partner_slot_uidx").on(
      t.partnerId,
      t.zoneId,
      t.rackCode,
      t.binCode,
      t.positionCode,
    ),
    index("safefind_storage_loc_case_idx").on(t.caseId),
    index("safefind_storage_loc_partner_idx").on(t.partnerId),
  ],
);

export const safefindStorageMovements = pgTable(
  "safefind_storage_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "restrict" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => safefindPartners.id, { onDelete: "restrict" }),
    fromLocationId: uuid("from_location_id"),
    toLocationId: uuid("to_location_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: varchar("reason", { length: 64 }).notNull().default("relocate"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("safefind_storage_movements_case_idx").on(t.caseId, t.createdAt)],
);

export const safefindPickupReservations = pgTable(
  "safefind_pickup_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => safefindPartners.id, { onDelete: "restrict" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    slotDate: date("slot_date").notNull(),
    slotStart: varchar("slot_start", { length: 8 }).notNull(),
    slotEnd: varchar("slot_end", { length: 8 }).notNull(),
    /** reserved | preparing | ready | completed | cancelled | no_show */
    status: varchar("status", { length: 32 }).notNull().default("reserved"),
    express: boolean("express").notNull().default(false),
    prepareRequestedAt: timestamp("prepare_requested_at", { withTimezone: true }),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_pickup_res_partner_date_idx").on(
      t.partnerId,
      t.slotDate,
      t.slotStart,
    ),
    index("safefind_pickup_res_case_idx").on(t.caseId),
    uniqueIndex("safefind_pickup_res_case_active_uidx").on(t.caseId),
  ],
);

export const safefindDeliveryFeePolicies = pgTable(
  "safefind_delivery_fee_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    feeAmount: numeric("fee_amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("CDF"),
    commune: varchar("commune", { length: 120 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const safefindCouriers = pgTable(
  "safefind_couriers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    provider: varchar("provider", { length: 64 }).notNull().default("internal"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const safefindDeliveryRequests = pgTable(
  "safefind_delivery_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "restrict" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    partnerId: uuid("partner_id").references(() => safefindPartners.id, {
      onDelete: "set null",
    }),
    courierId: uuid("courier_id").references(() => safefindCouriers.id, {
      onDelete: "set null",
    }),
    /**
     * requested | authorized | courier_assigned | pickup_from_partner |
     * in_transit | arrived | delivered | failed | returned | cancelled
     */
    status: varchar("status", { length: 40 }).notNull().default("requested"),
    /** Destination kept server-side; courier gets minimal instructions only. */
    destinationCommune: varchar("destination_commune", { length: 120 }),
    destinationQuartier: varchar("destination_quartier", { length: 120 }),
    destinationAddressHash: varchar("destination_address_hash", { length: 128 }),
    destinationAddressEnc: text("destination_address_enc"),
    deliveryFee: numeric("delivery_fee", { precision: 18, scale: 2 }).notNull(),
    rewardAmount: numeric("reward_amount", { precision: 18, scale: 2 }),
    currency: varchar("currency", { length: 8 }).notNull().default("CDF"),
    deliveryOtpHash: varchar("delivery_otp_hash", { length: 128 }),
    deliveryOtpExpiresAt: timestamp("delivery_otp_expires_at", {
      withTimezone: true,
    }),
    onlyVerifiedOwner: boolean("only_verified_owner").notNull().default(true),
    provider: varchar("provider", { length: 64 }).notNull().default("internal"),
    failureReason: text("failure_reason"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("safefind_delivery_requests_case_uidx").on(t.caseId),
    index("safefind_delivery_requests_status_idx").on(t.status),
  ],
);

export const safefindDeliveryEvents = pgTable(
  "safefind_delivery_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => safefindDeliveryRequests.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 40 }).notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_delivery_events_delivery_idx").on(t.deliveryId, t.createdAt),
  ],
);
