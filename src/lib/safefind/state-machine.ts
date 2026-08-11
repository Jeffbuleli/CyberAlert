import type { SafefindCaseStatus } from "./types";

/**
 * Allowed status transitions. Custody events must be appended separately —
 * never mutate partner assignment without an event.
 */
const TRANSITIONS: Record<SafefindCaseStatus, readonly SafefindCaseStatus[]> = {
  LOST: ["MATCH_CANDIDATE", "OWNER_VERIFICATION", "CANCELLED", "EXPIRED", "REPORTED_STOLEN"],
  FOUND: [
    "REGISTERED",
    "DEPOSIT_PENDING",
    "DISPUTED",
    "CANCELLED",
    "REPORTED_STOLEN",
  ],
  REGISTERED: [
    "DEPOSIT_PENDING",
    "DEPOSITED_AT_PARTNER",
    "DISPUTED",
    "CANCELLED",
    "REPORTED_STOLEN",
  ],
  DEPOSIT_PENDING: [
    "DEPOSITED_AT_PARTNER",
    "CANCELLED",
    "DISPUTED",
    "REPORTED_STOLEN",
  ],
  DEPOSITED_AT_PARTNER: [
    "MATCH_CANDIDATE",
    "OWNER_VERIFICATION",
    "READY_FOR_COLLECTION",
    "PARTNER_INCIDENT",
    "DISPUTED",
    "REPORTED_STOLEN",
    "EXPIRED",
  ],
  MATCH_CANDIDATE: [
    "OWNER_VERIFICATION",
    "DEPOSITED_AT_PARTNER",
    "DISPUTED",
    "REPORTED_STOLEN",
  ],
  OWNER_VERIFICATION: [
    "READY_FOR_COLLECTION",
    "MATCH_CANDIDATE",
    "DISPUTED",
    "REPORTED_STOLEN",
  ],
  READY_FOR_COLLECTION: [
    "COLLECTED",
    "DISPUTED",
    "PARTNER_INCIDENT",
    "REPORTED_STOLEN",
    "EXPIRED",
  ],
  COLLECTED: ["RETURNED", "DISPUTED"],
  RETURNED: ["REWARD_PENDING", "DISPUTED"],
  REWARD_PENDING: ["REWARD_RELEASED", "DISPUTED"],
  REWARD_RELEASED: [],
  DISPUTED: [
    "DEPOSITED_AT_PARTNER",
    "OWNER_VERIFICATION",
    "READY_FOR_COLLECTION",
    "RETURNED",
    "CANCELLED",
    "PARTNER_INCIDENT",
  ],
  PARTNER_INCIDENT: [
    "DEPOSITED_AT_PARTNER",
    "DISPUTED",
    "CANCELLED",
    "REPORTED_STOLEN",
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

/** Terminal-ish statuses where sensitive actions must stop. */
export function isSensitiveActionBlocked(status: SafefindCaseStatus): boolean {
  return (
    status === "DISPUTED" ||
    status === "REPORTED_STOLEN" ||
    status === "CANCELLED" ||
    status === "PARTNER_INCIDENT"
  );
}

export function isRewardPayableStatus(status: SafefindCaseStatus): boolean {
  return status === "RETURNED" || status === "REWARD_PENDING";
}
