import { randomUUID } from "crypto";
import type {
  AuthorizedScope,
  NormalizedFinding,
  ScanTarget,
} from "@/types/security";
import { analyzeLink } from "@/lib/link-analysis/engine";

export interface SecurityScanProvider {
  id: string;
  scan(target: ScanTarget, scope?: AuthorizedScope): Promise<NormalizedFinding[]>;
}

/**
 * Internal non-intrusive scanner: reuses link analysis + passive HTTP headers checks.
 * Never performs exploitation. Requires explicit scope for non-owned targets in product flows.
 */
export class InternalScannerProvider implements SecurityScanProvider {
  id = "internal";

  async scan(target: ScanTarget, _scope?: AuthorizedScope): Promise<NormalizedFinding[]> {
    const analysis = await analyzeLink(target.url, { fetchRemote: true });
    const findings: NormalizedFinding[] = [];

    for (const s of analysis.signals) {
      if (s.severity === "info") continue;
      const severity =
        s.severity === "high"
          ? "high"
          : s.severity === "medium"
            ? "medium"
            : "low";
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
        description: "Le site est accessible en HTTP sans redirection forcée détectée vers HTTPS.",
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

/** Stub — activate when HackerAI API contract is available. */
export class HackerAIProvider implements SecurityScanProvider {
  id = "hackerai";

  async scan(_target: ScanTarget, _scope?: AuthorizedScope): Promise<NormalizedFinding[]> {
    throw new Error("hackerai_not_configured");
  }
}

export function getSecurityScanProvider(): SecurityScanProvider {
  const id = process.env.SECURITY_SCAN_PROVIDER?.trim() || "internal";
  if (id === "hackerai") {
    if (!process.env.HACKERAI_API_KEY) return new InternalScannerProvider();
    return new HackerAIProvider();
  }
  return new InternalScannerProvider();
}
