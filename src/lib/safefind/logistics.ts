/**
 * SafeFind logistics: HeldByFinder, storage, pickup reservations, delivery.
 * Extends existing service - does not replace custody/reward core.
 */
import { and, eq, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import {
  getDb,
  safefindCases,
  safefindAuditEvents,
  safefindPartners,
  safefindPartnerAgents,
  safefindPickupReservations,
  safefindStorageLocations,
  safefindStorageMovements,
  safefindStorageZones,
  safefindDeliveryRequests,
  safefindDeliveryEvents,
  safefindDeliveryFeePolicies,
} from "@/db";
import { canTransition, isSensitiveActionBlocked } from "./state-machine";
import {
  SAFEFIND_DEFAULT_CONFIG,
  capacityStatusFromPct,
  type SafefindCaseStatus,
} from "./types";
import { hashOtp } from "./privacy";
import { getDeliveryProvider } from "./delivery-provider";
import { getPartnerAgent, appendCustodyEvent } from "./service";

async function writeAudit(args: {
  caseId?: string | null;
  action: string;
  actorUserId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(safefindAuditEvents).values({
    caseId: args.caseId ?? null,
    action: args.action,
    actorUserId: args.actorUserId ?? null,
    meta: args.meta ?? {},
  });
}

function refreshCapacityStatus(capacity: number, count: number): string {
  if (capacity <= 0) return "AVAILABLE";
  const pct = Math.round((count / capacity) * 100);
  return capacityStatusFromPct(pct);
}

/** Finder confirms they still hold the physical document. */
export async function confirmHeldByFinder(args: {
  userId: string;
  casePublicId: string;
  circumstances?: string;
  approxCommune?: string;
  latitude?: number;
  longitude?: number;
}) {
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.initialFinderUserId !== args.userId) {
    throw new Error("forbidden");
  }
  const from = caseRow.status as SafefindCaseStatus;
  if (!canTransition(from, "HELD_BY_FINDER") && from !== "HELD_BY_FINDER") {
    throw new Error("safefind_invalid_transition");
  }

  // Chain-break: already deposited elsewhere then claimed held by finder
  if (
    caseRow.currentPartnerId &&
    (from === "DEPOSITED_AT_PARTNER" ||
      from === "STORED_AT_LOCATION" ||
      from === "READY_FOR_COLLECTION" ||
      from === "PICKUP_RESERVED")
  ) {
    await db
      .update(safefindCases)
      .set({
        status: "POTENTIAL_CHAIN_BREAK",
        rewardFrozen: true,
        rewardStatus: "LOCKED",
        heldByFinder: true,
        updatedAt: new Date(),
        meta: {
          ...(caseRow.meta ?? {}),
          chainBreak: true,
          circumstances: args.circumstances ?? null,
        },
      })
      .where(eq(safefindCases.id, caseRow.id));
    await appendCustodyEvent({
      caseId: caseRow.id,
      eventType: "POTENTIAL_CHAIN_BREAK",
      actorUserId: args.userId,
      actorRole: "finder",
      previousValue: { status: from },
      newValue: { status: "POTENTIAL_CHAIN_BREAK" },
    });
    await writeAudit({
      caseId: caseRow.id,
      action: "POTENTIAL_CHAIN_BREAK",
      actorUserId: args.userId,
    });
    return {
      status: "POTENTIAL_CHAIN_BREAK" as const,
      message:
        "Votre declaration a ete enregistree. Une verification est en cours. Conservez le document et suivez uniquement la procedure SafeFind.",
    };
  }

  await db
    .update(safefindCases)
    .set({
      status: "HELD_BY_FINDER",
      heldByFinder: true,
      foundCommune: args.approxCommune ?? caseRow.foundCommune,
      updatedAt: new Date(),
      meta: {
        ...(caseRow.meta ?? {}),
        heldConfirmation: {
          at: new Date().toISOString(),
          circumstances: args.circumstances ?? null,
          lat: args.latitude ?? null,
          lng: args.longitude ?? null,
        },
      },
    })
    .where(eq(safefindCases.id, caseRow.id));

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "HELD_BY_FINDER",
    actorUserId: args.userId,
    actorRole: "finder",
    previousValue: { status: from },
    newValue: { status: "HELD_BY_FINDER" },
    meta: { circumstances: args.circumstances ?? null },
  });
  await writeAudit({
    caseId: caseRow.id,
    action: "HELD_BY_FINDER",
    actorUserId: args.userId,
  });

  return {
    status: "HELD_BY_FINDER" as const,
    message:
      "Merci de conserver le document en securite. Ne le remettez pas directement a une personne qui pretend en etre proprietaire. Utilisez uniquement la procedure SafeFind.",
  };
}

