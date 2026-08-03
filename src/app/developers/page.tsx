import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import {
  Badge,
  Button,
  MetaChip,
  Section,
  SurfaceCard,
} from "@/components/ui/primitives";
import { IconArrowRight, IconCheck, IconCode, IconLink, IconSearch } from "@/components/icons";
import { FeatureCard } from "@/components/ui/visuals";
import { getSessionUser } from "@/lib/auth/session";

const FREE_POINTS = [
  "1 projet",
  "2 scans / mois",
  "Résultats principaux",
  "Recommandations essentielles",
];

const PRO_POINTS = [
  "Scans supplémentaires",
  "Historique et rapports",
  "Suivi des findings + retest",
  "Plusieurs projets selon le plan",
];

const STEPS = [
  {
    n: "01",
    title: "Créez un compte",
    text: "Inscription rapide. Free dès le départ, sans carte.",
    icon: <IconCode size={20} />,
  },
  {
    n: "02",
    title: "Ajoutez votre app",
    text: "URL de votre application ou site à analyser.",
    icon: <IconLink size={20} />,
  },
  {
    n: "03",
    title: "Lancez un scan",
    text: "Analyse non intrusive. Findings clairs, prêts à traiter.",
    icon: <IconSearch size={20} />,
  },
];

export default async function DevelopersPage() {
  const user = await getSessionUser().catch(() => null);

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
                      Cyber Alert DRC · Développeurs
                    </p>
                    <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-3xl">
                      Tester mon application
                    </h1>
                  </div>
                </div>
                <Badge tone="info">1-2 scans gratuits</Badge>
              </div>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--ca-ink-muted)] sm:text-base">
                Comprenez la valeur avec des scans gratuits. Passez à Developer Pro pour
                l&apos;historique, les rapports et le suivi des findings.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <MetaChip label="Non-intrusif" />
                <MetaChip label="Findings actionnables" />
                <MetaChip label="Mobile Money" />
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {user ? (
                  <>
                    <Link href="/dashboard" className="sm:flex-1">
                      <Button className="w-full">
                        <IconCode size={18} />
                        Ouvrir mon espace
                      </Button>
                    </Link>
                    <Link href="/pricing" className="sm:flex-1">
                      <Button variant="secondary" className="w-full">
                        Voir Developer Pro
                        <IconArrowRight size={16} />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/register" className="sm:flex-1">
                      <Button className="w-full">
                        <IconCode size={18} />
                        Commencer gratuitement
                      </Button>
                    </Link>
                    <Link href="/pricing" className="sm:flex-1">
                      <Button variant="secondary" className="w-full">
                        Voir Developer Pro
                        <IconArrowRight size={16} />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="relative z-10 border-t border-white/10 bg-gradient-to-r from-[#0b1020] via-[#141b2f] to-[#1a2744] px-5 py-4 sm:px-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">
                Approche
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                Scan technique d&apos;abord - McBuleli AI explique ensuite. Jamais d&apos;exploitation.
              </p>
            </div>
          </article>
        </Section>
      </div>

      <Section className="pb-16 pt-4">
        <h2 className="text-center text-sm font-extrabold uppercase tracking-[0.16em] text-[var(--ca-ink-subtle)]">
          Comment ça marche
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <FeatureCard
              key={s.n}
              eyebrow={`Étape ${s.n}`}
              title={s.title}
              description={s.text}
              icon={s.icon}
              accent="var(--ca-accent)"
            />
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ca-low)] text-white">
                <IconCheck size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold text-[var(--ca-ink)]">Free</h2>
                  <Badge tone="low">Gratuit</Badge>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--ca-ink-muted)]">Pour découvrir la valeur</p>
            <ul className="mt-4 space-y-2.5">
              {FREE_POINTS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--ca-ink)]">
                  <IconCheck size={16} className="mt-0.5 shrink-0 text-[var(--ca-low)]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={user ? "/dashboard" : "/register"} className="mt-6 block">
              <Button variant="secondary" className="w-full">
                {user ? "Mon espace" : "Créer mon compte"}
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
                  <h2 className="text-lg font-extrabold text-[var(--ca-ink)]">Developer Pro</h2>
                  <Badge tone="info">Recommandé</Badge>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--ca-ink-muted)]">
              À partir de 15 USD / mois (configurable)
            </p>
            <ul className="mt-4 space-y-2.5">
              {PRO_POINTS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--ca-ink)]">
                  <IconCheck size={16} className="mt-0.5 shrink-0 text-[var(--ca-accent)]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={user ? "/pricing/pay" : "/pricing"} className="mt-6 block">
              <Button className="w-full">
                Passer à Pro
                <IconArrowRight size={16} />
              </Button>
            </Link>
          </SurfaceCard>
        </div>

        <SurfaceCard variant="panther" className="mx-auto mt-10 max-w-3xl overflow-hidden p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
              <IconSearch size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">Vos scans au même endroit</h2>
                <Link href={user ? "/dashboard" : "/register"}>
                  <Button variant="secondary">
                    {user ? "Ouvrir le dashboard" : "Créer un compte"}
                  </Button>
                </Link>
              </div>
              <p className="mt-2 text-sm text-white/65">
                Quotas visibles, projets, findings par sévérité, retest quand vous passez Pro.
              </p>
            </div>
          </div>
        </SurfaceCard>
      </Section>
    </div>
  );
}
