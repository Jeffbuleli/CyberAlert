/**
 * Reward ownership — one primary reward per case.
 * A re-finder after partner incident does NOT auto-create a second reward.
 */

export type RewardOwnershipState = {
  caseId: string;
  initialFinderUserId: string | null;
  rewardOwnerUserId: string | null;
  rewardStatus: string;
  rewardFrozen: boolean;
  caseStatus: string;
  hasOpenDispute: boolean;
  hasOpenIncident: boolean;
  reportedStolen: boolean;
};

export type RewardDecision =
  | { ok: true; beneficiaryUserId: string; action: "authorize" | "keep_locked" }
  | {
      ok: false;
      reason:
        | "frozen"
        | "disputed"
        | "stolen"
        | "no_beneficiary"
        | "wrong_status"
        | "already_paid"
        | "incident_review"
        | "kyc_required"
        | "manual_review_required";
    };

/**
 * Who currently holds the reward right.
 * Transfer only via explicit admin/rule — never by simple elapsed time alone.
 */
export function resolveRewardOwner(state: RewardOwnershipState): string | null {
  return state.rewardOwnerUserId ?? state.initialFinderUserId;
}

export function canAuthorizeReward(args: {
  ownership: RewardOwnershipState;
  beneficiaryKycApproved: boolean;
  requireKyc: boolean;
}): RewardDecision {
  const o = args.ownership;
  if (o.rewardStatus === "PAID") {
    return { ok: false, reason: "already_paid" };
  }
  if (o.rewardFrozen) return { ok: false, reason: "frozen" };
  if (o.hasOpenDispute || o.rewardStatus === "DISPUTED") {
    return { ok: false, reason: "disputed" };
  }
  if (o.reportedStolen || o.caseStatus === "REPORTED_STOLEN") {
    return { ok: false, reason: "stolen" };
  }
  if (o.hasOpenIncident || o.caseStatus === "PARTNER_INCIDENT") {
    return { ok: false, reason: "incident_review" };
  }
  if (o.caseStatus !== "RETURNED" && o.caseStatus !== "REWARD_PENDING") {
    return { ok: false, reason: "wrong_status" };
  }
  const beneficiary = resolveRewardOwner(o);
  if (!beneficiary) return { ok: false, reason: "no_beneficiary" };
  if (args.requireKyc && !args.beneficiaryKycApproved) {
    return { ok: false, reason: "kyc_required" };
  }
  if (o.rewardStatus === "LOCKED") {
    return { ok: false, reason: "manual_review_required" };
  }
  return { ok: true, beneficiaryUserId: beneficiary, action: "authorize" };
}

/**
 * When K re-finds a document after A deposited and an incident occurred:
 * - do NOT create a second reward row
 * - keep initial finder as owner unless admin transfers
 * - lock reward pending review
 */
export function onDocumentRefoundDecision(args: {
  initialFinderUserId: string | null;
  recoveryFinderUserId: string;
  hadPartnerCustody: boolean;
}): {
  createSecondReward: false;
  rewardOwnerUserId: string | null;
  lockReward: boolean;
  notifyInitialFinder: boolean;
  notifyPartner: boolean;
  neutralMessageForRecoveryFinder: string;
} {
  return {
    createSecondReward: false,
    rewardOwnerUserId: args.initialFinderUserId,
    lockReward: args.hadPartnerCustody,
    notifyInitialFinder: Boolean(args.initialFinderUserId),
    notifyPartner: args.hadPartnerCustody,
    neutralMessageForRecoveryFinder:
      "Votre déclaration a bien été enregistrée. Veuillez déposer le document dans le point indiqué.",
  };
}

export function shouldOpenDuplicateDispute(args: {
  openClaimsCount: number;
}): boolean {
  return args.openClaimsCount >= 2;
}
