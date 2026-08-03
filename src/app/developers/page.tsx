import Link from "next/link";
import { Section, Button, Badge } from "@/components/ui/primitives";
import { IconCode, IconArrowRight } from "@/components/icons";

export default function DevelopersPage() {
  return (
    <Section className="py-14 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="info">Développeurs</Badge>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Tester mon application
        </h1>
        <p className="mt-3 text-[var(--ca-ink-muted)]">
          Comprenez la valeur avec 1 à 2 scans gratuits. Puis passez à Developer Pro pour
          l&apos;historique, les rapports et le suivi des findings.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register">
            <Button className="w-full sm:w-auto">
              <IconCode size={18} />
              Commencer gratuitement
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="secondary" className="w-full sm:w-auto">
              Voir Developer Pro
              <IconArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--ca-border)] bg-white p-5 text-left">
          <h2 className="font-semibold">Free</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--ca-ink-muted)]">
            <li>- 1 projet</li>
            <li>- 2 scans / mois</li>
            <li>- Résultats principaux</li>
            <li>- Recommandations essentielles</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--ca-accent)] bg-[var(--ca-accent-soft)]/40 p-5 text-left">
          <h2 className="font-semibold">Developer Pro</h2>
          <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">À partir de 15 USD / mois (configurable)</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--ca-ink-muted)]">
            <li>- Scans supplémentaires</li>
            <li>- Historique et rapports détaillés</li>
            <li>- Suivi des findings et retest</li>
            <li>- Plusieurs projets selon le plan</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
