import type { BrandEntry } from "@/lib/link-analysis/verdict";
import { loadBrandWatchlist, DEFAULT_BRANDS } from "@/lib/security-core/brands";
import { admitUrl } from "@/lib/security-core/gateway";
import { runDnsResolverTool } from "@/lib/security-core/tools/dns-resolver";
import { runTlsInspectionTool } from "@/lib/security-core/tools/tls-inspection";
import { runHttpAndRedirectTools } from "@/lib/security-core/tools/http-redirect";
import { runCompanyIdentityTool } from "@/lib/security-core/tools/company-identity";
import { runDomainInfoTool } from "@/lib/security-core/tools/domain-info";
import { runReputationTool } from "@/lib/security-core/tools/reputation";
import { runLocalHeuristicsTool } from "@/lib/security-core/tools/local-heuristics";
import {
  EMPTY_DIMENSIONS,
  makeEvidence,
  makeSignal,
  type EvidenceBundle,
  type EvidenceDimensions,
  type EvidenceItem,
  type IdentityEvidence,
  type TechnicalEvidence,
} from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";

function dedupeSignals(signals: LinkSignal[]): LinkSignal[] {
  const byCode = new Map<string, LinkSignal>();
  const weight = (s: LinkSignal["severity"]) =>
    s === "high" ? 4 : s === "medium" ? 3 : s === "low" ? 2 : 1;
  for (const s of signals) {
    const prev = byCode.get(s.code);
    if (!prev || weight(s.severity) > weight(prev.severity)) byCode.set(s.code, s);
  }
  return [...byCode.values()];
}

function computeDimensions(input: {
  signals: LinkSignal[];
  identity: IdentityEvidence;
  reputationStatus: string;
  technical: TechnicalEvidence;
  domainRdap: string | null;
  fetchRemote: boolean;
}): EvidenceDimensions {
  const d = EMPTY_DIMENSIONS();
  const codes = new Set(input.signals.map((s) => s.code));

  if (!input.fetchRemote) {
    d.technical_validity = "unknown";
  } else if (input.technical.https && input.technical.tls_valid !== false) {
    d.technical_validity = "pass";
  } else if (codes.has("no_https") || codes.has("final_no_https")) {
    d.technical_validity = "fail";
  } else {
    d.technical_validity = "information_not_established";
  }

  if (input.reputationStatus === "information_not_established") {
    d.domain_reputation = "information_not_established";
  } else {
    d.domain_reputation = "unknown";
  }

  if (input.identity.match_type === "exact_official") {
    d.identity_confidence = "pass";
    d.brand_consistency = "pass";
  } else if (
    input.identity.match_type === "lookalike" ||
    input.identity.match_type === "brand_in_name"
  ) {
    d.identity_confidence = "fail";
    d.brand_consistency = "fail";
  } else {
    d.identity_confidence = "information_not_established";
    d.brand_consistency = "unknown";
  }

  d.web_evidence = "information_not_established";
  d.content_signals = "unknown";

  const phishingCodes = ["phishing_keywords", "brand_lookalike", "brand_impersonation_name", "homoglyph"];
  d.phishing_signals = phishingCodes.some((c) => codes.has(c)) ? "present" : "none";

  const malicious = ["userinfo_in_url"];
  d.malicious_signals = malicious.some((c) => codes.has(c)) ? "present" : "none";

  if (codes.has("dns_ok")) d.infrastructure_signals = "pass";
  else if (codes.has("dns_unknown")) d.infrastructure_signals = "fail";
  else d.infrastructure_signals = "unknown";

  if (input.domainRdap === "ok") d.historical_signals = "pass";
  else if (codes.has("domain_very_new")) d.historical_signals = "present";
  else d.historical_signals = "information_not_established";

  return d;
}

export type CollectOptions = {
  brands?: BrandEntry[];
  fetchRemote?: boolean;
  /** Skip RDAP/TLS for unit tests speed */
  skipSlowTools?: boolean;
};

/**
 * EvidenceEngine — gather proofs without concluding trust.
 */
