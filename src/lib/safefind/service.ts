import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  getDb,
  safefindAuditEvents,
  safefindCaseCounters,
  safefindCases,
  safefindCustodyEvents,
  safefindDeclarations,
  safefindDisputes,
  safefindIncidents,
  safefindMatchCandidates,
  safefindMatchGroups,
  safefindPartnerAgents,
  safefindPartners,
  safefindRewardPolicies,
  safefindRewards,
  users,
} from "@/db";
import { evaluateAntifraud } from "./antifraud";
import { arePotentialDuplicateFounds, computeMatchScore } from "./matching";
import {
  custodyEventHash,
  generateCollectionOtp,
  hashDocumentNumber,
  hashOtp,
  last4DocumentNumber,
  toPublicCaseView,
} from "./privacy";
import { findNearestPartners } from "./location/nearby";
import { onDocumentRefoundDecision } from "./reward-ownership";
import { assertTransition, canTransition } from "./state-machine";
import {
  SAFEFIND_DEFAULT_CONFIG,
  SAFEFIND_DEFAULT_REWARDS,
  type SafefindCaseStatus,
  type SafefindDocType,
} from "./types";

function isEmailVerified(v: Date | null | undefined): boolean {
  return v != null;
}
function isKycApproved(v: unknown): boolean {
  // Cyber Alert V1: no Didit - treat email verification as trust gate for rewards/collection.
  if (typeof v === "boolean") return v;
  return isEmailVerified(v as Date | null | undefined);
}

async function writeAudit(args: {
  caseId?: string | null;
  action: string;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(safefindAuditEvents).values({
    caseId: args.caseId ?? null,
    action: args.action,
    actorUserId: args.actorUserId ?? null,
    resourceType: args.resourceType ?? null,
    resourceId: args.resourceId ?? null,
    meta: args.meta ?? {},
  });
}

export async function appendCustodyEvent(args: {
  caseId: string;
  eventType: string;
  actorUserId: string | null;
  actorRole: string;
  partnerId?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
  evidenceRef?: string | null;
}) {
  const db = getDb();
  const createdAt = new Date();
  const eventHash = custodyEventHash({
    caseId: args.caseId,
    eventType: args.eventType,
    actorUserId: args.actorUserId,
    partnerId: args.partnerId ?? null,
    createdAtIso: createdAt.toISOString(),
    previousValue: args.previousValue ?? null,
    newValue: args.newValue ?? null,
  });
  const [row] = await db
    .insert(safefindCustodyEvents)
    .values({
      caseId: args.caseId,
      eventType: args.eventType,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole,
      partnerId: args.partnerId ?? null,
      previousValue: args.previousValue ?? null,
      newValue: args.newValue ?? null,
      meta: args.meta ?? {},
      evidenceRef: args.evidenceRef ?? null,
      eventHash,
      createdAt,
    })
    .returning();
  return row;
}

export async function nextPublicCaseId(year = new Date().getFullYear()): Promise<string> {
  const db = getDb();
  await db
    .insert(safefindCaseCounters)
    .values({ year, lastSeq: 0 })
    .onConflictDoNothing();
  const [row] = await db
    .update(safefindCaseCounters)
    .set({ lastSeq: sql`${safefindCaseCounters.lastSeq} + 1` })
    .where(eq(safefindCaseCounters.year, year))
    .returning();
  const seq = row?.lastSeq ?? 1;
  return `SF-${year}-${String(seq).padStart(6, "0")}`;
}

export async function ensureDefaultRewardPolicies(): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(safefindRewardPolicies).limit(1);
  if (existing.length > 0) return;
  for (const [documentType, amounts] of Object.entries(SAFEFIND_DEFAULT_REWARDS)) {
    await db.insert(safefindRewardPolicies).values({
      documentType,
      baseReward: amounts.base,
      maxBonus: amounts.maxBonus,
      currency: "CDF",
      active: true,
    });
  }
}

async function activeRewardPolicy(documentType: string) {
  const db = getDb();
  const [policy] = await db
    .select()
    .from(safefindRewardPolicies)
    .where(
      and(
        eq(safefindRewardPolicies.documentType, documentType),
        eq(safefindRewardPolicies.active, true),
      ),
    )
    .orderBy(desc(safefindRewardPolicies.effectiveFrom))
    .limit(1);
  return policy ?? null;
}

async function transitionCase(
  caseId: string,
  from: SafefindCaseStatus,
  to: SafefindCaseStatus,
  extra?: Partial<typeof safefindCases.$inferInsert>,
) {
  assertTransition(from, to);
  const db = getDb();
  const [updated] = await db
    .update(safefindCases)
    .set({ status: to, updatedAt: new Date(), ...extra })
    .where(and(eq(safefindCases.id, caseId), eq(safefindCases.status, from)))
    .returning();
  if (!updated) throw new Error("safefind_case_transition_race");
  return updated;
}

