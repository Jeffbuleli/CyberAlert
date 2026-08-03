"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import {
  Badge,
  Button,
  Input,
  MetaChip,
  Section,
  SurfaceCard,
  TextArea,
} from "@/components/ui/primitives";
import { FeatureCard } from "@/components/ui/visuals";
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconCode,
  IconLock,
  IconSearch,
  IconShield,
} from "@/components/icons";

const SERVICES = [
  {
    title: "Security Audit",
    description: "Revue globale des risques, priorisation exécutive et plan de remédiation.",
    icon: <IconShield size={20} />,
    accent: "var(--ca-panther)",
  },
  {
    title: "Audit application web",
    description: "Contrôles ciblés sur vos surfaces web exposées (config, headers, flux sensibles).",
    icon: <IconSearch size={20} />,
    accent: "var(--ca-accent)",
  },
  {
    title: "Audit API",
    description: "Exposition, auth, et points d'entrée API - sans exploitation destructive.",
    icon: <IconCode size={20} />,
    accent: "var(--ca-medium)",
  },
  {
    title: "Monitoring",
    description: "Suivi continu des signaux et alertes - à partir de 50 USD / mois (configurable).",
    icon: <IconLock size={20} />,
    accent: "var(--ca-low)",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Cadrage",
    text: "Périmètre, actifs critiques, contraintes métier et critères de succès.",
    icon: <IconBuilding size={20} />,
  },
  {
    n: "02",
    title: "Analyse",
    text: "Contrôles techniques non intrusifs, preuves tracées, priorisation par impact.",
    icon: <IconSearch size={20} />,
  },
  {
    n: "03",
    title: "Restitution",
    text: "Rapport exécutif + technique, plan d'action, option retest après corrections.",
    icon: <IconCheck size={20} />,
  },
];

const GUARANTEES = [
  {
    title: "Confidentialité",
    description: "Échanges et livrables traités de façon confidentielle.",
    icon: <IconLock size={20} />,
  },
  {
    title: "Sans exploitation",
    description: "Pas d'attaque destructive. Approche contrôlée et documentée.",
    icon: <IconShield size={20} />,
  },
  {
    title: "Décision claire",
    description: "McBuleli AI aide à synthétiser - la décision reste humaine.",
    icon: <IconCheck size={20} />,
  },
];

