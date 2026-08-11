import type { SafefindDocType } from "./types";

export type MatchSignalInput = {
  documentType: string;
  holderFirstName?: string | null;
  holderLastName?: string | null;
  documentNumberHash?: string | null;
  documentNumberLast4?: string | null;
  foundCommune?: string | null;
  lostCommune?: string | null;
  foundApproxDate?: Date | null;
  lostApproxDate?: Date | null;
  appearanceMeta?: Record<string, unknown> | null;
  visualNotes?: string | null;
};

export type MatchClaimInput = {
  documentType: string;
  firstName?: string | null;
  lastName?: string | null;
  documentNumber?: string | null;
  documentNumberLast4?: string | null;
  lostCommune?: string | null;
  lostApproxDate?: Date | null;
  appearanceHints?: Record<string, unknown> | null;
  notes?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function nameOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.startsWith(b) || b.startsWith(a)) return 0.7;
  if (a[0] === b[0] && a.length > 2 && b.length > 2) return 0.35;
  return 0;
}

function daysApart(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * Multi-signal match score 0..100.
 * High score triggers verification — never automatic ownership proof.
 */
export function computeMatchScore(
  caseRow: MatchSignalInput,
  claim: MatchClaimInput,
): { score: number; signals: Record<string, number | boolean> } {
  const signals: Record<string, number | boolean> = {};
  let score = 0;

  if (caseRow.documentType === claim.documentType) {
    score += 20;
    signals.documentType = true;
  } else {
    signals.documentType = false;
    return { score: 0, signals };
  }

  const fn = nameOverlap(norm(caseRow.holderFirstName), norm(claim.firstName));
  const ln = nameOverlap(norm(caseRow.holderLastName), norm(claim.lastName));
  const namePts = Math.round((fn * 15 + ln * 20));
  score += namePts;
  signals.nameScore = namePts;

  if (claim.documentNumber && caseRow.documentNumberHash) {
    // caller should pass pre-hashed comparison via last4 or exact hash match flag
  }
  if (
    claim.documentNumberLast4 &&
    caseRow.documentNumberLast4 &&
    claim.documentNumberLast4 === caseRow.documentNumberLast4
  ) {
    score += 25;
    signals.last4 = true;
  }

  if (
    claim.lostCommune &&
    caseRow.foundCommune &&
    norm(claim.lostCommune) === norm(caseRow.foundCommune)
  ) {
    score += 10;
    signals.commune = true;
  } else if (
    claim.lostCommune &&
    caseRow.lostCommune &&
    norm(claim.lostCommune) === norm(caseRow.lostCommune)
  ) {
    score += 8;
    signals.commune = true;
  }

  const gap = daysApart(claim.lostApproxDate, caseRow.foundApproxDate);
  if (gap != null) {
    if (gap <= 14) {
      score += 10;
      signals.dateProximity = 10;
    } else if (gap <= 60) {
      score += 5;
      signals.dateProximity = 5;
    }
  }

  if (claim.appearanceHints && caseRow.appearanceMeta) {
    let hits = 0;
    for (const [k, v] of Object.entries(claim.appearanceHints)) {
      if (caseRow.appearanceMeta[k] != null && caseRow.appearanceMeta[k] === v) {
        hits += 1;
      }
    }
    const appearancePts = Math.min(10, hits * 4);
    score += appearancePts;
    signals.appearance = appearancePts;
  }

  return { score: Math.min(100, score), signals };
}

/** Detect possible duplicate found declarations for the same physical doc. */
export function arePotentialDuplicateFounds(
  a: MatchSignalInput,
  b: MatchSignalInput,
): { duplicate: boolean; score: number } {
  if (a.documentType !== b.documentType) return { duplicate: false, score: 0 };

  let score = 20;
  if (
    a.documentNumberHash &&
    b.documentNumberHash &&
    a.documentNumberHash === b.documentNumberHash
  ) {
    return { duplicate: true, score: 100 };
  }
  if (
    a.documentNumberLast4 &&
    b.documentNumberLast4 &&
    a.documentNumberLast4 === b.documentNumberLast4
  ) {
    score += 30;
  }
  const fn = nameOverlap(norm(a.holderFirstName), norm(b.holderFirstName));
  const ln = nameOverlap(norm(a.holderLastName), norm(b.holderLastName));
  score += Math.round(fn * 15 + ln * 20);
  if (norm(a.foundCommune) && norm(a.foundCommune) === norm(b.foundCommune)) {
    score += 10;
  }
  return { duplicate: score >= 55, score };
}

export function documentTypeLabel(t: SafefindDocType | string): string {
  const map: Record<string, string> = {
    carte_electeur: "Carte d'électeur",
    passeport: "Passeport",
    permis_conduire: "Permis de conduire",
  };
  return map[t] ?? t;
}
