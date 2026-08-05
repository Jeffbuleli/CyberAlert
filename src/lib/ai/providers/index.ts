import type { LinkAnalysisResult, RiskLevel } from "@/types/security";
import {
  ANALYST_SYSTEM_PROMPT,
  buildAnalystPayload,
  DISCLAIMER,
  mergeAiSuggestions,
  parseAnalystJson,
  templateAnalyze,
  type McBuleliAnalysis,
} from "@/lib/ai/analyst";

export { DISCLAIMER, templateAnalyze, mergeAiSuggestions };
export type { McBuleliAnalysis };

export function riskHeadline(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "Fiable selon les éléments vérifiés";
    case "caution":
      return "Suspect";
    case "high":
      return "Dangereux";
    case "unknown":
      return "Fiabilité non établie";
  }
}

/** @deprecated Prefer templateAnalyze — kept for callers expecting explain shape */
export function templateExplain(result: LinkAnalysisResult): {
  overview: string;
  summary: string;
  recommendation: string;
  sourceSignalIds: string[];
} {
  const a = templateAnalyze(result);
  return {
    overview: a.overview,
    summary: a.summary,
    recommendation: a.recommendation,
    sourceSignalIds: a.sourceSignalIds,
  };
}

export type AiExplainResult = {
  overview: string;
  summary: string;
  recommendation: string;
  sourceSignalIds: string[];
  provider: "template" | "mcbuleli-ai";
  /** Phase C structured fields */
  headline?: string;
  why?: string[];
  advice?: string;
  needsDeepAnalysis?: boolean;
  incomplete?: boolean;
  reasoning?: string[];
};

export interface AIProvider {
  id: string;
  explainLinkResult(result: LinkAnalysisResult): Promise<AiExplainResult>;
  analyzeLinkResult(result: LinkAnalysisResult): Promise<McBuleliAnalysis>;
  prioritizeFindings?(findings: unknown[]): Promise<{ orderedIds: string[]; rationale: string }>;
  executiveSummary?(findings: unknown[]): Promise<string>;
  technicalSummary?(findings: unknown[]): Promise<string>;
}

function toExplain(a: McBuleliAnalysis): AiExplainResult {
  return {
    overview: a.overview,
    summary: a.summary,
    recommendation: a.recommendation,
    sourceSignalIds: a.sourceSignalIds,
    provider: a.provider,
    headline: a.headline,
    why: a.why,
    advice: a.advice,
    needsDeepAnalysis: a.needs_deep_analysis,
    incomplete: a.incomplete,
    reasoning: a.reasoning,
  };
}

async function openaiAnalyzeDirect(
  result: LinkAnalysisResult,
  fallback: McBuleliAnalysis,
): Promise<McBuleliAnalysis | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const rawModel =
    process.env.OPENAI_EXPLAIN_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini";
  const model = /^gpt-5/i.test(rawModel) ? "gpt-4o-mini" : rawModel;

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYST_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(buildAnalystPayload(result)) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn("[mcbuleli-ai] openai analyze failed", res.status);
      return null;
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return parseAnalystJson(content, fallback, result);
  } catch (err) {
    console.warn("[mcbuleli-ai] openai analyze error", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * McBuleli AI — cerveau / analyste (Phase C).
 * Entrée = résultats Evidence + Risk Engine uniquement.
 * 1) AI Gateway `/v1/analyze-link` (préféré)
 * 2) OpenAI direct
 * 3) Templates grounded
 */
export class McBuleliAIProvider implements AIProvider {
  id = "mcbuleli-ai";

  constructor(private config: { url: string; secret: string }) {}

  async analyzeLinkResult(result: LinkAnalysisResult): Promise<McBuleliAnalysis> {
    const fallback = templateAnalyze(result);

    if (this.config.url && this.config.secret) {
      try {
        const res = await fetch(`${this.config.url.replace(/\/$/, "")}/v1/analyze-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.secret}`,
          },
          body: JSON.stringify(buildAnalystPayload(result)),
          signal: AbortSignal.timeout(14_000),
        });
        if (res.ok) {
          const data = await res.json();
          const parsed = parseAnalystJson(JSON.stringify(data), fallback, result);
          if (parsed) return parsed;
        }
      } catch {
        // fall through
      }

