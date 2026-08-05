import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, projects, securityScans, findings } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { consumeQuota, getQuotaRemaining } from "@/lib/quotas";
import { getSecurityScanProvider } from "@/lib/security/providers";
import {
  applyMcBuleliAnalysis,
  getAIProvider,
} from "@/lib/ai/providers";
import { trackEvent } from "@/lib/analytics";

const schema = z.object({
  url: z.string().min(3).max(2048),
  projectName: z.string().min(1).max(120),
  projectId: z.string().uuid().optional(),
  authorized: z.literal(true),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const missingAuth = !parsed.success && parsed.error.issues.some((i) => i.path.includes("authorized"));
    return Response.json(
      {
        error: missingAuth ? "authorization_required" : "invalid",
        message: missingAuth
          ? "Vous devez confirmer que vous contrôlez cette URL et autorisez un scan non destructif."
          : "Données invalides.",
      },
      { status: 400 },
    );
  }

  const quota = await getQuotaRemaining(user.id, "scans");
  if (quota.remaining <= 0) {
    await trackEvent("free_scan_remaining", { remaining: 0, userId: user.id });
    return Response.json({ error: "quota_exceeded", message: "Quota épuisé." }, { status: 402 });
  }

  const db = getDb();
  let projectId = parsed.data.projectId;
  if (!projectId) {
    const [proj] = await db
      .insert(projects)
      .values({
        userId: user.id,
        name: parsed.data.projectName,
        primaryUrl: parsed.data.url.trim(),
      })
      .returning({ id: projects.id });
    projectId = proj.id;
  } else {
    const [owned] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
      .limit(1);
    if (!owned) return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await trackEvent("developer_scan_started", { userId: user.id });
  const consumed = await consumeQuota(user.id, "scans", 1);
  if (!consumed.ok) {
    return Response.json({ error: "quota_exceeded" }, { status: 402 });
  }

  const [scan] = await db
    .insert(securityScans)
    .values({
      projectId,
      userId: user.id,
      provider: getSecurityScanProvider().id,
      status: "running",
      targetUrl: parsed.data.url.trim(),
      authorizedByUser: true,
    })
    .returning();

  try {
    const provider = getSecurityScanProvider();
    const { findings: result, analysis } = await provider.scan({
      url: parsed.data.url.trim(),
      projectId,
    });

    const ai = getAIProvider();
    let merged = analysis;
    let aiJson: Record<string, unknown> = {};
    if (analysis) {
      const mcb = await ai.analyzeLinkResult(analysis);
      merged = applyMcBuleliAnalysis(analysis, mcb);
      aiJson = mcb as unknown as Record<string, unknown>;
    }

    const risk = merged?.riskLevel ?? "unknown";
    const verdict = merged?.verdict ?? "unknown";

    const executive =
      (aiJson.overview as string | undefined) ||
      (aiJson.summary as string | undefined) ||
      (await ai.executiveSummary?.(result));
    const technical =
      (Array.isArray(aiJson.why) ? (aiJson.why as string[]).map((w) => `– ${w}`).join("\n") : null) ||
      (await ai.technicalSummary?.(result));

    // Honest executive line when unknown and no high findings
    const honestExecutive =
      risk === "unknown" || risk === "caution" || risk === "high"
        ? executive
        : executive;

    if (result.length) {
      await db.insert(findings).values(
        result.map((f) => ({
          scanId: scan.id,
          title: f.title,
          severity: f.severity,
          confidence: f.confidence,
          category: f.category,
          description: f.description,
          impact: f.impact ?? null,
          evidence: f.evidence,
          affectedAsset: f.affectedAsset ?? null,
          recommendation: f.recommendation ?? null,
          source: f.source,
          status: f.status,
        })),
      );
    }

    await db
      .update(securityScans)
      .set({
        status: "completed",
        summary: `${result.length} finding(s) · verdict ${verdict}`,
        executiveSummary: honestExecutive ?? null,
        technicalSummary: technical ?? null,
        verdict,
        riskLevel: risk,
        confidence: merged?.confidence ?? null,
        evidenceJson: merged?.evidenceItems ?? [],
        dimensionsJson: merged?.dimensions ?? {},
        aiAnalysisJson: aiJson,
        completedAt: new Date(),
      })
      .where(eq(securityScans.id, scan.id));

    await trackEvent("developer_scan_completed", {
      id: scan.id,
      findings: result.length,
      risk,
      verdict,
    });
    return Response.json({
      id: scan.id,
      findings: result.length,
      riskLevel: risk,
      verdict,
    });
  } catch (e) {
    await db
      .update(securityScans)
      .set({ status: "failed", summary: e instanceof Error ? e.message : "failed" })
      .where(eq(securityScans.id, scan.id));
    return Response.json({ error: "scan_failed", id: scan.id }, { status: 500 });
  }
}
