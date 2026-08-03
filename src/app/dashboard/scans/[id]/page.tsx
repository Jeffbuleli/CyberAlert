import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, securityScans, findings } from "@/db";
import { Badge, Button, MetaChip, Section, SurfaceCard } from "@/components/ui/primitives";
import { FindingHistogram, RiskRadar } from "@/components/ui/visuals";
import { FindingStatusForm } from "@/components/dashboard/finding-status-form";
import { BrandLogo } from "@/components/brand/logo";
import { IconArrowRight } from "@/components/icons";

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

function riskFromScore(score: number): "low" | "caution" | "high" {
  if (score >= 70) return "low";
  if (score >= 40) return "caution";
  return "high";
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
  const score = scoreFromFindings(rows);
  const riskLevel = riskFromScore(score);
  const accent =
    riskLevel === "high"
      ? "var(--ca-high)"
      : riskLevel === "caution"
        ? "var(--ca-caution)"
        : "var(--ca-low)";

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
                <p className="text-sm font-bold text-[var(--ca-ink)]">Analyse développeur</p>
              </div>
            </div>
            <Badge tone={riskLevel === "low" ? "low" : riskLevel === "caution" ? "caution" : "high"}>
              {scan.status}
            </Badge>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <MetaChip label={`Score ${score}/100`} />
            <MetaChip label={`${rows.length} findings`} />
            <MetaChip label={scan.provider} />
          </div>

          <div className="mt-7 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <RiskRadar score={score} riskLevel={riskLevel} />
            <div>
              <h1 className="break-all text-xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-2xl">
                {scan.targetUrl}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ca-ink-muted)]">
                {scan.executiveSummary ||
                  scan.summary ||
                  "Résumé exécutif en cours - consultez les findings ci-dessous."}
              </p>
            </div>
          </div>

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
            {scan.technicalSummary ||
              "Détails techniques disponibles dès que le scan est terminé."}
          </p>
        </div>
      </article>

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
            <li className="text-sm text-[var(--ca-ink-muted)]">Aucun finding pour ce scan.</li>
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
