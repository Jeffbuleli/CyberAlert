import { createHash, randomUUID } from "crypto";
import type {
  DeepInvestigationInput,
  DeepInvestigationResult,
  DeepJobStatus,
  HackerAIAdapter,
} from "./types";

export type HackerAIConfig = {
  enabled: boolean;
  mode: "disabled" | "agent_token" | "http_bridge";
  apiKey: string | null;
  apiUrl: string | null;
  quickstart: string | null;
};

/** Extract --token from an npx quickstart string if present. */
export function extractTokenFromQuickstart(quickstart: string | null | undefined): string | null {
  if (!quickstart) return null;
  const m = quickstart.match(/--token\s+(\S+)/);
  return m?.[1] ?? null;
}

export function getHackerAIConfig(): HackerAIConfig {
  const enabled = (process.env.HACKERAI_ENABLED || "true").trim().toLowerCase() !== "false";
  const apiKey =
    process.env.HACKERAI_API_KEY?.trim() ||
    extractTokenFromQuickstart(process.env.HACKERAI_QUICKSTART_TOKEN) ||
    null;
  const apiUrl = process.env.HACKERAI_API_URL?.trim() || null;
  const quickstart = process.env.HACKERAI_QUICKSTART_TOKEN?.trim() || null;
  const modeEnv = (process.env.HACKERAI_MODE || "").trim().toLowerCase();

  let mode: HackerAIConfig["mode"] = "disabled";
  if (enabled && apiUrl && apiKey) mode = "http_bridge";
  else if (enabled && apiKey) mode = "agent_token";
  if (modeEnv === "disabled" || modeEnv === "agent_token" || modeEnv === "http_bridge") {
    if (modeEnv === "disabled") mode = "disabled";
    else if (modeEnv === "http_bridge" && apiUrl && apiKey) mode = "http_bridge";
    else if (modeEnv === "agent_token" && apiKey) mode = "agent_token";
    else if (modeEnv === "http_bridge" && (!apiUrl || !apiKey)) mode = apiKey ? "agent_token" : "disabled";
  }

  return { enabled, mode, apiKey, apiUrl, quickstart };
}

/** In-memory job store (also mirrored to DB by worker). */
const jobs = new Map<string, DeepInvestigationResult>();

export class NullHackerAIAdapter implements HackerAIAdapter {
  id = "hackerai-null";

  async isAvailable() {
    return false;
  }

  async startInvestigation(input: DeepInvestigationInput) {
    const jobId = randomUUID();
    jobs.set(jobId, {
      jobId,
      status: "unavailable",
      mode: "disabled",
      invoked: false,
      summary:
        "HackerAI non configuré. Analyse approfondie indisponible — la fiabilité reste non établie si les preuves sont insuffisantes.",
      findings: [],
      suggestsEscalation: false,
      incomplete: true,
      error: "hackerai_not_configured",
      raw: { analysisId: input.analysisId },
    });
    return { jobId };
  }

  async getStatus(jobId: string): Promise<DeepJobStatus> {
    return jobs.get(jobId)?.status ?? "unavailable";
  }

  async getResult(jobId: string) {
    return jobs.get(jobId) ?? null;
  }
}

/**
 * Official integration path today: agent token (hsb_*) for @hackerai/local on the VPS.
 * There is no documented public standalone HTTP API for URL checks.
 * We register a deep job + brief for the agent; we do NOT invent cloud endpoints.
 */
export class AgentTokenHackerAIAdapter implements HackerAIAdapter {
  id = "hackerai-agent-token";

  constructor(private config: HackerAIConfig) {}

  async isAvailable() {
    return Boolean(this.config.apiKey && this.config.mode === "agent_token");
  }

  async startInvestigation(input: DeepInvestigationInput) {
    const jobId = randomUUID();
    const tokenFingerprint = this.config.apiKey
      ? createHash("sha256").update(this.config.apiKey).digest("hex").slice(0, 12)
      : null;

    const brief = [
      "Cyber Alert DRC — deep investigation brief",
      `URL: ${input.normalizedUrl}`,
      `Domain: ${input.domain ?? "n/a"}`,
      `Engine verdict: ${input.verdict} (${input.riskLevel})`,
      `Signals: ${input.signalCodes.join(", ") || "none"}`,
      "Evidence:",
      ...input.evidenceSummary.slice(0, 12).map((e) => `– ${e}`),
      "Constraints: non-destructive recon only; no exploitation; report facts with sources.",
    ].join("\n");

    jobs.set(jobId, {
      jobId,
      status: "awaiting_local_agent",
      mode: "agent_token",
      invoked: true,
      summary:
        "Job HackerAI enregistré (token agent). Exécution via @hackerai/local sur le VPS si l'agent est connecté. Sans résultat agent, la fiabilité n'est pas établie automatiquement.",
      findings: [
        {
          title: "Investigation HackerAI en file (agent local)",
          severity: "info",
          detail:
            "Le compte pro HackerAI n'expose pas d'API HTTP publique pour les URL. Le token agent (Settings → Agents) active le client local officiel sur le VPS.",
          evidence: [
            `mode=agent_token`,
            `token_fp=${tokenFingerprint}`,
            `analysis_id=${input.analysisId}`,
          ],
        },
      ],
      suggestsEscalation: true,
      incomplete: true,
      raw: {
        analysisId: input.analysisId,
        brief,
        quickstart_hint: this.config.quickstart
          ? "HACKERAI_QUICKSTART_TOKEN present"
          : "npx @hackerai/local@latest --token <HACKERAI_API_KEY>",
      },
    });

    return { jobId };
  }

