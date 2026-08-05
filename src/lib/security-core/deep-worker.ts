import { eq } from "drizzle-orm";
import { getDb, analysisJobs, linkChecks } from "@/db";
import { getHackerAIAdapter } from "@/lib/security-core/hackerai";
import type { DeepInvestigationInput } from "@/lib/security-core/hackerai/types";
import type { LinkSignal } from "@/types/security";

export async function enqueueDeepAnalysis(input: DeepInvestigationInput & { linkCheckId: string }) {
  const db = getDb();
  const adapter = getHackerAIAdapter();
  const available = await adapter.isAvailable();

  const [job] = await db
    .insert(analysisJobs)
    .values({
      linkCheckId: input.linkCheckId,
      provider: adapter.id,
      status: available ? "queued" : "unavailable",
      inputJson: input,
      attempts: 0,
    })
    .returning({ id: analysisJobs.id });

  await db
    .update(linkChecks)
    .set({
      status: available ? "deep_analysis" : "completed",
      needsDeepAnalysis: true,
      hackeraiJson: {
        invoked: available,
        adapter: adapter.id,
        job_db_id: job.id,
        status: available ? "queued" : "unavailable",
      },
    })
    .where(eq(linkChecks.id, input.linkCheckId));

  // Default: in-process fire-and-forget (unchanged behaviour).
  // Opt-in: DEEP_WORKER_MODE=external → leave job queued for scripts/deep-worker.ts
  const workerMode = (process.env.DEEP_WORKER_MODE || "inprocess").trim().toLowerCase();
  if (available) {
    if (workerMode === "external") {
      // Queue only — cyberalert-deep-worker consumes analysis_jobs.
    } else {
      void processDeepJob(job.id).catch((err) => {
        console.warn("[deep-worker]", err instanceof Error ? err.message : err);
      });
    }
  } else {
    await finalizeUnavailable(input.linkCheckId, job.id);
  }

  return { jobId: job.id, available };
}

async function finalizeUnavailable(linkCheckId: string, jobDbId: string) {
  const db = getDb();
  const signal: LinkSignal = {
    id: "hackerai_unavailable",
    code: "hackerai_unavailable",
    title: "Analyse approfondie indisponible",
    severity: "info",
    confidence: 90,
    description:
      "HackerAI n'est pas disponible. Les résultats disponibles ne permettent pas d'établir automatiquement la fiabilité du lien.",
    evidence: ["status=unavailable"],
  };

  const [row] = await db
    .select()
    .from(linkChecks)
    .where(eq(linkChecks.id, linkCheckId))
    .limit(1);
  if (!row) return;

  const signals = [...((row.signals as LinkSignal[]) || []), signal];
  const riskLevel = row.riskLevel === "low" ? "unknown" : row.riskLevel;

  await db
    .update(analysisJobs)
    .set({
      status: "unavailable",
      error: "hackerai_not_configured",
      finishedAt: new Date(),
      updatedAt: new Date(),
      resultJson: { incomplete: true },
    })
    .where(eq(analysisJobs.id, jobDbId));

  await db
    .update(linkChecks)
    .set({
      status: "completed",
      riskLevel,
      verdict: riskLevel === "unknown" ? "unknown" : row.verdict,
      signals,
      needsDeepAnalysis: true,
      hackeraiJson: {
        invoked: false,
        status: "unavailable",
        job_db_id: jobDbId,
      },
    })
    .where(eq(linkChecks.id, linkCheckId));
}