export async function declareFound(args: {
  userId: string;
  documentType: SafefindDocType;
  holderFirstName?: string;
  holderLastName?: string;
  documentNumber?: string;
  visualNotes?: string;
  appearanceMeta?: Record<string, unknown>;
  commune?: string;
  quartier?: string;
  approxDate?: Date;
  partnerIdHint?: string;
  /** held = still with finder; deposited = already at partner */
  possessionMode?: "held" | "deposited";
  locationId?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationPrecision?: string;
}) {
  const db = getDb();
  await ensureDefaultRewardPolicies();

  const [user] = await db
    .select({
      id: users.id,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  if (!user) throw new Error("user_not_found");

  const openFounds = await db
    .select({ id: safefindDeclarations.id })
    .from(safefindDeclarations)
    .where(
      and(
        eq(safefindDeclarations.declarantUserId, args.userId),
        eq(safefindDeclarations.kind, "found"),
        eq(safefindDeclarations.status, "open"),
      ),
    );
  if (
    openFounds.length >= SAFEFIND_DEFAULT_CONFIG.MAX_OPEN_FOUND_WITHOUT_KYC &&
    !isEmailVerified(user.emailVerifiedAt)
  ) {
    throw new Error("kyc_required");
  }

  const docHash = args.documentNumber
    ? hashDocumentNumber(args.documentNumber)
    : null;
  const last4 = args.documentNumber
    ? last4DocumentNumber(args.documentNumber)
    : null;

  // Background match against existing deposited cases - never reveal to finder.
  let linkedExisting: typeof safefindCases.$inferSelect | null = null;
  if (docHash) {
    const [hit] = await db
      .select()
      .from(safefindCases)
      .where(eq(safefindCases.documentNumberHash, docHash))
      .limit(1);
    if (hit) linkedExisting = hit;
  }

  if (!linkedExisting && args.holderLastName) {
    const candidates = await db
      .select()
      .from(safefindCases)
      .where(eq(safefindCases.documentType, args.documentType))
      .limit(40);
    for (const c of candidates) {
      const { duplicate, score } = arePotentialDuplicateFounds(
        {
          documentType: c.documentType,
          holderFirstName: c.holderFirstName,
          holderLastName: c.holderLastName,
          documentNumberHash: c.documentNumberHash,
          documentNumberLast4: c.documentNumberLast4,
          foundCommune: c.foundCommune,
        },
        {
          documentType: args.documentType,
          holderFirstName: args.holderFirstName ?? null,
          holderLastName: args.holderLastName ?? null,
          documentNumberHash: docHash,
          documentNumberLast4: last4,
          foundCommune: args.commune ?? null,
        },
      );
      if (
        duplicate &&
        (c.status === "DEPOSITED_AT_PARTNER" ||
          c.status === "PARTNER_INCIDENT" ||
          c.status === "READY_FOR_COLLECTION")
      ) {
        linkedExisting = c;
        await db.insert(safefindMatchGroups).values({
          status: "open",
          caseIds: [c.id],
          signals: { score, kind: "duplicate_found" },
        });
        break;
      }
    }
  }

  const policy = await activeRewardPolicy(args.documentType);

  if (linkedExisting) {
    const hadCustody = Boolean(linkedExisting.currentPartnerId);
    const decision = onDocumentRefoundDecision({
      initialFinderUserId: linkedExisting.initialFinderUserId,
      recoveryFinderUserId: args.userId,
      hadPartnerCustody: hadCustody,
    });

    const antifraud = evaluateAntifraud({
      finderUserId: args.userId,
      finderKycApproved: isEmailVerified(user.emailVerifiedAt),
      finderOpenFoundCount: openFounds.length,
      finderDisputeCount: 0,
      finderTrustScore: 50,
      caseHadPartnerCustody: hadCustody,
      caseStatus: linkedExisting.status,
      declarationKind: "found",
      sameDocHashExists: Boolean(docHash),
      partnerIncidentOpen: linkedExisting.status === "PARTNER_INCIDENT",
      geoInconsistent: false,
    });

    const [decl] = await db
      .insert(safefindDeclarations)
      .values({
        caseId: linkedExisting.id,
        kind: "found",
        declarantUserId: args.userId,
        documentType: args.documentType,
        payload: {
          recovery: true,
          // Do not expose prior case details in API responses derived from payload
        },
        commune: args.commune ?? null,
        quartier: args.quartier ?? null,
        status: "duplicate_candidate",
      })
      .returning();

    await db
      .update(safefindCases)
      .set({
        status: "PARTNER_INCIDENT",
        rewardFrozen: true,
        rewardStatus: "LOCKED",
        rewardOwnerUserId: decision.rewardOwnerUserId,
        updatedAt: new Date(),
        meta: {
          ...(linkedExisting.meta ?? {}),
          recoveryFinderUserId: args.userId,
          antifraud: antifraud.reasons,
        },
      })
      .where(eq(safefindCases.id, linkedExisting.id));

    await appendCustodyEvent({
      caseId: linkedExisting.id,
      eventType: "DOCUMENT_REFOUND",
      actorUserId: args.userId,
      actorRole: "finder",
      partnerId: null,
      previousValue: { status: linkedExisting.status },
      newValue: { status: "PARTNER_INCIDENT" },
      meta: { antifraud: antifraud.reasons, silentLink: true },
    });

    if (linkedExisting.currentPartnerId) {
      await db.insert(safefindIncidents).values({
        caseId: linkedExisting.id,
        partnerId: linkedExisting.currentPartnerId,
        reportedByUserId: null,
        incidentType: "other",
        description:
          "Document réapparu hors du point partenaire - incident automatique",
        freezeRewards: true,
        status: "open",
      });
    }

    await writeAudit({
      caseId: linkedExisting.id,
      action: "DOCUMENT_REFOUND",
      actorUserId: args.userId,
      meta: { silent: true },
    });

    if (decision.notifyInitialFinder && linkedExisting.initialFinderUserId) {
      await notifySafe(
        linkedExisting.initialFinderUserId,
        "safefind_document_refound",
        { casePublicId: linkedExisting.publicId },
      );
    }

    // Neutral response - no hint of existing case ownership.
    return {
      ok: true as const,
      neutral: true as const,
      message: decision.neutralMessageForRecoveryFinder,
      declarationId: decl.id,
      // Fresh-looking public id for deposit flow UX only (internal still linked)
      depositHintPartnerId: args.partnerIdHint ?? null,
      casePublicId: null as string | null,
      linkedSilently: true as const,
    };
  }

  const publicId = await nextPublicCaseId();
  const [caseRow] = await db
    .insert(safefindCases)
    .values({
      publicId,
      documentType: args.documentType,
      status: "FOUND",
      holderFirstName: args.holderFirstName ?? null,
      holderLastName: args.holderLastName ?? null,
      documentNumberHash: docHash,
      documentNumberLast4: last4,
      visualNotes: args.visualNotes ?? null,
      appearanceMeta: args.appearanceMeta ?? {},
      foundCommune: args.commune ?? null,
      foundQuartier: args.quartier ?? null,
      foundApproxDate: args.approxDate ?? new Date(),
      foundLocationId: args.locationId ?? null,
      initialFinderUserId: args.userId,
      rewardOwnerUserId: args.userId,
      rewardPolicyId: policy?.id ?? null,
      rewardAmount: policy?.baseReward ?? null,
      rewardCurrency: policy?.currency ?? "CDF",
      rewardStatus: "PENDING",
    })
    .returning();

  const [decl] = await db
    .insert(safefindDeclarations)
    .values({
      caseId: caseRow.id,
      kind: "found",
      declarantUserId: args.userId,
      documentType: args.documentType,
      payload: {
        locationPrecision: args.locationPrecision ?? null,
      },
      commune: args.commune ?? null,
      quartier: args.quartier ?? null,
      latitude: args.latitude != null ? String(args.latitude) : null,
      longitude: args.longitude != null ? String(args.longitude) : null,
      locationId: args.locationId ?? null,
      status: "linked",
    })
    .returning();

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "DOCUMENT_FOUND",
    actorUserId: args.userId,
    actorRole: "finder",
    newValue: { status: "FOUND", publicId },
  });
  await writeAudit({
    caseId: caseRow.id,
    action: "CASE_CREATED",
    actorUserId: args.userId,
  });
  await writeAudit({
    caseId: caseRow.id,
    action: "DOCUMENT_FOUND",
    actorUserId: args.userId,
  });

  let nextStatus: SafefindCaseStatus = "REGISTERED";
  const possession = args.possessionMode ?? (args.partnerIdHint ? "deposited" : "held");
  if (possession === "held") {
    nextStatus = "HELD_BY_FINDER";
    await db
      .update(safefindCases)
      .set({
        status: nextStatus,
        heldByFinder: true,
        updatedAt: new Date(),
        meta: args.partnerIdHint
          ? { suggestedPartnerId: args.partnerIdHint }
          : {},
      })
      .where(eq(safefindCases.id, caseRow.id));
    await appendCustodyEvent({
      caseId: caseRow.id,
      eventType: "HELD_BY_FINDER",
      actorUserId: args.userId,
      actorRole: "finder",
      newValue: { status: nextStatus },
    });
  } else if (args.partnerIdHint) {
    nextStatus = "DEPOSIT_PENDING";
    await db
      .update(safefindCases)
      .set({
        status: nextStatus,
        heldByFinder: false,
        updatedAt: new Date(),
        meta: { suggestedPartnerId: args.partnerIdHint },
      })
      .where(eq(safefindCases.id, caseRow.id));
    await appendCustodyEvent({
      caseId: caseRow.id,
      eventType: "PARTNER_SELECTED",
      actorUserId: args.userId,
      actorRole: "finder",
      partnerId: args.partnerIdHint,
      newValue: { status: nextStatus },
    });
  } else {
    await db
      .update(safefindCases)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(safefindCases.id, caseRow.id));
  }

  let nearbyPartners: Awaited<ReturnType<typeof findNearestPartners>> = [];
  if (args.latitude != null && args.longitude != null) {
    nearbyPartners = await findNearestPartners({
      lat: args.latitude,
      lng: args.longitude,
      limit: 5,
      documentType: args.documentType,
    });
    if (!args.partnerIdHint && nearbyPartners[0]) {
      const [fresh] = await db
        .select({ meta: safefindCases.meta })
        .from(safefindCases)
        .where(eq(safefindCases.id, caseRow.id))
        .limit(1);
      await db
        .update(safefindCases)
        .set({
          meta: {
            ...(fresh?.meta ?? {}),
            suggestedPartnerId: nearbyPartners[0].id,
            nearbyPartners: nearbyPartners.map((p) => ({
              id: p.id,
              distanceKm: p.distanceKm,
              capacityStatus: p.capacityStatus,
            })),
          },
          updatedAt: new Date(),
        })
        .where(eq(safefindCases.id, caseRow.id));
    }
  }

  return {
    ok: true as const,
    neutral: false as const,
    message: "Declaration enregistree. Deposez le document dans un Point SafeFind.",
    declarationId: decl.id,
    casePublicId: publicId,
    caseId: caseRow.id,
    depositHintPartnerId: args.partnerIdHint ?? nearbyPartners[0]?.id ?? null,
    nearbyPartners,
    linkedSilently: false as const,
  };
}

