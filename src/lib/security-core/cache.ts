import { createHash } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb, analysisCache } from "@/db";

export function cacheKeyForUrl(normalizedUrl: string): string {
  return createHash("sha256").update(normalizedUrl.trim().toLowerCase()).digest("hex");
}

export function cacheTtlHours(): number {
  const n = Number(process.env.ANALYSIS_CACHE_TTL_HOURS || "24");
  return Number.isFinite(n) && n > 0 ? n : 24;
}

export async function lookupAnalysisCache(normalizedUrl: string) {
  try {
    const db = getDb();
    const key = cacheKeyForUrl(normalizedUrl);
    const now = new Date();
    const [row] = await db
      .select()
      .from(analysisCache)
      .where(and(eq(analysisCache.cacheKey, key), gt(analysisCache.expiresAt, now)))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function storeAnalysisCache(input: {
  normalizedUrl: string;
  domain: string | null;
  linkCheckId: string;
  riskLevel: string;
  verdict: string;
  payload: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    const key = cacheKeyForUrl(input.normalizedUrl);
    const expiresAt = new Date(Date.now() + cacheTtlHours() * 3600_000);
    await db
      .insert(analysisCache)
      .values({
        cacheKey: key,
        normalizedUrl: input.normalizedUrl,
        domain: input.domain,
        linkCheckId: input.linkCheckId,
        riskLevel: input.riskLevel,
        verdict: input.verdict,
        payload: input.payload,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: analysisCache.cacheKey,
        set: {
          linkCheckId: input.linkCheckId,
          riskLevel: input.riskLevel,
          verdict: input.verdict,
          payload: input.payload,
          expiresAt,
          domain: input.domain,
          normalizedUrl: input.normalizedUrl,
        },
      });
  } catch (err) {
    console.warn("[cache] store failed", err instanceof Error ? err.message : err);
  }
}