  async getStatus(jobId: string): Promise<DeepJobStatus> {
    return jobs.get(jobId)?.status ?? "unavailable";
  }

  async getResult(jobId: string) {
    return jobs.get(jobId) ?? null;
  }

  /** Operator/agent can complete a job with findings (webhook/internal). */
  completeJob(jobId: string, patch: Partial<DeepInvestigationResult>) {
    const prev = jobs.get(jobId);
    if (!prev) return null;
    const next: DeepInvestigationResult = {
      ...prev,
      ...patch,
      jobId,
      status: patch.status ?? "completed",
      incomplete: patch.incomplete ?? false,
    };
    jobs.set(jobId, next);
    return next;
  }
}

/**
 * Optional operator-configured HTTP bridge.
 * Only used when HACKERAI_API_URL is explicitly set — not an invented HackerAI endpoint.
 */
export class HttpBridgeHackerAIAdapter implements HackerAIAdapter {
  id = "hackerai-http-bridge";

  constructor(private config: HackerAIConfig) {}

  async isAvailable() {
    return Boolean(
      this.config.apiUrl && this.config.apiKey && this.config.mode === "http_bridge",
    );
  }

  async startInvestigation(input: DeepInvestigationInput) {
    const jobId = randomUUID();
    const url = this.config.apiUrl!;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "X-CyberAlert-Job": jobId,
        },
        body: JSON.stringify({
          job_id: jobId,
          analysis_id: input.analysisId,
          url: input.normalizedUrl,
          domain: input.domain,
          risk_level: input.riskLevel,
          verdict: input.verdict,
          signals: input.signalCodes,
          evidence_summary: input.evidenceSummary,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) {
        jobs.set(jobId, {
          jobId,
          status: "failed",
          mode: "http_bridge",
          invoked: true,
          summary: `Pont HTTP HackerAI indisponible (HTTP ${res.status}). Fiabilité non établie à partir de cette étape.`,
          findings: [],
          suggestsEscalation: false,
          incomplete: true,
          error: `http_${res.status}`,
        });
        return { jobId };
      }

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      jobs.set(jobId, {
        jobId,
        status: "completed",
        mode: "http_bridge",
        invoked: true,
        summary:
          typeof data.summary === "string"
            ? data.summary
            : "Résultat pont HTTP reçu. Interprétation laissée au Risk Engine / McBuleli AI.",
        findings: Array.isArray(data.findings)
          ? (data.findings as DeepInvestigationResult["findings"])
          : [],
        suggestsEscalation: Boolean(data.suggests_escalation),
        incomplete: Boolean(data.incomplete),
        raw: data,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "bridge_failed";
      jobs.set(jobId, {
        jobId,
        status: "failed",
        mode: "http_bridge",
        invoked: true,
        summary:
          "Pont HTTP HackerAI en échec / timeout. Les preuves existantes ne permettent pas d'établir la fiabilité.",
        findings: [],
        suggestsEscalation: false,
        incomplete: true,
        error: msg,
      });
    }
    return { jobId };
  }

  async getStatus(jobId: string): Promise<DeepJobStatus> {
    return jobs.get(jobId)?.status ?? "unavailable";
  }

  async getResult(jobId: string) {
    return jobs.get(jobId) ?? null;
  }
}

export function getHackerAIAdapter(): HackerAIAdapter {
  const cfg = getHackerAIConfig();
  if (cfg.mode === "http_bridge") return new HttpBridgeHackerAIAdapter(cfg);
  if (cfg.mode === "agent_token") return new AgentTokenHackerAIAdapter(cfg);
  return new NullHackerAIAdapter();
}

export function getInMemoryDeepJob(jobId: string) {
  return jobs.get(jobId) ?? null;
}

export function setInMemoryDeepJob(result: DeepInvestigationResult) {
  jobs.set(result.jobId, result);
}
