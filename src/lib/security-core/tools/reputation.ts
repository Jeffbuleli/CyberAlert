import { getReputationProvider } from "@/lib/reputation";
import { makeEvidence, type EvidenceItem, type ReputationEvidence } from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";

export type ReputationToolResult = {
  tool: "ReputationTool";
  reputation: ReputationEvidence;
  evidence: EvidenceItem[];
  signals: LinkSignal[];
};

/**
 * ReputationTool — wraps existing provider.
 * Placeholder feeds return information_not_established / unknown (never trusted).
 */
export async function runReputationTool(domain: string): Promise<ReputationToolResult> {
  const tool = "ReputationTool";
  const provider = getReputationProvider();
  const lookup = await provider.lookup(domain);

  const isUnknown =
    lookup.score == null ||
    lookup.labels.includes("unknown") ||
    lookup.labels.length === 0;

  const reputation: ReputationEvidence = {
    status: isUnknown ? "information_not_established" : "unknown",
    labels: lookup.labels.length ? lookup.labels : ["unknown"],
    sources: [lookup.source],
    score: lookup.score,
  };

  return {
    tool,
    reputation: {
      ...reputation,
      status: "information_not_established",
    },
    evidence: [
      makeEvidence({
        tool,
        category: "reputation",
        claim: "Réputation non établie via sources contractées",
        status: "information_not_established",
        data: {
          domain,
          provider: lookup.source,
          labels: reputation.labels,
          score: lookup.score,
        },
        source: lookup.source,
      }),
    ],
    signals: [],
  };
}
