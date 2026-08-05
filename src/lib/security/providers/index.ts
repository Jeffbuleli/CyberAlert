import { randomUUID } from "crypto";
import type {
  AuthorizedScope,
  LinkAnalysisResult,
  NormalizedFinding,
  ScanTarget,
} from "@/types/security";
import { analyzeLink } from "@/lib/link-analysis/engine";
import { getHackerAIAdapter, getHackerAIConfig } from "@/lib/security-core/hackerai";

export type ScanBundle = {
  findings: NormalizedFinding[];
  analysis: LinkAnalysisResult | null;
};

export interface SecurityScanProvider {
  id: string;
  scan(target: ScanTarget, scope?: AuthorizedScope): Promise<ScanBundle>;
}

function signalsToFindings(
  analysis: LinkAnalysisResult,
  source: string,
): NormalizedFinding[] {
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
      affectedAsset: analysis.domain ?? analysis.urlNormalized,
      recommendation: s.recommendation,
      source,
      status: "new",
    });
  }

  if (analysis.urlNormalized.startsWith("http://") && !analysis.blocked) {
    findings.push({
      id: randomUUID(),
      title: "Absence de HTTPS obligatoire",
      severity: "medium",
      confidence: 90,
      category: "transport",
      description:
        "Le site est accessible en HTTP sans preuve d'une redirection forcée vers HTTPS dans cette analyse.",
      evidence: [`url=${analysis.urlNormalized}`],
      affectedAsset: analysis.domain ?? analysis.urlNormalized,
      recommendation: "Activer HTTPS et rediriger tout le trafic HTTP vers HTTPS.",
      source,
      status: "new",
    });
  }

  const hasBlocking = findings.some(
    (f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium",
  );

  // Never leave an unknown/unproven target looking "clean" with zero findings.
  if (
    !analysis.blocked &&
    (analysis.riskLevel === "unknown" || analysis.verdict === "unknown") &&
    !hasBlocking
  ) {
    findings.push({
      id: randomUUID(),
      title: "Fiabilité non établie",
      severity: "info",
      confidence: analysis.confidence || 70,
      category: "identity_unknown",
      description:
        "Les contrôles techniques (DNS, TLS, HTTP) ne suffisent pas à confirmer la légitimité de cette application. Verdict : UNKNOWN — ne pas traiter comme sûr.",
      evidence: [
        `risk_level=${analysis.riskLevel}`,
        `verdict=${analysis.verdict}`,
        "HTTPS≠légitimité",
      ],
      affectedAsset: analysis.domain ?? analysis.urlNormalized,
      recommendation:
        "Confirmer l'identité officielle du domaine avant toute mise en production ou intégration sensible.",
      source,
      status: "new",
    });
  }

  return findings;
}

export class InternalScannerProvider implements SecurityScanProvider {
  id = "internal";

  async scan(target: ScanTarget, _scope?: AuthorizedScope): Promise<ScanBundle> {
    const analysis = await analyzeLink(target.url, { fetchRemote: true });
    return {
      findings: signalsToFindings(analysis, this.id),
      analysis,
    };
  }
}

/**
 * Deep path via HackerAIAdapter (agent token / optional HTTP bridge).
 * Does not invent a public HackerAI REST API.
 */
export class HackerAIProvider implements SecurityScanProvider {
  id = "hackerai";

  async scan(target: ScanTarget, _scope?: AuthorizedScope): Promise<ScanBundle> {
    const adapter = getHackerAIAdapter();
    if (!(await adapter.isAvailable())) {
      throw new Error("hackerai_not_configured");
    }
    // Prefer Evidence first so we never invent "safe" from HackerAI alone.
    const analysis = await analyzeLink(target.url, { fetchRemote: true });
    const { jobId } = await adapter.startInvestigation({
      analysisId: randomUUID(),
      url: target.url,
      normalizedUrl: analysis.urlNormalized,
      domain: analysis.domain,
      riskLevel: analysis.riskLevel,
      verdict: analysis.verdict,
      needsDeepAnalysis: true,
      evidenceSummary: [`Authorized app scan for ${target.url}`],
      signalCodes: analysis.signals.map((s) => s.code),
    });
    const result = await adapter.getResult(jobId);
    const deepFindings = (result?.findings || []).map((f) => ({
      id: randomUUID(),
      title: f.title,
      severity: (f.severity === "info" ? "info" : f.severity) as NormalizedFinding["severity"],
      confidence: 70,
      category: "hackerai",
      description: f.detail,
      evidence: f.evidence,
      affectedAsset: target.url,
      source: this.id,
      status: "new" as const,
    }));
    const base = signalsToFindings(analysis, "internal");
    return { findings: [...base, ...deepFindings], analysis };
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

/** Pure helpers exported for unit tests */
export const __test = { signalsToFindings };
