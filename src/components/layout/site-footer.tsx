import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { McBuleliPoweredFooter } from "@/components/brand/mcbuleli-powered-footer";

const legal = [
  { href: "/privacy", label: "Confidentialité" },
  { href: "/terms", label: "Conditions" },
  { href: "/responsible-disclosure", label: "Divulgation responsable" },
  { href: "/data-retention", label: "Conservation des données" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--ca-border)] bg-[var(--ca-surface)]/90 sm:mt-20">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <BrandLogo size={48} />
            <div className="min-w-0">
              <p className="font-extrabold text-[var(--ca-ink)]">Cyber Alert DRC</p>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--ca-ink-muted)]">
                Confiance numérique pour la RDC et l&apos;Afrique francophone.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-[var(--ca-ink-muted)] sm:flex sm:flex-wrap sm:justify-end sm:gap-x-5">
            {legal.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-[var(--ca-ink)]">
                {l.label}
              </Link>
            ))}
            <Link href="/pricing" className="hover:text-[var(--ca-ink)]">
              Tarifs
            </Link>
            <Link href="/login" className="hover:text-[var(--ca-ink)]">
              Connexion
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--ca-border)] pt-5">
          <McBuleliPoweredFooter />
        </div>
      </div>
    </footer>
  );
}
