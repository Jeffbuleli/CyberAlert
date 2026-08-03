import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, projects, securityScans, findings } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { consumeQuota, getQuotaRemaining } from "@/lib/quotas";
import { getSecurityScanProvider } from "@/lib/security/providers";
import { getAIProvider } from "@/lib/ai/providers";
import { trackEvent } from "@/lib/analytics";

const schema = z.object({
  url: z.string().min(3).max(2048),
  projectName: z.string().min(1).max(120),
  projectId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Données invalides." }, { status: 400 });
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
    })
    .returning();

  try {
    const provider = getSecurityScanProvider();
    const result = await provider.scan({ url: parsed.data.url.trim(), projectId });
    const ai = getAIProvider();
    const executive = await ai.executiveSummary?.(result);
    const technical = await ai.technicalSummary?.(result);

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
        summary: `${result.length} finding(s)`,
        executiveSummary: executive ?? null,
        technicalSummary: technical ?? null,
        completedAt: new Date(),
      })
      .where(eq(securityScans.id, scan.id));

    await trackEvent("developer_scan_completed", { id: scan.id, findings: result.length });
    return Response.json({ id: scan.id, findings: result.length });
  } catch (e) {
    await db
      .update(securityScans)
      .set({ status: "failed", summary: e instanceof Error ? e.message : "failed" })
      .where(eq(securityScans.id, scan.id));
    return Response.json({ error: "scan_failed", id: scan.id }, { status: 500 });
  }
}
