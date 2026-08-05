import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateOrBlockedIp,
  isBlockedHostname,
  normalizeUrlInput,
  analyzeLink,
} from "../engine";
import {
  decideRiskLevel,
  isOfficialKnownDomain,
  assessmentConfidence,
} from "../verdict";
import { runCompanyIdentityTool } from "@/lib/security-core/tools/company-identity";
import { evaluateEvidence } from "@/lib/security-core/risk-engine";
import { collectEvidence } from "@/lib/security-core/evidence-engine";

const BRANDS = [
  { name: "Rawbank", domains: ["rawbank.com", "rawbank.cd"] },
  { name: "McBuleli", domains: ["mcbuleli.org", "mcbuleli.online"] },
];

describe("SSRF guards", () => {
  it("blocks private IPv4", () => {
    assert.equal(isPrivateOrBlockedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrBlockedIp("10.0.0.5"), true);
    assert.equal(isPrivateOrBlockedIp("192.168.1.1"), true);
    assert.equal(isPrivateOrBlockedIp("169.254.169.254"), true);
    assert.equal(isPrivateOrBlockedIp("8.8.8.8"), false);
  });

  it("blocks localhost hostnames", () => {
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedHostname("foo.local"), true);
    assert.equal(isBlockedHostname("example.com"), false);
  });

  it("normalizes bare domains to https", () => {
    const u = normalizeUrlInput("example.com/path");
    assert.equal(u.protocol, "https:");
    assert.equal(u.hostname, "example.com");
  });
});

describe("verdict decision (Phase A)", () => {
  it("maps score 0 without legitimacy to unknown (not low)", () => {
    assert.equal(decideRiskLevel({ score: 0, hasOfficialLegitimacy: false }), "unknown");
  });

  it("maps score 0 with legitimacy to low", () => {
    assert.equal(decideRiskLevel({ score: 0, hasOfficialLegitimacy: true }), "low");
  });

  it("maps high scores to high regardless of legitimacy", () => {
    assert.equal(decideRiskLevel({ score: 80, hasOfficialLegitimacy: true }), "high");
    assert.equal(decideRiskLevel({ score: 80, hasOfficialLegitimacy: false }), "high");
  });

  it("elevates impersonation signals to at least caution", () => {
    assert.equal(
      decideRiskLevel({
        score: 10,
        hasOfficialLegitimacy: false,
        hasImpersonationSignal: true,
      }),
      "caution",
    );
  });

  it("does not treat brand substring as official domain", () => {
    const r = isOfficialKnownDomain("rawbank-secure-login.com", BRANDS);
    assert.equal(r.match, false);
  });

  it("recognizes exact official domains and subdomains", () => {
    assert.equal(isOfficialKnownDomain("rawbank.com", BRANDS).match, true);
    assert.equal(isOfficialKnownDomain("www.rawbank.cd", BRANDS).match, true);
    assert.equal(isOfficialKnownDomain("pay.mcbuleli.org", BRANDS).match, true);
  });

  it("keeps high confidence for unknown assessments", () => {
    const c = assessmentConfidence("unknown", []);
    assert.ok(c >= 70);
  });
});

describe("CompanyIdentityTool (Phase B)", () => {
  it("flags brand-in-name without claiming ownership", () => {
    const r = runCompanyIdentityTool("rawbank-secure-login.com", BRANDS);
    assert.equal(r.identity.match_type, "brand_in_name");
    assert.equal(r.identity.claimed_entity, "Rawbank");
    assert.equal(r.identity.identified_entity, null);
    assert.equal(r.identity.official_domain, "rawbank.com");
    assert.ok(r.signals.some((s) => s.code === "brand_impersonation_name"));
  });

  it("recognizes official domain", () => {
    const r = runCompanyIdentityTool("www.rawbank.com", BRANDS);
    assert.equal(r.identity.match_type, "exact_official");
    assert.ok(r.identity.identity_confidence >= 0.8);
  });
});

describe("analyzeLink", () => {
  it("blocks localhost without fetching", async () => {
    const r = await analyzeLink("http://127.0.0.1/", { fetchRemote: false });
    assert.equal(r.blocked, true);
    assert.equal(r.riskLevel, "high");
    assert.equal(r.verdict, "dangerous");
  });

  it("flags http as caution-capable signal", async () => {
    const r = await analyzeLink("http://example.com", { fetchRemote: false });
    assert.ok(r.signals.some((s) => s.code === "no_https"));
  });

  it("Cas 1 — unknown domain never becomes trusted/low", async () => {
    const r = await analyzeLink("https://gkffjkfdf.com", {
      fetchRemote: false,
      brands: BRANDS,
    });
    assert.equal(r.riskLevel, "unknown");
    assert.equal(r.verdict, "unknown");
    assert.ok(r.signals.some((s) => s.code === "identity_not_established"));
    assert.ok(r.dimensions);
    assert.equal(r.dimensions?.identity_confidence, "information_not_established");
    assert.notEqual(r.dimensions?.technical_validity, "pass"); // no remote TLS
  });

  it("Cas 4 — HTTPS alone does not produce low", async () => {
    const r = await analyzeLink("https://totally-random-xyz-example.test", {
      fetchRemote: false,
      brands: BRANDS,
    });
    assert.equal(r.riskLevel, "unknown");
    assert.notEqual(r.riskLevel, "low");
  });

  it("Cas 2 — official known domain can be low without negative signals", async () => {
    const r = await analyzeLink("https://mcbuleli.org", {
      fetchRemote: false,
      brands: BRANDS,
    });
    assert.equal(r.riskLevel, "low");
    assert.equal(r.verdict, "trusted");
    assert.ok(r.signals.some((s) => s.code === "official_domain_match"));
    assert.equal(r.dimensions?.identity_confidence, "pass");
  });

  it("Cas 3 — brand lookalike stays elevated (not trusted)", async () => {
    const r = await analyzeLink("https://rawbannk.com", {
      fetchRemote: false,
      brands: BRANDS,
    });
    assert.ok(r.signals.some((s) => s.code === "brand_lookalike"));
    assert.notEqual(r.riskLevel, "low");
    assert.ok(r.riskLevel === "caution" || r.riskLevel === "high");
  });

  it("Cas 3b — brand-secure-login impersonation", async () => {
    const r = await analyzeLink("https://rawbank-secure-login.com/login", {
      fetchRemote: false,
      brands: BRANDS,
    });
    assert.ok(r.signals.some((s) => s.code === "brand_impersonation_name"));
    assert.notEqual(r.riskLevel, "low");
    assert.equal(r.identity?.claimed_entity, "Rawbank");
    assert.equal(r.identity?.identified_entity, null);
  });

  it("Cas 9 — SSRF private destination blocked", async () => {
    const r = await analyzeLink("http://169.254.169.254/", { fetchRemote: false });
    assert.equal(r.blocked, true);
    assert.equal(r.riskLevel, "high");
  });

  it("EvidenceEngine exposes tools and never trusts on empty reputation", async () => {
    const bundle = await collectEvidence("https://gkffjkfdf.com", {
      fetchRemote: false,
      brands: BRANDS,
      skipSlowTools: true,
    });
    const risk = evaluateEvidence(bundle);
    assert.ok(bundle.tools_used.includes("CompanyIdentityTool"));
    assert.equal(bundle.reputation.status, "information_not_established");
    assert.equal(risk.riskLevel, "unknown");
    assert.equal(risk.needs_deep_analysis, true);
  });
});
