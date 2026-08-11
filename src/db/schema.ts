import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 120 }),
    role: varchar("role", { length: 32 }).notNull().default("developer"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_uidx").on(t.email)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("auth_tokens_hash_uidx").on(t.tokenHash),
    index("auth_tokens_user_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uidx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const pricingPlans = pgTable(
  "pricing_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    priceUsdCents: integer("price_usd_cents").notNull().default(0),
    billingPeriod: varchar("billing_period", { length: 32 }).notNull().default("monthly"),
    quotas: jsonb("quotas").notNull().default({}),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("pricing_plans_code_uidx").on(t.code)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => pricingPlans.id),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

export const quotasUsage = pgTable(
  "quotas_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: varchar("metric", { length: 64 }).notNull(),
    period: varchar("period", { length: 32 }).notNull(),
    used: integer("used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("quotas_usage_user_metric_period_uidx").on(t.userId, t.metric, t.period),
  ],
);

export const linkChecks = pgTable(
  "link_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    urlRaw: text("url_raw").notNull(),
    urlNormalized: text("url_normalized").notNull(),
    domain: varchar("domain", { length: 255 }),
    riskLevel: varchar("risk_level", { length: 16 }).notNull(),
    score: integer("score").notNull().default(0),
    signals: jsonb("signals").notNull().default([]),
    aiOverview: text("ai_overview"),
    aiSummary: text("ai_summary"),
    aiRecommendation: text("ai_recommendation"),
    aiSourceSignalIds: jsonb("ai_source_signal_ids").default([]),
    aiProvider: varchar("ai_provider", { length: 32 }),
    /** Phase B */
    verdict: varchar("verdict", { length: 32 }),
    confidence: integer("confidence"),
    evidenceJson: jsonb("evidence_json").default([]),
    dimensionsJson: jsonb("dimensions_json").default({}),
    toolsUsed: jsonb("tools_used").default([]),
    needsDeepAnalysis: boolean("needs_deep_analysis").notNull().default(false),
    /** Phase C — McBuleli structured analysis */
    aiAnalysisJson: jsonb("ai_analysis_json").default({}),
    /** Phase D */
    status: varchar("status", { length: 32 }).notNull().default("completed"),
    hackeraiJson: jsonb("hackerai_json").default({}),
    cacheHit: boolean("cache_hit").notNull().default(false),
    durationMs: integer("duration_ms"),
    ipHash: varchar("ip_hash", { length: 128 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("link_checks_domain_idx").on(t.domain),
    index("link_checks_risk_idx").on(t.riskLevel),
    index("link_checks_created_idx").on(t.createdAt),
  ],
);

export const siteReports = pgTable(
  "site_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    comment: text("comment"),
    source: varchar("source", { length: 64 }),
    moderationStatus: varchar("moderation_status", { length: 32 })
      .notNull()
      .default("pending"),
    moderatorNote: text("moderator_note"),
    ipHash: varchar("ip_hash", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("site_reports_status_idx").on(t.moderationStatus),
    index("site_reports_created_idx").on(t.createdAt),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    primaryUrl: text("primary_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const securityScans = pgTable(
  "security_scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    targetUrl: text("target_url").notNull(),
    summary: text("summary"),
    executiveSummary: text("executive_summary"),
    technicalSummary: text("technical_summary"),
    rawRef: text("raw_ref"),
    /** Phase E — Evidence Engine snapshot (Module 2) */
    verdict: varchar("verdict", { length: 32 }),
    riskLevel: varchar("risk_level", { length: 16 }),
    confidence: integer("confidence"),
    evidenceJson: jsonb("evidence_json").default([]),
    dimensionsJson: jsonb("dimensions_json").default({}),
    aiAnalysisJson: jsonb("ai_analysis_json").default({}),
    authorizedByUser: boolean("authorized_by_user").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("security_scans_user_idx").on(t.userId),
    index("security_scans_project_idx").on(t.projectId),
  ],
);

/** Phase E Module 3 — organization asset inventory */
export const orgAssets = pgTable(
  "org_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    url: text("url").notNull(),
    domain: varchar("domain", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    lastVerdict: varchar("last_verdict", { length: 32 }),
    lastRiskLevel: varchar("last_risk_level", { length: 16 }),
    lastConfidence: integer("last_confidence"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSummary: text("last_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("org_assets_user_idx").on(t.userId),
    index("org_assets_domain_idx").on(t.domain),
  ],
);

export const orgAlerts = pgTable(
  "org_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => orgAssets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    severity: varchar("severity", { length: 16 }).notNull().default("info"),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("org_alerts_asset_idx").on(t.assetId),
    index("org_alerts_user_idx").on(t.userId),
    index("org_alerts_status_idx").on(t.status),
  ],
);

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => securityScans.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull(),
    confidence: integer("confidence").notNull().default(50),
    category: varchar("category", { length: 64 }).notNull(),
    description: text("description").notNull(),
    impact: text("impact"),
    evidence: jsonb("evidence").notNull().default([]),
    affectedAsset: text("affected_asset"),
    recommendation: text("recommendation"),
    source: varchar("source", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("findings_scan_idx").on(t.scanId),
    index("findings_severity_idx").on(t.severity),
    index("findings_status_idx").on(t.status),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    provider: varchar("provider", { length: 64 }).notNull().default("pawapay"),
    purpose: varchar("purpose", { length: 64 }).notNull(),
    planCode: varchar("plan_code", { length: 64 }),
    usdAmountCents: integer("usd_amount_cents").notNull(),
    localAmount: varchar("local_amount", { length: 32 }),
    localCurrency: varchar("local_currency", { length: 8 }).default("CDF"),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    providerRef: varchar("provider_ref", { length: 128 }),
    phone: varchar("phone", { length: 32 }),
    meta: jsonb("meta").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payments_user_idx").on(t.userId),
    index("payments_status_idx").on(t.status),
    index("payments_provider_ref_idx").on(t.providerRef),
  ],
);

export const auditRequests = pgTable("audit_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organization: varchar("organization", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 120 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 32 }),
  serviceType: varchar("service_type", { length: 64 }).notNull(),
  message: text("message"),
  status: varchar("status", { length: 32 }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 128 }).notNull(),
    meta: jsonb("meta").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt)],
);

