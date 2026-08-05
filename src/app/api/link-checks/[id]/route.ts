import { eq } from "drizzle-orm";
import { getDb, linkChecks, analysisJobs } from "@/db";
import { parseRiskLevel, riskLevelToVerdict } from "@/types/security";
import type { LinkSignal } from "@/types/security";
import { assessmentConfidence } from "@/lib/link-analysis/verdict";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select().from(linkChecks).where(eq(linkChecks.id, id)).limit(1);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  const riskLevel = parseRiskLevel(row.riskLevel);
  const signals = (row.signals || []) as LinkSignal[];
  const verdict = (row.verdict as string) || riskLevelToVerdict(riskLevel);
  const confidence =
    typeof row.confidence === "number"
      ? row.confidence
      : assessmentConfidence(riskLevel, signals);

  const jobs = await db
    .select({
      id: analysisJobs.id,
      status: analysisJobs.status,
      provider: analysisJobs.provider,
      externalJobId: analysisJobs.externalJobId,
      updatedAt: analysisJobs.updatedAt,
    })
    .from(analysisJobs)
    .where(eq(analysisJobs.linkCheckId, id));

  return Response.json({
    id: row.id,
    url: row.urlNormalized,
    riskLevel,
    verdict,
    confidence,
    score: row.score,
    status: row.status,
    signals,
    dimensions: row.dimensionsJson ?? {},
    evidence: row.evidenceJson ?? [],
    toolsUsed: row.toolsUsed ?? [],
    needsDeepAnalysis: row.needsDeepAnalysis ?? false,
    hackerai: row.hackeraiJson ?? {},
    jobs,
    cacheHit: row.cacheHit ?? false,
    durationMs: row.durationMs,
    summary: row.aiSummary,
    recommendation: row.aiRecommendation,
    overview: row.aiOverview,
    aiAnalysis: row.aiAnalysisJson ?? {},
    provider: row.aiProvider,
    createdAt: row.createdAt,
  });
}
