/** SafeFind domain constants and types (no DB I/O). */

export const SAFEFIND_CASE_STATUSES = [
  "LOST",
  "FOUND",
  "REGISTERED",
  "HELD_BY_FINDER",
  "DEPOSIT_PENDING",
  "DEPOSITED_AT_PARTNER",
  "STORED_AT_LOCATION",
  "MATCH_CANDIDATE",
  "OWNER_VERIFICATION",
  "PICKUP_RESERVED",
  "READY_FOR_PICKUP",
  "READY_FOR_COLLECTION",
  "COLLECTED",
  "RETURNED",
  "REWARD_PENDING",
  "REWARD_RELEASED",
  "DELIVERY_REQUESTED",
  "DELIVERY_AUTHORIZED",
  "COURIER_ASSIGNED",
  "PICKUP_FROM_PARTNER",
  "IN_TRANSIT",
  "ARRIVED",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURN_TO_PARTNER",
  "DISPUTED",
  "PARTNER_INCIDENT",
  "POTENTIAL_CHAIN_BREAK",
  "REPORTED_STOLEN",
  "EXPIRED",
  "CANCELLED",
] as const;

export type SafefindCaseStatus = (typeof SAFEFIND_CASE_STATUSES)[number];

export const SAFEFIND_REWARD_STATUSES = [
  "PENDING",
  "LOCKED",
  "AUTHORIZED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "DISPUTED",
] as const;

export type SafefindRewardStatus = (typeof SAFEFIND_REWARD_STATUSES)[number];

export const SAFEFIND_DOCUMENT_TYPES = [
  "carte_electeur",
  "passeport",
  "permis_conduire",
] as const;

export type SafefindDocType = (typeof SAFEFIND_DOCUMENT_TYPES)[number];

export const SAFEFIND_RESTITUTION_MODES = [
  "partner_pickup",
  "delivery",
  "request_partner_deposit",
  "secure_collection",
] as const;

export type SafefindRestitutionMode = (typeof SAFEFIND_RESTITUTION_MODES)[number];

export const SAFEFIND_CAPACITY_STATUSES = [
  "AVAILABLE",
  "NEAR_CAPACITY",
  "FULL",
  "SUSPENDED",
] as const;

export type SafefindCapacityStatus = (typeof SAFEFIND_CAPACITY_STATUSES)[number];

export const SAFEFIND_AUDIT_ACTIONS = [
  "CASE_CREATED",
  "DOCUMENT_FOUND",
  "DOCUMENT_LOST",
  "DOCUMENT_MATCHED",
  "OWNER_VERIFICATION_STARTED",
  "OWNER_VERIFIED",
  "PARTNER_SELECTED",
  "DEPOSIT_CREATED",
  "DEPOSIT_ACCEPTED",
  "CUSTODY_TRANSFERRED",
  "STORAGE_LOCATION_CHANGED",
  "PARTNER_INCIDENT_REPORTED",
  "DOCUMENT_REFOUND",
  "POTENTIAL_CHAIN_BREAK",
  "HELD_BY_FINDER",
  "PICKUP_RESERVED",
  "READY_FOR_PICKUP",
  "DELIVERY_REQUESTED",
  "DELIVERY_AUTHORIZED",
  "COURIER_ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURN_TO_PARTNER",
  "REWARD_LOCKED",
  "REWARD_AUTHORIZED",
  "REWARD_PAID",
  "DOCUMENT_COLLECTED",
  "CASE_CLOSED",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
  "CASE_FROZEN",
  "REPORTED_STOLEN",
] as const;

export type SafefindAuditAction = (typeof SAFEFIND_AUDIT_ACTIONS)[number];

export const SAFEFIND_INCIDENT_TYPES = [
  "burglary",
  "internal_loss",
  "misfile",
  "unrecorded_transfer",
  "security_issue",
  "missing_document",
  "damaged_document",
  "other",
] as const;

export type SafefindIncidentType = (typeof SAFEFIND_INCIDENT_TYPES)[number];

export const SAFEFIND_PARTNER_TYPES = [
  "banque",
  "maison_transfert",
  "agence",
  "commerce",
  "cybercafe",
  "boutique",
  "autre",
] as const;

/** Defaults overridable via safefind_config. */
export const SAFEFIND_DEFAULT_CONFIG = {
  INITIAL_REVIEW_WINDOW_MS: 72 * 60 * 60 * 1000,
  INCIDENT_REVIEW_WINDOW_MS: 168 * 60 * 60 * 1000,
  COLLECTION_OTP_TTL_MS: 48 * 60 * 60 * 1000,
  MATCH_AUTO_VERIFY_THRESHOLD: 85,
  MATCH_CANDIDATE_THRESHOLD: 40,
  MAX_OPEN_FOUND_WITHOUT_KYC: 1,
  NEARBY_PARTNER_RADIUS_KM: 8,
  PICKUP_SLOT_MINUTES: 15,
  PICKUP_SLOT_MAX_RESERVATIONS: 2,
  CAPACITY_NEAR_PCT: 70,
  CAPACITY_FULL_PCT: 90,
  /** Partner selection score weights (sum ~100). */
  SCORE_WEIGHT_DISTANCE: 35,
  SCORE_WEIGHT_CAPACITY: 30,
  SCORE_WEIGHT_SECURITY: 25,
  SCORE_WEIGHT_HOURS: 10,
  DEFAULT_DELIVERY_FEE_CDF: "8000",
  DELIVERY_ONLY_VERIFIED_OWNER: true,
} as const;

export const SAFEFIND_DEFAULT_REWARDS: Record<
  SafefindDocType,
  { base: string; maxBonus: string }
> = {
  carte_electeur: { base: "5000", maxBonus: "0" },
  permis_conduire: { base: "10000", maxBonus: "0" },
  passeport: { base: "20000", maxBonus: "0" },
};

export function isSafefindCaseStatus(s: string): s is SafefindCaseStatus {
  return (SAFEFIND_CASE_STATUSES as readonly string[]).includes(s);
}

export function isSafefindDocType(s: string): s is SafefindDocType {
  return (SAFEFIND_DOCUMENT_TYPES as readonly string[]).includes(s);
}

export function capacityStatusFromPct(
  pct: number,
  near = SAFEFIND_DEFAULT_CONFIG.CAPACITY_NEAR_PCT,
  full = SAFEFIND_DEFAULT_CONFIG.CAPACITY_FULL_PCT,
): Exclude<SafefindCapacityStatus, "SUSPENDED"> {
  if (pct >= full) return "FULL";
  if (pct >= near) return "NEAR_CAPACITY";
  return "AVAILABLE";
}
