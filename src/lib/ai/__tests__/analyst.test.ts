import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeAiSuggestions,
  parseAnalystJson,
  templateAnalyze,
} from "../analyst";
import type { LinkAnalysisResult } from "@/types/security";

function baseResult(over: Partial<LinkAnalysisResult> = {}): LinkAnalysisResult {
  return {
    urlRaw: "https://gkffjkfdf.com",
    urlNormalized: "https://gkffjkfdf.com/",
    domain: "gkffjkfdf.com",
    riskLevel: "unknown",
    verdict: "unknown",
    confidence: 80,
    score: 0,
    signals: [
      {
        id: "identity_not_established",
        code: "identity_not_established",
        title: "Identité non établie",
        severity: "info",
        confidence: 80,
        description: "Aucune association officielle.",
        evidence: ["status=information_not_established"],
      },
    ],
    blocked: false,
    needsDeepAnalysis: true,
    identity: {
      claimed_entity: null,
      identified_entity: null,
      official_domain: null,
      identity_confidence: 0,
      impersonation_risk: "unknown",
      match_type: "none",
    },
    reputation: {
      status: "information_not_established",
      labels: ["unknown"],
      sources: ["internal"],
      score: null,
    },
    technical: {
      https: true,
      tls_valid: true,
      tls_issuer: "Example CA",
      tls_expires_at: null,
      tls_hostname_match: true,
      http_status: 200,
      redirects: [],
      final_url: "https://gkffjkfdf.com/",
      note: "TLS valide ≠ légitimité",
    },
    ...over,
  };
}

describe("McBuleli AI analyst (Phase C)", () => {
  it("template never marks unknown as trusted", () => {
    const ai = templateAnalyze(baseResult());
    assert.equal(ai.risk_suggestion, "unknown");
    assert.equal(ai.verdict_suggestion, "unknown");
    assert.ok(ai.why.length >= 2);
    assert.ok(ai.why.some((w) => /identité|légitim/i.test(w) || /HTTPS/i.test(w)));
    assert.equal(ai.needs_deep_analysis, true);
    assert.ok(!/100\s*%\s*sûr/i.test(ai.recommendation));
  });

  it("merge refuses AI upgrade to low without official identity", () => {
    const engine = baseResult();
    const merged = mergeAiSuggestions(engine, {
      risk_suggestion: "low",
      verdict_suggestion: "trusted",
      confidence: 99,
      needs_deep_analysis: false,
    });
    assert.equal(merged.riskLevel, "unknown");
    assert.equal(merged.verdict, "unknown");
  });

  it("merge allows AI escalation to caution/high", () => {
    const engine = baseResult({ riskLevel: "unknown", verdict: "unknown" });
    const merged = mergeAiSuggestions(engine, {
      risk_suggestion: "caution",
      verdict_suggestion: "suspicious",
      confidence: 70,
      needs_deep_analysis: true,
    });
    assert.equal(merged.riskLevel, "caution");
    assert.equal(merged.needsDeepAnalysis, true);
  });

  it("parseAnalystJson grounds signal ids", () => {
    const engine = baseResult();
    const fb = templateAnalyze(engine);
    const parsed = parseAnalystJson(
      JSON.stringify({
        headline: "Fiabilité non établie",
        overview: "Domaine inconnu.",
        why: ["Identité non confirmée.", "HTTPS ne prouve pas la légitimité."],
        advice: "N'entrez aucune donnée personnelle.",
        summary: "Preuves insuffisantes.",
        recommendation: "N'entrez aucune donnée personnelle.",
        source_signal_ids: ["identity_not_established", "invented_id"],
        source_evidence_ids: [],
        risk_suggestion: "unknown",
        verdict_suggestion: "unknown",
        confidence: 85,
        needs_deep_analysis: true,
        reasoning: ["grounded"],
      }),
      fb,
      engine,
    );
    assert.ok(parsed);
    assert.deepEqual(parsed!.sourceSignalIds, ["identity_not_established"]);
    assert.equal(parsed!.provider, "mcbuleli-ai");
  });

  it("Cas 8 — AI down keeps honest unknown (no invented trust)", () => {
    const engine = baseResult();
    const fb = templateAnalyze(engine);
    const incomplete = { ...fb, incomplete: true, provider: "template" as const };
    const merged = mergeAiSuggestions(engine, incomplete);
    assert.equal(merged.riskLevel, "unknown");
    assert.notEqual(merged.verdict, "trusted");
  });
});
