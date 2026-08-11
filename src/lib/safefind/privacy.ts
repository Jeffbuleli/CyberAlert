import { createHash, randomBytes, createHmac } from "node:crypto";

const REDACT_PEPPER =
  process.env.SAFEFIND_HASH_PEPPER ||
  process.env.SESSION_SECRET || process.env.JWT_SECRET ||
  "safefind-dev-pepper";

export function hashDocumentNumber(raw: string): string {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  return createHmac("sha256", REDACT_PEPPER).update(normalized).digest("hex");
}

export function last4DocumentNumber(raw: string): string {
  const n = raw.trim().replace(/\s+/g, "");
  if (n.length < 4) return n;
  return n.slice(-4);
}

export function maskName(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim();
  if (t.length <= 1) return "*";
  if (t.length === 2) return `${t[0]}*`;
  return `${t[0]}${"*".repeat(Math.min(t.length - 2, 6))}${t[t.length - 1]}`;
}

/** Public-safe case view - no full numbers, addresses, DOB, signatures. */
export function toPublicCaseView(row: {
  publicId: string;
  documentType: string;
  status: string;
  holderFirstName?: string | null;
  holderLastName?: string | null;
  foundCommune?: string | null;
  foundQuartier?: string | null;
  foundApproxDate?: Date | null;
  visualNotes?: string | null;
  appearanceMeta?: Record<string, unknown> | null;
  mediaRefs?: Array<{ kind: string; key: string; redacted: boolean }> | null;
  rewardAmount?: string | null;
  rewardCurrency?: string | null;
  createdAt: Date;
}) {
  return {
    publicId: row.publicId,
    documentType: row.documentType,
    status: publicStatusLabel(row.status),
    holderFirstNameMasked: maskName(row.holderFirstName),
    holderLastNameMasked: maskName(row.holderLastName),
    foundZone: {
      commune: row.foundCommune ?? null,
      quartier: row.foundQuartier ?? null,
    },
    foundApproxDate: row.foundApproxDate
      ? approximateDate(row.foundApproxDate)
      : null,
    appearance: sanitizeAppearance(row.appearanceMeta ?? {}),
    visualNotes: truncatePublic(row.visualNotes, 160),
    previewMedia: (row.mediaRefs ?? []).filter((m) => m.redacted),
    rewardHint:
      row.rewardAmount && row.rewardCurrency
        ? { amount: row.rewardAmount, currency: row.rewardCurrency }
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function publicStatusLabel(status: string): string {
  const map: Record<string, string> = {
    FOUND: "declare",
    REGISTERED: "enregistre",
    DEPOSIT_PENDING: "depot_en_attente",
    DEPOSITED_AT_PARTNER: "securise",
    STORED_AT_LOCATION: "securise",
    HELD_BY_FINDER: "chez_trouveur",
    MATCH_CANDIDATE: "correspondance",
    OWNER_VERIFICATION: "verification",
    PICKUP_RESERVED: "retrait_reserve",
    READY_FOR_PICKUP: "pret_retrait",
    READY_FOR_COLLECTION: "pret_retrait",
    DELIVERY_REQUESTED: "livraison",
    DELIVERY_AUTHORIZED: "livraison",
    IN_TRANSIT: "livraison",
    DELIVERED: "remis",
    COLLECTED: "remis",
    RETURNED: "restitue",
    REWARD_PENDING: "recompense_en_cours",
    REWARD_RELEASED: "clos",
    DISPUTED: "en_litige",
    PARTNER_INCIDENT: "incident",
    REPORTED_STOLEN: "signale",
    LOST: "perdu",
    EXPIRED: "expire",
    CANCELLED: "annule",
  };
  return map[status] ?? "en_cours";
}

function approximateDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function sanitizeAppearance(meta: Record<string, unknown>) {
  const allowed = ["color", "condition", "cover", "language", "wear"];
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (meta[k] != null) out[k] = meta[k];
  }
  return out;
}

function truncatePublic(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function hashOtp(otp: string): string {
  return createHash("sha256")
    .update(`${REDACT_PEPPER}:otp:${otp}`)
    .digest("hex");
}

export function generateCollectionOtp(): string {
  const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  return String(n).padStart(6, "0");
}

export function custodyEventHash(payload: {
  caseId: string;
  eventType: string;
  actorUserId: string | null;
  partnerId: string | null;
  createdAtIso: string;
  previousValue: unknown;
  newValue: unknown;
}): string {
  const raw = JSON.stringify(payload);
  return createHmac("sha256", REDACT_PEPPER).update(raw).digest("hex");
}
