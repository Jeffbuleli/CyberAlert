/**
 * McBuleli AI assist for SafeFind — signals only, never ownership/reward authority.
 */

export type SafefindParseDeclarationResult = {
  documentType: "carte_electeur" | "passeport" | "permis_conduire" | null;
  locationText: string | null;
  locationPrecision: "commune" | "quartier" | "landmark" | "gps" | null;
  dateEstimate: string | null;
  timePeriod: "morning" | "afternoon" | "evening" | "night" | null;
  visualHints: Record<string, string>;
  confidence: number;
  provider: "mcbuleli-ai" | "template";
};

export type SafefindMatchAssistResult = {
  potentialMatch: boolean;
  confidence: number;
  reasons: string[];
  riskFlags: string[];
  recommendedAction: "review" | "verify" | "ignore";
  provider: "mcbuleli-ai" | "template";
};

export type SafefindAnomalyHintResult = {
  riskFlags: string[];
  recommendedAction: "review" | "dispute" | "lock" | "continue";
  explanation: string;
  provider: "mcbuleli-ai" | "template";
};

export type MaskedMatchCard = {
  documentType: string;
  commune: string | null;
  approxDate: string | null;
  appearance: Record<string, unknown>;
  visualNotes: string | null;
  last4: string | null;
};

function gatewayConfig() {
  return {
    url: (process.env.AI_GATEWAY_URL?.trim() || "http://127.0.0.1:8090").replace(
      /\/$/,
      "",
    ),
    secret: process.env.AI_GATEWAY_SECRET?.trim() || "",
    openaiKey: process.env.OPENAI_API_KEY?.trim() || "",
    openaiBase: (
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
    ).replace(/\/$/, ""),
    model:
      process.env.OPENAI_EXPLAIN_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-4o-mini",
  };
}

function templateParse(text: string): SafefindParseDeclarationResult {
  const t = text.toLowerCase();
  let documentType: SafefindParseDeclarationResult["documentType"] = null;
  if (/passeport|passport/.test(t)) documentType = "passeport";
  else if (/permis/.test(t)) documentType = "permis_conduire";
  else if (/carte|électeur|electeur|voter/.test(t)) documentType = "carte_electeur";

  let locationPrecision: SafefindParseDeclarationResult["locationPrecision"] = null;
  if (/près|pembeni|chez|arrêt|rond-point|marché|entrée/.test(t)) {
    locationPrecision = "landmark";
  } else if (/quartier|q\./.test(t)) {
    locationPrecision = "quartier";
  } else if (/gombe|ngaliema|limete|kinshasa|commune/.test(t)) {
    locationPrecision = "commune";
  }

  let timePeriod: SafefindParseDeclarationResult["timePeriod"] = null;
  if (/matin|morning/.test(t)) timePeriod = "morning";
  else if (/après-midi|apres-midi|afternoon/.test(t)) timePeriod = "afternoon";
  else if (/soir|evening/.test(t)) timePeriod = "evening";
  else if (/nuit|night/.test(t)) timePeriod = "night";

  return {
    documentType,
    locationText: text.trim().slice(0, 200) || null,
    locationPrecision,
    dateEstimate: null,
    timePeriod,
    visualHints: {},
    confidence: documentType ? 0.45 : 0.25,
    provider: "template",
  };
}

function templateMatch(
  a: MaskedMatchCard,
  b: MaskedMatchCard,
): SafefindMatchAssistResult {
  const reasons: string[] = [];
  let confidence = 0.2;
  if (a.documentType === b.documentType) {
    reasons.push("same document type");
    confidence += 0.25;
  }
  if (a.commune && b.commune && a.commune.toLowerCase() === b.commune.toLowerCase()) {
    reasons.push("same area");
    confidence += 0.2;
  }
  if (a.last4 && b.last4 && a.last4 === b.last4) {
    reasons.push("compatible document fragment");
    confidence += 0.25;
  }
  const potentialMatch = confidence >= 0.55 && a.documentType === b.documentType;
  return {
    potentialMatch,
    confidence: Math.min(0.92, confidence),
    reasons,
    riskFlags: [],
    recommendedAction: potentialMatch ? "verify" : "ignore",
    provider: "template",
  };
}

function templateAnomaly(reasons: string[]): SafefindAnomalyHintResult {
  return {
    riskFlags: reasons.slice(0, 6),
    recommendedAction: reasons.some((r) =>
      /custody|refound|dispute/i.test(r),
    )
      ? "dispute"
      : "review",
    explanation:
      reasons.length > 0
        ? `Incohérences signalées: ${reasons.join(", ")}`
        : "Aucune anomalie évidente.",
    provider: "template",
  };
}

