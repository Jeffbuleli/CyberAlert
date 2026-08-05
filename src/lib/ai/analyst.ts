import type { LinkAnalysisResult, LinkSignal, RiskLevel, Verdict } from "@/types/security";
import { riskLevelToVerdict } from "@/types/security";

export const DISCLAIMER =
  "Cette analyse ne garantit pas qu'un site est sûr à 100 %. Restez prudent.";

function riskHeadlineLocal(level: RiskLevel): string {
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

export type McBuleliAnalysis = {
  headline: string;
  overview: string;
  why: string[];
  advice: string;
  /** Compat UI / DB */
  summary: string;
  recommendation: string;
  sourceSignalIds: string[];
  sourceEvidenceIds: string[];
  verdict_suggestion: Verdict;
  risk_suggestion: RiskLevel;
  confidence: number;
  needs_deep_analysis: boolean;
  reasoning: string[];
  provider: "template" | "mcbuleli-ai";
  /** True when OpenAI/gateway failed — technical result still valid */
  incomplete: boolean;
};

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  unknown: 1,
  caution: 2,
  high: 3,
};

function templateOverview(domain: string | null | undefined): string {
  const host = (domain || "").toLowerCase().replace(/^www\./, "");
  if (!host) return "Aperçu indisponible. Basez-vous sur les preuves techniques.";
  if (host === "mcbuleli.org" || host.endsWith(".mcbuleli.org")) {
    return "McBuleli.org : plateforme fintech / P2P basée à Kinshasa (RDC).";
  }
  if (host === "cyberalert-rdc.org" || host === "cyberalert.mcbuleli.org") {
    return "Cyber Alert DRC : service McBuleli de vérification de liens.";
  }
  return `Domaine « ${host} » : identité non confirmée via aperçu local.`;
}

function buildWhy(result: LinkAnalysisResult): string[] {
  const why: string[] = [];
  const id = result.identity;

  if (id?.match_type === "exact_official") {
    why.push(`Domaine associé à ${id.identified_entity ?? "une entité connue"}.`);
  } else if (id?.match_type === "lookalike" || id?.match_type === "brand_in_name") {
    why.push(
      `Usurpation possible de ${id.claimed_entity ?? "une marque"} — domaine non officiel.`,
    );
    if (id.official_domain) {
      why.push(`Domaine officiel connu : ${id.official_domain}.`);
    }
  } else {
    why.push("Aucune identité officielle confirmée pour ce domaine.");
  }

  if (result.reputation?.status === "information_not_established") {
    why.push("Réputation non établie (aucune source contractée consultée avec succès).");
  }

  if (result.technical?.https) {
    why.push("HTTPS/TLS présents — preuve technique uniquement, pas de légitimité.");
  }

  for (const s of result.signals.filter((x) => x.severity !== "info").slice(0, 3)) {
    if (!why.includes(s.title)) why.push(s.title);
  }

  if (result.dimensions?.phishing_signals === "present") {
    why.push("Signaux de phishing / usurpation détectés.");
  }

  // Dedupe + cap
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of why) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= 5) break;
  }
  return out;
}

function buildAdvice(result: LinkAnalysisResult): string {
  switch (result.riskLevel) {
    case "unknown":
      return "Évitez de fournir des informations personnelles tant que l'identité n'est pas confirmée.";
    case "caution":
      return "Ne saisissez pas d'infos sensibles avant de confirmer le site via un canal officiel.";
    case "high":
      return "N'entrez ni mot de passe, ni données bancaires, ni infos personnelles.";
    case "low":
      return "Aucun signal important détecté lors de cette analyse — restez prudent.";
  }
}

function decideNeedsDeep(result: LinkAnalysisResult): boolean {
  if (result.blocked) return false;
  if (result.needsDeepAnalysis) return true;
  if (result.riskLevel === "unknown") return true;
  if (
    result.identity?.match_type === "lookalike" ||
    result.identity?.match_type === "brand_in_name"
  ) {
    return true;
  }
  if (result.dimensions?.identity_confidence === "information_not_established") {
    return true;
  }
  if (result.reputation?.status === "information_not_established" && result.riskLevel !== "low") {
    return true;
  }
  return false;
}

/**
 * Template analyst — grounded only on Evidence/Risk Engine output.
 * Never invents facts. Used when OpenAI/gateway unavailable.
 */