/** Owner asks finder to deposit at nearest partner (no finder PII revealed). */
export async function requestPartnerDeposit(args: {
  ownerUserId: string;
  casePublicId: string;
  suggestedPartnerId?: string;
}) {
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.ownerUserId !== args.ownerUserId) throw new Error("forbidden");
  if (caseRow.status !== "HELD_BY_FINDER" && caseRow.status !== "OWNER_VERIFICATION") {
    throw new Error("invalid_status");
  }

  await db
    .update(safefindCases)
    .set({
      status: "DEPOSIT_PENDING",
      restitutionMode: "request_partner_deposit",
      updatedAt: new Date(),
      meta: {
        ...(caseRow.meta ?? {}),
        suggestedPartnerId:
          args.suggestedPartnerId ??
          (caseRow.meta as Record<string, unknown>)?.suggestedPartnerId,
        depositRequestedByOwnerAt: new Date().toISOString(),
      },
    })
    .where(eq(safefindCases.id, caseRow.id));

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "DEPOSIT_CREATED",
    actorUserId: args.ownerUserId,
    actorRole: "owner",
    partnerId: args.suggestedPartnerId ?? null,
    newValue: { status: "DEPOSIT_PENDING" },
  });

  return {
    ok: true as const,
    finderMessage:
      "Une correspondance potentielle a ete detectee. Veuillez deposer le document au Point SafeFind indique.",
    // Never include owner identity
  };
}

export async function requestSecureCollection(args: {
  ownerUserId: string;
  casePublicId: string;
}) {
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.ownerUserId !== args.ownerUserId) throw new Error("forbidden");
  if (caseRow.status !== "HELD_BY_FINDER") throw new Error("invalid_status");

  await db
    .update(safefindCases)
    .set({
      restitutionMode: "secure_collection",
      updatedAt: new Date(),
      meta: {
        ...(caseRow.meta ?? {}),
        secureCollectionRequestedAt: new Date().toISOString(),
      },
    })
    .where(eq(safefindCases.id, caseRow.id));

  await writeAudit({
    caseId: caseRow.id,
    action: "DELIVERY_REQUESTED",
    actorUserId: args.ownerUserId,
    meta: { kind: "secure_collection_from_finder" },
  });

  return { ok: true as const, status: "secure_collection_requested" as const };
}

function slotKey(date: string, start: string) {
  return `${date}|${start}`;
}

export async function createPickupReservation(args: {
  ownerUserId: string;
  casePublicId: string;
  partnerId: string;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
  express?: boolean;
}) {
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.ownerUserId !== args.ownerUserId) throw new Error("forbidden");
  if (isSensitiveActionBlocked(caseRow.status as SafefindCaseStatus)) {
    throw new Error("case_blocked");
  }
  if (
    caseRow.currentPartnerId &&
    caseRow.currentPartnerId !== args.partnerId
  ) {
    throw new Error("wrong_partner");
  }

  const max = SAFEFIND_DEFAULT_CONFIG.PICKUP_SLOT_MAX_RESERVATIONS;
  const existing = await db
    .select({ id: safefindPickupReservations.id })
    .from(safefindPickupReservations)
    .where(
      and(
        eq(safefindPickupReservations.partnerId, args.partnerId),
        eq(safefindPickupReservations.slotDate, args.slotDate),
        eq(safefindPickupReservations.slotStart, args.slotStart),
        sql`${safefindPickupReservations.status} in ('reserved','preparing','ready')`,
      ),
    );
  if (existing.length >= max) throw new Error("slot_full");

  const [res] = await db
    .insert(safefindPickupReservations)
    .values({
      caseId: caseRow.id,
      partnerId: args.partnerId,
      ownerUserId: args.ownerUserId,
      slotDate: args.slotDate,
      slotStart: args.slotStart,
      slotEnd: args.slotEnd,
      status: "reserved",
      express: Boolean(args.express),
      prepareRequestedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [safefindPickupReservations.caseId],
      set: {
        partnerId: args.partnerId,
        slotDate: args.slotDate,
        slotStart: args.slotStart,
        slotEnd: args.slotEnd,
        status: "reserved",
        express: Boolean(args.express),
        prepareRequestedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .update(safefindCases)
    .set({
      status: "PICKUP_RESERVED",
      restitutionMode: "partner_pickup",
      currentPartnerId: args.partnerId,
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, caseRow.id));

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "PICKUP_RESERVED",
    actorUserId: args.ownerUserId,
    actorRole: "owner",
    partnerId: args.partnerId,
    newValue: {
      status: "PICKUP_RESERVED",
      slot: slotKey(args.slotDate, args.slotStart),
    },
  });
  await writeAudit({
    caseId: caseRow.id,
    action: "PICKUP_RESERVED",
    actorUserId: args.ownerUserId,
  });

  return { reservation: res };
}

