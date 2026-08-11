import type { SafefindCaseStatus } from "./types";

/**
 * Allowed status transitions. Custody events must be appended separately -
 * never mutate partner assignment without an event.
 */
const TRANSITIONS: Record<SafefindCaseStatus, readonly SafefindCaseStatus[]> = {
  LOST: ["MATCH_CANDIDATE", "OWNER_VERIFICATION", "CANCELLED", "EXPIRED", "REPORTED_STOLEN"],
  FOUND: [
    "REGISTERED",
    "HELD_BY_FINDER",
    "DEPOSIT_PENDING",
    "DISPUTED",
    "CANCELLED",
    "REPORTED_STOLEN",
    "POTENTIAL_CHAIN_BREAK",
  ],
  REGISTERED: [
    "HELD_BY_FINDER",
    "DEPOSIT_PENDING",
    "DEPOSITED_AT_PARTNER",
    "DISPUTED",
    "CANCELLED",
    "REPORTED_STOLEN",
  ],
  HELD_BY_FINDER: [
    "DEPOSIT_PENDING",
    "DEPOSITED_AT_PARTNER",
    "MATCH_CANDIDATE",
    "OWNER_VERIFICATION",
    "DISPUTED",
    "POTENTIAL_CHAIN_BREAK",
    "CANCELLED",
    "REPORTED_STOLEN",
  ],
  DEPOSIT_PENDING: [
    "DEPOSITED_AT_PARTNER",
    "HELD_BY_FINDER",
    "CANCELLED",
    "DISPUTED",
    "REPORTED_STOLEN",
  ],
  DEPOSITED_AT_PARTNER: [
    "STORED_AT_LOCATION",
    "MATCH_CANDIDATE",
    "OWNER_VERIFICATION",
    "READY_FOR_COLLECTION",
    "PICKUP_RESERVED",
    "DELIVERY_REQUESTED",
    "PARTNER_INCIDENT",
    "DISPUTED",
    "REPORTED_STOLEN",
    "EXPIRED",
    "POTENTIAL_CHAIN_BREAK",
  ],
  STORED_AT_LOCATION: [
    "DEPOSITED_AT_PARTNER",
    "PICKUP_RESERVED",
    "READY_FOR_PICKUP",
    "READY_FOR_COLLECTION",
    "DELIVERY_REQUESTED",
    "PARTNER_INCIDENT",
    "DISPUTED",
    "EXPIRED",
  ],
  MATCH_CANDIDATE: [
    "OWNER_VERIFICATION",
    "DEPOSITED_AT_PARTNER",
    "HELD_BY_FINDER",
    "DISPUTED",
    "REPORTED_STOLEN",
  ],
  OWNER_VERIFICATION: [
    "READY_FOR_COLLECTION",
    "PICKUP_RESERVED",
    "DELIVERY_REQUESTED",
    "HELD_BY_FINDER",
    "MATCH_CANDIDATE",
    "DISPUTED",
    "REPORTED_STOLEN",
  ],
  PICKUP_RESERVED: [
    "READY_FOR_PICKUP",
    "READY_FOR_COLLECTION",
    "DISPUTED",
    "PARTNER_INCIDENT",
    "CANCELLED",
    "EXPIRED",
  ],
  READY_FOR_PICKUP: [
    "COLLECTED",
    "READY_FOR_COLLECTION",
    "DISPUTED",
    "PARTNER_INCIDENT",
    "EXPIRED",
  ],
  READY_FOR_COLLECTION: [
    "PICKUP_RESERVED",
    "READY_FOR_PICKUP",
    "COLLECTED",
    "DELIVERY_REQUESTED",
    "DISPUTED",
    "PARTNER_INCIDENT",
    "REPORTED_STOLEN",
    "EXPIRED",
  ],
  COLLECTED: ["RETURNED", "DISPUTED"],
  RETURNED: ["REWARD_PENDING", "DISPUTED"],
  REWARD_PENDING: ["REWARD_RELEASED", "DISPUTED"],
  REWARD_RELEASED: [],
  DELIVERY_REQUESTED: [
    "DELIVERY_AUTHORIZED",
    "CANCELLED",
    "DISPUTED",
    "READY_FOR_COLLECTION",
  ],
  DELIVERY_AUTHORIZED: ["COURIER_ASSIGNED", "CANCELLED", "DISPUTED"],
  COURIER_ASSIGNED: ["PICKUP_FROM_PARTNER", "CANCELLED", "DISPUTED"],
  PICKUP_FROM_PARTNER: ["IN_TRANSIT", "RETURN_TO_PARTNER", "DISPUTED"],
  IN_TRANSIT: ["ARRIVED", "DELIVERY_FAILED", "DISPUTED"],
  ARRIVED: ["DELIVERED", "DELIVERY_FAILED", "DISPUTED"],
  DELIVERED: ["RETURNED", "REWARD_PENDING"],
  DELIVERY_FAILED: ["RETURN_TO_PARTNER", "IN_TRANSIT", "CANCELLED"],
  RETURN_TO_PARTNER: [
    "DEPOSITED_AT_PARTNER",
    "STORED_AT_LOCATION",
    "READY_FOR_PICKUP",
    "READY_FOR_COLLECTION",
    "DISPUTED",
  ],
  DISPUTED: [
    "DEPOSITED_AT_PARTNER",
    "HELD_BY_FINDER",
    "OWNER_VERIFICATION",
    "READY_FOR_COLLECTION",
    "READY_FOR_PICKUP",
    "RETURNED",
    "CANCELLED",
    "PARTNER_INCIDENT",
  ],
  PARTNER_INCIDENT: [
    "DEPOSITED_AT_PARTNER",
    "HELD_BY_FINDER",
    "DISPUTED",
    "CANCELLED",
    "REPORTED_STOLEN",
    "POTENTIAL_CHAIN_BREAK",
  ],
  POTENTIAL_CHAIN_BREAK: [
    "DISPUTED",
    "PARTNER_INCIDENT",
    "DEPOSITED_AT_PARTNER",
    "HELD_BY_FINDER",
    "CANCELLED",
  ],
  REPORTED_STOLEN: ["DISPUTED", "CANCELLED"],
  EXPIRED: ["CANCELLED"],
  CANCELLED: [],
};

