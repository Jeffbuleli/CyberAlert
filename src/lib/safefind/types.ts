/** SafeFind domain constants & types (no DB I/O). */

export const SAFEFIND_CASE_STATUSES = [
  "LOST",
  "FOUND",
  "REGISTERED",
  "DEPOSIT_PENDING",
  "DEPOSITED_AT_PARTNER",
  "MATCH_CANDIDATE",
  "OWNER_VERIFICATION",
  "READY_FOR_COLLECTION",
  "COLLECTED",
  "RETURNED",
  "REWARD_PENDING",
  "REWARD_RELEASED",
  "DISPUTED",
  "PARTNER_INCIDENT",
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
  "PARTNER_INCIDENT_REPORTED",
  "DOCUMENT_REFOUND",
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

/** Default review windows (ms) — overridable via safefind_config. */
export const SAFEFIND_DEFAULT_CONFIG = {
  INITIAL_REVIEW_WINDOW_MS: 72 * 60 * 60 * 1000,
  INCIDENT_REVIEW_WINDOW_MS: 168 * 60 * 60 * 1000,
  COLLECTION_OTP_TTL_MS: 48 * 60 * 60 * 1000,
  MATCH_AUTO_VERIFY_THRESHOLD: 85,
  MATCH_CANDIDATE_THRESHOLD: 40,
  MAX_OPEN_FOUND_WITHOUT_KYC: 1,
  NEARBY_PARTNER_RADIUS_KM: 8,
} as const;

/** Seed reward policies (CDF) — DB is source of truth after seed. */
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
