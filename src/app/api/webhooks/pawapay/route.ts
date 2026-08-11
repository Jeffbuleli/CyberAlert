import { eq } from "drizzle-orm";
import { getDb, payments } from "@/db";
import { getPaymentProvider } from "@/lib/payments/providers";
import { activateSubscription } from "@/lib/payments/reconcile";
import { trackEvent } from "@/lib/analytics";

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
    await trackEvent("payment_completed", { paymentId: payment.id, via: "webhook" });
  } else if (status === "FAILED" && payment.status !== "failed") {
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }


  // SafeFind reward payouts (idempotent; ignore if not a SafeFind ref)
  try {
    const { applySafefindPayoutWebhook } = await import("@/lib/safefind/payout");
    if (status === "COMPLETED" || status === "FAILED") {
      await applySafefindPayoutWebhook({
        reference: verified.providerRef,
        status,
      });
    }
  } catch {
    /* ignore */
  }

  return Response.json({ ok: true, status });
}