      // Legacy gateway path
      try {
        const res = await fetch(`${this.config.url.replace(/\/$/, "")}/v1/explain-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.secret}`,
          },
          body: JSON.stringify({
            risk_level: result.riskLevel,
            verdict: result.verdict,
            confidence: result.confidence,
            score: result.score,
            domain: result.domain,
            url: result.urlNormalized,
            signals: result.signals.map((s) => ({
              id: s.id,
              code: s.code,
              title: s.title,
              severity: s.severity,
              confidence: s.confidence,
              description: s.description,
              evidence: s.evidence,
            })),
          }),
          signal: AbortSignal.timeout(12_000),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            overview?: string;
            summary?: string;
            recommendation?: string;
            source_signal_ids?: string[];
          };
          if (data.summary && data.recommendation) {
            return {
              ...fallback,
              overview: (data.overview || fallback.overview).trim(),
              summary: data.summary,
              recommendation: data.recommendation.includes("100 %")
                ? data.recommendation
                : `${data.recommendation} ${DISCLAIMER}`,
              advice: data.recommendation,
              sourceSignalIds: data.source_signal_ids?.length
                ? data.source_signal_ids.filter((id) =>
                    result.signals.some((s) => s.id === id),
                  )
                : fallback.sourceSignalIds,
              provider: "mcbuleli-ai",
            };
          }
        }
      } catch {
        // fall through
      }
    }

    const direct = await openaiAnalyzeDirect(result, fallback);
    if (direct) return direct;

    return { ...fallback, incomplete: true, provider: "template" };
  }

  async explainLinkResult(result: LinkAnalysisResult): Promise<AiExplainResult> {
    return toExplain(await this.analyzeLinkResult(result));
  }

  async prioritizeFindings(findings: { id: string; severity: string; confidence: number }[]) {
    const order = ["critical", "high", "medium", "low", "info"];
    const sorted = [...findings].sort((a, b) => {
      const da = order.indexOf(a.severity);
      const db = order.indexOf(b.severity);
      if (da !== db) return da - db;
      return b.confidence - a.confidence;
    });
    return {
      orderedIds: sorted.map((f) => f.id),
      rationale: "Priorisation McBuleli AI par sévérité puis confiance (données sources uniquement).",
    };
  }

  async executiveSummary(findings: { title: string; severity: string; category?: string }[]) {
    const crit = findings.filter((f) => f.severity === "critical" || f.severity === "high");
    const unknown = findings.some(
      (f) => f.category === "identity_unknown" || /non établie/i.test(f.title),
    );
    if (unknown && !crit.length) {
      return "Verdict UNKNOWN : la fiabilité n'est pas établie. Absence de finding critique ≠ application sûre. Confirmer l'identité officielle avant production.";
    }
    if (!crit.length) {
      return "Aucun finding critique ou élevé confirmé. Continuer le suivi — ce résumé ne constitue pas une attestation de confiance.";
    }
    return `Points prioritaires pour la direction : ${crit
      .slice(0, 5)
      .map((f) => f.title)
      .join(" – ")}. Traiter ces éléments avant mise en production.`;
  }

  async technicalSummary(findings: { title: string; severity: string; recommendation?: string }[]) {
    return findings
      .map(
        (f) =>
          `– [${f.severity}] ${f.title}${f.recommendation ? ` → ${f.recommendation}` : ""}`,
      )
      .join("\n");
  }
}

export function getAIProvider(): AIProvider {
  const url = process.env.AI_GATEWAY_URL?.trim() || "http://127.0.0.1:8090";
  const secret = process.env.AI_GATEWAY_SECRET?.trim() || "";
  return new McBuleliAIProvider({ url, secret });
}

/** Apply AI analysis onto engine result with hard merge rules. */
export function applyMcBuleliAnalysis(
  engine: LinkAnalysisResult,
  ai: McBuleliAnalysis,
): LinkAnalysisResult {
  const merged = mergeAiSuggestions(engine, ai);
  return {
    ...engine,
    riskLevel: merged.riskLevel,
    verdict: merged.verdict,
    confidence: merged.confidence,
    needsDeepAnalysis: merged.needsDeepAnalysis,
  };
}
