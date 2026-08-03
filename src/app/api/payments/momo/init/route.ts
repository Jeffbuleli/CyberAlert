import { randomUUID } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, payments, pricingPlans } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import {
  detectMomoMethod,
  getPaymentProvider,
  toPawapayProviderId,
} from "@/lib/payments/providers";
import { trackEvent } from "@/lib/analytics";

const schema = z.object({
  planCode: z.string().min(1),
  phone: z.string().min(8).max(32),
  /** Optional UI selection — phone detection wins when available. */
  method: z.enum(["orange", "mpesa", "airtel"]).optional(),
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

  const detected = detectMomoMethod(parsed.data.phone);
  if (detected === "africell") {
    return Response.json(
      {
        error: "unsupported_network",
        message:
          "Africell / Afrimoney n'est pas supporté. Utilisez Orange Money, M-Pesa ou Airtel Money.",
      },
      { status: 400 },
    );
  }
  const method = detected || parsed.data.method || "orange";
  const providerId = toPawapayProviderId(method);

  // Same currency model as McBuleli Hackathon MoMo: charge USD via PawaPay.
  const amountUsd = formatUsd(plan.priceUsdCents);
  const depositId = randomUUID();

  const [payment] = await db
    .insert(payments)
    .values({
      userId: user.id,
      provider: "pawapay",
      purpose: "subscription",
      planCode: plan.code,
      usdAmountCents: plan.priceUsdCents,
      localAmount: amountUsd,
      localCurrency: "USD",
      status: "pending",
      providerRef: depositId,
      phone: parsed.data.phone,
      meta: { method, providerId },
    })
    .returning();

  await trackEvent("payment_started", { paymentId: payment.id, plan: plan.code });

  try {
    const provider = getPaymentProvider();
    const result = await provider.createDeposit({
      amountLocal: amountUsd,
      currency: "USD",
      phone: parsed.data.phone,
      depositId,
      provider: providerId,
      customerMessage: "Cyber Alert Pro",
    });
    await db
      .update(payments)
      .set({
        status: result.accepted ? "processing" : "failed",
        providerRef: result.providerRef,
        updatedAt: new Date(),
        meta: {
          method,
          providerId,
          rawStatus: result.rawStatus,
          failureMessage: result.failureMessage,
        },
      })
      .where(eq(payments.id, payment.id));

    if (!result.accepted) {
      return Response.json(
        {
          error: "provider_rejected",
          message: result.failureMessage || "Le paiement Mobile Money a été refusé.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      paymentId: payment.id,
      localAmount: amountUsd,
      localCurrency: "USD",
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

function formatUsd(cents: number): string {
  const n = cents / 100;
  let s = n.toFixed(3);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}