async function callGatewayJson(
  path: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  const cfg = gatewayConfig();
  if (!cfg.url || !cfg.secret) return null;
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.secret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(14_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callOpenAiJson(
  system: string,
  user: unknown,
): Promise<Record<string, unknown> | null> {
  const cfg = gatewayConfig();
  if (!cfg.openaiKey) return null;
  const model = /^gpt-5/i.test(cfg.model) ? "gpt-4o-mini" : cfg.model;
  try {
    const res = await fetch(`${cfg.openaiBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(user) },
        ],
      }),
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const PARSE_SYSTEM =
  "Tu es McBuleli AI pour SafeFind (Cyber Alert RDC). Extrais des champs structurés " +
  "depuis une déclaration FR/Lingala. JSON strict: documentType (carte_electeur|passeport|permis_conduire|null), " +
  "locationText, locationPrecision (commune|quartier|landmark|gps|null), dateEstimate (YYYY-MM-DD|null), " +
  "timePeriod (morning|afternoon|evening|night|null), visualHints (object), confidence (0-1). " +
  "Ne invente pas de numéro de pièce. Ne décide pas des coordonnées GPS.";

const MATCH_SYSTEM =
  "Tu es McBuleli AI SafeFind. Compare deux fiches DÉJÀ MASQUÉES. JSON: potentialMatch (bool), " +
  "confidence (0-1), reasons (string[]), riskFlags (string[]), recommendedAction (review|verify|ignore). " +
  "Jamais ownership proof. confidence haute ≠ restitution automatique.";

const ANOMALY_SYSTEM =
  "Tu es McBuleli AI SafeFind antifraud. Analyse une chronologie SANS PII. JSON: riskFlags (string[]), " +
  "recommendedAction (review|dispute|lock|continue), explanation (string courte FR). " +
  "Tu signales seulement; le moteur décide.";

function normalizeDocType(
  v: unknown,
): SafefindParseDeclarationResult["documentType"] {
  const s = String(v ?? "").toLowerCase();
  if (s === "carte_electeur" || s === "passeport" || s === "permis_conduire") {
    return s;
  }
  return null;
}

export async function safefindParseDeclaration(
  text: string,
): Promise<SafefindParseDeclarationResult> {
  const fallback = templateParse(text);
  const raw =
    (await callGatewayJson("/v1/safefind/parse-declaration", { text })) ??
    (await callOpenAiJson(PARSE_SYSTEM, { text: text.slice(0, 800) }));
  if (!raw) return fallback;

  return {
    documentType: normalizeDocType(raw.documentType) ?? fallback.documentType,
    locationText:
      typeof raw.locationText === "string"
        ? raw.locationText.slice(0, 200)
        : fallback.locationText,
    locationPrecision:
      (["commune", "quartier", "landmark", "gps"].includes(
        String(raw.locationPrecision),
      )
        ? (raw.locationPrecision as SafefindParseDeclarationResult["locationPrecision"])
        : fallback.locationPrecision),
    dateEstimate:
      typeof raw.dateEstimate === "string" ? raw.dateEstimate.slice(0, 10) : null,
    timePeriod:
      (["morning", "afternoon", "evening", "night"].includes(String(raw.timePeriod))
        ? (raw.timePeriod as SafefindParseDeclarationResult["timePeriod"])
        : fallback.timePeriod),
    visualHints:
      raw.visualHints && typeof raw.visualHints === "object"
        ? (raw.visualHints as Record<string, string>)
        : {},
    confidence: Math.max(
      0,
      Math.min(1, Number(raw.confidence ?? fallback.confidence)),
    ),
    provider: "mcbuleli-ai",
  };
}

export async function safefindMatchAssist(
  lost: MaskedMatchCard,
  found: MaskedMatchCard,
): Promise<SafefindMatchAssistResult> {
  const fallback = templateMatch(lost, found);
  const raw =
    (await callGatewayJson("/v1/safefind/match-assist", { lost, found })) ??
    (await callOpenAiJson(MATCH_SYSTEM, { lost, found }));
  if (!raw) return fallback;

  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0)));
  return {
    potentialMatch: Boolean(raw.potentialMatch),
    confidence,
    reasons: Array.isArray(raw.reasons)
      ? raw.reasons.map(String).slice(0, 8)
      : fallback.reasons,
    riskFlags: Array.isArray(raw.riskFlags)
      ? raw.riskFlags.map(String).slice(0, 8)
      : [],
    recommendedAction: (["review", "verify", "ignore"].includes(
      String(raw.recommendedAction),
    )
      ? (raw.recommendedAction as SafefindMatchAssistResult["recommendedAction"])
      : fallback.recommendedAction),
    provider: "mcbuleli-ai",
  };
}

export async function safefindAnomalyHint(args: {
  reasons: string[];
  timeline?: Array<{ at: string; event: string }>;
}): Promise<SafefindAnomalyHintResult> {
  const fallback = templateAnomaly(args.reasons);
  const raw =
    (await callGatewayJson("/v1/safefind/anomaly-hint", args)) ??
    (await callOpenAiJson(ANOMALY_SYSTEM, args));
  if (!raw) return fallback;

  return {
    riskFlags: Array.isArray(raw.riskFlags)
      ? raw.riskFlags.map(String).slice(0, 8)
      : fallback.riskFlags,
    recommendedAction: (["review", "dispute", "lock", "continue"].includes(
      String(raw.recommendedAction),
    )
      ? (raw.recommendedAction as SafefindAnomalyHintResult["recommendedAction"])
      : fallback.recommendedAction),
    explanation:
      typeof raw.explanation === "string"
        ? raw.explanation.slice(0, 280)
        : fallback.explanation,
    provider: "mcbuleli-ai",
  };
}

/**
 * AI may raise scoreBand by one notch only when rules score is already medium+.
 * Never authorizes reward / ownership.
 */
export function applyAiMatchBandBoost(
  rulesScore: number,
  ai: SafefindMatchAssistResult | null,
): { scoreBand: "high" | "medium" | "low"; aiBoosted: boolean } {
  let band: "high" | "medium" | "low" =
    rulesScore >= 85 ? "high" : rulesScore >= 60 ? "medium" : "low";
  let aiBoosted = false;
  if (
    ai &&
    ai.potentialMatch &&
    ai.confidence >= 0.75 &&
    band === "medium"
  ) {
    band = "high";
    aiBoosted = true;
  }
  return { scoreBand: band, aiBoosted };
}