export async function declareLost(args: {
  userId: string;
  documentType: SafefindDocType;
  holderFirstName?: string;
  holderLastName?: string;
  documentNumber?: string;
  commune?: string;
  quartier?: string;
  approxDate?: Date;
  appearanceHints?: Record<string, unknown>;
  locationId?: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const db = getDb();
  const docHash = args.documentNumber
    ? hashDocumentNumber(args.documentNumber)
    : null;

  const [decl] = await db
    .insert(safefindDeclarations)
    .values({
      kind: "lost",
      declarantUserId: args.userId,
      documentType: args.documentType,
      payload: {
        holderFirstName: args.holderFirstName ?? null,
        holderLastName: args.holderLastName ?? null,
        documentNumberLast4: args.documentNumber
          ? last4DocumentNumber(args.documentNumber)
          : null,
        documentNumberHash: docHash,
        appearanceHints: args.appearanceHints ?? {},
      },
      commune: args.commune ?? null,
      quartier: args.quartier ?? null,
      latitude: args.latitude != null ? String(args.latitude) : null,
      longitude: args.longitude != null ? String(args.longitude) : null,
      locationId: args.locationId ?? null,
      status: "open",
    })
    .returning();

  await writeAudit({
    action: "DOCUMENT_LOST",
    actorUserId: args.userId,
    resourceType: "declaration",
    resourceId: decl.id,
  });

  // Soft match against found cases
  const found = await db
    .select()
    .from(safefindCases)
    .where(
      and(
        eq(safefindCases.documentType, args.documentType),
        sql`${safefindCases.status} not in ('CANCELLED','EXPIRED','REWARD_RELEASED')`,
      ),
    )
    .limit(50);

  const matches: Array<{ publicId: string; score: number }> = [];
  for (const c of found) {
    const { score } = computeMatchScore(
      {
        documentType: c.documentType,
        holderFirstName: c.holderFirstName,
        holderLastName: c.holderLastName,
        documentNumberHash: c.documentNumberHash,
        documentNumberLast4: c.documentNumberLast4,
        foundCommune: c.foundCommune,
        lostCommune: c.lostCommune,
        foundApproxDate: c.foundApproxDate,
        appearanceMeta: c.appearanceMeta as Record<string, unknown>,
      },
      {
        documentType: args.documentType,
        firstName: args.holderFirstName,
        lastName: args.holderLastName,
        documentNumberLast4: args.documentNumber
          ? last4DocumentNumber(args.documentNumber)
          : null,
        lostCommune: args.commune,
        lostApproxDate: args.approxDate,
        appearanceHints: args.appearanceHints,
      },
    );
    if (docHash && c.documentNumberHash === docHash) {
      matches.push({ publicId: c.publicId, score: Math.max(score, 90) });
    } else if (score >= SAFEFIND_DEFAULT_CONFIG.MATCH_CANDIDATE_THRESHOLD) {
      matches.push({ publicId: c.publicId, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);

  return {
    declarationId: decl.id,
    candidates: matches.slice(0, 10).map((m) => ({
      publicId: m.publicId,
      scoreBand:
        m.score >= 85 ? "high" : m.score >= 60 ? "medium" : "low",
    })),
  };
}

export async function getCasePublicById(publicId: string) {
  const db = getDb();
  // Enumeration protection: constant-ish lookup; no sequential listing of neighbors
  const [row] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, publicId))
    .limit(1);
  if (!row) return null;
  return toPublicCaseView(row);
}

/** Statuses visible on the public marketplace feed (secured at partner). */
export const SAFEFIND_MARKETPLACE_STATUSES = [
  "DEPOSITED_AT_PARTNER",
  "STORED_AT_LOCATION",
  "MATCH_CANDIDATE",
  "OWNER_VERIFICATION",
  "PICKUP_RESERVED",
  "READY_FOR_PICKUP",
  "READY_FOR_COLLECTION",
] as const;

const SAFEFIND_ACTIVE_RESTITUTION_STATUSES = [
  "MATCH_CANDIDATE",
  "OWNER_VERIFICATION",
  "PICKUP_RESERVED",
  "READY_FOR_PICKUP",
  "READY_FOR_COLLECTION",
  "DELIVERY_REQUESTED",
  "DELIVERY_AUTHORIZED",
  "COURIER_ASSIGNED",
  "PICKUP_FROM_PARTNER",
  "IN_TRANSIT",
  "ARRIVED",
  "DELIVERY_FAILED",
  "RETURN_TO_PARTNER",
] as const;

const READY_PICKUP_STATUSES = [
  "READY_FOR_PICKUP",
  "READY_FOR_COLLECTION",
  "PICKUP_RESERVED",
] as const;

export type MarketplaceListing = ReturnType<typeof toPublicCaseView> & {
  partner: { id: string; name: string; commune: string } | null;
  documentNumberLast4: string | null;
};

export async function listMarketplaceCases(args: {
  documentType?: string;
  commune?: string;
  partnerId?: string;
  readyOnly?: boolean;
  nearLat?: number;
  nearLng?: number;
  limit?: number;
}): Promise<{ listings: MarketplaceListing[]; partners: Array<{ id: string; name: string; commune: string }> }> {
  const db = getDb();
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 80);

  let nearPartnerIds: string[] | null = null;
  if (
    typeof args.nearLat === "number" &&
    typeof args.nearLng === "number" &&
    Number.isFinite(args.nearLat) &&
    Number.isFinite(args.nearLng)
  ) {
    const nearby = await findNearestPartners({
      lat: args.nearLat,
      lng: args.nearLng,
      limit: 12,
    });
    nearPartnerIds = nearby.map((p) => p.id);
  }

  const statusFilter = args.readyOnly
    ? inArray(safefindCases.status, [...READY_PICKUP_STATUSES])
    : inArray(safefindCases.status, [...SAFEFIND_MARKETPLACE_STATUSES]);

  const filters = [statusFilter];
  if (args.documentType) {
    filters.push(eq(safefindCases.documentType, args.documentType));
  }
  if (args.partnerId) {
    filters.push(eq(safefindCases.currentPartnerId, args.partnerId));
  }
  if (args.commune) {
    filters.push(
      or(
        eq(safefindCases.foundCommune, args.commune),
        eq(safefindPartners.commune, args.commune),
      )!,
    );
  }
  if (nearPartnerIds && nearPartnerIds.length > 0) {
    filters.push(inArray(safefindCases.currentPartnerId, nearPartnerIds));
  } else if (nearPartnerIds && nearPartnerIds.length === 0) {
    return { listings: [], partners: [] };
  }

  const rows = await db
    .select({
      case: safefindCases,
      partnerId: safefindPartners.id,
      partnerName: safefindPartners.name,
      partnerCommune: safefindPartners.commune,
    })
    .from(safefindCases)
    .leftJoin(
      safefindPartners,
      eq(safefindCases.currentPartnerId, safefindPartners.id),
    )
    .where(and(...filters))
    .orderBy(desc(safefindCases.updatedAt))
    .limit(limit);

  const listings: MarketplaceListing[] = rows.map((r) => {
    const view = toPublicCaseView(r.case);
    return {
      ...view,
      documentNumberLast4: r.case.documentNumberLast4 ?? null,
      partner:
        r.partnerId && r.partnerName
          ? {
              id: r.partnerId,
              name: r.partnerName,
              commune: r.partnerCommune ?? "",
            }
          : null,
    };
  });

  const partnerRows = await db
    .select({
      id: safefindPartners.id,
      name: safefindPartners.name,
      commune: safefindPartners.commune,
    })
    .from(safefindPartners)
    .where(eq(safefindPartners.status, "active"))
    .orderBy(safefindPartners.name)
    .limit(100);

  return { listings, partners: partnerRows };
}

export async function listMySafefindCases(args: {
  userId: string;
  bucket?: "all" | "active";
  limit?: number;
}): Promise<MarketplaceListing[]> {
  const db = getDb();
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 80);
  const ownership = or(
    eq(safefindCases.ownerUserId, args.userId),
    eq(safefindCases.initialFinderUserId, args.userId),
    eq(safefindCases.rewardOwnerUserId, args.userId),
  )!;

  const filters =
    args.bucket === "active"
      ? and(
          ownership,
          inArray(safefindCases.status, [...SAFEFIND_ACTIVE_RESTITUTION_STATUSES]),
        )
      : ownership;

  const rows = await db
    .select({
      case: safefindCases,
      partnerId: safefindPartners.id,
      partnerName: safefindPartners.name,
      partnerCommune: safefindPartners.commune,
    })
    .from(safefindCases)
    .leftJoin(
      safefindPartners,
      eq(safefindCases.currentPartnerId, safefindPartners.id),
    )
    .where(filters)
    .orderBy(desc(safefindCases.updatedAt))
    .limit(limit);

  return rows.map((r) => {
    const view = toPublicCaseView(r.case);
    return {
      ...view,
      documentNumberLast4: r.case.documentNumberLast4 ?? null,
      partner:
        r.partnerId && r.partnerName
          ? {
              id: r.partnerId,
              name: r.partnerName,
              commune: r.partnerCommune ?? "",
            }
          : null,
    };
  });
}

