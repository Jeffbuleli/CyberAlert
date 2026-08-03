import { randomUUID } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, payments, pricingPlans } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { getPaymentProvider } from "@/lib/payments/providers";
import { getUsdToCdfRate } from "@/lib/env";
import { trackEvent } from "@/lib/analytics";

const schema = z.object({
  planCode: z.string().min(1),
  phone: z.string().min(8).max(32),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Connectez-vous pour payer." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Données invalides." }, { status: 400 });
  }

  const db = getDb();
  const [plan] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.code, parsed.data.planCode))
    .limit(1);
  if (!plan || !plan.active || plan.priceUsdCents <= 0) {
    return Response.json({ error: "plan_not_found", message: "Plan introuvable." }, { status: 404 });
  }

  const rate = getUsdToCdfRate();
  const usd = plan.priceUsdCents / 100;
  const localAmount = String(Math.round(usd * rate));
  const depositId = randomUUID();

  const [payment] = await db
    .insert(payments)
    .values({
      userId: user.id,
      provider: "pawapay",
      purpose: "subscription",
      planCode: plan.code,
      usdAmountCents: plan.priceUsdCents,
      localAmount,
      localCurrency: "CDF",
      status: "pending",
      providerRef: depositId,
      phone: parsed.data.phone,
    })
    .returning();

  await trackEvent("payment_started", { paymentId: payment.id, plan: plan.code });

  try {
    const provider = getPaymentProvider();
    const result = await provider.createDeposit({
      amountLocal: localAmount,
      currency: "CDF",
      phone: parsed.data.phone,
      depositId,
    });
    await db
      .update(payments)
      .set({
        status: result.accepted ? "processing" : "failed",
        providerRef: result.providerRef,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    if (!result.accepted) {
      return Response.json(
        { error: "provider_rejected", message: "Le paiement Mobile Money a été refusé." },
        { status: 502 },
      );
    }

    return Response.json({
      paymentId: payment.id,
      localAmount,
      localCurrency: "CDF",
      providerRef: result.providerRef,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "payment_failed";
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date(), meta: { error: msg } })
      .where(eq(payments.id, payment.id));
    return Response.json(
      {
        error: msg,
        message:
          msg === "pawapay_not_configured"
            ? "Le paiement Mobile Money n'est pas encore configuré sur ce serveur."
            : "Échec d'initiation du paiement.",
      },
      { status: 503 },
    );
  }
}
