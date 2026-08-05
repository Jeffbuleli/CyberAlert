import {
  assessmentConfidence,
  decideRiskLevel,
  decideVerdict,
} from "@/lib/link-analysis/verdict";
import type { EvidenceBundle, RiskEngineResult } from "@/lib/security-core/types";
import type { LinkAnalysisResult, LinkSignal } from "@/types/security";

function severityWeight(s: LinkSignal["severity"]): number {
  switch (s) {
    case "high":
      return 35;
    case "medium":
      return 20;
    case "low":
      return 10;
    default:
      return 2;
  }
}

function scoreSignals(signals: LinkSignal[]): number {
  let score = 0;
  for (const s of signals) {
    if (s.severity === "info") continue;
    score += severityWeight(s.severity) * (s.confidence / 100);
  }
  return Math.min(100, Math.round(score));
}

/**
 * RiskEngine — multi-dimensional evaluation.
 * Technical validity alone never produces trusted.
 */
export function evaluateEvidence(bundle: EvidenceBundle): RiskEngineResult {
  const score = scoreSignals(bundle.signals);
  const hasOfficialLegitimacy = bundle.identity.match_type === "exact_official";
  const hasImpersonationSignal =
    bundle.identity.match_type === "lookalike" ||
    bundle.identity.match_type === "brand_in_name" ||
    bundle.signals.some(
      (s) =>
        s.code === "brand_lookalike" ||
        s.code === "homoglyph" ||
        s.code === "brand_impersonation_name",
    );

  let riskLevel = decideRiskLevel({
    score,
    hasOfficialLegitimacy,
    hasImpersonationSignal,
  });

  // Hard overrides from dimensions / gateway
  if (bundle.blocked) {
    riskLevel = "high";
  }

  // Critical phishing path + brand abuse → high when score already elevated
  if (
    hasImpersonationSignal &&
    bundle.signals.some((s) => s.code === "phishing_keywords") &&
    score >= 40
  ) {
    riskLevel = "high";
  }

  const verdict = decideVerdict(riskLevel);
  const confidence = assessmentConfidence(riskLevel, bundle.signals);

  const reasoning: string[] = [];
  reasoning.push(`technical_validity=${bundle.dimensions.technical_validity}`);
  reasoning.push(`identity=${bundle.identity.match_type}`);
  reasoning.push(`identity_confidence_dim=${bundle.dimensions.identity_confidence}`);
  reasoning.push(`reputation=${bundle.reputation.status}`);
  reasoning.push(`phishing_signals=${bundle.dimensions.phishing_signals}`);
  if (bundle.technical.https) {
    reasoning.push("https_present_but_not_proof_of_legitimacy");
  }

  const needs_deep_analysis =
    !bundle.blocked &&
    (riskLevel === "unknown" ||
      hasImpersonationSignal ||
      bundle.dimensions.identity_confidence === "information_not_established" ||
      bundle.reputation.status === "information_not_established");

  return {
    riskLevel,
    verdict,
    confidence,
    score: bundle.blocked ? 100 : score,
    needs_deep_analysis,
    reasoning,
    dimensions: bundle.dimensions,
    evidence: bundle.evidence,
    signals: bundle.signals,
  };
}

export function toLinkAnalysisResult(
  bundle: EvidenceBundle,
  risk: RiskEngineResult,
): LinkAnalysisResult {
  return {
    urlRaw: bundle.url_raw,
    urlNormalized: bundle.normalized_url,
    domain: bundle.domain,
    riskLevel: risk.riskLevel,
    verdict: risk.verdict,
    confidence: risk.confidence,
    score: risk.score,
    signals: risk.signals,
    blocked: bundle.blocked,
    blockReason: bundle.block_reason,
    dimensions: risk.dimensions,
    evidenceItems: risk.evidence,
    needsDeepAnalysis: risk.needs_deep_analysis,
    toolsUsed: bundle.tools_used,
    technical: bundle.technical,
    identity: bundle.identity,
    reputation: bundle.reputation,
  };
}
