import { eq } from "drizzle-orm";
import { getDb, safefindCases, safefindRewards, users } from "@/db";
import { getPawapayConfig } from "@/lib/env";
import {
  detectMomoMethod,
  formatPawapayAmount,
  normalizePhone,
  toPawapayProviderId,
} from "@/lib/payments/providers";
import { canAuthorizeReward } from "./reward-ownership";

function isEmailVerified(v: Date | null | undefined): boolean {
  return v != null;
}

async function pawapayPayOut(args: {
  payoutId: string;
  amount: string;
  currency: "USD" | "CDF";
  phoneNumber: string;
  provider: string;
  customerMessage?: string;
}): Promise<{ accepted: boolean; response: Record<string, unknown> }> {
  const cfg = getPawapayConfig();
  if (!cfg.token.trim()) throw new Error("pawapay_not_configured");
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/v2/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      payoutId: args.payoutId,
      amount: formatPawapayAmount(args.amount),
      currency: args.currency,
      recipient: {
        type: "MMO",
        accountDetails: {
          phoneNumber: args.phoneNumber,
          provider: args.provider,
        },
      },
      customerMessage: (args.customerMessage || "SafeFind reward").slice(0, 22),
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(json.status || "").toUpperCase();
  return {
    accepted: status === "ACCEPTED" || status === "DUPLICATE_IGNORED",
    response: json,
  };
}

export async function processSafefindRewardPayout(args: {
  rewardId: string;
  phoneNumber: string;
  provider: string;
  actorUserId?: string | null;
}): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const db = getDb();
  const [reward] = await db
    .select()
    .from(safefindRewards)
    .where(eq(safefindRewards.id, args.rewardId))
    .limit(1);
  if (!reward) return { ok: false, error: "reward_not_found" };
  if (reward.status === "PAID" || reward.status === "PROCESSING") {
    return { ok: true, reference: String(reward.payoutReference ?? reward.id) };
  }
  if (reward.status !== "AUTHORIZED") {
    return { ok: false, error: "reward_not_authorized" };
  }

  const [caseRow] = await db
    .select()
    .from(safefindCases)
    .where(eq(safefindCases.id, reward.caseId))
    .limit(1);
  if (!caseRow) return { ok: false, error: "case_not_found" };

  const [beneficiary] = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, reward.beneficiaryUserId))
    .limit(1);

  const decision = canAuthorizeReward({
    ownership: {
      caseId: caseRow.id,
      initialFinderUserId: caseRow.initialFinderUserId,
      rewardOwnerUserId: caseRow.rewardOwnerUserId,
      rewardStatus: reward.status,
      rewardFrozen: caseRow.rewardFrozen,
      caseStatus: caseRow.status,
      hasOpenDispute: caseRow.status === "DISPUTED",
      hasOpenIncident: caseRow.status === "PARTNER_INCIDENT",
      reportedStolen: caseRow.status === "REPORTED_STOLEN",
    },
    beneficiaryKycApproved: isEmailVerified(beneficiary?.emailVerifiedAt),
    requireKyc: true,
  });
  if (!decision.ok) return { ok: false, error: decision.reason };

  const phone = normalizePhone(args.phoneNumber);
  const method = detectMomoMethod(phone) || args.provider;
  const providerId = toPawapayProviderId(method);
  const reference = reward.payoutReference;
  if (!reference) return { ok: false, error: "missing_payout_reference" };

  await db
    .update(safefindRewards)
    .set({
      status: "PROCESSING",
      phoneNumber: phone,
      provider: providerId,
      updatedAt: new Date(),
    })
    .where(eq(safefindRewards.id, reward.id));

  try {
    const result = await pawapayPayOut({
      payoutId: reference,
      amount: reward.amount,
      currency: (reward.currency === "USD" ? "USD" : "CDF") as "USD" | "CDF",
      phoneNumber: phone,
      provider: providerId,
    });
    await db
      .update(safefindRewards)
      .set({
        updatedAt: new Date(),
        meta: { ...(reward.meta ?? {}), pawapayInit: result.response, accepted: result.accepted },
      })
      .where(eq(safefindRewards.id, reward.id));
    if (!result.accepted) {
      await db
        .update(safefindRewards)
        .set({ status: "FAILED", failureReason: "pawapay_not_accepted", updatedAt: new Date() })
        .where(eq(safefindRewards.id, reward.id));
      return { ok: false, error: "payout_failed" };
    }
    return { ok: true, reference };
  } catch (e) {
    await db
      .update(safefindRewards)
      .set({
        status: "FAILED",
        failureReason: e instanceof Error ? e.message : "payout_failed",
        updatedAt: new Date(),
      })
      .where(eq(safefindRewards.id, reward.id));
    return { ok: false, error: "payout_failed" };
  }
}

export async function applySafefindPayoutWebhook(args: {
  reference: string;
  status: "COMPLETED" | "FAILED";
  providerTxId?: string | null;
}): Promise<"applied" | "ignored" | "not_found"> {
  const db = getDb();
  const [reward] = await db
    .select()
    .from(safefindRewards)
    .where(eq(safefindRewards.payoutReference, args.reference))
    .limit(1);
  if (!reward) return "not_found";
  if (reward.status === "PAID") return "ignored";
  if (args.status === "COMPLETED") {
    await db
      .update(safefindRewards)
      .set({
        status: "PAID",
        paidAt: new Date(),
        providerTxId: args.providerTxId ?? reward.providerTxId,
        updatedAt: new Date(),
      })
      .where(eq(safefindRewards.id, reward.id));
    await db
      .update(safefindCases)
      .set({
        status: "REWARD_RELEASED",
        rewardStatus: "PAID",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(safefindCases.id, reward.caseId));
    return "applied";
  }
  await db
    .update(safefindRewards)
    .set({ status: "FAILED", updatedAt: new Date() })
    .where(eq(safefindRewards.id, reward.id));
  return "applied";
}
