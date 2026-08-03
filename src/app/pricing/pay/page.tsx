import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, pricingPlans } from "@/db";
import { Section } from "@/components/ui/primitives";
import { UpgradeCheckout } from "@/components/payments/upgrade-checkout";
import Link from "next/link";

export default async function PricingPayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/pricing/pay");

  let planName = "Developer Pro";
  let priceLabel = "15 $ / mois";
  try {
    const db = getDb();
    const [pro] = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.code, "developer_pro"))
      .limit(1);
    if (pro) {
      planName = pro.name;
      priceLabel = `$${(pro.priceUsdCents / 100).toFixed(0)} / mois`;
    }
  } catch {
    /* fallback labels */
  }

  return (
    <Section className="py-12 sm:py-16">
      <div className="mx-auto max-w-lg">
        <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-accent)]">
          Checkout
        </p>
        <h1 className="mt-2 text-center text-2xl font-extrabold text-[var(--ca-ink)]">
          Activer Developer Pro
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--ca-ink-muted)]">
          Paiement Mobile Money uniquement quand vous êtes prêt. Confirmez sur votre téléphone.
        </p>
        <div className="mt-6">
          <UpgradeCheckout
            planCode="developer_pro"
            planName={planName}
            priceLabel={priceLabel}
          />
        </div>
        <p className="mt-4 text-center text-sm text-[var(--ca-ink-muted)]">
          <Link href="/pricing" className="font-semibold text-[var(--ca-accent)] hover:underline">
            Retour aux tarifs
          </Link>
        </p>
      </div>
    </Section>
  );
}
