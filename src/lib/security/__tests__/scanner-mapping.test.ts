import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { __test } from "@/lib/security/providers";
import type { LinkAnalysisResult } from "@/types/security";

const { signalsToFindings } = __test;

function base(partial: Partial<LinkAnalysisResult>): LinkAnalysisResult {
  return {
    urlRaw: "https://example.test",
    urlNormalized: "https://example.test",
    domain: "example.test",
    riskLevel: "unknown",
    verdict: "unknown",
    confidence: 70,
    score: 0,
    signals: [],
    blocked: false,
    ...partial,
  };
}

describe("InternalScanner findings mapping (Phase E)", () => {
  it("unknown with no signals still gets honest 'Fiabilité non établie' finding", () => {
    const findings = signalsToFindings(base({ riskLevel: "unknown", verdict: "unknown" }), "internal");
    assert.ok(findings.some((f) => f.category === "identity_unknown"));
    assert.ok(!findings.some((f) => f.title.toLowerCase().includes("sûr")));
  });

  it("does not treat empty findings as trusted/low risk level", () => {
    const analysis = base({ riskLevel: "unknown", verdict: "unknown" });
    const findings = signalsToFindings(analysis, "internal");
    // Surface findings may include info — risk stays on analysis
    assert.equal(analysis.riskLevel, "unknown");
    assert.ok(findings.length >= 1);
  });

  it("SSRF blocked analyses do not invent identity_unknown finding", () => {
    const findings = signalsToFindings(
      base({
        blocked: true,
        riskLevel: "high",
        verdict: "dangerous",
        signals: [
          {
            id: "ssrf",
            code: "ssrf",
            title: "Cible bloquée",
            severity: "high",
            confidence: 99,
            description: "localhost",
            evidence: [],
          },
        ],
      }),
      "internal",
    );
    assert.ok(findings.some((f) => f.severity === "high"));
    assert.ok(!findings.some((f) => f.category === "identity_unknown"));
  });

  it("maps medium/high signals without forcing unknown finding when blocking exists", () => {
    const findings = signalsToFindings(
      base({
        riskLevel: "caution",
        verdict: "suspicious",
        signals: [
          {
            id: "1",
            code: "lookalike",
            title: "Lookalike",
            severity: "medium",
            confidence: 80,
            description: "x",
            evidence: ["e"],
          },
        ],
      }),
      "internal",
    );
    assert.ok(findings.some((f) => f.severity === "medium"));
    assert.ok(!findings.some((f) => f.category === "identity_unknown"));
  });
});