export async function acceptDeposit(args: {
  agentUserId: string;
  casePublicId: string;
  documentPresent: boolean;
  conditionNotes?: string;
}) {
  const db = getDb();
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");

  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");

  // Partner may only act on cases assigned to them or pending deposit with their hint
  const suggested = (caseRow.meta as Record<string, unknown>)?.suggestedPartnerId;
  const allowed =
    caseRow.currentPartnerId === agent.partnerId ||
    suggested === agent.partnerId ||
    caseRow.status === "DEPOSIT_PENDING" ||
    caseRow.status === "REGISTERED" ||
    caseRow.status === "FOUND" ||
    caseRow.status === "PARTNER_INCIDENT";
  if (!allowed) throw new Error("partner_case_forbidden");

  if (!args.documentPresent) throw new Error("document_not_present");

  const from = caseRow.status as SafefindCaseStatus;
  // PARTNER_INCIDENT → DEPOSITED_AT_PARTNER is allowed (re-deposit after incident).
  if (!canTransition(from, "DEPOSITED_AT_PARTNER")) {
    throw new Error("safefind_invalid_transition");
  }

  const prevPartner = caseRow.currentPartnerId;
  const [updated] = await db
    .update(safefindCases)
    .set({
      status: "DEPOSITED_AT_PARTNER",
      currentPartnerId: agent.partnerId,
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, caseRow.id))
    .returning();

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "DEPOSIT_ACCEPTED",
    actorUserId: args.agentUserId,
    actorRole: agent.role,
    partnerId: agent.partnerId,
    previousValue: { partnerId: prevPartner, status: from },
    newValue: { partnerId: agent.partnerId, status: "DEPOSITED_AT_PARTNER" },
    meta: { conditionNotes: args.conditionNotes ?? null },
  });
  await writeAudit({
    caseId: caseRow.id,
    action: "DEPOSIT_ACCEPTED",
    actorUserId: args.agentUserId,
  });

  if (caseRow.initialFinderUserId) {
    await notifySafe(caseRow.initialFinderUserId, "safefind_deposit_confirmed", {
      casePublicId: caseRow.publicId,
      partnerId: agent.partnerId,
    });
  }

  return {
    casePublicId: updated.publicId,
    status: updated.status,
    partnerId: agent.partnerId,
  };
}

