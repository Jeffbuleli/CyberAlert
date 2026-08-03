import Link from "next/link";
import { LinkCheckForm } from "@/components/link-check/link-check-form";
import { Section } from "@/components/ui/primitives";
import {
  IconBuilding,
  IconCode,
  IconFlag,
  IconLink,
  IconShield,
} from "@/components/icons";

export default function HomePage() {
  return (
    <div>
      <div
        className="relative overflow-hidden"
        style={{ background: "var(--ca-hero-glow)" }}
      >
        <Section className="flex min-h-[calc(100vh-4rem)] flex-col justify-center py-12 sm:py-16">
          <div className="mx-auto w-full max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--ca-border)] bg-white/70 px-3 py-1.5 text-xs font-medium text-[var(--ca-ink-muted)] backdrop-blur">
              <IconShield size={14} className="text-[var(--ca-accent)]" />
              Cyber Alert DRC
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-5xl sm:leading-[1.1]">
              Vous avez reçu un lien ?
              <span className="mt-2 block text-[var(--ca-accent)]">
                Vérifiez-le avant de cliquer.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-[var(--ca-ink-muted)] sm:text-lg">
              Collez l&apos;URL reçue sur WhatsApp, SMS ou email. Résultat clair en quelques secondes.
            </p>
            <div className="mt-8 rounded-2xl border border-[var(--ca-border)] bg-white/90 p-4 shadow-[0_20px_50px_-28px_rgba(12,27,42,0.35)] backdrop-blur sm:p-6">
              <LinkCheckForm />
            </div>
          </div>
        </Section>
      </div>

      <Section className="py-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-[var(--ca-ink-subtle)]">
          Autres services
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/report"
            className="group rounded-2xl border border-[var(--ca-border)] bg-white p-5 transition hover:border-[var(--ca-accent)]"
          >
            <IconFlag className="text-[var(--ca-high)]" />
            <h3 className="mt-3 font-semibold">Signaler un site</h3>
            <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
              Phishing, arnaque ou usurpation - sans compte obligatoire.
            </p>
          </Link>
          <Link
            href="/developers"
            className="group rounded-2xl border border-[var(--ca-border)] bg-white p-5 transition hover:border-[var(--ca-accent)]"
          >
            <IconCode className="text-[var(--ca-accent)]" />
            <h3 className="mt-3 font-semibold">Tester mon application</h3>
            <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
              1 à 2 scans gratuits pour les développeurs.
            </p>
          </Link>
          <Link
            href="/business"
            className="group rounded-2xl border border-[var(--ca-border)] bg-white p-5 transition hover:border-[var(--ca-accent)]"
          >
            <IconBuilding className="text-[var(--ca-ink)]" />
            <h3 className="mt-3 font-semibold">Sécuriser mon organisation</h3>
            <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
              Audits et monitoring pour entreprises.
            </p>
          </Link>
        </div>
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-[var(--ca-ink-subtle)]">
          <IconLink size={16} />
          Le grand public vérifie - les développeurs améliorent - les entreprises se protègent.
        </p>
      </Section>
    </div>
  );
}
