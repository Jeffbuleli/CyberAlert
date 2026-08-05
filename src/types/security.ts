/** Public risk stored in DB / API (Phase A). */
export type RiskLevel = "low" | "caution" | "high" | "unknown";

/**
 * Canonical verdict (Evidence → Analysis → Verdict).
 * Phase A maps RiskLevel ↔ Verdict; later phases may store Verdict directly.
 */
export type Verdict =
  | "trusted"
  | "likely_trusted"
  | "unknown"
  | "suspicious"
  | "dangerous";

export type LinkSignal = {
  id: string;
  code: string;
  title: string;
  severity: "info" | "low" | "medium" | "high";
  confidence: number;
  description: string;
  evidence: string[];
  recommendation?: string;
};

export type LinkAnalysisResult = {
  urlRaw: string;
  urlNormalized: string;
  domain: string | null;
  riskLevel: RiskLevel;
  /** Derived from riskLevel for forward-compatible clients. */
  verdict: Verdict;
  /** Confidence in the assessment itself (0–100), not “safety %”. */
  confidence: number;
  score: number;
  signals: LinkSignal[];
  blocked: boolean;
  blockReason?: string;
  /** Phase B — multi-dimensional evidence snapshot */
  dimensions?: import("@/lib/security-core/types").EvidenceDimensions;
  evidenceItems?: import("@/lib/security-core/types").EvidenceItem[];
  needsDeepAnalysis?: boolean;
  toolsUsed?: string[];
  technical?: import("@/lib/security-core/types").TechnicalEvidence;
  identity?: import("@/lib/security-core/types").IdentityEvidence;
  reputation?: import("@/lib/security-core/types").ReputationEvidence;
};

export type NormalizedFinding = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  category: string;
  description: string;
  impact?: string;
  evidence: string[];
  affectedAsset?: string;
  recommendation?: string;
  source: string;
  status: FindingStatus;
};

export type FindingStatus =
  | "new"
  | "confirmed"
  | "in_progress"
  | "fixed"
  | "retest_pending"
  | "resolved"
  | "false_positive";

export type AuthorizedScope = {
  domains?: string[];
  subdomains?: string[];
  ips?: string[];
  apis?: string[];
  environment?: string;
  startAt?: string;
  endAt?: string;
  allowedTests?: string[];
  exclusions?: string[];
};

export type ScanTarget = {
  url: string;
  projectId?: string;
};

/** Map stored riskLevel → canonical verdict. */
export function riskLevelToVerdict(level: RiskLevel): Verdict {
  switch (level) {
    case "low":
      return "trusted";
    case "caution":
      return "suspicious";
    case "high":
      return "dangerous";
    case "unknown":
      return "unknown";
  }
}

/** Normalize legacy DB rows that predate `unknown`. */
export function parseRiskLevel(raw: string | null | undefined): RiskLevel {
  if (raw === "low" || raw === "caution" || raw === "high" || raw === "unknown") {
    return raw;
  }
  return "unknown";
}
