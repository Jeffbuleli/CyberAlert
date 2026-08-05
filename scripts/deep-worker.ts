/**
 * External deep-worker entrypoint (opt-in).
 *
 * Default production path remains in-process fire-and-forget via enqueueDeepAnalysis
 * when DEEP_WORKER_MODE is unset or "inprocess".
 *
 * Start only when:
 *   DEEP_WORKER_MODE=external
 *   and analysis_jobs table exists
 *   and web is configured with DEEP_WORKER_MODE=external (enqueue only).
 *
 * Usage:
 *   npx tsx --env-file=ops/vps/.env scripts/deep-worker.ts
 *   # or via docker compose profile "deep"
 */
import { eq, asc } from "drizzle-orm";
import { getDb, analysisJobs } from "../src/db";
import { processDeepJob } from "../src/lib/security-core/deep-worker";

const POLL_MS = Number(process.env.DEEP_WORKER_POLL_MS || "3000");
const CONCURRENCY = Math.max(1, Number(process.env.DEEP_WORKER_CONCURRENCY || "1"));

async function nextQueuedId(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: analysisJobs.id })
    .from(analysisJobs)
    .where(eq(analysisJobs.status, "queued"))
    .orderBy(asc(analysisJobs.createdAt))
    .limit(1);
  return row?.id ?? null;
}

async function loop() {
  console.log(
    `[deep-worker] started poll=${POLL_MS}ms concurrency=${CONCURRENCY} (HackerAI is not an HTTP API)`,
  );

  for (;;) {
    for (let i = 0; i < CONCURRENCY; i++) {
      let id: string | null = null;
      try {
        id = await nextQueuedId();
      } catch (err) {
        console.warn("[deep-worker] poll failed", err instanceof Error ? err.message : err);
        break;
      }
      if (!id) break;
      // Serial claim: mark running before another poll can see the same row
      const db = getDb();
      await db
        .update(analysisJobs)
        .set({
          status: "running",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(analysisJobs.id, id));
      try {
        await processDeepJob(id);
      } catch (err) {
        console.warn("[deep-worker] job failed", id, err instanceof Error ? err.message : err);
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

const mode = (process.env.DEEP_WORKER_MODE || "inprocess").toLowerCase();
if (mode !== "external") {
  console.error(
    `DEEP_WORKER_MODE=${mode} — this process is for external mode only. Set DEEP_WORKER_MODE=external.`,
  );
  process.exit(1);
}

void loop();