export async function reportPartnerIncident(args: {
  agentUserId: string;
  casePublicId?: string;
  incidentType: string;
  description?: string;
  evidenceRefs?: string[];
  allUnderCustody?: boolean;
}) {
  const db = getDb();
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");

  const cases = args.casePublicId
    ? await db
        .select()
        .from(safefindCases)
        .where(
          and(
            eq(safefindCases.publicId, args.casePublicId),
            eq(safefindCases.currentPartnerId, agent.partnerId),
          ),
        )
    : args.allUnderCustody
      ? await db
          .select()
          .from(safefindCases)
          .where(
            and(
              eq(safefindCases.currentPartnerId, agent.partnerId),
              eq(safefindCases.status, "DEPOSITED_AT_PARTNER"),
            ),
          )
      : [];

  if (args.casePublicId && cases.length === 0) {
    throw new Error("partner_case_forbidden");
  }

  const incidents = [];
  for (const c of cases) {
    const [inc] = await db
      .insert(safefindIncidents)
      .values({
        caseId: c.id,
        partnerId: agent.partnerId,
        reportedByUserId: args.agentUserId,
        incidentType: args.incidentType,
        description: args.description ?? null,
        evidenceRefs: args.evidenceRefs ?? [],
        freezeRewards: true,
        status: "open",
      })
      .returning();
    incidents.push(inc);

    await db
      .update(safefindCases)
      .set({
        status: "PARTNER_INCIDENT",
        rewardFrozen: true,
        rewardStatus: "LOCKED",
        updatedAt: new Date(),
      })
      .where(eq(safefindCases.id, c.id));

    await appendCustodyEvent({
      caseId: c.id,
      eventType: "PARTNER_INCIDENT_REPORTED",
      actorUserId: args.agentUserId,
      actorRole: agent.role,
      partnerId: agent.partnerId,
      previousValue: { status: c.status },
      newValue: { status: "PARTNER_INCIDENT", incidentId: inc.id },
    });
    await writeAudit({
      caseId: c.id,
      action: "PARTNER_INCIDENT_REPORTED",
      actorUserId: args.agentUserId,
      meta: { incidentType: args.incidentType },
    });
  }

  return { incidents: incidents.map((i) => i.id), casesAffected: cases.length };
}

