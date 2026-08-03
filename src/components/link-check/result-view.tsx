import Link from "next/link";
import { Badge, Button } from "@/components/ui/primitives";
import { IconAlert, IconCheck, IconFlag, IconCode } from "@/components/icons";
import type { LinkSignal, RiskLevel } from "@/types/security";
import { riskHeadline } from "@/lib/ai/providers";

const toneFor = (level: RiskLevel) =>
  level === "low" ? "low" : level === "caution" ? "caution" : "high";

export function LinkCheckResultView({
  id,
  url,
  riskLevel,
  summary,
  recommendation,
  signals,
}: {
  id: string;
  url: string;
  riskLevel: RiskLevel;
  summary: string;
  recommendation: string;
  signals: LinkSignal[];
}) {
  const visible = signals.filter((s) => s.severity !== "info" || riskLevel === "low");
  const Icon = riskLevel === "low" ? IconCheck : IconAlert;

  return (
    <div className="space-y-8">
      <div
        className={`rounded-2xl border p-6 sm:p-8 ${
          riskLevel === "low"
            ? "border-[var(--ca-low)]/30 bg-[var(--ca-low-soft)]"
            : riskLevel === "caution"
              ? "border-[var(--ca-caution)]/30 bg-[var(--ca-caution-soft)]"
              : "border-[var(--ca-high)]/30 bg-[var(--ca-high-soft)]"
        }`}
      >
        <div className="flex items-start gap-4">
          <span
            className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              riskLevel === "low"
                ? "bg-[var(--ca-low)] text-white"
                : riskLevel === "caution"
                  ? "bg-[var(--ca-caution)] text-white"
                  : "bg-[var(--ca-high)] text-white"
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
            <p className="mt-4 text-base leading-relaxed text-[var(--ca-ink)]">{summary}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--ca-ink)]">Signaux vérifiés</h2>
        <ul className="mt-4 space-y-3">
          {visible.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-[var(--ca-border)] bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    s.severity === "high"
                      ? "high"
                      : s.severity === "medium"
                        ? "caution"
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
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface)] p-5">
        <h2 className="font-semibold text-[var(--ca-ink)]">Recommandation</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ca-ink-muted)]">{recommendation}</p>
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
