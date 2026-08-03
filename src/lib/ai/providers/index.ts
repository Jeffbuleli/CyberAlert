import type { LinkAnalysisResult, LinkSignal, RiskLevel } from "@/types/security";

const DISCLAIMER =
  "Cette analyse ne garantit pas qu'un site est sûr à 100 %. Restez prudent avant de fournir des informations personnelles, bancaires ou des mots de passe.";

export function riskHeadline(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "Risque faible";
    case "caution":
      return "Prudence";
    case "high":
      return "Attention - risque élevé";
  }
}

export function templateExplain(result: LinkAnalysisResult): {
  summary: string;
  recommendation: string;
  sourceSignalIds: string[];
} {
  const ids = result.signals.map((s) => s.id);
  if (result.riskLevel === "low") {
    return {
      summary:
        "Aucun signal important indiquant une fraude n'a été détecté parmi les contrôles effectués.",
      recommendation: DISCLAIMER,
      sourceSignalIds: ids,
    };
  }
  if (result.riskLevel === "caution") {
    const titles = result.signals
      .filter((s) => s.severity !== "info")
      .map((s) => s.title)
      .slice(0, 5);
    return {
      summary: `Certains éléments nécessitent votre attention${titles.length ? ` : ${titles.join(" - ")}.` : "."}`,
      recommendation:
        "Ne saisissez pas vos informations sensibles tant que vous n'avez pas confirmé l'identité du site par un canal officiel. " +
        DISCLAIMER,
      sourceSignalIds: ids,
    };
  }
  return {
    summary:
      "Plusieurs indicateurs correspondent à des caractéristiques fréquemment observées sur des sites frauduleux.",
    recommendation:
      "Ne saisissez pas votre mot de passe, vos informations bancaires ou vos données personnelles sur ce site. " +
      DISCLAIMER,
    sourceSignalIds: ids,
  };
}

export type AiExplainResult = {
  summary: string;
  recommendation: string;
  sourceSignalIds: string[];
  provider: "template" | "mcbuleli-ai";
};

export interface AIProvider {
  id: string;
  explainLinkResult(result: LinkAnalysisResult): Promise<AiExplainResult>;
  prioritizeFindings?(findings: unknown[]): Promise<{ orderedIds: string[]; rationale: string }>;
  executiveSummary?(findings: unknown[]): Promise<string>;
  technicalSummary?(findings: unknown[]): Promise<string>;
}

function assertGrounded(sourceIds: string[], signals: LinkSignal[]): string[] {
  const allowed = new Set(signals.map((s) => s.id));
  return sourceIds.filter((id) => allowed.has(id));
}

export class McBuleliAIProvider implements AIProvider {
  id = "mcbuleli-ai";

  constructor(
    private config: { url: string; secret: string },
  ) {}

  async explainLinkResult(result: LinkAnalysisResult): Promise<AiExplainResult> {
    const fallback = templateExplain(result);
    if (!this.config.secret || !this.config.url) {
      return { ...fallback, provider: "template" };
    }
    try {
      const res = await fetch(`${this.config.url.replace(/\/$/, "")}/v1/explain-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.secret}`,
        },
        body: JSON.stringify({
          risk_level: result.riskLevel,
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
      if (!res.ok) return { ...fallback, provider: "template" };
      const data = (await res.json()) as {
        summary?: string;
        recommendation?: string;
        source_signal_ids?: string[];
      };
      if (!data.summary || !data.recommendation) {
        return { ...fallback, provider: "template" };
      }
      const grounded = assertGrounded(data.source_signal_ids ?? fallback.sourceSignalIds, result.signals);
      return {
        summary: data.summary,
        recommendation: data.recommendation,
        sourceSignalIds: grounded.length ? grounded : fallback.sourceSignalIds,
        provider: "mcbuleli-ai",
      };
    } catch {
      return { ...fallback, provider: "template" };
    }
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
      rationale: "Priorisation par sévérité puis confiance (données sources uniquement).",
    };
  }

  async executiveSummary(findings: { title: string; severity: string }[]) {
    const crit = findings.filter((f) => f.severity === "critical" || f.severity === "high");
    if (!crit.length) {
      return "Aucun finding critique ou élevé n'a été confirmé dans ce scan. Continuer le suivi de routine.";
    }
    return `Points prioritaires pour la direction : ${crit
      .slice(0, 5)
      .map((f) => f.title)
      .join(" - ")}. Traiter ces éléments avant mise en production.`;
  }

  async technicalSummary(findings: { title: string; severity: string; recommendation?: string }[]) {
    return findings
      .map(
        (f) =>
          `- [${f.severity}] ${f.title}${f.recommendation ? ` → ${f.recommendation}` : ""}`,
      )
      .join("\n");
  }
}

export function getAIProvider(): AIProvider {
  const url = process.env.AI_GATEWAY_URL?.trim() || "http://127.0.0.1:8090";
  const secret = process.env.AI_GATEWAY_SECRET?.trim() || "";
  return new McBuleliAIProvider({ url, secret });
}
