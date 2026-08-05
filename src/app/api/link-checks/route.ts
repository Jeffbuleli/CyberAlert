import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, linkChecks } from "@/db";
import { analyzeLink } from "@/lib/link-analysis/engine";
import { applyMcBuleliAnalysis, getAIProvider } from "@/lib/ai/providers";
import { trackEvent } from "@/lib/analytics";
import {
  checkRateLimit,
  clientIpFromRequest,
  hashIp,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { getRateLimit } from "@/lib/env";
import { normalizeUrlInput } from "@/lib/security-core/gateway";
import { lookupAnalysisCache, storeAnalysisCache } from "@/lib/security-core/cache";
import { enqueueDeepAnalysis } from "@/lib/security-core/deep-worker";
import { getHackerAIConfig } from "@/lib/security-core/hackerai";

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
  force: z.boolean().optional(),
});

function analyticsRiskKey(risk: string): string {
  if (risk === "low") return "risk_low";
  if (risk === "caution") return "risk_medium";
  if (risk === "unknown") return "risk_unknown";
  return "risk_high";
}

export async function POST(req: Request) {
  const started = Date.now();
  const ip = clientIpFromRequest(req);
  const limit = getRateLimit("link");
  const rl = checkRateLimit(`link:${ip}`, limit, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterMs);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid_url", message: "URL invalide." }, { status: 400 });
  }

  await trackEvent("link_check_started", { length: parsed.data.url.length }, hashIp(ip));

  // Cache lookup (fast path)
  let normalizedForCache = parsed.data.url;
  try {
    normalizedForCache = normalizeUrlInput(parsed.data.url).toString();
  } catch {
    /* engine will handle invalid */
  }

  if (!parsed.data.force) {
    const cached = await lookupAnalysisCache(normalizedForCache);
    if (cached?.linkCheckId) {
      await trackEvent(
        "link_check_cache_hit",
        { id: cached.linkCheckId, risk: cached.riskLevel },
        hashIp(ip),
      );
      return Response.json({
        id: cached.linkCheckId,
        riskLevel: cached.riskLevel,
        verdict: cached.verdict,
        cacheHit: true,
        status: "completed",
        analyzedAt: cached.createdAt,
      });
    }
  }

  const engine = await analyzeLink(parsed.data.url);
  const ai = await getAIProvider().analyzeLinkResult(engine);
  const analysis = applyMcBuleliAnalysis(engine, ai);

  const db = getDb();
  const needsDeep = Boolean(analysis.needsDeepAnalysis && !analysis.blocked);
  const status = needsDeep ? "deep_analysis" : "completed";

  const [row] = await db
    .insert(linkChecks)
    .values({
      urlRaw: analysis.urlRaw,
      urlNormalized: analysis.urlNormalized,
      domain: analysis.domain,
      riskLevel: analysis.riskLevel,
      score: analysis.score,
      signals: analysis.signals,
      aiOverview: ai.overview,
      aiSummary: ai.summary,
      aiRecommendation: ai.recommendation,
      aiSourceSignalIds: ai.sourceSignalIds,
      aiProvider: ai.provider,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      evidenceJson: analysis.evidenceItems ?? [],
      dimensionsJson: analysis.dimensions ?? {},
      toolsUsed: analysis.toolsUsed ?? [],
      needsDeepAnalysis: needsDeep,
      aiAnalysisJson: {
        headline: ai.headline,
        why: ai.why,
        advice: ai.advice,
        reasoning: ai.reasoning,
        needs_deep_analysis: ai.needs_deep_analysis,
        incomplete: ai.incomplete,
        risk_suggestion: ai.risk_suggestion,
        verdict_suggestion: ai.verdict_suggestion,
        source_evidence_ids: ai.sourceEvidenceIds,
      },
      status,
      hackeraiJson: { invoked: false, status: null },
      cacheHit: false,
      durationMs: Date.now() - started,
      ipHash: hashIp(ip),
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    })
    .returning({ id: linkChecks.id });

  if (needsDeep) {
    const cfg = getHackerAIConfig();
    await enqueueDeepAnalysis({
      linkCheckId: row.id,
      analysisId: row.id,
      url: analysis.urlRaw,
      normalizedUrl: analysis.urlNormalized,
      domain: analysis.domain,
      riskLevel: analysis.riskLevel,
      verdict: analysis.verdict,
      needsDeepAnalysis: true,
      evidenceSummary: (analysis.evidenceItems ?? []).slice(0, 12).map((e) => e.claim),
      signalCodes: analysis.signals.map((s) => s.code),
    });
    await trackEvent(
      "hackerai_enqueued",
      { id: row.id, mode: cfg.mode },
      hashIp(ip),
    );
  } else {
    await storeAnalysisCache({
      normalizedUrl: analysis.urlNormalized,
      domain: analysis.domain,
      linkCheckId: row.id,
      riskLevel: analysis.riskLevel,
      verdict: analysis.verdict,
      payload: {
        confidence: analysis.confidence,
        score: analysis.score,
      },
    });
  }

  await trackEvent(
    "link_check_completed",
    {
      id: row.id,
      risk: analysis.riskLevel,
      verdict: analysis.verdict,
      deep: needsDeep,
      ai: ai.provider,
    },
    hashIp(ip),
  );
  await trackEvent(analyticsRiskKey(analysis.riskLevel), { id: row.id }, hashIp(ip));

  // refresh status after enqueue
  const [fresh] = await db
    .select({ status: linkChecks.status, hackeraiJson: linkChecks.hackeraiJson })
    .from(linkChecks)
    .where(eq(linkChecks.id, row.id))
    .limit(1);

  return Response.json({
    id: row.id,
    riskLevel: analysis.riskLevel,
    verdict: analysis.verdict,
    confidence: analysis.confidence,
    blocked: analysis.blocked,
    needsDeepAnalysis: needsDeep,
    status: fresh?.status ?? status,
    hackerai: fresh?.hackeraiJson ?? null,
    toolsUsed: analysis.toolsUsed ?? [],
    aiProvider: ai.provider,
    incomplete: ai.incomplete,
    cacheHit: false,
    durationMs: Date.now() - started,
  });
}
