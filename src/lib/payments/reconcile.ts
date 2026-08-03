import { and, eq } from "drizzle-orm";
import { getDb, payments, pricingPlans, subscriptions } from "@/db";
import { getPaymentProvider } from "@/lib/payments/providers";
import { trackEvent } from "@/lib/analytics";

const OPEN = new Set(["pending", "processing"]);

export async function activateSubscription(userId: string, planCode: string) {
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

/**
 * Heal missed webhooks by polling PawaPay (same pattern as McBuleli Hackathon).
 */
export async function reconcilePaymentById(paymentId: string): Promise<{
  status: string;
  changed: boolean;
}> {
  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!payment) return { status: "not_found", changed: false };
  if (!OPEN.has(payment.status)) {
    return { status: payment.status, changed: false };
  }
  if (!payment.providerRef) {
    return { status: payment.status, changed: false };
  }

  const provider = getPaymentProvider();
  const remote = await provider.lookupStatus(payment.providerRef);
  if (remote === "PROCESSING") {
    return { status: payment.status, changed: false };
  }

  if (remote === "COMPLETED") {
    await db
      .update(payments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    if (payment.userId && payment.planCode) {
      await activateSubscription(payment.userId, payment.planCode);
    }
    await trackEvent("payment_completed", { paymentId: payment.id, via: "reconcile" });
    return { status: "completed", changed: true };
  }

  if (remote === "FAILED") {
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    return { status: "failed", changed: true };
  }

  return { status: payment.status, changed: false };
}
