import { z } from "zod";
import { getDb, linkChecks } from "@/db";
import { analyzeLink } from "@/lib/link-analysis/engine";
import { getAIProvider } from "@/lib/ai/providers";
import { trackEvent } from "@/lib/analytics";
import {
  checkRateLimit,
  clientIpFromRequest,
  hashIp,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { getRateLimit } from "@/lib/env";

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
});

export async function POST(req: Request) {
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

  const analysis = await analyzeLink(parsed.data.url);
  const ai = await getAIProvider().explainLinkResult(analysis);

  const db = getDb();
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
      ipHash: hashIp(ip),
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    })
    .returning({ id: linkChecks.id });

  await trackEvent(
    "link_check_completed",
    { id: row.id, risk: analysis.riskLevel },
    hashIp(ip),
  );
  await trackEvent(
    analysis.riskLevel === "low"
      ? "risk_low"
      : analysis.riskLevel === "caution"
        ? "risk_medium"
        : "risk_high",
    { id: row.id },
    hashIp(ip),
  );

  return Response.json({
    id: row.id,
    riskLevel: analysis.riskLevel,
    blocked: analysis.blocked,
    aiProvider: ai.provider,
  });
}