export async function startOwnerClaim(args: {
  userId: string;
  casePublicId: string;
  firstName?: string;
  lastName?: string;
  documentNumber?: string;
  lostCommune?: string;
  lostApproxDate?: Date;
  appearanceHints?: Record<string, unknown>;
}) {
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");

  const { score, signals } = computeMatchScore(
    {
      documentType: caseRow.documentType,
      holderFirstName: caseRow.holderFirstName,
      holderLastName: caseRow.holderLastName,
      documentNumberHash: caseRow.documentNumberHash,
      documentNumberLast4: caseRow.documentNumberLast4,
      foundCommune: caseRow.foundCommune,
      foundApproxDate: caseRow.foundApproxDate,
      appearanceMeta: caseRow.appearanceMeta as Record<string, unknown>,
    },
    {
      documentType: caseRow.documentType,
      firstName: args.firstName,
      lastName: args.lastName,
      documentNumberLast4: args.documentNumber
        ? last4DocumentNumber(args.documentNumber)
        : null,
      lostCommune: args.lostCommune,
      lostApproxDate: args.lostApproxDate,
      appearanceHints: args.appearanceHints,
    },
  );

  if (args.documentNumber && caseRow.documentNumberHash) {
    if (hashDocumentNumber(args.documentNumber) === caseRow.documentNumberHash) {
      signals.exactHash = true;
    }
  }

  const existingClaims = await db
    .select()
    .from(safefindMatchCandidates)
    .where(
      and(
        eq(safefindMatchCandidates.caseId, caseRow.id),
        sql`${safefindMatchCandidates.status} in ('pending','verification')`,
      ),
    );

  const otherOpen = existingClaims.filter((c) => c.claimantUserId !== args.userId);
  if (otherOpen.length >= 1 && score >= SAFEFIND_DEFAULT_CONFIG.MATCH_CANDIDATE_THRESHOLD) {
    await db.insert(safefindDisputes).values({
      caseId: caseRow.id,
      openedByUserId: args.userId,
      reason: "multiple_owners",
      description: "Deux propriétaires potentiels",
      status: "open",
    });
    await db
      .update(safefindCases)
      .set({
        status: "DISPUTED",
        rewardFrozen: true,
        rewardStatus: "DISPUTED",
        updatedAt: new Date(),
      })
      .where(eq(safefindCases.id, caseRow.id));
    await writeAudit({
      caseId: caseRow.id,
      action: "DISPUTE_OPENED",
      actorUserId: args.userId,
    });
    return { status: "DISPUTED" as const, scoreBand: "conflict" as const };
  }

  await db
    .insert(safefindMatchCandidates)
    .values({
      caseId: caseRow.id,
      claimantUserId: args.userId,
      matchScore: score,
      signals,
      status:
        score >= SAFEFIND_DEFAULT_CONFIG.MATCH_CANDIDATE_THRESHOLD
          ? "verification"
          : "pending",
    })
    .onConflictDoUpdate({
      target: [
        safefindMatchCandidates.caseId,
        safefindMatchCandidates.claimantUserId,
      ],
      set: {
        matchScore: score,
        signals,
        status:
          score >= SAFEFIND_DEFAULT_CONFIG.MATCH_CANDIDATE_THRESHOLD
            ? "verification"
            : "pending",
        updatedAt: new Date(),
      },
    });

  if (score >= SAFEFIND_DEFAULT_CONFIG.MATCH_CANDIDATE_THRESHOLD) {
    if (canTransition(caseRow.status as SafefindCaseStatus, "OWNER_VERIFICATION")) {
      await transitionCase(
        caseRow.id,
        caseRow.status as SafefindCaseStatus,
        "OWNER_VERIFICATION",
      );
    }
    await writeAudit({
      caseId: caseRow.id,
      action: "OWNER_VERIFICATION_STARTED",
      actorUserId: args.userId,
      meta: { scoreBand: score >= 85 ? "high" : "medium" },
    });
  }

  return {
    status: "verification" as const,
    scoreBand:
      score >= 85 ? ("high" as const) : score >= 60 ? ("medium" as const) : ("low" as const),
    // Never return correct answers or raw score to claimant beyond band
  };
}

