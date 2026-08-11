/**
 * SafeFind — lost/found identity document restitution (Cyber Alert RDC).
 * Physical custody via partner points; one case → one primary reward.
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
} from "drizzle-orm/pg-core";
import { users } from "./schema";

/** Document types supported in V1. */
export const SAFEFIND_DOCUMENT_TYPES = [
  "carte_electeur",
  "passeport",
  "permis_conduire",
] as const;
export type SafefindDocumentType = (typeof SAFEFIND_DOCUMENT_TYPES)[number];

export const safefindPartners = pgTable(
  "safefind_partners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    type: varchar("type", { length: 64 }).notNull().default("commerce"),
    address: text("address").notNull(),
    commune: varchar("commune", { length: 120 }).notNull(),
    quartier: varchar("quartier", { length: 120 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    openingHours: jsonb("opening_hours")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** draft | pending_verification | active | suspended | revoked */
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    /** none | pending | verified | rejected */
    verificationStatus: varchar("verification_status", { length: 32 })
      .notNull()
      .default("none"),
    securityScore: integer("security_score").notNull().default(50),
    commissionPolicyId: uuid("commission_policy_id"),
    phone: varchar("phone", { length: 32 }),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_partners_status_idx").on(t.status),
    index("safefind_partners_commune_idx").on(t.commune),
  ],
);

export const safefindPartnerAgents = pgTable(
  "safefind_partner_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => safefindPartners.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** partner_admin | partner_agent */
    role: varchar("role", { length: 32 }).notNull().default("partner_agent"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("safefind_partner_agents_partner_user_uidx").on(
      t.partnerId,
      t.userId,
    ),
    index("safefind_partner_agents_user_idx").on(t.userId),
  ],
);

export const safefindRewardPolicies = pgTable(
  "safefind_reward_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    baseReward: numeric("base_reward", { precision: 18, scale: 2 }).notNull(),
    maxBonus: numeric("max_bonus", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 8 }).notNull().default("CDF"),
    active: boolean("active").notNull().default(true),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_reward_policies_type_active_idx").on(
      t.documentType,
      t.active,
    ),
  ],
);

