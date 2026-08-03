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

function parseExplainJson(
  raw: string,
  fallback: ReturnType<typeof templateExplain>,
  signals: LinkSignal[],
): AiExplainResult | null {
  try {
    const data = JSON.parse(raw) as {
      summary?: string;
      recommendation?: string;
      source_signal_ids?: string[];
    };
    if (!data.summary || !data.recommendation) return null;
    const grounded = assertGrounded(
      data.source_signal_ids ?? fallback.sourceSignalIds,
      signals,
    );
    return {
      summary: data.summary,
      recommendation: data.recommendation.includes("100 %")
        ? data.recommendation
        : `${data.recommendation} ${DISCLAIMER}`,
      sourceSignalIds: grounded.length ? grounded : fallback.sourceSignalIds,
      provider: "mcbuleli-ai",
    };
  } catch {
    return null;
  }
}

async function openaiExplainDirect(
  result: LinkAnalysisResult,
  fallback: ReturnType<typeof templateExplain>,
): Promise<AiExplainResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  // Prefer a chat-completions-stable model for explain; gpt-5.x from McBuleli
  // can be set later once Responses API is wired. Override via OPENAI_EXPLAIN_MODEL.
  const rawModel = process.env.OPENAI_EXPLAIN_MODEL?.trim()
    || process.env.OPENAI_MODEL?.trim()
    || "gpt-4o-mini";
  const model = /^gpt-5/i.test(rawModel) ? "gpt-4o-mini" : rawModel;

  const system = [
    "Tu es McBuleli AI pour Cyber Alert DRC.",
    "Tu EXPLIQUES uniquement les signaux techniques fournis.",
    "Tu n'inventes JAMAIS de vulnérabilité, preuve ou accusation définitive.",
    "Ne dis jamais qu'un site est 100% sûr ou forcément une arnaque.",
    "Réponds UNIQUEMENT en JSON avec keys: summary, recommendation, source_signal_ids.",
    "source_signal_ids doit être un sous-ensemble des ids fournis.",
    "Langue: français simple, grand public RDC / Afrique francophone.",
  ].join(" ");

  const user = JSON.stringify({
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
    disclaimer: DISCLAIMER,
  });

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn("[mcbuleli-ai] openai explain failed", res.status);
      return null;
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return parseExplainJson(content, fallback, result.signals);
  } catch (err) {
    console.warn("[mcbuleli-ai] openai explain error", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * McBuleli AI — couche d'explication (pas le scanner).
 * 1) Secure AI Gateway Python (préféré)
 * 2) OpenAI direct côté serveur (même rôle McBuleli AI)
 * 3) Templates FR grounded
 *
 * HackerAI (scans approfondis) reste derrière SecurityScanProvider — à brancher plus tard.
 */
export class McBuleliAIProvider implements AIProvider {
  id = "mcbuleli-ai";

  constructor(
    private config: { url: string; secret: string },
  ) {}

  async explainLinkResult(result: LinkAnalysisResult): Promise<AiExplainResult> {
    const fallback = templateExplain(result);

    if (this.config.url && this.config.secret) {
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
        if (res.ok) {
          const data = (await res.json()) as {
            summary?: string;
            recommendation?: string;
            source_signal_ids?: string[];
          };
          const parsed = parseExplainJson(JSON.stringify(data), fallback, result.signals);
          if (parsed) return parsed;
        }
      } catch {
        // fall through to direct OpenAI
      }
    }

    const direct = await openaiExplainDirect(result, fallback);
    if (direct) return direct;

    return { ...fallback, provider: "template" };
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
