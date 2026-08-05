/**
 * Link analysis entrypoint — Phase B delegates to Security Core.
 * Re-exports SSRF helpers for backward-compatible imports/tests.
 */
import type { LinkAnalysisResult } from "@/types/security";
import type { BrandEntry } from "@/lib/link-analysis/verdict";
import {
  collectEvidence,
  evaluateEvidence,
  toLinkAnalysisResult,
} from "@/lib/security-core";

export {
  isPrivateOrBlockedIp,
  isBlockedHostname,
  normalizeUrlInput,
} from "@/lib/security-core/gateway";

export async function analyzeLink(
  rawUrl: string,
  options?: {
    brands?: BrandEntry[];
    fetchRemote?: boolean;
    skipSlowTools?: boolean;
  },
): Promise<LinkAnalysisResult> {
  const bundle = await collectEvidence(rawUrl, {
    brands: options?.brands,
    fetchRemote: options?.fetchRemote,
    skipSlowTools: options?.skipSlowTools ?? options?.fetchRemote === false,
  });
  const risk = evaluateEvidence(bundle);
  return toLinkAnalysisResult(bundle, risk);
}