export const brandWatchlist = pgTable(
  "brand_watchlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandName: varchar("brand_name", { length: 120 }).notNull(),
    domains: jsonb("domains").notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("brand_watchlist_name_uidx").on(t.brandName)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 64 }).notNull(),
    props: jsonb("props").default({}),
    ipHash: varchar("ip_hash", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("analytics_events_name_idx").on(t.name),
    index("analytics_events_created_idx").on(t.createdAt),
  ],
);

/** Phase D — URL analysis cache */
export const analysisCache = pgTable(
  "analysis_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cacheKey: varchar("cache_key", { length: 64 }).notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    domain: varchar("domain", { length: 255 }),
    linkCheckId: uuid("link_check_id").references(() => linkChecks.id, {
      onDelete: "set null",
    }),
    riskLevel: varchar("risk_level", { length: 16 }).notNull(),
    verdict: varchar("verdict", { length: 32 }),
    payload: jsonb("payload").notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("analysis_cache_key_uidx").on(t.cacheKey),
    index("analysis_cache_expires_idx").on(t.expiresAt),
  ],
);

/** Phase D — async deep investigation jobs (HackerAI / workers) */
export const analysisJobs = pgTable(
  "analysis_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    linkCheckId: uuid("link_check_id")
      .notNull()
      .references(() => linkChecks.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull().default("hackerai"),
    externalJobId: varchar("external_job_id", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    inputJson: jsonb("input_json").default({}),
    resultJson: jsonb("result_json").default({}),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("analysis_jobs_link_idx").on(t.linkCheckId),
    index("analysis_jobs_status_idx").on(t.status),
  ],
);

export * from "./safefind-schema";
