export type RiskLevel = "low" | "caution" | "high";

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
  score: number;
  signals: LinkSignal[];
  blocked: boolean;
  blockReason?: string;
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