export function canTransition(
  from: SafefindCaseStatus,
  to: SafefindCaseStatus,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: SafefindCaseStatus,
  to: SafefindCaseStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`safefind_invalid_transition:${from}->${to}`);
  }
}

export function isSensitiveActionBlocked(status: SafefindCaseStatus): boolean {
  return (
    status === "DISPUTED" ||
    status === "REPORTED_STOLEN" ||
    status === "CANCELLED" ||
    status === "PARTNER_INCIDENT" ||
    status === "POTENTIAL_CHAIN_BREAK"
  );
}

export function isRewardPayableStatus(status: SafefindCaseStatus): boolean {
  return (
    status === "RETURNED" ||
    status === "REWARD_PENDING" ||
    status === "DELIVERED"
  );
}

export function isAtPartner(status: SafefindCaseStatus): boolean {
  return (
    status === "DEPOSITED_AT_PARTNER" ||
    status === "STORED_AT_LOCATION" ||
    status === "PICKUP_RESERVED" ||
    status === "READY_FOR_PICKUP" ||
    status === "READY_FOR_COLLECTION"
  );
}

export function isInDelivery(status: SafefindCaseStatus): boolean {
  return (
    status === "DELIVERY_REQUESTED" ||
    status === "DELIVERY_AUTHORIZED" ||
    status === "COURIER_ASSIGNED" ||
    status === "PICKUP_FROM_PARTNER" ||
    status === "IN_TRANSIT" ||
    status === "ARRIVED"
  );
}