export const safefindPartnerCommissionPolicies = pgTable(
  "safefind_partner_commission_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    depositCommission: numeric("deposit_commission", {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default("0"),
    returnCommission: numeric("return_commission", {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default("0"),
    performanceBonus: numeric("performance_bonus", {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 8 }).notNull().default("CDF"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const safefindConfig = pgTable("safefind_config", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * One physical document = one SafeFind case (public id SF-YYYY-NNNNNN).
 */
export const safefindCases = pgTable(
  "safefind_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicId: varchar("public_id", { length: 32 }).notNull(),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    /**
     * LOST | FOUND | REGISTERED | DEPOSIT_PENDING | DEPOSITED_AT_PARTNER |
     * MATCH_CANDIDATE | OWNER_VERIFICATION | READY_FOR_COLLECTION |
     * COLLECTED | RETURNED | REWARD_PENDING | REWARD_RELEASED |
     * DISPUTED | PARTNER_INCIDENT | REPORTED_STOLEN | EXPIRED | CANCELLED
     */
    status: varchar("status", { length: 40 }).notNull().default("FOUND"),
    /** Sensitive fields — never expose full values publicly. */
    holderFirstName: varchar("holder_first_name", { length: 128 }),
    holderLastName: varchar("holder_last_name", { length: 128 }),
    /** Hashed / partial document number for matching only. */
    documentNumberHash: varchar("document_number_hash", { length: 128 }),
    documentNumberLast4: varchar("document_number_last4", { length: 8 }),
    visualNotes: text("visual_notes"),
    appearanceMeta: jsonb("appearance_meta")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** Server-side redacted preview asset refs only. */
    mediaRefs: jsonb("media_refs")
      .$type<Array<{ kind: string; key: string; redacted: boolean }>>()
      .notNull()
      .default([]),
    foundCommune: varchar("found_commune", { length: 120 }),
    foundQuartier: varchar("found_quartier", { length: 120 }),
    foundApproxDate: timestamp("found_approx_date", { withTimezone: true }),
    lostCommune: varchar("lost_commune", { length: 120 }),
    lostQuartier: varchar("lost_quartier", { length: 120 }),
    lostApproxDate: timestamp("lost_approx_date", { withTimezone: true }),
    currentPartnerId: uuid("current_partner_id").references(
      () => safefindPartners.id,
      { onDelete: "set null" },
    ),
    initialFinderUserId: uuid("initial_finder_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    /** Current reward right holder (may differ after admin transfer). */
    rewardOwnerUserId: uuid("reward_owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    collectionOtpHash: varchar("collection_otp_hash", { length: 128 }),
    collectionOtpExpiresAt: timestamp("collection_otp_expires_at", {
      withTimezone: true,
    }),
    rewardPolicyId: uuid("reward_policy_id").references(
      () => safefindRewardPolicies.id,
      { onDelete: "set null" },
    ),
    rewardAmount: numeric("reward_amount", { precision: 18, scale: 2 }),
    rewardCurrency: varchar("reward_currency", { length: 8 }).default("CDF"),
    /** PENDING | LOCKED | AUTHORIZED | PROCESSING | PAID | FAILED | REFUNDED | DISPUTED */
    rewardStatus: varchar("reward_status", { length: 32 }).default("PENDING"),
    rewardFrozen: boolean("reward_frozen").notNull().default(false),
    matchGroupId: uuid("match_group_id"),
    finderTrustSnapshot: integer("finder_trust_snapshot"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("safefind_cases_public_id_uidx").on(t.publicId),
    index("safefind_cases_status_idx").on(t.status),
    index("safefind_cases_doc_type_idx").on(t.documentType),
    index("safefind_cases_partner_idx").on(t.currentPartnerId),
    index("safefind_cases_finder_idx").on(t.initialFinderUserId),
    index("safefind_cases_owner_idx").on(t.ownerUserId),
    index("safefind_cases_doc_hash_idx").on(t.documentNumberHash),
    index("safefind_cases_match_group_idx").on(t.matchGroupId),
  ],
);

export const safefindDeclarations = pgTable(
  "safefind_declarations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").references(() => safefindCases.id, {
      onDelete: "set null",
    }),
    /** lost | found | owner_claim */
    kind: varchar("kind", { length: 32 }).notNull(),
    declarantUserId: uuid("declarant_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    commune: varchar("commune", { length: 120 }),
    quartier: varchar("quartier", { length: 120 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    /** open | linked | rejected | duplicate_candidate */
    status: varchar("status", { length: 32 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_declarations_case_idx").on(t.caseId),
    index("safefind_declarations_declarant_idx").on(t.declarantUserId),
    index("safefind_declarations_kind_status_idx").on(t.kind, t.status),
  ],
);

export const safefindCustodyEvents = pgTable(
  "safefind_custody_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "restrict" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** finder | owner | partner_agent | partner_admin | safefind_operator | system */
    actorRole: varchar("actor_role", { length: 40 }).notNull(),
    partnerId: uuid("partner_id").references(() => safefindPartners.id, {
      onDelete: "set null",
    }),
    previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
    newValue: jsonb("new_value").$type<Record<string, unknown>>(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    evidenceRef: varchar("evidence_ref", { length: 255 }),
    eventHash: varchar("event_hash", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_custody_events_case_idx").on(t.caseId, t.createdAt),
    index("safefind_custody_events_partner_idx").on(t.partnerId),
    index("safefind_custody_events_type_idx").on(t.eventType),
  ],
);

export const safefindMatchCandidates = pgTable(
  "safefind_match_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "cascade" }),
    claimantUserId: uuid("claimant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    declarationId: uuid("declaration_id").references(
      () => safefindDeclarations.id,
      { onDelete: "set null" },
    ),
    matchScore: integer("match_score").notNull().default(0),
    signals: jsonb("signals")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** pending | verification | accepted | rejected | disputed */
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_match_candidates_case_idx").on(t.caseId),
    index("safefind_match_candidates_claimant_idx").on(t.claimantUserId),
    uniqueIndex("safefind_match_candidates_case_claimant_uidx").on(
      t.caseId,
      t.claimantUserId,
    ),
  ],
);

export const safefindOwnerVerifications = pgTable(
  "safefind_owner_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "cascade" }),
    claimantUserId: uuid("claimant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    step: varchar("step", { length: 64 }).notNull(),
    /** Store challenge ids / hashed answers — never correct plaintext answers. */
    challenge: jsonb("challenge")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    responseMeta: jsonb("response_meta")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    passed: boolean("passed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_owner_verifications_case_idx").on(t.caseId),
  ],
);

export const safefindIncidents = pgTable(
  "safefind_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").references(() => safefindCases.id, {
      onDelete: "set null",
    }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => safefindPartners.id, { onDelete: "restrict" }),
    reportedByUserId: uuid("reported_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /**
     * burglary | internal_loss | misfile | unrecorded_transfer |
     * security_issue | other
     */
    incidentType: varchar("incident_type", { length: 64 }).notNull(),
    description: text("description"),
    evidenceRefs: jsonb("evidence_refs")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** open | under_review | resolved | dismissed */
    status: varchar("status", { length: 32 }).notNull().default("open"),
    freezeRewards: boolean("freeze_rewards").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    index("safefind_incidents_partner_idx").on(t.partnerId),
    index("safefind_incidents_case_idx").on(t.caseId),
    index("safefind_incidents_status_idx").on(t.status),
  ],
);

export const safefindRewards = pgTable(
  "safefind_rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "restrict" }),
    beneficiaryUserId: uuid("beneficiary_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("CDF"),
    /** PENDING | LOCKED | AUTHORIZED | PROCESSING | PAID | FAILED | REFUNDED | DISPUTED */
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    /** Idempotency key for PawaPay payout (UUID). */
    payoutReference: uuid("payout_reference"),
    providerTxId: varchar("provider_tx_id", { length: 128 }),
    phoneNumber: varchar("phone_number", { length: 32 }),
    provider: varchar("provider", { length: 64 }),
    failureReason: text("failure_reason"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("safefind_rewards_case_uidx").on(t.caseId),
    uniqueIndex("safefind_rewards_payout_ref_uidx").on(t.payoutReference),
    index("safefind_rewards_beneficiary_idx").on(t.beneficiaryUserId),
    index("safefind_rewards_status_idx").on(t.status),
  ],
);

export const safefindDisputes = pgTable(
  "safefind_disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => safefindCases.id, { onDelete: "restrict" }),
    openedByUserId: uuid("opened_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: varchar("reason", { length: 64 }).notNull(),
    description: text("description"),
    /** open | under_review | resolved | dismissed */
    status: varchar("status", { length: 32 }).notNull().default("open"),
    resolution: text("resolution"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("safefind_disputes_case_idx").on(t.caseId),
    index("safefind_disputes_status_idx").on(t.status),
  ],
);

export const safefindMatchGroups = pgTable(
  "safefind_match_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** open | merged | dismissed */
    status: varchar("status", { length: 32 }).notNull().default("open"),
    caseIds: jsonb("case_ids").$type<string[]>().notNull().default([]),
    signals: jsonb("signals")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
);

export const safefindTrustScores = pgTable(
  "safefind_trust_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectType: varchar("subject_type", { length: 32 }).notNull(),
    subjectId: uuid("subject_id").notNull(),
    score: integer("score").notNull().default(50),
    components: jsonb("components")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("safefind_trust_scores_subject_uidx").on(
      t.subjectType,
      t.subjectId,
    ),
  ],
);

export const safefindAuditEvents = pgTable(
  "safefind_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").references(() => safefindCases.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 64 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resourceType: varchar("resource_type", { length: 64 }),
    resourceId: varchar("resource_id", { length: 128 }),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_audit_events_case_idx").on(t.caseId, t.createdAt),
    index("safefind_audit_events_action_idx").on(t.action),
  ],
);

export const safefindPartnerCommissions = pgTable(
  "safefind_partner_commissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => safefindPartners.id, { onDelete: "restrict" }),
    caseId: uuid("case_id").references(() => safefindCases.id, {
      onDelete: "set null",
    }),
    kind: varchar("kind", { length: 32 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("CDF"),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("safefind_partner_commissions_partner_idx").on(t.partnerId),
  ],
);

/** Sequence helper for public case IDs (SF-YYYY-NNNNNN). */
export const safefindCaseCounters = pgTable("safefind_case_counters", {
  year: integer("year").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});
