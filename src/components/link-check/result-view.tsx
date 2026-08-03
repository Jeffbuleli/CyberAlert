import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, Button, MetaChip, SurfaceCard } from "@/components/ui/primitives";
import { RiskRadar, SignalHistogram } from "@/components/ui/visuals";
import { IconAlert, IconCheck, IconFlag, IconCode } from "@/components/icons";
import type { LinkSignal, RiskLevel } from "@/types/security";
import { riskHeadline } from "@/lib/ai/providers";

const toneFor = (level: RiskLevel) =>
  level === "low" ? "low" : level === "caution" ? "caution" : "high";

export function LinkCheckResultView({
  id,
  url,
  domain,
  riskLevel,
  score,
  overview,
  summary,
  recommendation,
  signals,
  aiProvider,
}: {
  id: string;
  url: string;
  domain?: string | null;
  riskLevel: RiskLevel;
  score: number;
  overview?: string | null;
  summary: string;
  recommendation: string;
  signals: LinkSignal[];
  aiProvider?: "template" | "mcbuleli-ai" | null;
}) {
  const visible = signals.filter((s) => s.severity !== "info" || riskLevel === "low");
  const Icon = riskLevel === "low" ? IconCheck : IconAlert;
  const accent =
    riskLevel === "high"
      ? "var(--ca-high)"
      : riskLevel === "caution"
        ? "var(--ca-caution)"
        : "var(--ca-low)";

  return (
    <div className="space-y-6">
      {/* Ticket / badge shell - inspired by Hackathon pass */}
      <article
        className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] border border-[var(--ca-border)] bg-[#FAFBFE] shadow-[0_24px_64px_-30px_rgba(12,24,48,0.45)]"
        style={{ ["--result-accent" as string]: accent }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at top right, color-mix(in srgb, var(--result-accent) 18%, transparent), transparent 55%)",
          }}
        />

        <div className="relative z-10 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo size={64} priority />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-accent)]">
                  Cyber Alert DRC · Pass
                </p>
                <p className="text-sm font-bold text-[var(--ca-ink)]">
                  Rapport de vérification
                </p>
              </div>
            </div>
            <Badge tone={toneFor(riskLevel)}>{riskHeadline(riskLevel)}</Badge>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <MetaChip label={domain || "domaine inconnu"} />
            <MetaChip label={`Score ${score}/100`} />
            <MetaChip label={`${signals.length} signaux`} />
            <MetaChip
              label={aiProvider === "mcbuleli-ai" ? "McBuleli AI" : "Analyse technique"}
            />
          </div>

          <div className="mt-7 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <RiskRadar score={score} riskLevel={riskLevel} />
            <div>
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.45)]"
                  style={{ background: accent }}
                >
                  <Icon size={22} />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-3xl">
                    {riskHeadline(riskLevel)}
                  </h1>
                  <p className="mt-1.5 break-all text-sm text-[var(--ca-ink-muted)]">{url}</p>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-[var(--ca-ink)]">{summary}</p>
            </div>
          </div>

          <div className="mt-7">
            <SignalHistogram signals={signals} />
          </div>
        </div>

        <div
          className="relative z-10 border-t border-white/10 px-5 py-4 sm:px-7"
          style={{
            background:
              "linear-gradient(90deg, #0b1020 0%, #141b2f 55%, color-mix(in srgb, var(--result-accent) 35%, #0b1020) 100%)",
          }}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">
            Recommandation
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/85">{recommendation}</p>
        </div>
      </article>

      {/* McBuleli AI site overview */}
      <SurfaceCard variant="lift" className="overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-[var(--ca-border)] bg-[var(--ca-accent-soft)]/50 px-5 py-3.5">
          <BrandLogo size={48} />
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--ca-accent)]">
              McBuleli AI
            </p>
            <p className="text-sm font-bold text-[var(--ca-ink)]">Aperçu du lien</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-base leading-relaxed text-[var(--ca-ink)]">
            {overview?.trim() ||
              "Aperçu indisponible pour le moment. Les signaux techniques ci-dessous restent la base de la vérification."}
          </p>
          <p className="mt-3 text-[11px] font-medium text-[var(--ca-ink-subtle)]">
            Aperçu informatif - ce n&apos;est pas une preuve de sécurité ni une garantie.
          </p>
        </div>
      </SurfaceCard>

      <div>
        <h2 className="text-lg font-semibold text-[var(--ca-ink)]">Signaux vérifiés</h2>
        <ul className="mt-4 space-y-3">
          {visible.map((s) => (
            <li key={s.id}>
              <SurfaceCard className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      s.severity === "high"
                        ? "high"
                        : s.severity === "medium"
                          ? "medium"
                          : s.severity === "info"
                            ? "info"
                            : "low"
                    }
                  >
                    {s.severity}
                  </Badge>
                  <span className="font-medium text-[var(--ca-ink)]">{s.title}</span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--ca-ink-muted)]">{s.description}</p>
              </SurfaceCard>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {(riskLevel === "high" || riskLevel === "caution") && (
          <Link href={`/report?url=${encodeURIComponent(url)}&from=${id}`}>
            <Button variant="danger" className="w-full sm:w-auto">
              <IconFlag size={18} />
              Signaler ce site
            </Button>
          </Link>
        )}
        <Link href={`/developers?from=check&url=${encodeURIComponent(url)}`}>
          <Button variant="secondary" className="w-full sm:w-auto">
            <IconCode size={18} />
            Vous développez ce site ?
          </Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" className="w-full sm:w-auto">
            Vérifier un autre lien
          </Button>
        </Link>
      </div>
    </div>
  );
}
