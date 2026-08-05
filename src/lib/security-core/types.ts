import type { LinkSignal, RiskLevel, Verdict } from "@/types/security";
import type { BrandEntry } from "@/lib/link-analysis/verdict";

/** Dimension status — never treat unknown as pass/trusted. */
export type DimensionStatus =
  | "pass"
  | "fail"
  | "none"
  | "present"
  | "unknown"
  | "information_not_established";

export type EvidenceDimensions = {
  technical_validity: DimensionStatus;
  domain_reputation: DimensionStatus;
  identity_confidence: DimensionStatus;
  brand_consistency: DimensionStatus;
  web_evidence: DimensionStatus;
  malicious_signals: DimensionStatus;
  phishing_signals: DimensionStatus;
  content_signals: DimensionStatus;
  infrastructure_signals: DimensionStatus;
  historical_signals: DimensionStatus;
};

export type EvidenceItem = {
  id: string;
  tool: string;
  category:
    | "dns"
    | "tls"
    | "http"
    | "redirect"
    | "domain"
    | "identity"
    | "reputation"
    | "heuristic"
    | "gateway";
  claim: string;
  status: "established" | "information_not_established" | "failed";
  data: Record<string, unknown>;
  source: string;
  collectedAt: string;
};

export type TechnicalEvidence = {
  https: boolean;
  tls_valid: boolean | null;
  tls_issuer: string | null;
  tls_expires_at: string | null;
  tls_hostname_match: boolean | null;
  http_status: number | null;
  redirects: { from: string; to: string; status?: number }[];
  final_url: string | null;
  note: string;
};

export type IdentityEvidence = {
  claimed_entity: string | null;
  identified_entity: string | null;
  official_domain: string | null;
  identity_confidence: number;
  impersonation_risk: "none" | "low" | "medium" | "high" | "unknown";
  match_type: "exact_official" | "lookalike" | "brand_in_name" | "none" | "unknown";
};

export type ReputationEvidence = {
  status: "known_good" | "known_bad" | "unknown" | "information_not_established";
  labels: string[];
  sources: string[];
  score: number | null;
};

export type DomainEvidence = {
  hostname: string;
  parent_domain: string | null;
  registrar: string | null;
  created_at: string | null;
  rdap_status: "ok" | "unavailable" | "skipped" | "information_not_established";
};

export type EvidenceBundle = {
  url_raw: string;
  normalized_url: string;
  domain: string | null;
  final_url: string | null;
  blocked: boolean;
  block_reason?: string;
  tools_used: string[];
  technical: TechnicalEvidence;
  identity: IdentityEvidence;
  reputation: ReputationEvidence;
  domain_info: DomainEvidence | null;
  dimensions: EvidenceDimensions;
  evidence: EvidenceItem[];
  signals: LinkSignal[];
  brands: BrandEntry[];
  collected_at: string;
  duration_ms: number;
};

export type RiskEngineResult = {
  riskLevel: RiskLevel;
  verdict: Verdict;
  confidence: number;
  score: number;
  needs_deep_analysis: boolean;
  reasoning: string[];
  dimensions: EvidenceDimensions;
  evidence: EvidenceItem[];
  signals: LinkSignal[];
};

export const EMPTY_DIMENSIONS = (): EvidenceDimensions => ({
  technical_validity: "unknown",
  domain_reputation: "unknown",
  identity_confidence: "unknown",
  brand_consistency: "unknown",
  web_evidence: "unknown",
  malicious_signals: "unknown",
  phishing_signals: "unknown",
  content_signals: "unknown",
  infrastructure_signals: "unknown",
  historical_signals: "unknown",
});

export function makeEvidence(
  partial: Omit<EvidenceItem, "collectedAt" | "id"> & { id?: string },
): EvidenceItem {
  return {
    id: partial.id ?? `${partial.tool}:${partial.category}:${Date.now()}`,
    tool: partial.tool,
    category: partial.category,
    claim: partial.claim,
    status: partial.status,
    data: partial.data,
    source: partial.source,
    collectedAt: new Date().toISOString(),
  };
}

export function makeSignal(
  partial: Omit<LinkSignal, "id"> & { id?: string },
): LinkSignal {
  return {
    id: partial.id ?? partial.code,
    ...partial,
  };
}
