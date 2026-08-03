import { and, eq, sql } from "drizzle-orm";
import { getDb, pricingPlans, quotasUsage, subscriptions } from "@/db";

export type PlanQuotas = {
  maxProjects?: number;
  scansPerMonth?: number;
  fullReports?: boolean;
};

export async function getActivePlanForUser(userId: string) {
  const db = getDb();
  const [sub] = await db
    .select({
      planId: subscriptions.planId,
      status: subscriptions.status,
      code: pricingPlans.code,
      name: pricingPlans.name,
      quotas: pricingPlans.quotas,
      priceUsdCents: pricingPlans.priceUsdCents,
    })
    .from(subscriptions)
    .innerJoin(pricingPlans, eq(subscriptions.planId, pricingPlans.id))
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .limit(1);

  if (sub) return sub;

  const [free] = await db
    .select()
    .from(pricingPlans)
    .where(and(eq(pricingPlans.code, "developer_free"), eq(pricingPlans.active, true)))
    .limit(1);
  return free
    ? {
        planId: free.id,
        status: "active",
        code: free.code,
        name: free.name,
        quotas: free.quotas,
        priceUsdCents: free.priceUsdCents,
      }
    : null;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getQuotaRemaining(userId: string, metric: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const plan = await getActivePlanForUser(userId);
  const quotas = (plan?.quotas || {}) as PlanQuotas;
  const limit =
    metric === "scans"
      ? quotas.scansPerMonth ?? 2
      : metric === "projects"
        ? quotas.maxProjects ?? 1
        : 0;

  const db = getDb();
  const period = currentPeriod();
  const [row] = await db
    .select()
    .from(quotasUsage)
    .where(
      and(
        eq(quotasUsage.userId, userId),
        eq(quotasUsage.metric, metric),
        eq(quotasUsage.period, period),
      ),
    )
    .limit(1);

  const used = row?.used ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function consumeQuota(userId: string, metric: string, amount = 1) {
  const { remaining } = await getQuotaRemaining(userId, metric);
  if (remaining < amount) {
    return { ok: false as const, error: "quota_exceeded" };
  }
  const db = getDb();
  const period = currentPeriod();
  await db
    .insert(quotasUsage)
    .values({ userId, metric, period, used: amount })
    .onConflictDoUpdate({
      target: [quotasUsage.userId, quotasUsage.metric, quotasUsage.period],
      set: { used: sql`${quotasUsage.used} + ${amount}`, updatedAt: new Date() },
    });
  return { ok: true as const };
}
