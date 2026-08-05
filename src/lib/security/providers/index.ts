import { randomUUID } from "crypto";
import type {
  AuthorizedScope,
  NormalizedFinding,
  ScanTarget,
} from "@/types/security";
import { analyzeLink } from "@/lib/link-analysis/engine";
import { getHackerAIAdapter, getHackerAIConfig } from "@/lib/security-core/hackerai";

export interface SecurityScanProvider {
  id: string;
  scan(target: ScanTarget, scope?: AuthorizedScope): Promise<NormalizedFinding[]>;
}

export class InternalScannerProvider implements SecurityScanProvider {
  id = "internal";

  async scan(target: ScanTarget, _scope?: AuthorizedScope): Promise<NormalizedFinding[]> {
    const analysis = await analyzeLink(target.url, { fetchRemote: true });
    const findings: NormalizedFinding[] = [];

    for (const s of analysis.signals) {
      if (s.severity === "info") continue;
      const severity =
        s.severity === "high" ? "high" : s.severity === "medium" ? "medium" : "low";
      findings.push({
        id: randomUUID(),
        title: s.title,
        severity,
        confidence: s.confidence,
        category: s.code,
        description: s.description,
        impact: s.severity === "high" ? "Risque potentiel pour les utilisateurs" : undefined,
        evidence: s.evidence,
        affectedAsset: analysis.domain ?? target.url,
        recommendation: s.recommendation,
        source: this.id,
        status: "new",
      });
    }

    if (analysis.urlNormalized.startsWith("http://")) {
      findings.push({
        id: randomUUID(),
        title: "Absence de HTTPS obligatoire",
        severity: "medium",
        confidence: 90,
        category: "transport",
        description:
          "Le site est accessible en HTTP sans redirection forcée détectée vers HTTPS.",
        evidence: [`url=${analysis.urlNormalized}`],
        affectedAsset: analysis.domain ?? target.url,
        recommendation: "Activer HTTPS et rediriger tout le trafic HTTP vers HTTPS.",
        source: this.id,
        status: "new",
      });
    }

    return findings;
  }
}

/**
 * Deep path via HackerAIAdapter (agent token / optional HTTP bridge).
 * Does not invent a public HackerAI REST API.
 */
export class HackerAIProvider implements SecurityScanProvider {
  id = "hackerai";

  async scan(target: ScanTarget, _scope?: AuthorizedScope): Promise<NormalizedFinding[]> {
    const adapter = getHackerAIAdapter();
    if (!(await adapter.isAvailable())) {
      throw new Error("hackerai_not_configured");
    }
    const { jobId } = await adapter.startInvestigation({
      analysisId: randomUUID(),
      url: target.url,
      normalizedUrl: target.url,
      domain: null,
      riskLevel: "unknown",
      verdict: "unknown",
      needsDeepAnalysis: true,
      evidenceSummary: [`Authorized app scan for ${target.url}`],
      signalCodes: [],
    });
    const result = await adapter.getResult(jobId);
    return (result?.findings || []).map((f) => ({
      id: randomUUID(),
      title: f.title,
      severity: f.severity === "info" ? "info" : f.severity,
      confidence: 70,
      category: "hackerai",
      description: f.detail,
      evidence: f.evidence,
      affectedAsset: target.url,
      source: this.id,
      status: "new" as const,
    }));
  }
}

export function getSecurityScanProvider(): SecurityScanProvider {
  const id = process.env.SECURITY_SCAN_PROVIDER?.trim() || "internal";
  if (id === "hackerai") {
    const cfg = getHackerAIConfig();
    if (!cfg.apiKey) return new InternalScannerProvider();
    return new HackerAIProvider();
  }
  return new InternalScannerProvider();
}
