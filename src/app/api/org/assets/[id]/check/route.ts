import { and, eq } from "drizzle-orm";
import { getDb, orgAssets, orgAlerts } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { analyzeLink } from "@/lib/link-analysis/engine";
import { applyMcBuleliAnalysis, getAIProvider } from "@/lib/ai/providers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();
  const [asset] = await db
    .select()
    .from(orgAssets)
    .where(and(eq(orgAssets.id, id), eq(orgAssets.userId, user.id)))
    .limit(1);
  if (!asset) return Response.json({ error: "not_found" }, { status: 404 });

  try {
    const engine = await analyzeLink(asset.url, { fetchRemote: true });
    const ai = await getAIProvider().analyzeLinkResult(engine);
    const merged = applyMcBuleliAnalysis(engine, ai);

    await db
      .update(orgAssets)
      .set({
        domain: merged.domain,
        lastVerdict: merged.verdict,
        lastRiskLevel: merged.riskLevel,
        lastConfidence: merged.confidence,
        lastCheckedAt: new Date(),
        lastSummary: ai.overview || ai.summary || null,
        updatedAt: new Date(),
      })
      .where(eq(orgAssets.id, asset.id));

    const shouldAlert =
      merged.riskLevel === "high" ||
      merged.riskLevel === "caution" ||
      merged.riskLevel === "unknown";

    let alertId: string | null = null;
    if (shouldAlert) {
      const [alert] = await db
        .insert(orgAlerts)
        .values({
          assetId: asset.id,
          userId: user.id,
          severity:
            merged.riskLevel === "high"
              ? "high"
              : merged.riskLevel === "caution"
                ? "medium"
                : "info",
          title: `Verdict ${merged.verdict} — ${asset.label}`,
          body:
            ai.overview ||
            ai.summary ||
            `Dernière vérification : risque ${merged.riskLevel}. UNKNOWN ≠ SAFE si identité non confirmée.`,
          status: "open",
        })
        .returning({ id: orgAlerts.id });
      alertId = alert.id;
    }

    return Response.json({
      assetId: asset.id,
      riskLevel: merged.riskLevel,
      verdict: merged.verdict,
      confidence: merged.confidence,
      alertId,
    });
  } catch (e) {
    return Response.json(
      { error: "check_failed", message: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
