import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, pricingPlans } from "@/db";
import { BrandLogo } from "@/components/brand/logo";
import {
  Badge,
  Button,
  MetaChip,
  Section,
  SurfaceCard,
} from "@/components/ui/primitives";
import { FeatureCard } from "@/components/ui/visuals";
import { UpgradeCheckout } from "@/components/payments/upgrade-checkout";
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconCode,
  IconLock,
} from "@/components/icons";

export default async function PricingPage() {
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
      <div className="relative overflow-hidden" style={{ background: "var(--ca-hero-glow)" }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "var(--ca-grid)", backgroundSize: "32px 32px" }}
        />
        <Section className="relative py-12 sm:py-16">
          <article className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] border border-[var(--ca-border)] bg-[#FAFBFE] shadow-[0_24px_64px_-30px_rgba(12,24,48,0.45)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(ellipse at top right, color-mix(in srgb, var(--ca-accent) 16%, transparent), transparent 55%)",
              }}
            />
            <div className="relative z-10 p-5 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BrandLogo size={56} priority />
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-accent)]">
                      Cyber Alert DRC · Tarifs
                    </p>
                    <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-3xl">
                      Des tarifs clairs
                    </h1>
                  </div>
                </div>
                <Badge tone="info">Configurables</Badge>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--ca-ink-muted)] sm:text-base">
                Link Checker et signalement restent gratuits. Les plans développeur et les audits
                entreprise sont gérés depuis l&apos;administration.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <MetaChip label="PawaPay Mobile Money" />
                <MetaChip label="Activation serveur" />
                <MetaChip label="Sans carte bancaire" />
              </div>
            </div>
            <div className="relative z-10 border-t border-white/10 bg-gradient-to-r from-[#0b1020] via-[#141b2f] to-[#1a2744] px-5 py-4 sm:px-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">
                Transparence
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                Paiement confirmé côté serveur avant activation Pro - pas de fausse confirmation.
              </p>
            </div>
          </article>
        </Section>
      </div>

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
            <Link href="/register" className="mt-6 block">
              <Button variant="secondary" className="w-full">
                <IconCode size={16} />
                Commencer gratuitement
              </Button>
            </Link>
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
            <a href="#checkout-pro" className="mt-6 block">
              <Button className="w-full">
                Passer à Pro
                <IconArrowRight size={16} />
              </Button>
            </a>
          </SurfaceCard>
        </div>
      </Section>

      {pro ? (
        <Section id="checkout-pro" className="pb-10">
          <div className="mx-auto max-w-lg">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ca-panther)] text-white">
                <IconLock size={20} />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-[var(--ca-ink)]">
                  Payer Developer Pro
                </h2>
                <p className="text-sm text-[var(--ca-ink-muted)]">
                  Mobile Money via PawaPay - activation après confirmation serveur.
                </p>
              </div>
            </div>
            <UpgradeCheckout planCode="developer_pro" />
            <p className="mt-3 text-center text-[11px] text-[var(--ca-ink-subtle)]">
              Connectez-vous d&apos;abord si ce n&apos;est pas déjà fait.{" "}
              <Link href="/login" className="font-semibold text-[var(--ca-accent)] hover:underline">
                Connexion
              </Link>
            </p>
          </div>
        </Section>
      ) : null}

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