export function templateAnalyze(result: LinkAnalysisResult): McBuleliAnalysis {
  const why = buildWhy(result);
  const advice = buildAdvice(result);
  const headline = riskHeadlineLocal(result.riskLevel);
  const overview = templateOverview(result.domain);
  const sourceSignalIds = result.signals.map((s) => s.id);
  const sourceEvidenceIds = (result.evidenceItems ?? []).map((e) => e.id);

  const summary =
    result.riskLevel === "unknown"
      ? "Preuves insuffisantes pour confirmer que ce site est légitime."
      : result.riskLevel === "low"
        ? "Domaine associé à une identité connue. Aucun signal de fraude important."
        : why.slice(0, 2).join(" ");

  return {
    headline,
    overview,
    why,
    advice,
    summary,
    recommendation: `${advice} ${DISCLAIMER}`,
    sourceSignalIds,
    sourceEvidenceIds,
    verdict_suggestion: result.verdict,
    risk_suggestion: result.riskLevel,
    confidence: result.confidence,
    needs_deep_analysis: decideNeedsDeep(result),
    reasoning: [
      `risk_engine=${result.riskLevel}`,
      `identity=${result.identity?.match_type ?? "n/a"}`,
      `reputation=${result.reputation?.status ?? "n/a"}`,
      ...(result.dimensions
        ? [
            `dim.identity=${result.dimensions.identity_confidence}`,
            `dim.phishing=${result.dimensions.phishing_signals}`,
          ]
        : []),
    ],
    provider: "template",
    incomplete: false,
  };
}

export function assertGroundedSignalIds(
  sourceIds: string[],
  signals: LinkSignal[],
): string[] {
  const allowed = new Set(signals.map((s) => s.id));
  return sourceIds.filter((id) => allowed.has(id));
}

export function assertGroundedEvidenceIds(
  ids: string[],
  result: LinkAnalysisResult,
): string[] {
  const allowed = new Set((result.evidenceItems ?? []).map((e) => e.id));
  return ids.filter((id) => allowed.has(id));
}

/**
 * Hard rules: AI may escalate severity, never invent trust.
 * Cannot set low/trusted unless Risk Engine already established official identity.
 */
export function mergeAiSuggestions(
  engine: LinkAnalysisResult,
  ai: Pick<
    McBuleliAnalysis,
    "risk_suggestion" | "verdict_suggestion" | "confidence" | "needs_deep_analysis"
  >,
): {
  riskLevel: RiskLevel;
  verdict: Verdict;
  confidence: number;
  needsDeepAnalysis: boolean;
} {
  const hasOfficial = engine.identity?.match_type === "exact_official";
  let risk = engine.riskLevel;

  // Allow AI to escalate only
  if (RISK_RANK[ai.risk_suggestion] > RISK_RANK[risk]) {
    // Escalation must not jump to low; and high/caution only
    if (ai.risk_suggestion === "caution" || ai.risk_suggestion === "high") {
      risk = ai.risk_suggestion;
    }
  }

  // Never allow AI to set low without official identity from engine
  if (risk === "low" && !hasOfficial) {
    risk = "unknown";
  }

  // Engine blocked stays high
  if (engine.blocked) risk = "high";

  const confidence = Math.max(
    0,
    Math.min(100, Math.round((engine.confidence + ai.confidence) / 2)),
  );

  return {
    riskLevel: risk,
    verdict: riskLevelToVerdict(risk),
    confidence,
    needsDeepAnalysis: Boolean(engine.needsDeepAnalysis || ai.needs_deep_analysis),
  };
}

export function buildAnalystPayload(result: LinkAnalysisResult) {
  return {
    risk_level: result.riskLevel,
    verdict: result.verdict,
    confidence: result.confidence,
    score: result.score,
    domain: result.domain,
    url: result.urlNormalized,
    needs_deep_analysis_hint: result.needsDeepAnalysis ?? false,
    dimensions: result.dimensions ?? null,
    identity: result.identity ?? null,
    reputation: result.reputation ?? null,
    technical: result.technical
      ? {
          https: result.technical.https,
          tls_valid: result.technical.tls_valid,
          http_status: result.technical.http_status,
          note: result.technical.note,
        }
      : null,
    signals: result.signals.map((s) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      severity: s.severity,
      confidence: s.confidence,
      description: s.description,
      evidence: s.evidence,
    })),
    evidence_ids: (result.evidenceItems ?? []).map((e) => ({
      id: e.id,
      tool: e.tool,
      claim: e.claim,
      status: e.status,
    })),
    rules: {
      https_ne_legitimacy: true,
      unknown_ne_safe: true,
      no_invented_facts: true,
      never_100_percent_safe: true,
    },
    disclaimer: DISCLAIMER,
  };
}

