import Link from "next/link";
import { LinkCheckForm } from "@/components/link-check/link-check-form";
import { Section, SurfaceCard } from "@/components/ui/primitives";
import { ServiceTile } from "@/components/ui/visuals";
import {
  IconBuilding,
  IconCode,
  IconFlag,
  IconLink,
} from "@/components/icons";

type Props = { searchParams?: Promise<{ url?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const sp = (await searchParams) || {};
  const initialUrl = typeof sp.url === "string" ? sp.url : "";

  return (
    <div>
      <div className="relative overflow-hidden" style={{ background: "var(--ca-hero-glow)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "var(--ca-grid)", backgroundSize: "32px 32px" }} />
        <Section className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-center py-12 sm:py-16">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex items-center rounded-[22px] border border-[var(--ca-border)] bg-white/80 px-4 py-2 text-xs font-semibold text-[var(--ca-ink-muted)] shadow-[var(--ca-shadow-soft)] backdrop-blur">
                <span className="text-[11px] font-extrabold tracking-tight text-[var(--ca-ink)]">
                  McBuleli AI · aperçu du lien
                </span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-5xl sm:leading-[1.08]">
                Avez-vous reçu un lien ?
                <span className="mt-2 block bg-gradient-to-r from-[var(--ca-accent)] to-[#0f9d7a] bg-clip-text text-transparent">
                  Vérifiez-le avant de cliquer.
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-base text-[var(--ca-ink-muted)] sm:text-lg lg:mx-0">
                Collez l&apos;URL reçue sur WhatsApp, SMS ou email. Résultat clair en quelques secondes.
              </p>
              <SurfaceCard variant="lift" className="mt-8 p-4 sm:p-6">
                <LinkCheckForm initialUrl={initialUrl} />
              </SurfaceCard>
            </div>

            <SurfaceCard variant="panther" className="relative hidden overflow-hidden p-6 lg:block">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/55">
                Trust pass
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">Risque + aperçu McBuleli AI</h2>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: "Faible", color: "var(--ca-low)" },
                  { label: "Prudence", color: "var(--ca-caution)" },
                  { label: "Élevé", color: "var(--ca-high)" },
                  { label: "Critique", color: "var(--ca-critical)" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur"
                  >
                    <span
                      className="mb-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: item.color, boxShadow: `0 0 12px ${item.color}` }}
                    />
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-relaxed text-white/65">
                Signaux techniques d&apos;abord - McBuleli AI explique le lien ensuite. Jamais « 100 % sûr ».
              </p>
              <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-[var(--ca-accent)]/30 blur-3xl" />
            </SurfaceCard>
          </div>
        </Section>
      </div>

      <Section className="py-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ca-ink-subtle)]">
          Autres services
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <ServiceTile
            href="/report"
            title="Signaler un site"
            description="Phishing, arnaque ou usurpation - sans compte obligatoire."
            accent="var(--ca-high)"
            icon={<IconFlag />}
          />
          <ServiceTile
            href="/developers"
            title="Tester mon application"
            description="1 à 2 scans gratuits pour les développeurs."
            accent="var(--ca-accent)"
            icon={<IconCode />}
          />
          <ServiceTile
            href="/business"
            title="Sécuriser mon organisation"
            description="Audits et monitoring pour entreprises."
            accent="var(--ca-panther)"
            icon={<IconBuilding />}
          />
        </div>
        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-[var(--ca-ink-subtle)]">
          <IconLink size={16} />
          Le grand public vérifie - les développeurs améliorent - les entreprises se protègent.
        </p>
      </Section>
    </div>
  );
}
