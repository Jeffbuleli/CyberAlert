export type DeepJobStatus =
  | "queued"
  | "running"
  | "awaiting_local_agent"
  | "completed"
  | "failed"
  | "unavailable"
  | "timeout";

export type DeepInvestigationInput = {
  analysisId: string;
  url: string;
  normalizedUrl: string;
  domain: string | null;
  riskLevel: string;
  verdict: string;
  needsDeepAnalysis: boolean;
  evidenceSummary: string[];
  signalCodes: string[];
};

export type DeepInvestigationResult = {
  jobId: string;
  status: DeepJobStatus;
  mode: "disabled" | "agent_token" | "http_bridge";
  invoked: boolean;
  summary: string;
  findings: {
    title: string;
    severity: "info" | "low" | "medium" | "high";
    detail: string;
    evidence: string[];
  }[];
  /** Never use this to force trusted — Risk Engine decides. */
  suggestsEscalation: boolean;
  incomplete: boolean;
  error?: string;
  raw?: Record<string, unknown>;
};

export interface HackerAIAdapter {
  id: string;
  isAvailable(): Promise<boolean>;
  startInvestigation(input: DeepInvestigationInput): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<DeepJobStatus>;
  getResult(jobId: string): Promise<DeepInvestigationResult | null>;
}