export async function processDeepJob(jobDbId: string) {
  const db = getDb();
  const [job] = await db.select().from(analysisJobs).where(eq(analysisJobs.id, jobDbId)).limit(1);
  if (!job) return;

  await db
    .update(analysisJobs)
    .set({ status: "running", startedAt: new Date(), attempts: job.attempts + 1, updatedAt: new Date() })
    .where(eq(analysisJobs.id, jobDbId));

  const adapter = getHackerAIAdapter();
  const input = job.inputJson as DeepInvestigationInput;

  try {
    const { jobId: externalId } = await adapter.startInvestigation({
      ...input,
      analysisId: input.analysisId || job.linkCheckId,
    });

    const result = await adapter.getResult(externalId);
    const status = result?.status ?? "failed";

    const [row] = await db
      .select()
      .from(linkChecks)
      .where(eq(linkChecks.id, job.linkCheckId))
      .limit(1);
    if (!row) return;

    const extraSignals: LinkSignal[] = [];
    if (result?.incomplete || status === "unavailable" || status === "failed" || status === "awaiting_local_agent") {
      extraSignals.push({
        id: "deep_analysis_incomplete",
        code: "deep_analysis_incomplete",
        title: "Analyse approfondie incomplète",
        severity: "info",
        confidence: 85,
        description:
          result?.summary ||
          "L'analyse approfondie n'a pas pu être terminée. Les résultats disponibles ne permettent pas d'établir la fiabilité du lien.",
        evidence: [`hackerai_status=${status}`, `external_job=${externalId}`],
      });
    }
    for (const f of result?.findings || []) {
      if (f.severity === "info") continue;
      extraSignals.push({
        id: `hackerai_${f.title}`.slice(0, 64),
        code: "hackerai_finding",
        title: f.title,
        severity: f.severity,
        confidence: 70,
        description: f.detail,
        evidence: f.evidence,
      });
    }

    const signals = [...((row.signals as LinkSignal[]) || []), ...extraSignals];
    // Never upgrade to low/trusted from incomplete deep analysis
    let riskLevel = row.riskLevel;
    if (
      (result?.incomplete || status !== "completed") &&
      riskLevel === "low"
    ) {
      riskLevel = "unknown";
    }
    if (result?.suggestsEscalation && riskLevel === "unknown") {
      // stay unknown unless findings are high
      const hasHigh = extraSignals.some((s) => s.severity === "high");
      if (hasHigh) riskLevel = "caution";
    }

    await db
      .update(analysisJobs)
      .set({
        status: status === "awaiting_local_agent" ? "awaiting_local_agent" : status === "completed" ? "completed" : status,
        externalJobId: externalId,
        resultJson: result ?? {},
        finishedAt: new Date(),
        updatedAt: new Date(),
        error: result?.error ?? null,
      })
      .where(eq(analysisJobs.id, jobDbId));

    await db
      .update(linkChecks)
      .set({
        status: status === "awaiting_local_agent" ? "deep_analysis" : "completed",
        riskLevel,
        verdict:
          riskLevel === "low"
            ? "trusted"
            : riskLevel === "caution"
              ? "suspicious"
              : riskLevel === "high"
                ? "dangerous"
                : "unknown",
        signals,
        needsDeepAnalysis: status === "awaiting_local_agent",
        hackeraiJson: {
          invoked: true,
          job_id: externalId,
          job_db_id: jobDbId,
          status,
          mode: result?.mode,
          summary: result?.summary,
          incomplete: result?.incomplete ?? true,
        },
      })
      .where(eq(linkChecks.id, job.linkCheckId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "deep_job_failed";
    await db
      .update(analysisJobs)
      .set({ status: "failed", error: msg, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(analysisJobs.id, jobDbId));

    const [row] = await db
      .select()
      .from(linkChecks)
      .where(eq(linkChecks.id, job.linkCheckId))
      .limit(1);
    if (!row) return;

    const signals = [
      ...((row.signals as LinkSignal[]) || []),
      {
        id: "deep_analysis_failed",
        code: "deep_analysis_failed",
        title: "Échec analyse approfondie",
        severity: "info" as const,
        confidence: 80,
        description:
          "L'analyse approfondie a échoué. Les preuves actuelles ne permettent pas d'établir la fiabilité.",
        evidence: [`error=${msg}`],
      },
    ];

    await db
      .update(linkChecks)
      .set({
        status: "completed",
        riskLevel: row.riskLevel === "low" ? "unknown" : row.riskLevel,
        verdict: row.riskLevel === "low" ? "unknown" : row.verdict,
        signals,
        hackeraiJson: { invoked: true, status: "failed", error: msg, job_db_id: jobDbId },
      })
      .where(eq(linkChecks.id, job.linkCheckId));
  }
}
