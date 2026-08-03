import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, pricingPlans } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import {
  Badge,
  Button,
  MetaChip,
  Section,
  SurfaceCard,
} from "@/components/ui/primitives";
import { FeatureCard } from "@/components/ui/visuals";
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconCode,
} from "@/components/icons";

export default async function PricingPage() {
  const user = await getSessionUser().catch(() => null);
  let plans: {
    code: string;
    name: string;
    description: string | null;
    priceUsdCents: number;
    quotas: unknown;
  }[] = [];
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

  const free = plans.find((p) => p.code === "developer_free");
  const pro = plans.find((p) => p.code === "developer_pro");

  return (
    <div>
      <Section className="py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-accent)]">
            Tarifs
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-4xl">
            Des plans simples
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ca-ink-muted)] sm:text-base">
            Link Checker et signalement restent gratuits. Passez à Pro uniquement quand vous
            en avez besoin - Mobile Money, activation après confirmation.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <MetaChip label="Mobile Money" />
            <MetaChip label="Activation confirmée" />
            <MetaChip label="Sans carte bancaire" />
          </div>
        </div>
      </Section>

      <Section className="pb-10 pt-2">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ca-low)] text-white">
                <IconCheck size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold text-[var(--ca-ink)]">
                    {free?.name || "Developer Free"}
                  </h2>
                  <Badge tone="low">Gratuit</Badge>
                </div>
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--ca-ink)]">
              {free?.priceUsdCents === 0 || !free ? "0 $" : `$${(free.priceUsdCents / 100).toFixed(0)}`}
            </p>
            <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">
              {free?.description || "1 projet - 2 scans / mois"}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ca-ink)]">
              <li className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-[var(--ca-low)]" />
                Idéal pour tester la valeur
              </li>
              <li className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-[var(--ca-low)]" />
                Compte sécurisé inclus
              </li>
            </ul>
            {user ? (
              <Link href="/dashboard" className="mt-6 block">
                <Button variant="secondary" className="w-full">
                  <IconCode size={16} />
                  Aller à mon espace
                </Button>
              </Link>
            ) : (
              <Link href="/register" className="mt-6 block">
                <Button variant="secondary" className="w-full">
                  <IconCode size={16} />
                  Commencer gratuitement
                </Button>
              </Link>
            )}
          </SurfaceCard>

          <SurfaceCard
            variant="lift"
            className="border border-[var(--ca-accent)]/35 bg-[var(--ca-accent-soft)]/35 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ca-accent)] text-white">
                <IconCode size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold text-[var(--ca-ink)]">
                    {pro?.name || "Developer Pro"}
                  </h2>
                  <Badge tone="info">Recommandé</Badge>
                </div>
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--ca-ink)]">
              {pro ? `$${(pro.priceUsdCents / 100).toFixed(0)}` : "15 $"}
              <span className="text-sm font-semibold text-[var(--ca-ink-muted)]"> / mois</span>
            </p>
            <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">
              {pro?.description || "Scans étendus - rapports - historique"}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ca-ink)]">
              <li className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-[var(--ca-accent)]" />
                Historique et rapports
              </li>
              <li className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-[var(--ca-accent)]" />
                Suivi findings + retest
              </li>
            </ul>
            <Link href="/pricing/pay" className="mt-6 block">
              <Button className="w-full">
                Passer à Pro
                <IconArrowRight size={16} />
              </Button>
            </Link>
          </SurfaceCard>
        </div>
      </Section>

      <Section className="pb-16">
        <FeatureCard
          icon={<IconBuilding size={20} />}
          title="Entreprises"
          description="Security Audit dès 100 USD - Professional Audit 250 USD+ - Monitoring dès 50 USD/mois. Devis selon périmètre."
          accent="var(--ca-panther)"
          className="mx-auto max-w-3xl"
        />
        <div className="mt-4 text-center">
          <Link href="/business">
            <Button>
              Demander un audit
              <IconArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </Section>
    </div>
  );
}