export const ANALYST_SYSTEM_PROMPT = [
  "Tu es McBuleli AI, analyste cybersécurité pour Cyber Alert DRC (RDC).",
  "Tu raisonnes UNIQUEMENT à partir des preuves/signaux fournis.",
  "JSON strict: headline, overview, why, advice, summary, recommendation,",
  "source_signal_ids, source_evidence_ids, risk_suggestion, verdict_suggestion,",
  "confidence (0-100), needs_deep_analysis (bool), reasoning.",
  "headline: 1 ligne. why: 2 à 5 puces courtes. advice: 1 phrase.",
  "summary: 1-2 phrases. recommendation: 1 phrase d'action.",
  "Si identity non établie / risk unknown: JAMAIS fiable ou sûr.",
  "HTTPS ≠ légitimité. NO_MALICIOUS_SIGNAL ≠ preuve de légitimité.",
  "needs_deep_analysis=true si preuves insuffisantes, usurpation possible, ou contradictions.",
  "risk_suggestion ∈ low|unknown|caution|high. verdict ∈ trusted|likely_trusted|unknown|suspicious|dangerous.",
  "N'invente aucune source. Jamais « 100% sûr ». Français simple, structuré, court.",
].join(" ");

export function parseAnalystJson(
  raw: string,
  fallback: McBuleliAnalysis,
  result: LinkAnalysisResult,
): McBuleliAnalysis | null {
  try {
    const data = JSON.parse(raw) as Partial<McBuleliAnalysis> & {
      source_signal_ids?: string[];
      source_evidence_ids?: string[];
      risk_suggestion?: string;
      verdict_suggestion?: string;
      needs_deep_analysis?: boolean;
    };

    const why = Array.isArray(data.why)
      ? data.why.map(String).map((w) => w.trim()).filter(Boolean).slice(0, 5)
      : fallback.why;
    if (!why.length) return null;

    const advice = String(data.advice || data.recommendation || "").trim();
    const summary = String(data.summary || "").trim();
    if (!advice || !summary) return null;

    const riskRaw = data.risk_suggestion;
    const risk_suggestion: RiskLevel =
      riskRaw === "low" ||
      riskRaw === "caution" ||
      riskRaw === "high" ||
      riskRaw === "unknown"
        ? riskRaw
        : fallback.risk_suggestion;

    const verdictRaw = data.verdict_suggestion;
    const verdict_suggestion: Verdict =
      verdictRaw === "trusted" ||
      verdictRaw === "likely_trusted" ||
      verdictRaw === "unknown" ||
      verdictRaw === "suspicious" ||
      verdictRaw === "dangerous"
        ? verdictRaw
        : fallback.verdict_suggestion;

    const sourceSignalIds = assertGroundedSignalIds(
      data.source_signal_ids ?? fallback.sourceSignalIds,
      result.signals,
    );
    const sourceEvidenceIds = assertGroundedEvidenceIds(
      data.source_evidence_ids ?? fallback.sourceEvidenceIds,
      result,
    );

    const headline = String(data.headline || fallback.headline).trim().slice(0, 120);
    const overview = String(data.overview || fallback.overview).trim().slice(0, 200);
    const recommendation = advice.includes("100 %") || advice.includes("100%")
      ? `${advice}`
      : `${advice} ${DISCLAIMER}`;

    const confidence = Math.max(
      0,
      Math.min(100, Number(data.confidence ?? fallback.confidence) || fallback.confidence),
    );

    return {
      headline,
      overview: overview || fallback.overview,
      why,
      advice,
      summary: summary.slice(0, 400),
      recommendation,
      sourceSignalIds: sourceSignalIds.length ? sourceSignalIds : fallback.sourceSignalIds,
      sourceEvidenceIds: sourceEvidenceIds.length
        ? sourceEvidenceIds
        : fallback.sourceEvidenceIds,
      risk_suggestion,
      verdict_suggestion,
      confidence,
      needs_deep_analysis: Boolean(
        data.needs_deep_analysis ?? fallback.needs_deep_analysis,
      ),
      reasoning: Array.isArray(data.reasoning)
        ? data.reasoning.map(String).slice(0, 8)
        : fallback.reasoning,
      provider: "mcbuleli-ai",
      incomplete: false,
    };
  } catch {
    return null;
  }
}
