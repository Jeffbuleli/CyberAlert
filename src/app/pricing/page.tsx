import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, pricingPlans } from "@/db";
import { Section, Button, Badge } from "@/components/ui/primitives";
import { UpgradeCheckout } from "@/components/payments/upgrade-checkout";

export default async function PricingPage() {
  let plans: { code: string; name: string; description: string | null; priceUsdCents: number; quotas: unknown }[] = [];
  try {
    const db = getDb();
    plans = await db
      .select({
        code: pricingPlans.code,
        name: pricingPlans.name,
        description: pricingPlans.description,
        priceUsdCents: pricingPlans.priceUsdCents,
        quotas: pricingPlans.quotas,
      })
      .from(pricingPlans)
      .where(eq(pricingPlans.active, true));
    plans.sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    plans = [
      {
        code: "developer_free",
        name: "Developer Free",
        description: "1 projet - 2 scans / mois",
        priceUsdCents: 0,
        quotas: {},
      },
      {
        code: "developer_pro",
        name: "Developer Pro",
        description: "Scans étendus - rapports - historique",
        priceUsdCents: 1500,
        quotas: {},
      },
    ];
  }

  const pro = plans.find((p) => p.code === "developer_pro");

  return (
    <Section className="py-14 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="info">Pricing</Badge>
        <h1 className="mt-3 text-3xl font-extrabold">Des tarifs clairs, configurables</h1>
        <p className="mt-2 text-[var(--ca-ink-muted)]">
          Link Checker et signalement restent gratuits. Les prix ci-dessous viennent de
          l&apos;administration.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {plans
          .filter((p) => p.code.startsWith("developer"))
          .map((p) => (
            <div
              key={p.code}
              className={`rounded-2xl border bg-white p-6 text-left ${
                p.code === "developer_pro"
                  ? "border-[var(--ca-accent)]"
                  : "border-[var(--ca-border)]"
              }`}
            >
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-3xl font-bold">
                {p.priceUsdCents === 0 ? "Gratuit" : `$${(p.priceUsdCents / 100).toFixed(0)}`}
                {p.priceUsdCents > 0 ? (
                  <span className="text-sm font-medium text-[var(--ca-ink-muted)]"> / mois</span>
                ) : null}
              </p>
              <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">{p.description}</p>
              {p.code === "developer_free" ? (
                <Link href="/register" className="mt-5 inline-block">
                  <Button variant="secondary">Commencer</Button>
                </Link>
              ) : null}
            </div>
          ))}
      </div>

      {pro ? (
        <div className="mx-auto mt-10 max-w-lg">
          <h2 className="text-center font-semibold">Payer Developer Pro (Mobile Money)</h2>
          <p className="mt-1 text-center text-sm text-[var(--ca-ink-muted)]">
            Paiement via PawaPay - activation après confirmation serveur.
          </p>
          <div className="mt-4">
            <UpgradeCheckout planCode="developer_pro" />
          </div>
        </div>
      ) : null}

      <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface)] p-6 text-center">
        <h2 className="font-semibold">Entreprises</h2>
        <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
          Security Audit dès 100 USD - Professional Audit 250 USD+ - Monitoring dès 50 USD/mois.
        </p>
        <Link href="/business" className="mt-4 inline-block">
          <Button>Demander un audit</Button>
        </Link>
      </div>
    </Section>
  );
}
