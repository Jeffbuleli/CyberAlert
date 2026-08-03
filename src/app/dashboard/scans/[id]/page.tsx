import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, securityScans, findings } from "@/db";
import { Section, Badge } from "@/components/ui/primitives";
import { FindingStatusForm } from "@/components/dashboard/finding-status-form";

type Props = { params: Promise<{ id: string }> };

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

  return (
    <Section className="py-10 sm:py-14">
      <p className="text-sm text-[var(--ca-ink-muted)]">Scan</p>
      <h1 className="mt-1 break-all text-2xl font-bold">{scan.targetUrl}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{scan.status}</Badge>
        <Badge tone="info">{scan.provider}</Badge>
      </div>

      {scan.executiveSummary ? (
        <div className="mt-8 rounded-2xl border border-[var(--ca-border)] bg-white p-5">
          <h2 className="font-semibold">Executive Summary</h2>
          <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">{scan.executiveSummary}</p>
        </div>
      ) : null}

      {scan.technicalSummary ? (
        <div className="mt-4 rounded-2xl border border-[var(--ca-border)] bg-white p-5">
          <h2 className="font-semibold">Technical Summary</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-[var(--ca-ink-muted)]">
            {scan.technicalSummary}
          </pre>
        </div>
      ) : null}

      <h2 className="mt-10 font-semibold">Findings</h2>
      <ul className="mt-3 space-y-3">
        {rows.map((f) => (
          <li key={f.id} className="rounded-2xl border border-[var(--ca-border)] bg-white p-4">
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
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-sm text-[var(--ca-ink-muted)]">Aucun finding pour ce scan.</li>
        ) : null}
      </ul>
    </Section>
  );
}
