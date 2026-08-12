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
  applyAiMatchBandBoost,
  safefindAnomalyHint,
  safefindMatchAssist,
} from "./ai-assist";
import {
  custodyEventHash,
  generateCollectionOtp,
  hashDocumentNumber,
  hashOtp,
  last4DocumentNumber,
  toPublicCaseView,
} from "./privacy";
import { findNearestPartners } from "./location/nearby";
import { computeRestitutionFees } from "./fees";
import { classifyFoundDeclarationCollision } from "./found-collision";
import { onDocumentRefoundDecision } from "./reward-ownership";
import { assertTransition, canTransition } from "./state-machine";
import {
  SAFEFIND_DEFAULT_CONFIG,
  SAFEFIND_DEFAULT_REWARDS,
  type SafefindCaseStatus,
  type SafefindDocType,
  isFinderEditableStatus,
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

function docLabelShort(documentType: SafefindDocType): string {
  const map: Record<SafefindDocType, string> = {
    carte_electeur: "Carte d'électeur",
    passeport: "Passeport",
    permis_conduire: "Permis de conduire",
  };
  return map[documentType] ?? "Pièce d'identité";
}

/** Check if document number already has an active marketplace case. */
export async function checkDocumentAlreadyListed(args: {
  documentNumber: string;
  documentType?: SafefindDocType;
  userId?: string;
}): Promise<{
  alreadyListed: boolean;
  ownCase: boolean;
  casePublicId: string | null;
  message: string | null;
}> {
  const db = getDb();
  const docHash = hashDocumentNumber(args.documentNumber);
  const filters = [
    eq(safefindCases.documentNumberHash, docHash),
    sql`${safefindCases.status} not in ('CANCELLED','EXPIRED','REWARD_RELEASED')`,
  ];
  if (args.documentType) {
    filters.push(eq(safefindCases.documentType, args.documentType));
  }
  const [hit] = await db
    .select({
      publicId: safefindCases.publicId,
      status: safefindCases.status,
      initialFinderUserId: safefindCases.initialFinderUserId,
    })
    .from(safefindCases)
    .where(and(...filters))
    .limit(1);
  if (!hit) {
    return {
      alreadyListed: false,
      ownCase: false,
      casePublicId: null,
      message: null,
    };
  }

  const ownCase =
    args.userId != null && hit.initialFinderUserId === args.userId;

  if (ownCase) {
    return {
      alreadyListed: true,
      ownCase: true,
      casePublicId: hit.publicId,
      message: isFinderEditableStatus(hit.status)
        ? `Dossier ${hit.publicId} déjà enregistré. Vous pouvez corriger les informations ci-dessous.`
        : `Dossier ${hit.publicId} déjà actif. Consultez Mes dossiers.`,
    };
  }

  return {
    alreadyListed: true,
    ownCase: false,
    casePublicId: null,
    message:
      "Une fiche similaire existe déjà dans SafeFind. Vérifiez le Marketplace ou contactez un Point partenaire.",
  };
}

type DeclareFoundInput = {
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
  possessionMode?: "held" | "deposited";
  locationId?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationPrecision?: string;
  previewUrl?: string;
  previewToken?: string;
};

async function findActiveCaseByDocumentHash(args: {
  docHash: string;
  documentType: SafefindDocType;
  declarantUserId?: string;
}) {
  const db = getDb();
  const hits = await db
    .select()
    .from(safefindCases)
    .where(
      and(
        eq(safefindCases.documentNumberHash, args.docHash),
        eq(safefindCases.documentType, args.documentType),
        sql`${safefindCases.status} not in ('CANCELLED','EXPIRED','REWARD_RELEASED')`,
      ),
    )
    .orderBy(desc(safefindCases.updatedAt))
    .limit(5);

  if (!hits.length) return null;

  if (args.declarantUserId) {
    const ownEditable = hits.find(
      (h) =>
        h.initialFinderUserId === args.declarantUserId &&
        (isFinderEditableStatus(h.status) ||
          (h.status === "PARTNER_INCIDENT" &&
            !h.currentPartnerId &&
            (h.meta as Record<string, unknown>)?.recoveryFinderUserId ===
              args.declarantUserId)),
    );
    if (ownEditable) return ownEditable;

    const ownAny = hits.find((h) => h.initialFinderUserId === args.declarantUserId);
    if (ownAny) return ownAny;
  }

  return hits[0] ?? null;
}

async function resumeExistingFinderCase(args: {
  userId: string;
  caseRow: typeof safefindCases.$inferSelect;
  input: DeclareFoundInput;
  policy: Awaited<ReturnType<typeof activeRewardPolicy>>;
}) {
  const db = getDb();
  const { caseRow, input, policy } = args;
  const previewUrl = input.previewUrl ?? null;
  const prevMeta = (caseRow.meta ?? {}) as Record<string, unknown>;
  const meta: Record<string, unknown> = { ...prevMeta };

  if (previewUrl) {
    meta.previewUrl = previewUrl;
    meta.previewToken = input.previewToken ?? null;
    meta.listingSummary = `${docLabelShort(input.documentType)} - photo marketplace`;
  }
  if (input.partnerIdHint) {
    meta.selectedPartnerId = input.partnerIdHint;
    meta.suggestedPartnerId = input.partnerIdHint;
  }

  const feeBreakdown = computeRestitutionFees(
    input.documentType,
    policy?.baseReward ?? caseRow.rewardAmount ?? null,
  );
  meta.feeBreakdown = feeBreakdown;

  const mediaRefs = previewUrl
    ? [{ kind: "preview", key: previewUrl, redacted: true as const }]
    : (caseRow.mediaRefs ?? []);

  // Partner selected → DEPOSIT_PENDING (finder still holds until partner confirms).
  // Never trust self-declared "already deposited" as custody.
  let nextStatus = caseRow.status as SafefindCaseStatus;
  let heldByFinder = caseRow.heldByFinder;
  if (input.partnerIdHint) {
    nextStatus = "DEPOSIT_PENDING";
    heldByFinder = true;
  } else if (
    caseRow.status === "FOUND" ||
    caseRow.status === "REGISTERED" ||
    caseRow.status === "HELD_BY_FINDER" ||
    caseRow.status === "DEPOSIT_PENDING"
  ) {
    nextStatus = "HELD_BY_FINDER";
    heldByFinder = true;
  }

  const repairingSelfIncident =
    caseRow.status === "PARTNER_INCIDENT" &&
    !caseRow.currentPartnerId &&
    prevMeta.recoveryFinderUserId === args.userId;

  await db
    .update(safefindCases)
    .set({
      holderFirstName: input.holderFirstName ?? caseRow.holderFirstName,
      holderLastName: input.holderLastName ?? caseRow.holderLastName,
      documentNumberLast4:
        input.documentNumber != null
          ? last4DocumentNumber(input.documentNumber)
          : caseRow.documentNumberLast4,
      visualNotes: input.visualNotes ?? caseRow.visualNotes,
      appearanceMeta: input.appearanceMeta ?? caseRow.appearanceMeta,
      foundCommune: input.commune ?? caseRow.foundCommune,
      foundQuartier: input.quartier ?? caseRow.foundQuartier,
      foundLocationId: input.locationId ?? caseRow.foundLocationId,
      rewardPolicyId: policy?.id ?? caseRow.rewardPolicyId,
      rewardAmount: policy?.baseReward ?? caseRow.rewardAmount,
      rewardCurrency: policy?.currency ?? caseRow.rewardCurrency ?? "CDF",
      status: nextStatus,
      heldByFinder,
      rewardFrozen: repairingSelfIncident ? false : caseRow.rewardFrozen,
      rewardStatus: repairingSelfIncident ? "PENDING" : caseRow.rewardStatus,
      mediaRefs,
      meta: repairingSelfIncident
        ? {
            ...meta,
            recoveryFinderUserId: null,
            antifraud: [],
            aiAnomaly: null,
            selfIncidentRepairedAt: new Date().toISOString(),
          }
        : meta,
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, caseRow.id));

  if (input.partnerIdHint && input.partnerIdHint !== prevMeta.selectedPartnerId) {
    await appendCustodyEvent({
      caseId: caseRow.id,
      eventType: "PARTNER_SELECTED",
      actorUserId: args.userId,
      actorRole: "finder",
      partnerId: input.partnerIdHint,
      previousValue: { partnerId: prevMeta.selectedPartnerId ?? null },
      newValue: { status: nextStatus },
    });
  }

  await writeAudit({
    caseId: caseRow.id,
    action: "DOCUMENT_FOUND",
    actorUserId: args.userId,
    meta: { resume: true, updatedFields: true },
  });

  const depositHintPartnerId =
    input.partnerIdHint ??
    (typeof meta.selectedPartnerId === "string" ? meta.selectedPartnerId : null) ??
    (typeof meta.suggestedPartnerId === "string" ? meta.suggestedPartnerId : null);
  const depositPartner = depositHintPartnerId
    ? await getPartnerDepositView(depositHintPartnerId)
    : null;

  return {
    ok: true as const,
    alreadyExists: true as const,
    updated: true as const,
    neutral: false as const,
    message: depositPartner
      ? `Dossier ${caseRow.publicId} déjà enregistré — informations mises à jour. Déposez au Point « ${depositPartner.name} » (${depositPartner.commune}).`
      : `Dossier ${caseRow.publicId} déjà enregistré — informations mises à jour.`,
    casePublicId: caseRow.publicId,
    caseId: caseRow.id,
    depositHintPartnerId,
    depositPartner,
    nearbyPartners: [] as Awaited<ReturnType<typeof findNearestPartners>>,
    linkedSilently: false as const,
  };
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
  previewUrl?: string;
  previewToken?: string;
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

  // Match against active cases — branch by collision type (own resume vs collusion).
  let linkedExisting: typeof safefindCases.$inferSelect | null = null;
  if (docHash) {
    linkedExisting = await findActiveCaseByDocumentHash({
      docHash,
      documentType: args.documentType,
      declarantUserId: args.userId,
    });
  }

  const policy = await activeRewardPolicy(args.documentType);

  if (linkedExisting) {
    const linkedMeta = (linkedExisting.meta ?? {}) as Record<string, unknown>;
    const collision = classifyFoundDeclarationCollision({
      declarantUserId: args.userId,
      existing: {
        initialFinderUserId: linkedExisting.initialFinderUserId,
        status: linkedExisting.status,
        currentPartnerId: linkedExisting.currentPartnerId,
        recoveryFinderUserId:
          typeof linkedMeta.recoveryFinderUserId === "string"
            ? linkedMeta.recoveryFinderUserId
            : null,
      },
    });

    if (collision === "same_finder_resume") {
      return resumeExistingFinderCase({
        userId: args.userId,
        caseRow: linkedExisting,
        input: args,
        policy,
      });
    }

    if (collision === "same_finder_readonly") {
      const depositHintPartnerId =
        args.partnerIdHint ??
        (typeof (linkedExisting.meta as Record<string, unknown>)?.selectedPartnerId ===
        "string"
          ? ((linkedExisting.meta as Record<string, unknown>).selectedPartnerId as string)
          : null);
      const depositPartner = depositHintPartnerId
        ? await getPartnerDepositView(depositHintPartnerId)
        : null;
      return {
        ok: true as const,
        alreadyExists: true as const,
        updated: false as const,
        neutral: false as const,
        message: `Dossier ${linkedExisting.publicId} déjà actif. Consultez Mes dossiers — les modifications ne sont plus possibles à ce stade.`,
        casePublicId: linkedExisting.publicId,
        caseId: linkedExisting.id,
        depositHintPartnerId,
        depositPartner,
        nearbyPartners: [],
        linkedSilently: false as const,
      };
    }

    if (collision === "cross_finder_concurrent") {
      await db.insert(safefindMatchGroups).values({
        status: "open",
        caseIds: [linkedExisting.id],
        signals: {
          kind: "concurrent_found",
          declarantUserId: args.userId,
          at: new Date().toISOString(),
        },
      });
      await db.insert(safefindDeclarations).values({
        caseId: linkedExisting.id,
        kind: "found",
        declarantUserId: args.userId,
        documentType: args.documentType,
        payload: { concurrent: true },
        commune: args.commune ?? null,
        quartier: args.quartier ?? null,
        status: "duplicate_candidate",
      });
      await writeAudit({
        caseId: linkedExisting.id,
        action: "DOCUMENT_FOUND",
        actorUserId: args.userId,
        meta: { concurrentFoundBlocked: true },
      });
      throw new Error("document_already_registered");
    }
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

  if (linkedExisting) {
    // cross_finder_refound — document reappears after partner custody (or name match)
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

    let aiAnomaly: Awaited<ReturnType<typeof safefindAnomalyHint>> | null = null;
    if (antifraud.suspicious) {
      try {
        aiAnomaly = await safefindAnomalyHint({
          reasons: antifraud.reasons,
          timeline: [
            {
              at: linkedExisting.createdAt.toISOString(),
              event: "case_created",
            },
            {
              at: new Date().toISOString(),
              event: "concurrent_found_declaration",
            },
          ],
        });
      } catch {
        aiAnomaly = null;
      }
    }

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
          ...(aiAnomaly
            ? {
                aiAnomaly: {
                  riskFlags: aiAnomaly.riskFlags,
                  recommendedAction: aiAnomaly.recommendedAction,
                  explanation: aiAnomaly.explanation,
                  provider: aiAnomaly.provider,
                  at: new Date().toISOString(),
                },
              }
            : {}),
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

    const depositPartner = args.partnerIdHint
      ? await getPartnerDepositView(args.partnerIdHint)
      : null;

    // Neutral response - no hint of existing case ownership.
    return {
      ok: true as const,
      neutral: true as const,
      message: decision.neutralMessageForRecoveryFinder,
      declarationId: decl.id,
      depositHintPartnerId: args.partnerIdHint ?? null,
      depositPartner,
      casePublicId: null as string | null,
      linkedSilently: true as const,
    };
  }

  const publicId = await nextPublicCaseId();
  const previewUrl = args.previewUrl ?? null;
  const mediaRefs = previewUrl
    ? [{ kind: "preview", key: previewUrl, redacted: true as const }]
    : [];
  const feeBreakdown = computeRestitutionFees(
    args.documentType,
    policy?.baseReward ?? null,
  );
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
      mediaRefs,
      meta: {
        ...(previewUrl
          ? {
              previewUrl,
              previewToken: args.previewToken ?? null,
              listingSummary: `${docLabelShort(args.documentType)} - photo marketplace`,
            }
          : {}),
        feeBreakdown,
      },
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

  // Custody rule: only the partner agent can mark DEPOSITED_AT_PARTNER.
  // Selecting a point → DEPOSIT_PENDING (finder still holds the document).
  // No partner yet → HELD_BY_FINDER.
  const baseMeta = {
    ...(caseRow.meta ?? {}),
    ...(args.partnerIdHint
      ? {
          selectedPartnerId: args.partnerIdHint,
          suggestedPartnerId: args.partnerIdHint,
        }
      : {}),
  };
  const nextStatus: SafefindCaseStatus = args.partnerIdHint
    ? "DEPOSIT_PENDING"
    : "HELD_BY_FINDER";

  await db
    .update(safefindCases)
    .set({
      status: nextStatus,
      heldByFinder: true,
      updatedAt: new Date(),
      meta: baseMeta,
    })
    .where(eq(safefindCases.id, caseRow.id));

  if (args.partnerIdHint) {
    await appendCustodyEvent({
      caseId: caseRow.id,
      eventType: "PARTNER_SELECTED",
      actorUserId: args.userId,
      actorRole: "finder",
      partnerId: args.partnerIdHint,
      newValue: { status: nextStatus, heldByFinder: true },
    });
  }
  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "HELD_BY_FINDER",
    actorUserId: args.userId,
    actorRole: "finder",
    partnerId: args.partnerIdHint ?? null,
    newValue: { status: nextStatus, heldByFinder: true },
  });

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

  const depositHintPartnerId =
    args.partnerIdHint ?? nearbyPartners[0]?.id ?? null;
  const depositPartner = depositHintPartnerId
    ? await getPartnerDepositView(depositHintPartnerId)
    : null;

  return {
    ok: true as const,
    neutral: false as const,
    message:
      depositPartner
        ? `Déclaration enregistrée. Déposez le document au Point SafeFind « ${depositPartner.name} » (${depositPartner.commune}).`
        : "Déclaration enregistrée. Déposez le document dans un Point SafeFind.",
    declarationId: decl.id,
    casePublicId: publicId,
    caseId: caseRow.id,
    depositHintPartnerId,
    depositPartner,
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

  const matches: Array<{
    publicId: string;
    score: number;
    aiBoosted?: boolean;
    aiConfidence?: number;
  }> = [];
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
        visualNotes: c.visualNotes,
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
    let finalScore = score;
    if (docHash && c.documentNumberHash === docHash) {
      finalScore = Math.max(score, 90);
    }
    if (finalScore < SAFEFIND_DEFAULT_CONFIG.MATCH_CANDIDATE_THRESHOLD) {
      continue;
    }

    let aiBoosted = false;
    let aiConfidence: number | undefined;
    if (finalScore >= 60) {
      try {
        const ai = await safefindMatchAssist(
          {
            documentType: args.documentType,
            commune: args.commune ?? null,
            approxDate: args.approxDate
              ? args.approxDate.toISOString().slice(0, 10)
              : null,
            appearance: args.appearanceHints ?? {},
            visualNotes: null,
            last4: args.documentNumber
              ? last4DocumentNumber(args.documentNumber)
              : null,
          },
          {
            documentType: c.documentType,
            commune: c.foundCommune ?? c.lostCommune ?? null,
            approxDate: c.foundApproxDate
              ? c.foundApproxDate.toISOString().slice(0, 10)
              : null,
            appearance: (c.appearanceMeta as Record<string, unknown>) ?? {},
            visualNotes: c.visualNotes
              ? String(c.visualNotes).slice(0, 120)
              : null,
            last4: c.documentNumberLast4 ?? null,
          },
        );
        const boost = applyAiMatchBandBoost(finalScore, ai);
        aiBoosted = boost.aiBoosted;
        aiConfidence = ai.confidence;
        const prevMeta = (c.meta as Record<string, unknown>) ?? {};
        await db
          .update(safefindCases)
          .set({
            meta: {
              ...prevMeta,
              aiMatch: {
                potentialMatch: ai.potentialMatch,
                confidence: ai.confidence,
                reasons: ai.reasons,
                riskFlags: ai.riskFlags,
                recommendedAction: ai.recommendedAction,
                provider: ai.provider,
                at: new Date().toISOString(),
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(safefindCases.id, c.id));
      } catch {
        // AI failure must not break matching
      }
    }
    matches.push({
      publicId: c.publicId,
      score: finalScore,
      aiBoosted,
      aiConfidence,
    });
  }
  matches.sort((a, b) => b.score - a.score);

  return {
    declarationId: decl.id,
    candidates: matches.slice(0, 10).map((m) => {
      const { scoreBand, aiBoosted } = applyAiMatchBandBoost(
        m.score,
        m.aiBoosted && m.aiConfidence != null
          ? {
              potentialMatch: true,
              confidence: m.aiConfidence,
              reasons: [],
              riskFlags: [],
              recommendedAction: "verify" as const,
              provider: "template" as const,
            }
          : null,
      );
      return {
        publicId: m.publicId,
        scoreBand,
        aiBoosted: aiBoosted || Boolean(m.aiBoosted),
      };
    }),
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
  /** Set on /api/safefind/mine only */
  myRole?: "finder" | "owner" | "reward";
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

  const metaPartnerIds = new Set<string>();
  for (const r of rows) {
    if (r.partnerId) continue;
    const meta = (r.case.meta ?? {}) as Record<string, unknown>;
    const pid = meta.selectedPartnerId ?? meta.suggestedPartnerId;
    if (typeof pid === "string") metaPartnerIds.add(pid);
  }
  const metaPartners =
    metaPartnerIds.size > 0
      ? await db
          .select({
            id: safefindPartners.id,
            name: safefindPartners.name,
            commune: safefindPartners.commune,
          })
          .from(safefindPartners)
          .where(inArray(safefindPartners.id, [...metaPartnerIds]))
      : [];
  const metaPartnerById = new Map(metaPartners.map((p) => [p.id, p]));

  return rows.map((r) => {
    const view = toPublicCaseView(r.case);
    const meta = (r.case.meta ?? {}) as Record<string, unknown>;
    const selectedId =
      typeof meta.selectedPartnerId === "string"
        ? meta.selectedPartnerId
        : typeof meta.suggestedPartnerId === "string"
          ? meta.suggestedPartnerId
          : null;
    const fallback = selectedId ? metaPartnerById.get(selectedId) : null;
    const myRole =
      r.case.initialFinderUserId === args.userId
        ? ("finder" as const)
        : r.case.ownerUserId === args.userId
          ? ("owner" as const)
          : r.case.rewardOwnerUserId === args.userId
            ? ("reward" as const)
            : undefined;
    return {
      ...view,
      documentNumberLast4: r.case.documentNumberLast4 ?? null,
      myRole,
      partner:
        r.partnerId && r.partnerName
          ? {
              id: r.partnerId,
              name: r.partnerName,
              commune: r.partnerCommune ?? "",
            }
          : fallback
            ? {
                id: fallback.id,
                name: fallback.name,
                commune: fallback.commune ?? "",
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

  // Partner may only act on cases assigned/selected for them.
  const meta = (caseRow.meta ?? {}) as Record<string, unknown>;
  const selectedPartnerId =
    meta.selectedPartnerId ?? meta.suggestedPartnerId ?? null;
  const isAssignedPartner = caseRow.currentPartnerId === agent.partnerId;
  const isSelectedPartner = selectedPartnerId === agent.partnerId;
  const allowed =
    isAssignedPartner ||
    (isSelectedPartner &&
      [
        "DEPOSIT_PENDING",
        "HELD_BY_FINDER",
        "REGISTERED",
        "FOUND",
      ].includes(caseRow.status)) ||
    (caseRow.status === "PARTNER_INCIDENT" && isAssignedPartner);
  if (!allowed) throw new Error("partner_case_forbidden");

  if (!args.documentPresent) throw new Error("document_not_present");

  const from = caseRow.status as SafefindCaseStatus;
  // PARTNER_INCIDENT → DEPOSITED_AT_PARTNER is allowed (re-deposit after incident).
  if (!canTransition(from, "DEPOSITED_AT_PARTNER")) {
    throw new Error("safefind_invalid_transition");
  }

  const prevPartner = caseRow.currentPartnerId;
  const publishedMeta = {
    ...(caseRow.meta ?? {}),
    marketplacePublishedAt: new Date().toISOString(),
  };
  const [updated] = await db
    .update(safefindCases)
    .set({
      status: "DEPOSITED_AT_PARTNER",
      currentPartnerId: agent.partnerId,
      heldByFinder: false,
      meta: publishedMeta,
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
      marketplacePublished: true,
    });
  }

  return {
    casePublicId: updated.publicId,
    status: updated.status,
    partnerId: agent.partnerId,
    marketplacePublished: true,
    message:
      "Dépôt confirmé. La fiche est publiée sur le Marketplace SafeFind (photo floutée).",
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
  if (
    caseRow.status !== "READY_FOR_COLLECTION" &&
    caseRow.status !== "READY_FOR_PICKUP"
  ) {
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
    const fees = computeRestitutionFees(
      caseRow.documentType as SafefindDocType,
      caseRow.rewardAmount,
    );
    await db
      .insert(safefindRewards)
      .values({
        caseId: caseRow.id,
        beneficiaryUserId: beneficiary,
        amount: fees.finderNetPayout,
        currency: caseRow.rewardCurrency ?? "CDF",
        status: "AUTHORIZED",
        authorizedAt: new Date(),
        payoutReference: randomUUID(),
        meta: {
          feeBreakdown: fees,
          grossReward: fees.baseReward,
        },
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

export type PartnerDepositView = {
  id: string;
  name: string;
  commune: string;
  address: string;
};

export async function getPartnerDepositView(
  partnerId: string,
): Promise<PartnerDepositView | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: safefindPartners.id,
      name: safefindPartners.name,
      commune: safefindPartners.commune,
      address: safefindPartners.address,
    })
    .from(safefindPartners)
    .where(
      and(
        eq(safefindPartners.id, partnerId),
        eq(safefindPartners.status, "active"),
      ),
    )
    .limit(1);
  return row ?? null;
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
  if (row) return row;
  return provisionStaffPartnerAgent(userId);
}

/** Auto-link admin/developer accounts to Point SafeFind Gombe (partner_admin). */
async function provisionStaffPartnerAgent(userId: string) {
  const db = getDb();
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || !["admin", "developer"].includes(user.role)) return null;

  const [partner] = await db
    .select({ id: safefindPartners.id })
    .from(safefindPartners)
    .where(eq(safefindPartners.name, "Point SafeFind Gombe"))
    .limit(1);
  if (!partner) return null;

  await db
    .insert(safefindPartnerAgents)
    .values({
      partnerId: partner.id,
      userId,
      role: "partner_admin",
      active: true,
    })
    .onConflictDoNothing();

  const [linked] = await db
    .select()
    .from(safefindPartnerAgents)
    .where(
      and(
        eq(safefindPartnerAgents.userId, userId),
        eq(safefindPartnerAgents.active, true),
      ),
    )
    .limit(1);
  return linked ?? null;
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
      holderFirstName: safefindCases.holderFirstName,
      holderLastName: safefindCases.holderLastName,
      previewUrl: sql<string | null>`${safefindCases.meta}->>'previewUrl'`,
      createdAt: safefindCases.createdAt,
      updatedAt: safefindCases.updatedAt,
    })
    .from(safefindCases)
    .where(
      and(
        eq(safefindCases.currentPartnerId, agent.partnerId),
        inArray(safefindCases.status, [
          "DEPOSITED_AT_PARTNER",
          "STORED_AT_LOCATION",
          "READY_FOR_COLLECTION",
          "READY_FOR_PICKUP",
          "PICKUP_RESERVED",
        ]),
      ),
    )
    .orderBy(desc(safefindCases.updatedAt));
  return rows;
}

/** Cases awaiting physical deposit at this partner (not yet on marketplace). */
export async function listPartnerPendingDeposits(agentUserId: string) {
  const agent = await getPartnerAgent(agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const partnerId = agent.partnerId;
  const rows = await db
    .select({
      publicId: safefindCases.publicId,
      documentType: safefindCases.documentType,
      status: safefindCases.status,
      holderFirstName: safefindCases.holderFirstName,
      holderLastName: safefindCases.holderLastName,
      previewUrl: sql<string | null>`${safefindCases.meta}->>'previewUrl'`,
      updatedAt: safefindCases.updatedAt,
    })
    .from(safefindCases)
    .where(
      and(
        inArray(safefindCases.status, [
          "DEPOSIT_PENDING",
          "HELD_BY_FINDER",
          "REGISTERED",
          "FOUND",
        ]),
        sql`(
          ${safefindCases.meta}->>'selectedPartnerId' = ${partnerId}
          OR ${safefindCases.meta}->>'suggestedPartnerId' = ${partnerId}
        )`,
      ),
    )
    .orderBy(desc(safefindCases.updatedAt))
    .limit(40);
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