export default function BusinessPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/audit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: fd.get("organization"),
          contactName: fd.get("contactName"),
          contactEmail: fd.get("contactEmail"),
          contactPhone: fd.get("contactPhone"),
          serviceType: fd.get("serviceType"),
          message: fd.get("message"),
        }),
      });
      if (!res.ok) {
        setError("Envoi impossible. Réessayez.");
        return;
      }
      setDone(true);
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="relative overflow-hidden" style={{ background: "var(--ca-hero-glow)" }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "var(--ca-grid)", backgroundSize: "32px 32px" }}
        />
        <Section className="relative py-12 sm:py-16">
          <article className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-[28px] border border-[var(--ca-border)] bg-[#FAFBFE] shadow-[0_24px_64px_-30px_rgba(12,24,48,0.45)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(ellipse at top right, color-mix(in srgb, var(--ca-panther) 12%, transparent), transparent 55%)",
              }}
            />
            <div className="relative z-10 p-5 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BrandLogo size={60} priority />
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-panther)]">
                      Cyber Alert DRC · Entreprises
                    </p>
                    <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-3xl">
                      Sécurisez votre présence numérique
                    </h1>
                  </div>
                </div>
                <Badge tone="info">Sur devis</Badge>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--ca-ink-muted)] sm:text-base">
                Approche professionnelle pour banques, fintechs, opérateurs et organisations :
                cadrage clair, analyse non intrusive, restitution exécutive et technique.
                Audits à partir de 100 USD (configurable).
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <MetaChip label="RDC & Afrique francophone" />
                <MetaChip label="Rapport exécutif + technique" />
                <MetaChip label="Retest optionnel" />
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#demande" className="sm:flex-1">
                  <Button className="w-full">
                    <IconBuilding size={18} />
                    Demander un audit
                  </Button>
                </a>
                <Link href="/pricing" className="sm:flex-1">
                  <Button variant="secondary" className="w-full">
                    Voir les tarifs
                    <IconArrowRight size={16} />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative z-10 border-t border-white/10 bg-gradient-to-r from-[#0b1020] via-[#141b2f] to-[#1c2438] px-5 py-4 sm:px-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">
                Méthode
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                Audit ciblé, livrables clairs, priorisation des risques - un interlocuteur unique
                du brief au rapport.
              </p>
            </div>
          </article>
        </Section>
      </div>

      <Section className="pb-6 pt-2">
        <h2 className="text-center text-sm font-extrabold uppercase tracking-[0.16em] text-[var(--ca-ink-subtle)]">
          Offres entreprises
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <FeatureCard
              key={s.title}
              icon={s.icon}
              title={s.title}
              description={s.description}
              accent={s.accent}
            />
          ))}
        </div>
      </Section>

      <Section className="py-10">
        <h2 className="text-center text-sm font-extrabold uppercase tracking-[0.16em] text-[var(--ca-ink-subtle)]">
          Méthode
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <FeatureCard
              key={s.n}
              eyebrow={`Étape ${s.n}`}
              icon={s.icon}
              title={s.title}
              description={s.text}
              accent="var(--ca-panther)"
            />
          ))}
        </div>
      </Section>

      <Section className="pb-10">
        <h2 className="text-center text-sm font-extrabold uppercase tracking-[0.16em] text-[var(--ca-ink-subtle)]">
          Pourquoi Cyber Alert DRC
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {GUARANTEES.map((g) => (
            <FeatureCard
              key={g.title}
              icon={g.icon}
              title={g.title}
              description={g.description}
              accent="var(--ca-accent)"
            />
          ))}
        </div>
      </Section>

      <Section id="demande" className="pb-16">
        <article className="mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-[var(--ca-border)] bg-white shadow-[0_24px_64px_-30px_rgba(12,24,48,0.35)]">
          <div className="border-b border-[var(--ca-border)] bg-[var(--ca-surface)]/80 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <BrandLogo size={48} />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--ca-accent)]">
                  Demande d&apos;audit
                </p>
                <h2 className="text-lg font-extrabold text-[var(--ca-ink)]">
                  Parlez-nous de votre périmètre
                </h2>
              </div>
            </div>
          </div>

          {done ? (
            <div className="space-y-4 p-5 sm:p-7">
              <div className="flex items-center gap-3 rounded-[22px] border border-[var(--ca-low)]/25 bg-[var(--ca-low-soft)]/60 px-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ca-low)] text-white">
                  <IconCheck size={20} />
                </span>
                <div>
                  <p className="font-bold text-[var(--ca-ink)]">Demande reçue</p>
                  <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
                    Nous vous recontacterons pour préciser le périmètre et le devis.
                  </p>
                </div>
              </div>
              <Link href="/">
                <Button variant="secondary" className="w-full">
                  Retour à l&apos;accueil
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold">Organisation</label>
                  <Input name="organization" placeholder="Nom de l'entreprise" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Contact</label>
                  <Input name="contactName" placeholder="Nom du contact" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Email</label>
                  <Input name="contactEmail" type="email" placeholder="email@entreprise.com" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Téléphone</label>
                  <Input name="contactPhone" placeholder="Mobile Money / WhatsApp" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Service</label>
                  <select
                    name="serviceType"
                    className="w-full rounded-2xl border border-[var(--ca-border-strong)] bg-white/90 px-4 py-3.5 text-[var(--ca-ink)] shadow-[var(--ca-inset)] outline-none focus:border-[var(--ca-accent)] focus:ring-4 focus:ring-[var(--ca-accent-soft)]"
                    defaultValue="security_audit"
                  >
                    <option value="security_audit">Security Audit</option>
                    <option value="web_audit">Audit application web</option>
                    <option value="api_audit">Audit API</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="custom">Sur devis</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Contexte <span className="font-medium text-[var(--ca-ink-subtle)]">(facultatif)</span>
                </label>
                <TextArea
                  name="message"
                  rows={4}
                  placeholder="Sites, apps, délais, contraintes de conformité…"
                />
              </div>
              {error ? (
                <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2.5 text-sm font-medium text-[var(--ca-high)]">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Envoi…" : "Envoyer la demande"}
              </Button>
            </form>
          )}
        </article>
      </Section>
    </div>
  );
}
