import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTokenFromQuickstart,
  getHackerAIConfig,
  NullHackerAIAdapter,
  AgentTokenHackerAIAdapter,
} from "../adapter";

describe("HackerAIAdapter (Phase D)", () => {
  it("extracts token from npx quickstart command", () => {
    const t = extractTokenFromQuickstart(
      "npx @hackerai/local@latest --token hsb_testtoken123",
    );
    assert.equal(t, "hsb_testtoken123");
  });

  it("Null adapter never claims success / trusted", async () => {
    const a = new NullHackerAIAdapter();
    assert.equal(await a.isAvailable(), false);
    const { jobId } = await a.startInvestigation({
      analysisId: "a1",
      url: "https://gkffjkfdf.com",
      normalizedUrl: "https://gkffjkfdf.com/",
      domain: "gkffjkfdf.com",
      riskLevel: "unknown",
      verdict: "unknown",
      needsDeepAnalysis: true,
      evidenceSummary: ["identity not established"],
      signalCodes: ["identity_not_established"],
    });
    const r = await a.getResult(jobId);
    assert.ok(r);
    assert.equal(r!.status, "unavailable");
    assert.equal(r!.incomplete, true);
    assert.equal(r!.invoked, false);
  });

  it("Agent token adapter registers awaiting_local_agent without inventing HTTP API", async () => {
    const a = new AgentTokenHackerAIAdapter({
      enabled: true,
      mode: "agent_token",
      apiKey: "hsb_dummy",
      apiUrl: null,
      quickstart: "npx @hackerai/local@latest --token hsb_dummy",
    });
    assert.equal(await a.isAvailable(), true);
    const { jobId } = await a.startInvestigation({
      analysisId: "a2",
      url: "https://rawbank-secure-login.com",
      normalizedUrl: "https://rawbank-secure-login.com/",
      domain: "rawbank-secure-login.com",
      riskLevel: "caution",
      verdict: "suspicious",
      needsDeepAnalysis: true,
      evidenceSummary: ["brand impersonation"],
      signalCodes: ["brand_impersonation_name"],
    });
    const r = await a.getResult(jobId);
    assert.equal(r!.mode, "agent_token");
    assert.equal(r!.status, "awaiting_local_agent");
    assert.equal(r!.invoked, true);
    assert.equal(r!.incomplete, true);
    assert.ok(String(r!.raw?.brief || "").includes("rawbank-secure-login"));
  });

  it("config prefers API key and agent_token when no API URL", () => {
    const keys = [
      "HACKERAI_ENABLED",
      "HACKERAI_MODE",
      "HACKERAI_API_KEY",
      "HACKERAI_API_URL",
      "HACKERAI_QUICKSTART_TOKEN",
    ] as const;
    const prev: Record<string, string | undefined> = {};
    for (const k of keys) prev[k] = process.env[k];
    process.env.HACKERAI_ENABLED = "true";
    process.env.HACKERAI_MODE = "agent_token";
    process.env.HACKERAI_API_KEY = "hsb_from_env";
    process.env.HACKERAI_API_URL = "";
    process.env.HACKERAI_QUICKSTART_TOKEN =
      "npx @hackerai/local@latest --token hsb_from_qs";
    try {
      const cfg = getHackerAIConfig();
      assert.equal(cfg.mode, "agent_token");
      assert.equal(cfg.apiKey, "hsb_from_env");
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });
});