export async function markReadyForPickup(args: {
  agentUserId: string;
  casePublicId: string;
}) {
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.currentPartnerId !== agent.partnerId) {
    throw new Error("partner_case_forbidden");
  }

  await db
    .update(safefindCases)
    .set({ status: "READY_FOR_PICKUP", updatedAt: new Date() })
    .where(eq(safefindCases.id, caseRow.id));
  await db
    .update(safefindPickupReservations)
    .set({ status: "ready", preparedAt: new Date(), updatedAt: new Date() })
    .where(eq(safefindPickupReservations.caseId, caseRow.id));

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "READY_FOR_PICKUP",
    actorUserId: args.agentUserId,
    actorRole: agent.role,
    partnerId: agent.partnerId,
    newValue: { status: "READY_FOR_PICKUP" },
  });

  return { status: "READY_FOR_PICKUP" as const };
}

export async function assignStorageLocation(args: {
  agentUserId: string;
  casePublicId: string;
  locationId: string;
}) {
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow || caseRow.currentPartnerId !== agent.partnerId) {
    throw new Error("partner_case_forbidden");
  }
  const [loc] = await db
    .select()
    .from(safefindStorageLocations)
    .where(
      and(
        eq(safefindStorageLocations.id, args.locationId),
        eq(safefindStorageLocations.partnerId, agent.partnerId),
      ),
    )
    .limit(1);
  if (!loc) throw new Error("location_not_found");
  if (loc.occupied && loc.caseId && loc.caseId !== caseRow.id) {
    throw new Error("location_occupied");
  }

  const prev = caseRow.storageLocationId;
  if (prev) {
    await db
      .update(safefindStorageLocations)
      .set({ occupied: false, caseId: null, updatedAt: new Date() })
      .where(eq(safefindStorageLocations.id, prev));
  }

  await db
    .update(safefindStorageLocations)
    .set({ occupied: true, caseId: caseRow.id, updatedAt: new Date() })
    .where(eq(safefindStorageLocations.id, loc.id));

  const sleeve =
    caseRow.sleeveQrToken ??
    createHash("sha256")
      .update(`${caseRow.publicId}:${randomBytes(8).toString("hex")}`)
      .digest("hex")
      .slice(0, 24);

  await db
    .update(safefindCases)
    .set({
      storageLocationId: loc.id,
      status: "STORED_AT_LOCATION",
      sleeveQrToken: sleeve,
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, caseRow.id));

  await db.insert(safefindStorageMovements).values({
    caseId: caseRow.id,
    partnerId: agent.partnerId,
    fromLocationId: prev ?? null,
    toLocationId: loc.id,
    actorUserId: args.agentUserId,
    reason: "assign",
  });

  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "STORAGE_LOCATION_CHANGED",
    actorUserId: args.agentUserId,
    actorRole: agent.role,
    partnerId: agent.partnerId,
    previousValue: { locationId: prev },
    newValue: {
      locationId: loc.id,
      rack: loc.rackCode,
      bin: loc.binCode,
      position: loc.positionCode,
    },
  });

  // bump partner count if first storage
  if (!prev) {
    const [partner] = await db
      .select()
      .from(safefindPartners)
      .where(eq(safefindPartners.id, agent.partnerId))
      .limit(1);
    if (partner) {
      const next = (partner.currentStorageCount ?? 0) + 1;
      await db
        .update(safefindPartners)
        .set({
          currentStorageCount: next,
          capacityStatus: refreshCapacityStatus(
            partner.storageCapacity ?? 100,
            next,
          ),
          updatedAt: new Date(),
        })
        .where(eq(safefindPartners.id, partner.id));
    }
  }

  return {
    sleeveQrToken: sleeve,
    location: {
      rack: loc.rackCode,
      bin: loc.binCode,
      position: loc.positionCode,
    },
  };
}

