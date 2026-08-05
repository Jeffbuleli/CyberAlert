import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, linkChecks } from "@/db";
import { Section } from "@/components/ui/primitives";
import { LinkCheckResultClient } from "@/components/link-check/result-client";
import type { LinkSignal, Verdict } from "@/types/security";
import { parseRiskLevel, riskLevelToVerdict } from "@/types/security";
import { assessmentConfidence } from "@/lib/link-analysis/verdict";

type Props = { params: Promise<{ id: string }> };

type StoredAi = {
  headline?: string;
  why?: string[];
  advice?: string;
  incomplete?: boolean;
};

export default async function CheckResultPage({ params }: Props) {
  const { id } = await params;
  let row;
  try {
    const db = getDb();
    [row] = await db.select().from(linkChecks).where(eq(linkChecks.id, id)).limit(1);
  } catch {
    notFound();
  }
  if (!row) notFound();

  const riskLevel = parseRiskLevel(row.riskLevel);
  const signals = (row.signals || []) as LinkSignal[];
  const verdict = ((row.verdict as Verdict | null) || riskLevelToVerdict(riskLevel)) as Verdict;
  const confidence =
    typeof row.confidence === "number"
      ? row.confidence
      : assessmentConfidence(riskLevel, signals);
  const ai = (row.aiAnalysisJson || {}) as StoredAi;

  return (
    <Section className="py-10 sm:py-14">
      <LinkCheckResultClient
        id={row.id}
        url={row.urlNormalized}
        domain={row.domain}
        riskLevel={riskLevel}
        score={row.score}
        confidence={confidence}
        verdict={verdict}
        overview={row.aiOverview}
        summary={row.aiSummary || ""}
        recommendation={row.aiRecommendation || ""}
        signals={signals}
        aiProvider={(row.aiProvider as "template" | "mcbuleli-ai" | null) || null}
        why={Array.isArray(ai.why) ? ai.why : null}
        headline={typeof ai.headline === "string" ? ai.headline : null}
        needsDeepAnalysis={row.needsDeepAnalysis ?? false}
        incomplete={Boolean(ai.incomplete)}
        initialStatus={row.status || "completed"}
        analyzedAt={row.createdAt?.toISOString?.() ?? null}
        cacheHit={row.cacheHit ?? false}
      />
    </Section>
  );
}
