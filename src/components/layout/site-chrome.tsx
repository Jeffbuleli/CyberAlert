import Link from "next/link";
import { IconShield } from "@/components/icons";

const links = [
  { href: "/", label: "Vérifier" },
  { href: "/report", label: "Signaler" },
  { href: "/developers", label: "Développeurs" },
  { href: "/business", label: "Entreprises" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ca-border)]/80 bg-[var(--ca-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-[var(--ca-ink)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ca-accent)] text-white">
            <IconShield size={18} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm tracking-tight">Cyber Alert DRC</span>
            <span className="block text-[10px] font-medium text-[var(--ca-ink-muted)]">
              Vérifiez avant de faire confiance.
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--ca-ink-muted)] hover:bg-[var(--ca-surface-2)] hover:text-[var(--ca-ink)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="rounded-xl bg-[var(--ca-ink)] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Connexion
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--ca-border)] bg-[var(--ca-surface)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[var(--ca-ink)]">Cyber Alert DRC</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--ca-ink-muted)]">
            Confiance numérique pour la RDC et l&apos;Afrique francophone.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--ca-ink-muted)]">
          <Link href="/privacy" className="hover:text-[var(--ca-ink)]">
            Confidentialité
          </Link>
          <Link href="/terms" className="hover:text-[var(--ca-ink)]">
            Conditions
          </Link>
          <Link href="/responsible-disclosure" className="hover:text-[var(--ca-ink)]">
            Divulgation responsable
          </Link>
          <Link href="/data-retention" className="hover:text-[var(--ca-ink)]">
            Conservation des données
          </Link>
        </div>
      </div>
    </footer>
  );
}
