/**
 * Anti-fraud heuristics for SafeFind V1.
 * Never auto-pay when suspicious.
 */

export type AntifraudContext = {
  finderUserId: string | null;
  finderKycApproved: boolean;
  finderOpenFoundCount: number;
  finderDisputeCount: number;
  finderTrustScore: number;
  caseHadPartnerCustody: boolean;
  caseStatus: string;
  declarationKind: "found" | "lost" | "owner_claim";
  sameDocHashExists: boolean;
  partnerIncidentOpen: boolean;
  geoInconsistent: boolean;
};

export type AntifraudVerdict = {
  suspicious: boolean;
  blockAutoReward: boolean;
  requireManualReview: boolean;
  reasons: string[];
  suggestedStatus?: "DISPUTED" | "LOCKED";
};

export function evaluateAntifraud(ctx: AntifraudContext): AntifraudVerdict {
  const reasons: string[] = [];

  if (ctx.declarationKind === "found" && ctx.sameDocHashExists && ctx.caseHadPartnerCustody) {
    reasons.push("refound_after_custody");
  }
  if (ctx.partnerIncidentOpen) {
    reasons.push("open_partner_incident");
  }
  if (ctx.finderOpenFoundCount > 3 && !ctx.finderKycApproved) {
    reasons.push("many_finds_without_kyc");
  }
  if (ctx.finderDisputeCount >= 2) {
    reasons.push("repeat_disputes");
  }
  if (ctx.finderTrustScore < 25) {
    reasons.push("low_trust");
  }
  if (ctx.geoInconsistent) {
    reasons.push("geo_inconsistent");
  }
  if (ctx.caseStatus === "DEPOSITED_AT_PARTNER" && ctx.declarationKind === "found") {
    reasons.push("found_while_in_partner_custody");
  }

  const suspicious = reasons.length > 0;
  const blockAutoReward =
    suspicious ||
    reasons.includes("refound_after_custody") ||
    reasons.includes("found_while_in_partner_custody");

  return {
    suspicious,
    blockAutoReward,
    requireManualReview: blockAutoReward || ctx.finderTrustScore < 40,
    reasons,
    suggestedStatus: blockAutoReward ? "DISPUTED" : undefined,
  };
}

/**
 * Finder trust score 0..100 — not just restitution count.
 */
export function computeFinderTrustScore(components: {
  kycApproved: boolean;
  successfulReturns: number;
  openDisputes: number;
  rejectedClaims: number;
  accountAgeDays: number;
  falseFoundFlags: number;
}): number {
  let score = 40;
  if (components.kycApproved) score += 20;
  score += Math.min(20, components.successfulReturns * 5);
  score += Math.min(10, Math.floor(components.accountAgeDays / 30));
  score -= components.openDisputes * 15;
  score -= components.rejectedClaims * 8;
  score -= components.falseFoundFlags * 20;
  return Math.max(0, Math.min(100, score));
}

export function computePartnerSecurityScore(components: {
  documentsReceived: number;
  documentsReturned: number;
  incidents: number;
  avgHoursToReturn: number | null;
  disputes: number;
  procedureCompliance: number;
}): number {
  let score = 50;
  const ratio =
    components.documentsReceived > 0
      ? components.documentsReturned / components.documentsReceived
      : 0.5;
  score += Math.round(ratio * 25);
  score -= components.incidents * 12;
  score -= components.disputes * 8;
  if (components.avgHoursToReturn != null) {
    if (components.avgHoursToReturn <= 48) score += 10;
    else if (components.avgHoursToReturn > 168) score -= 10;
  }
  score += Math.round((components.procedureCompliance / 100) * 15);
  return Math.max(0, Math.min(100, score));
}
