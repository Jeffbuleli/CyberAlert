import type { LinkSignal, RiskLevel, Verdict } from "@/types/security";
import { riskLevelToVerdict } from "@/types/security";

export type BrandEntry = { name: string; domains: string[] };

/**
 * True only when hostname is an exact brand domain or a subdomain of one.
 * Containing a brand name in a random SLD is NOT enough (usurpation case).
 */
export function isOfficialKnownDomain(
  hostname: string,
  brands: BrandEntry[],
): { match: boolean; brandName?: string; officialDomain?: string } {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!host) return { match: false };

  for (const brand of brands) {
    for (const d of brand.domains) {
      const domain = d.toLowerCase();
      if (host === domain || host.endsWith(`.${domain}`)) {
        return { match: true, brandName: brand.name, officialDomain: domain };
      }
    }
  }
  return { match: false };
}

/**
 * Phase A decision:
 * - high / caution from negative signal score
 * - impersonation signals (lookalike / homoglyph) → at least caution
 * - low only with official domain match AND no significant risk score
 * - otherwise unknown (HTTPS/DNS/HTTP alone never produce low)
 */
export function decideRiskLevel(input: {
  score: number;
  hasOfficialLegitimacy: boolean;
  hasImpersonationSignal?: boolean;
}): RiskLevel {
  if (input.score >= 70) return "high";
  if (input.score >= 35 || input.hasImpersonationSignal) return "caution";
  if (input.hasOfficialLegitimacy) return "low";
  return "unknown";
}

export function decideVerdict(riskLevel: RiskLevel): Verdict {
  return riskLevelToVerdict(riskLevel);
}

/** Confidence in the assessment (not a safety percentage). */
export function assessmentConfidence(
  riskLevel: RiskLevel,
  signals: LinkSignal[],
): number {
  const n = signals.length;
  if (riskLevel === "unknown") {
    // High confidence that we cannot establish legitimacy.
    return Math.min(95, 70 + Math.min(n, 5) * 4);
  }
  if (riskLevel === "high") {
    const highs = signals.filter((s) => s.severity === "high").length;
    return Math.min(95, 75 + highs * 5);
  }
  if (riskLevel === "caution") {
    return Math.min(90, 60 + Math.min(n, 6) * 4);
  }
  // low / trusted official match
  return Math.min(90, 65 + Math.min(n, 5) * 4);
}