export async function verifyOwner(args: {
  userId: string;
  casePublicId: string;
  answers: {
    firstName?: string;
    lastName?: string;
    last4?: string;
    lostCommune?: string;
  };
}) {
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.status === "DISPUTED" || caseRow.status === "REPORTED_STOLEN") {
    throw new Error("case_blocked");
  }

  let passed = 0;
  let checks = 0;
  const check = (cond: boolean) => {
    checks += 1;
    if (cond) passed += 1;
  };
  if (args.answers.firstName && caseRow.holderFirstName) {
    check(
      args.answers.firstName.trim().toLowerCase() ===
        caseRow.holderFirstName.trim().toLowerCase(),
    );
  }
  if (args.answers.lastName && caseRow.holderLastName) {
    check(
      args.answers.lastName.trim().toLowerCase() ===
        caseRow.holderLastName.trim().toLowerCase(),
    );
  }
  if (args.answers.last4 && caseRow.documentNumberLast4) {
    check(args.answers.last4 === caseRow.documentNumberLast4);
  }
  if (args.answers.lostCommune && caseRow.foundCommune) {
    check(
      args.answers.lostCommune.trim().toLowerCase() ===
        caseRow.foundCommune.trim().toLowerCase(),
    );
  }

  const ok = checks >= 2 && passed >= Math.ceil(checks * 0.66);
  if (!ok) {
    return { verified: false as const };
  }

  const [user] = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  if (!user || !isEmailVerified(user.emailVerifiedAt)) {
    throw new Error("kyc_required");
  }

  const otp = generateCollectionOtp();
  const otpHash = hashOtp(otp);
  const expires = new Date(
    Date.now() + SAFEFIND_DEFAULT_CONFIG.COLLECTION_OTP_TTL_MS,
  );

  await db
    .update(safefindCases)
    .set({
      status: "READY_FOR_COLLECTION",
      ownerUserId: args.userId,
      collectionOtpHash: otpHash,
      collectionOtpExpiresAt: expires,
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, caseRow.id));

  await db
    .update(safefindMatchCandidates)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(
      and(
        eq(safefindMatchCandidates.caseId, caseRow.id),
        eq(safefindMatchCandidates.claimantUserId, args.userId),
      ),
    );

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "OWNER_VERIFIED",
    actorUserId: args.userId,
    actorRole: "owner",
    partnerId: caseRow.currentPartnerId,
    newValue: { status: "READY_FOR_COLLECTION" },
  });
  await writeAudit({
    caseId: caseRow.id,
    action: "OWNER_VERIFIED",
    actorUserId: args.userId,
  });

  await notifySafe(args.userId, "safefind_ready_collection", {
    casePublicId: caseRow.publicId,
  });

  const partner = caseRow.currentPartnerId
    ? (
        await db
          .select()
          .from(safefindPartners)
          .where(eq(safefindPartners.id, caseRow.currentPartnerId))
          .limit(1)
      )[0]
    : null;

  return {
    verified: true as const,
    collectionOtp: otp,
    expiresAt: expires.toISOString(),
    partner: partner
      ? {
          name: partner.name,
          address: partner.address,
          commune: partner.commune,
          openingHours: partner.openingHours,
        }
      : null,
  };
}

