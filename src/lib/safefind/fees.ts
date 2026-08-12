import {
  SAFEFIND_DEFAULT_REWARDS,
  type SafefindDocType,
} from "@/lib/safefind/types";

/** Owner transaction fee on top of base reward (MoMo / PawaPay). */
export const SAFEFIND_TX_FEE_RATE = 0.05;
/** Partner share of base reward when owner pays restitution. */
export const SAFEFIND_PARTNER_COMMISSION_RATE = 0.1;
/** Platform treasury share of base reward. */
export const SAFEFIND_TREASURY_RATE = 0.1;
/** Finder withdrawal network fee: 5% of partner commission. */
export const SAFEFIND_FINDER_WITHDRAWAL_NETWORK_RATE = 0.05;

export type RestitutionFeeBreakdown = {
  documentType: SafefindDocType;
  baseReward: string;
  transactionFee: string;
  ownerTotal: string;
  partnerCommission: string;
  treasury: string;
  finderGross: string;
  finderNetworkFee: string;
  finderNetPayout: string;
  currency: "CDF";
};

function roundCdf(n: number): number {
  return Math.round(n);
}

export function baseRewardForDocType(documentType: SafefindDocType): number {
  return Number(SAFEFIND_DEFAULT_REWARDS[documentType].base);
}

/** Standard restitution fee split for owner payment + finder payout. */
export function computeRestitutionFees(
  documentType: SafefindDocType,
  baseRewardOverride?: string | number | null,
): RestitutionFeeBreakdown {
  const base = roundCdf(
    Number(baseRewardOverride ?? SAFEFIND_DEFAULT_REWARDS[documentType].base),
  );
  const transactionFee = roundCdf(base * SAFEFIND_TX_FEE_RATE);
  const ownerTotal = base + transactionFee;
  const partnerCommission = roundCdf(base * SAFEFIND_PARTNER_COMMISSION_RATE);
  const treasury = roundCdf(base * SAFEFIND_TREASURY_RATE);
  const finderGross = base - partnerCommission - treasury;
  const finderNetworkFee = roundCdf(
    partnerCommission * SAFEFIND_FINDER_WITHDRAWAL_NETWORK_RATE,
  );
  const finderNetPayout = finderGross - finderNetworkFee;

  return {
    documentType,
    baseReward: String(base),
    transactionFee: String(transactionFee),
    ownerTotal: String(ownerTotal),
    partnerCommission: String(partnerCommission),
    treasury: String(treasury),
    finderGross: String(finderGross),
    finderNetworkFee: String(finderNetworkFee),
    finderNetPayout: String(finderNetPayout),
    currency: "CDF",
  };
}

/** Public owner-facing breakdown (reward + tx fee + optional delivery). */
export function ownerPaymentBreakdown(args: {
  documentType: SafefindDocType;
  baseReward?: string | null;
  deliveryFee?: string | null;
}) {
  const fees = computeRestitutionFees(args.documentType, args.baseReward);
  const delivery = roundCdf(Number(args.deliveryFee ?? 0));
  return {
    ...fees,
    deliveryFee: String(delivery),
    totalDue: String(Number(fees.ownerTotal) + delivery),
  };
}
