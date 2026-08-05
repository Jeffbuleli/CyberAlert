import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, securityScans, findings } from "@/db";
import { Badge, Button, MetaChip, Section, SurfaceCard } from "@/components/ui/primitives";
import { FindingHistogram, RiskRadar } from "@/components/ui/visuals";
import { FindingStatusForm } from "@/components/dashboard/finding-status-form";
import { BrandLogo } from "@/components/brand/logo";
import {
  IconAlert,
  IconArrowRight,
  IconBan,
  IconHelpCircle,
  IconShieldCheck,
} from "@/components/icons";
import type { RiskLevel } from "@/types/security";
import { riskHeadline } from "@/lib/ai/providers";

type Props = { params: Promise<{ id: string }> };

function scoreFromFindings(rows: { severity: string }[]) {
  let penalty = 0;
  for (const f of rows) {
    if (f.severity === "critical") penalty += 25;
    else if (f.severity === "high") penalty += 15;
    else if (f.severity === "medium") penalty += 8;
    else if (f.severity === "low") penalty += 3;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

function asRiskLevel(v: string | null | undefined): RiskLevel {
  if (v === "low" || v === "caution" || v === "high" || v === "unknown") return v;
  return "unknown";
}

function VerdictIcon({ level, size = 22 }: { level: RiskLevel; size?: number }) {
  if (level === "low") return <IconShieldCheck size={size} />;
  if (level === "unknown") return <IconHelpCircle size={size} />;
  if (level === "high") return <IconBan size={size} />;
  return <IconAlert size={size} />;
}

function accentFor(level: RiskLevel): string {
  if (level === "high") return "var(--ca-high)";
  if (level === "caution") return "var(--ca-caution)";
  if (level === "unknown") return "var(--ca-unknown)";
  return "var(--ca-low)";
}

function badgeTone(level: RiskLevel) {
  if (level === "low") return "low" as const;
  if (level === "caution") return "caution" as const;
  if (level === "unknown") return "unknown" as const;
  return "high" as const;
}

export default async function ScanDetailPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const db = getDb();
  const [scan] = await db
    .select()
    .from(securityScans)
    .where(and(eq(securityScans.id, id), eq(securityScans.userId, user.id)))
    .limit(1);
  if (!scan) notFound();

  const rows = await db.select().from(findings).where(eq(findings.scanId, scan.id));
  const surfaceScore = scoreFromFindings(rows);
  // Evidence verdict wins — never derive "low/trusted" from empty findings.
  const riskLevel = asRiskLevel(scan.riskLevel);
  const accent = accentFor(riskLevel);
  const ai = (scan.aiAnalysisJson || {}) as {
    overview?: string;
    summary?: string;
    recommendation?: string;
    why?: string[];
    headline?: string;
  };
  const headline = ai.headline?.trim() || riskHeadline(riskLevel);

  return (
    <Section className="py-10 sm:py-14">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ca-accent)] hover:underline"
        >
          ← Retour à l&apos;espace
        </Link>
      </div>

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
              <BrandLogo size={56} priority />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-accent)]">
                  Scan Pro · Rapport
                </p>
                <p className="text-sm font-bold text-[var(--ca-ink)]">Evidence → Verdict</p>
              </div>
            </div>
            <Badge tone={badgeTone(riskLevel)}>
              <span className="inline-flex items-center gap-1.5">
                <VerdictIcon level={riskLevel} size={14} />
                {scan.verdict || riskLevel}
              </span>
            </Badge>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <MetaChip label={headline} />
            <MetaChip label={`Confiance ${scan.confidence ?? "—"}%`} />
            <MetaChip label={`Findings ${rows.length}`} />
            <MetaChip label={`Surface ${surfaceScore}/100`} />
            <MetaChip label={scan.provider} />
          </div>

          <div className="mt-7 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <RiskRadar
              score={riskLevel === "unknown" ? scan.confidence || 60 : surfaceScore}
              riskLevel={riskLevel}
            />
            <div>
              <h1 className="break-all text-xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-2xl">
                {scan.targetUrl}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ca-ink-muted)]">
                {ai.overview ||
                  scan.executiveSummary ||
                  scan.summary ||
                  "Résumé basé sur l'Evidence Engine et McBuleli AI."}
              </p>
              {riskLevel === "unknown" ? (
                <p className="mt-2 text-sm font-semibold text-[var(--ca-unknown)]">
                  UNKNOWN ≠ SAFE — aucun finding ne prouve à lui seul la légitimité.
                </p>
              ) : null}
            </div>
          </div>

          {ai.why && ai.why.length ? (
            <ul className="mt-5 space-y-1.5 text-sm text-[var(--ca-ink-muted)]">
              {ai.why.slice(0, 5).map((w) => (
                <li key={w}>– {w}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-7">
            <FindingHistogram findings={rows} />
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
            Synthèse technique
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
            {ai.recommendation ||
              scan.technicalSummary ||
              "Détails techniques disponibles dès que le scan est terminé."}
          </p>
        </div>
      </article>

      <details className="mx-auto mt-6 max-w-3xl rounded-2xl border border-[var(--ca-border)] bg-white/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--ca-ink)]">
          Détails Evidence (dimensions)
        </summary>
        <pre className="mt-3 overflow-x-auto text-xs text-[var(--ca-ink-muted)]">
          {JSON.stringify(
            {
              verdict: scan.verdict,
              riskLevel: scan.riskLevel,
              confidence: scan.confidence,
              dimensions: scan.dimensionsJson,
              evidence: scan.evidenceJson,
            },
            null,
            2,
          )}
        </pre>
      </details>

      <div className="mx-auto mt-8 max-w-3xl">
        <h2 className="text-lg font-semibold text-[var(--ca-ink)]">Findings</h2>
        <ul className="mt-3 space-y-3">
          {rows.map((f) => (
            <li key={f.id}>
              <SurfaceCard className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      f.severity === "critical" || f.severity === "high"
                        ? "high"
                        : f.severity === "medium"
                          ? "caution"
                          : f.severity === "info"
                            ? "info"
                            : "low"
                    }
                  >
                    {f.severity}
                  </Badge>
                  <span className="font-medium">{f.title}</span>
                  <span className="text-xs text-[var(--ca-ink-subtle)]">
                    confidence {f.confidence}% - {f.source}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">{f.description}</p>
                {f.recommendation ? (
                  <p className="mt-2 text-sm font-medium text-[var(--ca-ink)]">
                    Recommandation : {f.recommendation}
                  </p>
                ) : null}
                <div className="mt-3">
                  <FindingStatusForm findingId={f.id} status={f.status} />
                </div>
              </SurfaceCard>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="text-sm text-[var(--ca-ink-muted)]">
              Aucun finding listé — le verdict Evidence ci-dessus reste la référence (pas un feu vert).
            </li>
          ) : null}
        </ul>

        <div className="mt-6">
          <Link href="/dashboard">
            <Button variant="secondary">
              Nouveaux scans
              <IconArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </Section>
  );
}
