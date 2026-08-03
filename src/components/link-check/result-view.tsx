import Link from "next/link";
import { Badge, Button, SurfaceCard } from "@/components/ui/primitives";
import { RiskRadar } from "@/components/ui/visuals";
import { IconAlert, IconCheck, IconFlag, IconCode } from "@/components/icons";
import type { LinkSignal, RiskLevel } from "@/types/security";
import { riskHeadline } from "@/lib/ai/providers";

const toneFor = (level: RiskLevel) =>
  level === "low" ? "low" : level === "caution" ? "caution" : "high";

export function LinkCheckResultView({
  id,
  url,
  riskLevel,
  score,
  summary,
  recommendation,
  signals,
}: {
  id: string;
  url: string;
  riskLevel: RiskLevel;
  score: number;
  summary: string;
  recommendation: string;
  signals: LinkSignal[];
}) {
  const visible = signals.filter((s) => s.severity !== "info" || riskLevel === "low");
  const Icon = riskLevel === "low" ? IconCheck : IconAlert;

  return (
    <div className="space-y-8">
      <SurfaceCard variant="lift" className="overflow-hidden p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <RiskRadar score={score} riskLevel={riskLevel} />
          <div>
            <div className="flex items-start gap-4">
              <span
                className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.45)] ${
                  riskLevel === "low"
                    ? "bg-[var(--ca-low)]"
                    : riskLevel === "caution"
                      ? "bg-[var(--ca-caution)]"
                      : "bg-[var(--ca-high)]"
                }`}
              >
                <Icon size={24} />
              </span>
              <div className="min-w-0">
                <Badge tone={toneFor(riskLevel)}>{riskHeadline(riskLevel)}</Badge>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ca-ink)] sm:text-3xl">
                  {riskLevel === "high" ? "Attention - risque élevé" : riskHeadline(riskLevel)}
                </h1>
                <p className="mt-2 break-all text-sm text-[var(--ca-ink-muted)]">{url}</p>
              </div>
            </div>
            <p className="mt-5 text-base leading-relaxed text-[var(--ca-ink)]">{summary}</p>
          </div>
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

      <SurfaceCard variant="panther" className="p-5 sm:p-6">
        <h2 className="font-semibold text-white">Recommandation</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{recommendation}</p>
      </SurfaceCard>

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