export async function lookupBySleeveQr(args: {
  agentUserId: string;
  sleeveQrToken: string;
}) {
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.sleeveQrToken, args.sleeveQrToken))
    .limit(1);
  if (!caseRow || caseRow.currentPartnerId !== agent.partnerId) {
    throw new Error("not_found");
  }
  let location = null;
  if (caseRow.storageLocationId) {
    const [loc] = await db
      .select()
      .from(safefindStorageLocations)
      .where(eq(safefindStorageLocations.id, caseRow.storageLocationId))
      .limit(1);
    if (loc) {
      const [zone] = await db
        .select()
        .from(safefindStorageZones)
        .where(eq(safefindStorageZones.id, loc.zoneId))
        .limit(1);
      location = {
        zone: zone?.code ?? null,
        rack: loc.rackCode,
        bin: loc.binCode,
        position: loc.positionCode,
      };
    }
  }
  return {
    publicId: caseRow.publicId,
    status: caseRow.status,
    documentType: caseRow.documentType,
    location,
  };
}

export async function listTodayPickups(agentUserId: string, slotDate: string) {
  const agent = await getPartnerAgent(agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const rows = await db
    .select({
      reservationId: safefindPickupReservations.id,
      slotStart: safefindPickupReservations.slotStart,
      slotEnd: safefindPickupReservations.slotEnd,
      status: safefindPickupReservations.status,
      publicId: safefindCases.publicId,
      caseStatus: safefindCases.status,
      storageLocationId: safefindCases.storageLocationId,
    })
    .from(safefindPickupReservations)
    .innerJoin(
      safefindCases,
      eq(safefindCases.id, safefindPickupReservations.caseId),
    )
    .where(
      and(
        eq(safefindPickupReservations.partnerId, agent.partnerId),
        eq(safefindPickupReservations.slotDate, slotDate),
      ),
    )
    .orderBy(safefindPickupReservations.slotStart);
  return rows;
}

export async function requestDelivery(args: {
  ownerUserId: string;
  casePublicId: string;
  destinationCommune: string;
  destinationQuartier?: string;
  destinationAddress: string;
}) {
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow) throw new Error("case_not_found");
  if (caseRow.ownerUserId !== args.ownerUserId) throw new Error("forbidden");
  if (isSensitiveActionBlocked(caseRow.status as SafefindCaseStatus)) {
    throw new Error("case_blocked");
  }
  if (!caseRow.currentPartnerId && caseRow.status !== "HELD_BY_FINDER") {
    throw new Error("document_unavailable");
  }

  const [feePolicy] = await db
    .select()
    .from(safefindDeliveryFeePolicies)
    .where(eq(safefindDeliveryFeePolicies.active, true))
    .limit(1);
  const fee =
    feePolicy?.feeAmount ?? SAFEFIND_DEFAULT_CONFIG.DEFAULT_DELIVERY_FEE_CDF;

  const addrHash = createHash("sha256")
    .update(args.destinationAddress.trim().toLowerCase())
    .digest("hex");

  const [delivery] = await db
    .insert(safefindDeliveryRequests)
    .values({
      caseId: caseRow.id,
      ownerUserId: args.ownerUserId,
      partnerId: caseRow.currentPartnerId,
      status: "requested",
      destinationCommune: args.destinationCommune,
      destinationQuartier: args.destinationQuartier ?? null,
      destinationAddressHash: addrHash,
      destinationAddressEnc: args.destinationAddress, // V1: encrypt later with KMS
      deliveryFee: fee,
      rewardAmount: caseRow.rewardAmount,
      currency: caseRow.rewardCurrency ?? "CDF",
      onlyVerifiedOwner: SAFEFIND_DEFAULT_CONFIG.DELIVERY_ONLY_VERIFIED_OWNER,
      provider: "internal",
    })
    .onConflictDoUpdate({
      target: [safefindDeliveryRequests.caseId],
      set: {
        status: "requested",
        destinationCommune: args.destinationCommune,
        destinationQuartier: args.destinationQuartier ?? null,
        destinationAddressHash: addrHash,
        destinationAddressEnc: args.destinationAddress,
        deliveryFee: fee,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .update(safefindCases)
    .set({
      status: "DELIVERY_REQUESTED",
      restitutionMode: "delivery",
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, caseRow.id));

  await db.insert(safefindDeliveryEvents).values({
    deliveryId: delivery.id,
    eventType: "DELIVERY_REQUESTED",
    actorUserId: args.ownerUserId,
    actorRole: "owner",
  });
  await appendCustodyEvent({
    caseId: caseRow.id,
    eventType: "DELIVERY_REQUESTED",
    actorUserId: args.ownerUserId,
    actorRole: "owner",
    partnerId: caseRow.currentPartnerId,
    newValue: { status: "DELIVERY_REQUESTED" },
  });

  return {
    deliveryId: delivery.id,
    breakdown: {
      finderReward: caseRow.rewardAmount,
      deliveryFee: fee,
      currency: caseRow.rewardCurrency ?? "CDF",
      total:
        String(
          Number(caseRow.rewardAmount ?? 0) + Number(fee),
        ),
    },
  };
}

export async function authorizeDelivery(args: {
  adminUserId: string;
  deliveryId: string;
}) {
  const db = getDb();
  const [d] = await db
    .select()
    .from(safefindDeliveryRequests)
    .where(eq(safefindDeliveryRequests.id, args.deliveryId))
    .limit(1);
  if (!d) throw new Error("not_found");

  const assign = await getDeliveryProvider().assign({
    deliveryId: d.id,
    pickupPartnerId: d.partnerId ?? "",
    destinationCommune: d.destinationCommune,
    destinationQuartier: d.destinationQuartier,
  });
  if (!assign.accepted) throw new Error("provider_rejected");

  await db
    .update(safefindDeliveryRequests)
    .set({ status: "authorized", updatedAt: new Date() })
    .where(eq(safefindDeliveryRequests.id, d.id));
  await db
    .update(safefindCases)
    .set({ status: "DELIVERY_AUTHORIZED", updatedAt: new Date() })
    .where(eq(safefindCases.id, d.caseId));
  await db.insert(safefindDeliveryEvents).values({
    deliveryId: d.id,
    eventType: "DELIVERY_AUTHORIZED",
    actorUserId: args.adminUserId,
    actorRole: "admin",
  });
  return { ok: true as const };
}

export async function confirmDeliveryToOwner(args: {
  courierUserId: string;
  deliveryId: string;
  otp: string;
  recipientIsVerifiedOwner: boolean;
}) {
  const db = getDb();
  const [d] = await db
    .select()
    .from(safefindDeliveryRequests)
    .where(eq(safefindDeliveryRequests.id, args.deliveryId))
    .limit(1);
  if (!d) throw new Error("not_found");
  if (d.onlyVerifiedOwner && !args.recipientIsVerifiedOwner) {
    throw new Error("only_verified_owner");
  }
  if (!d.deliveryOtpHash || hashOtp(args.otp) !== d.deliveryOtpHash) {
    throw new Error("otp_invalid");
  }
  if (
    d.deliveryOtpExpiresAt &&
    d.deliveryOtpExpiresAt.getTime() < Date.now()
  ) {
    throw new Error("otp_expired");
  }

  await db
    .update(safefindDeliveryRequests)
    .set({ status: "delivered", updatedAt: new Date() })
    .where(eq(safefindDeliveryRequests.id, d.id));
  await db
    .update(safefindCases)
    .set({ status: "DELIVERED", updatedAt: new Date() })
    .where(eq(safefindCases.id, d.caseId));
  await db.insert(safefindDeliveryEvents).values({
    deliveryId: d.id,
    eventType: "DELIVERED",
    actorUserId: args.courierUserId,
    actorRole: "courier",
  });
  await appendCustodyEvent({
    caseId: d.caseId,
    eventType: "DELIVERED",
    actorUserId: args.courierUserId,
    actorRole: "courier",
    newValue: { status: "DELIVERED" },
  });
  return { status: "DELIVERED" as const };
}

export async function failDelivery(args: {
  courierUserId: string;
  deliveryId: string;
  reason?: string;
}) {
  const db = getDb();
  const [d] = await db
    .select()
    .from(safefindDeliveryRequests)
    .where(eq(safefindDeliveryRequests.id, args.deliveryId))
    .limit(1);
  if (!d) throw new Error("not_found");

  await db
    .update(safefindDeliveryRequests)
    .set({
      status: "failed",
      failureReason: args.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(safefindDeliveryRequests.id, d.id));
  await db
    .update(safefindCases)
    .set({ status: "DELIVERY_FAILED", updatedAt: new Date() })
    .where(eq(safefindCases.id, d.caseId));
  await db.insert(safefindDeliveryEvents).values({
    deliveryId: d.id,
    eventType: "DELIVERY_FAILED",
    actorUserId: args.courierUserId,
    actorRole: "courier",
    meta: { reason: args.reason ?? null },
  });
  return { status: "DELIVERY_FAILED" as const };
}

export async function confirmReturnToPartner(args: {
  agentUserId: string;
  deliveryId: string;
}) {
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const [d] = await db
    .select()
    .from(safefindDeliveryRequests)
    .where(eq(safefindDeliveryRequests.id, args.deliveryId))
    .limit(1);
  if (!d) throw new Error("not_found");
  if (d.partnerId !== agent.partnerId) throw new Error("partner_case_forbidden");

  await db
    .update(safefindDeliveryRequests)
    .set({ status: "returned", updatedAt: new Date() })
    .where(eq(safefindDeliveryRequests.id, d.id));
  await db
    .update(safefindCases)
    .set({
      status: "READY_FOR_PICKUP",
      updatedAt: new Date(),
    })
    .where(eq(safefindCases.id, d.caseId));
  await appendCustodyEvent({
    caseId: d.caseId,
    eventType: "RETURN_TO_PARTNER",
    actorUserId: args.agentUserId,
    actorRole: agent.role,
    partnerId: agent.partnerId,
    newValue: { status: "READY_FOR_PICKUP" },
  });
  return { status: "READY_FOR_PICKUP" as const };
}

/** Public fee breakdown for owner UI - no mystery totals. */
export function feeBreakdown(args: {
  rewardAmount: string | null;
  deliveryFee: string | null;
  partnerCommission?: string | null;
  platformFee?: string | null;
  currency: string;
}) {
  const reward = Number(args.rewardAmount ?? 0);
  const delivery = Number(args.deliveryFee ?? 0);
  const partner = Number(args.partnerCommission ?? 0);
  const platform = Number(args.platformFee ?? 0);
  return {
    finderReward: String(reward),
    deliveryFee: String(delivery),
    partnerCommission: String(partner),
    platformFee: String(platform),
    currency: args.currency,
    total: String(reward + delivery + partner + platform),
  };
}

/** Owner must never see finder identity. */
export function ownerFacingCustodySummary(status: string, heldByFinder: boolean) {
  if (heldByFinder || status === "HELD_BY_FINDER") {
    return {
      situation: "held_by_finder",
      label: "Actuellement detenu par le trouveur",
      tone: "caution",
    };
  }
  if (
    status === "DEPOSITED_AT_PARTNER" ||
    status === "STORED_AT_LOCATION" ||
    status === "PICKUP_RESERVED" ||
    status === "READY_FOR_PICKUP" ||
    status === "READY_FOR_COLLECTION"
  ) {
    return {
      situation: "at_partner",
      label: "Securise chez un partenaire",
      tone: "ok",
    };
  }
  if (status.startsWith("DELIVERY") || status === "IN_TRANSIT" || status === "ARRIVED") {
    return {
      situation: "in_delivery",
      label: "En livraison",
      tone: "info",
    };
  }
  return { situation: "other", label: status, tone: "muted" };
}


/** Suggest storage zone by document type (A=electeur, B=permis, C=passeport). */
export function preferredZoneCodeForDocument(documentType: string): string {
  if (documentType === "carte_electeur") return "A";
  if (documentType === "permis_conduire") return "B";
  if (documentType === "passeport") return "C";
  return "A";
}

export async function suggestStorageSlot(args: {
  agentUserId: string;
  casePublicId: string;
}) {
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow || caseRow.currentPartnerId !== agent.partnerId) {
    throw new Error("partner_case_forbidden");
  }
  const zoneCode = preferredZoneCodeForDocument(caseRow.documentType);
  const zones = await db
    .select()
    .from(safefindStorageZones)
    .where(
      and(
        eq(safefindStorageZones.partnerId, agent.partnerId),
        eq(safefindStorageZones.active, true),
      ),
    );
  const preferred =
    zones.find((z) => z.code.toUpperCase() === zoneCode) ??
    zones.find((z) => {
      const prefs = (z.preferredDocumentTypes as string[] | null) ?? [];
      return prefs.includes(caseRow.documentType);
    }) ??
    zones[0];
  if (!preferred) {
    return { zone: null, location: null, path: null as string | null };
  }
  const [slot] = await db
    .select()
    .from(safefindStorageLocations)
    .where(
      and(
        eq(safefindStorageLocations.partnerId, agent.partnerId),
        eq(safefindStorageLocations.zoneId, preferred.id),
        eq(safefindStorageLocations.occupied, false),
      ),
    )
    .limit(1);
  const path = slot
    ? `${preferred.code}-${slot.rackCode}-${slot.binCode}${slot.positionCode ? `-${slot.positionCode}` : ""}`
    : preferred.code;
  return { zone: preferred, location: slot ?? null, path };
}

/** Documents deposited without identified owner past retention threshold. */
export async function listOrphanCases(args?: { minAgeDays?: number; limit?: number }) {
  const db = getDb();
  const minDays =
    args?.minAgeDays ?? SAFEFIND_DEFAULT_CONFIG.ORPHAN_ALERT_DAYS;
  const limit = args?.limit ?? 100;
  const cutoff = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: safefindCases.id,
      publicId: safefindCases.publicId,
      documentType: safefindCases.documentType,
      status: safefindCases.status,
      partnerId: safefindCases.currentPartnerId,
      storageLocationId: safefindCases.storageLocationId,
      foundCommune: safefindCases.foundCommune,
      createdAt: safefindCases.createdAt,
      ownerUserId: safefindCases.ownerUserId,
    })
    .from(safefindCases)
    .where(
      and(
        sql`${safefindCases.ownerUserId} is null`,
        sql`${safefindCases.status} in ('DEPOSITED_AT_PARTNER','STORED_AT_LOCATION','READY_FOR_COLLECTION','MATCH_CANDIDATE')`,
        sql`${safefindCases.createdAt} < ${cutoff}`,
      ),
    )
    .limit(limit);

  return rows.map((r) => {
    const ageDays = Math.floor(
      (Date.now() - new Date(r.createdAt).getTime()) / (24 * 60 * 60 * 1000),
    );
    const actionRequired =
      ageDays >= SAFEFIND_DEFAULT_CONFIG.ORPHAN_ACTION_DAYS;
    return {
      ...r,
      ageDays,
      actionRequired,
      severity: actionRequired ? "high" : ageDays >= minDays ? "medium" : "low",
    };
  });
}

export async function requestPreparePickup(args: {
  agentUserId: string;
  casePublicId: string;
}) {
  const agent = await getPartnerAgent(args.agentUserId);
  if (!agent) throw new Error("partner_forbidden");
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.publicId, args.casePublicId))
    .limit(1);
  if (!caseRow || caseRow.currentPartnerId !== agent.partnerId) {
    throw new Error("partner_case_forbidden");
  }
  await db
    .update(safefindPickupReservations)
    .set({ status: "preparing", updatedAt: new Date() })
    .where(eq(safefindPickupReservations.caseId, caseRow.id));
  await writeAudit({
    caseId: caseRow.id,
    action: "PICKUP_PREPARE_REQUESTED",
    actorUserId: args.agentUserId,
  });
  return { status: "preparing" as const };
}