export async function releaseToOwner(args: {
  agentUserId: string;
  casePublicId: string;
  otp: string;
}) {
  const db = getDb();
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");

  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.currentPartnerId !== agent.partnerId) {
    throw new Error("partner_case_forbidden");
  }
  if (caseRow.status !== "READY_FOR_COLLECTION") {
    throw new Error("not_ready");
  }
  if (
    !caseRow.collectionOtpHash ||
    !caseRow.collectionOtpExpiresAt ||
    caseRow.collectionOtpExpiresAt.getTime() < Date.now()
  ) {
    throw new Error("otp_expired");
  }
  if (hashOtp(args.otp) !== caseRow.collectionOtpHash) {
    throw new Error("otp_invalid");
  }

  await db
    .update(safefindCases)
    .set({
      status: "RETURNED",
      collectionOtpHash: null,
      collectionOtpExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, caseRow.id));

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "DOCUMENT_COLLECTED",
    actorUserId: args.agentUserId,
    actorRole: agent.role,
    partnerId: agent.partnerId,
    previousValue: { status: "READY_FOR_COLLECTION" },
    newValue: { status: "RETURNED" },
  });
  await writeAudit({
    caseId: caseRow.id,
    action: "DOCUMENT_COLLECTED",
    actorUserId: args.agentUserId,
  });

  // Ensure single reward row
  const beneficiary = caseRow.rewardOwnerUserId ?? caseRow.initialFinderUserId;
  if (beneficiary && caseRow.rewardAmount && !caseRow.rewardFrozen) {
    await db
      .insert(safefindRewards)
      .values({
        caseId: caseRow.id,
        beneficiaryUserId: beneficiary,
        amount: caseRow.rewardAmount,
        currency: caseRow.rewardCurrency ?? "CDF",
        status: "AUTHORIZED",
        authorizedAt: new Date(),
        payoutReference: randomUUID(),
      })
      .onConflictDoNothing();

    await db
      .update(safefindCases)
      .set({
        status: "REWARD_PENDING",
        rewardStatus: "AUTHORIZED",
        updatedAt: new Date(),
      })
      .where(eq(safefindCases.id, caseRow.id));

    await writeAudit({
      caseId: caseRow.id,
      action: "REWARD_AUTHORIZED",
      actorUserId: args.agentUserId,
    });
  }

  return { status: "RETURNED" as const };
}

export async function getPartnerAgent(userId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(safefindPartnerAgents)
    .where(
      and(
        eq(safefindPartnerAgents.userId, userId),
        eq(safefindPartnerAgents.active, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listPartnerCustody(agentUserId: string) {
  const agent = await getPartnerAgent(agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const rows = await db
    .select({
      publicId: safefindCases.publicId,
      documentType: safefindCases.documentType,
      status: safefindCases.status,
      createdAt: safefindCases.createdAt,
    })
    .from(safefindCases)
    .where(eq(safefindCases.currentPartnerId, agent.partnerId));
  return rows;
}

async function notifySafe(
  userId: string,
  kind: string,
  payload: Record<string, unknown>,
) {
  try {
    const db = getDb();
    await db.execute(
      sql`insert into user_notifications (user_id, kind, payload) values (${userId}::uuid, ${kind}, ${JSON.stringify(payload)}::jsonb)`,
    );
  } catch {
    /* best-effort - table/kind may vary */
  }
}

export function caseAccessToken(publicId: string, userId: string): string {
  return createHash("sha256")
    .update(`${publicId}:${userId}:${process.env.JWT_SECRET ?? "x"}`)
    .digest("hex")
    .slice(0, 16);
}
