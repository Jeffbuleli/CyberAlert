import { and, eq } from "drizzle-orm";
import { getDb, payments, pricingPlans, subscriptions } from "@/db";
import { getPaymentProvider } from "@/lib/payments/providers";
import { trackEvent } from "@/lib/analytics";

async function activateSubscription(userId: string, planCode: string) {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.code, planCode))
    .limit(1);
  if (!plan) return;

  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));

  await db.insert(subscriptions).values({
    userId,
    planId: plan.id,
    status: "active",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const provider = getPaymentProvider();
  const verified = await provider.verifyWebhook(req, body);
  if (!verified.ok || !verified.providerRef) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Never trust webhook alone - confirm with provider lookup
  const status = await provider.lookupStatus(verified.providerRef);
  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerRef, verified.providerRef))
    .limit(1);

  if (!payment) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (status === "COMPLETED" && payment.status !== "completed") {
    await db
      .update(payments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    if (payment.userId && payment.planCode) {
      await activateSubscription(payment.userId, payment.planCode);
    }
    await trackEvent("payment_completed", { paymentId: payment.id });
  } else if (status === "FAILED") {
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }

  return Response.json({ ok: true, status });
}