export async function collectEvidence(
  rawUrl: string,
  options?: CollectOptions,
): Promise<EvidenceBundle> {
  const started = Date.now();
  const fetchRemote = options?.fetchRemote !== false;
  const skipSlow = options?.skipSlowTools === true;

  const tools_used: string[] = ["SecurityGateway"];
  const evidence: EvidenceItem[] = [];
  let signals: LinkSignal[] = [];

  const admitted = admitUrl(rawUrl);
  if (!admitted.ok) {
    const brands = options?.brands ?? DEFAULT_BRANDS;
    const isSsrf = admitted.code === "ssrf_blocked_host";
    signals = [
      makeSignal({
        code: isSsrf ? "blocked_destination" : "invalid_url",
        title: isSsrf ? "Destination interdite" : "URL invalide",
        severity: "high",
        confidence: isSsrf ? 99 : 95,
        description: isSsrf
          ? "Cette adresse pointe vers une ressource locale ou interne et ne peut pas être vérifiée."
          : "L'adresse fournie ne peut pas être analysée correctement.",
        evidence: [`reason=${admitted.reason}`],
      }),
    ];
    evidence.push(
      makeEvidence({
        tool: "SecurityGateway",
        category: "gateway",
        claim: admitted.reason,
        status: "failed",
        data: { code: admitted.code },
        source: "gateway",
      }),
    );

    const technical: TechnicalEvidence = {
      https: false,
      tls_valid: null,
      tls_issuer: null,
      tls_expires_at: null,
      tls_hostname_match: null,
      http_status: null,
      redirects: [],
      final_url: null,
      note: "TLS valide ≠ légitimité",
    };

    const identity: IdentityEvidence = {
      claimed_entity: null,
      identified_entity: null,
      official_domain: null,
      identity_confidence: 0,
      impersonation_risk: "unknown",
      match_type: "unknown",
    };

    return {
      url_raw: admitted.urlRaw,
      normalized_url: admitted.urlNormalized,
      domain: admitted.domain,
      final_url: null,
      blocked: isSsrf,
      block_reason: admitted.reason,
      tools_used,
      technical,
      identity,
      reputation: {
        status: "information_not_established",
        labels: ["unknown"],
        sources: [],
        score: null,
      },
      domain_info: null,
      dimensions: EMPTY_DIMENSIONS(),
      evidence,
      signals,
      brands,
      collected_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
    };
  }

  const brands =
    options?.brands ??
    (skipSlow || !fetchRemote
      ? DEFAULT_BRANDS
      : await loadBrandWatchlist().catch(() => DEFAULT_BRANDS));

  const url = admitted.url;
  const heuristics = runLocalHeuristicsTool(url);
  tools_used.push(heuristics.tool);
  signals.push(...heuristics.signals);

  let finalUrl = url;
  let technical: TechnicalEvidence = {
    https: url.protocol === "https:",
    tls_valid: null,
    tls_issuer: null,
    tls_expires_at: null,
    tls_hostname_match: null,
    http_status: null,
    redirects: [],
    final_url: url.toString(),
    note: "TLS valide ≠ légitimité",
  };

  if (fetchRemote) {
    const dns = await runDnsResolverTool(url.hostname);
    tools_used.push(dns.tool);
    evidence.push(...dns.evidence);
    signals.push(...dns.signals);

    if (dns.ssrfError) {
      return {
        url_raw: admitted.urlRaw,
        normalized_url: admitted.urlNormalized,
        domain: url.hostname,
        final_url: null,
        blocked: true,
        block_reason: dns.ssrfError,
        tools_used,
        technical,
        identity: {
          claimed_entity: null,
          identified_entity: null,
          official_domain: null,
          identity_confidence: 0,
          impersonation_risk: "unknown",
          match_type: "unknown",
        },
        reputation: {
          status: "information_not_established",
          labels: ["unknown"],
          sources: [],
          score: null,
        },
        domain_info: null,
        dimensions: EMPTY_DIMENSIONS(),
        evidence,
        signals: [
          makeSignal({
            code: "ssrf_blocked",
            title: "Destination interne bloquée",
            severity: "high",
            confidence: 99,
            description: "Cette adresse ne peut pas être analysée (protection SSRF).",
            evidence: [`reason=${dns.ssrfError}`],
          }),
        ],
        brands,
        collected_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
      };
    }

    type TlsR = Awaited<ReturnType<typeof runTlsInspectionTool>>;
    type HttpR = Awaited<ReturnType<typeof runHttpAndRedirectTools>>;

    const tlsPromise: Promise<TlsR | null> =
      url.protocol === "https:" && !skipSlow
        ? runTlsInspectionTool(url.hostname)
        : Promise.resolve(null);
    const httpPromise: Promise<HttpR> = runHttpAndRedirectTools(url);

    const [tlsResult, httpResult] = await Promise.all([tlsPromise, httpPromise]);

    if (tlsResult) {
      tools_used.push(tlsResult.tool);
      evidence.push(...tlsResult.evidence);
      signals.push(...tlsResult.signals);
      technical = {
        ...technical,
        tls_valid: tlsResult.tls_valid,
        tls_issuer: tlsResult.tls_issuer,
        tls_expires_at: tlsResult.tls_expires_at,
        tls_hostname_match: tlsResult.tls_hostname_match,
        https: tlsResult.tls_valid ? true : technical.https,
      };
    }

    if (httpResult) {
      tools_used.push("HTTPInspectionTool", "RedirectTool");
      evidence.push(...httpResult.evidence);
      signals.push(...httpResult.signals);

      if (httpResult.ssrfError) {
        return {
          url_raw: admitted.urlRaw,
          normalized_url: admitted.urlNormalized,
          domain: url.hostname,
          final_url: null,
          blocked: true,
          block_reason: httpResult.ssrfError,
          tools_used,
          technical,
          identity: {
            claimed_entity: null,
            identified_entity: null,
            official_domain: null,
            identity_confidence: 0,
            impersonation_risk: "unknown",
            match_type: "unknown",
          },
          reputation: {
            status: "information_not_established",
            labels: ["unknown"],
            sources: [],
            score: null,
          },
          domain_info: null,
          dimensions: EMPTY_DIMENSIONS(),
          evidence,
          signals: [
            makeSignal({
              code: "ssrf_blocked",
              title: "Analyse bloquée pour sécurité",
              severity: "high",
              confidence: 99,
              description:
                "La destination ou une redirection pointe vers une ressource interne interdite.",
              evidence: [`reason=${httpResult.ssrfError}`],
            }),
          ],
          brands,
          collected_at: new Date().toISOString(),
          duration_ms: Date.now() - started,
        };
      }

      finalUrl = httpResult.finalUrl;
      technical = {
        ...technical,
        http_status: httpResult.status ?? null,
        redirects: httpResult.redirects,
        final_url: httpResult.finalUrl.toString(),
        https: httpResult.https,
      };
    }

    if (!skipSlow) {
      const [domainInfo, reputation] = await Promise.all([
        runDomainInfoTool(finalUrl.hostname),
        runReputationTool(finalUrl.hostname),
      ]);
      tools_used.push(domainInfo.tool, reputation.tool);
      evidence.push(...domainInfo.evidence, ...reputation.evidence);
      signals.push(...domainInfo.signals);

      const identity = runCompanyIdentityTool(finalUrl.hostname, brands);
      tools_used.push(identity.tool);
      evidence.push(...identity.evidence);
      signals.push(...identity.signals);

      const unique = dedupeSignals(signals);
      const dimensions = computeDimensions({
        signals: unique,
        identity: identity.identity,
        reputationStatus: reputation.reputation.status,
        technical,
        domainRdap: domainInfo.domain_info.rdap_status,
        fetchRemote,
      });

      return {
        url_raw: admitted.urlRaw,
        normalized_url: finalUrl.toString(),
        domain: finalUrl.hostname,
        final_url: finalUrl.toString(),
        blocked: false,
        tools_used: [...new Set(tools_used)],
        technical,
        identity: identity.identity,
        reputation: reputation.reputation,
        domain_info: domainInfo.domain_info,
        dimensions,
        evidence,
        signals: unique,
        brands,
        collected_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
      };
    }
  }

  // Local-only path (tests / fetchRemote=false)
  const identity = runCompanyIdentityTool(finalUrl.hostname, brands);
  tools_used.push(identity.tool);
  evidence.push(...identity.evidence);
  signals.push(...identity.signals);

  const reputation = {
    status: "information_not_established" as const,
    labels: ["unknown"],
    sources: ["skipped"],
    score: null,
  };

  const unique = dedupeSignals(signals);
  const dimensions = computeDimensions({
    signals: unique,
    identity: identity.identity,
    reputationStatus: reputation.status,
    technical,
    domainRdap: null,
    fetchRemote,
  });

  return {
    url_raw: admitted.urlRaw,
    normalized_url: finalUrl.toString(),
    domain: finalUrl.hostname,
    final_url: finalUrl.toString(),
    blocked: false,
    tools_used: [...new Set(tools_used)],
    technical,
    identity: identity.identity,
    reputation,
    domain_info: null,
    dimensions,
    evidence,
    signals: unique,
    brands,
    collected_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
  };
}
