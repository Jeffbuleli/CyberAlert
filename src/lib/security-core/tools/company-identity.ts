import type { BrandEntry } from "@/lib/link-analysis/verdict";
import { isOfficialKnownDomain } from "@/lib/link-analysis/verdict";
import {
  makeEvidence,
  makeSignal,
  type EvidenceItem,
  type IdentityEvidence,
} from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function hasHomoglyphs(hostname: string): boolean {
  return /[аеорсухіјӏ]|xn--/i.test(hostname);
}

/**
 * Detect brand name embedded in hostname without being official domain.
 * Example: rawbank-secure-login.com → claimed Rawbank, NOT official.
 */
function brandNameInHostname(
  hostname: string,
  brands: BrandEntry[],
): { brand: BrandEntry; token: string } | null {
  const host = hostname.toLowerCase();
  const labels = host.split(".");
  const sld = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  const normalized = sld.replace(/[^a-z0-9]/g, "");

  for (const brand of brands) {
    const token = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (token.length < 4) continue;
    for (const d of brand.domains) {
      if (host === d || host.endsWith(`.${d}`)) return null;
    }
    if (normalized.includes(token) && normalized !== token) {
      return { brand, token };
    }
  }
  return null;
}

export type CompanyIdentityToolResult = {
  tool: "CompanyIdentityTool";
  identity: IdentityEvidence;
  evidence: EvidenceItem[];
  signals: LinkSignal[];
};

/**
 * CompanyIdentityTool — never declare ownership just because the brand appears in the name.
 */
export function runCompanyIdentityTool(
  hostname: string,
  brands: BrandEntry[],
): CompanyIdentityToolResult {
  const tool = "CompanyIdentityTool";
  const evidence: EvidenceItem[] = [];
  const signals: LinkSignal[] = [];
  const host = hostname.toLowerCase();

  if (hasHomoglyphs(host)) {
    signals.push(
      makeSignal({
        code: "homoglyph",
        title: "Caractères suspects dans le domaine",
        severity: "high",
        confidence: 80,
        description:
          "Le domaine utilise des caractères qui peuvent imiter une marque (homoglyphes / punycode).",
        evidence: [`hostname=${host}`],
      }),
    );
  }

  const official = isOfficialKnownDomain(host, brands);
  if (official.match) {
    const identity: IdentityEvidence = {
      claimed_entity: official.brandName ?? null,
      identified_entity: official.brandName ?? null,
      official_domain: official.officialDomain ?? null,
      identity_confidence: 0.85,
      impersonation_risk: "none",
      match_type: "exact_official",
    };
    evidence.push(
      makeEvidence({
        tool,
        category: "identity",
        claim: `Domaine officiel connu pour ${official.brandName}`,
        status: "established",
        data: identity,
        source: "brand_watchlist",
      }),
    );
    signals.push(
      makeSignal({
        code: "official_domain_match",
        title: `Domaine associé à ${official.brandName}`,
        severity: "info",
        confidence: 85,
        description: `Le domaine correspond à une adresse officielle connue (${official.officialDomain}).`,
        evidence: [
          `hostname=${host}`,
          `brand=${official.brandName}`,
          `official=${official.officialDomain}`,
        ],
      }),
    );
    return { tool, identity, evidence, signals };
  }

  // Lookalike (typosquat)
  const labels = host.split(".");
  const sld = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  let lookalikeBrand: string | null = null;
  let lookalikeDist = 99;

  for (const brand of brands) {
    for (const d of brand.domains) {
      if (host === d || host.endsWith(`.${d}`)) continue;
      const brandSld = d.split(".")[0];
      const dist = levenshtein(sld, brandSld);
      if (dist > 0 && dist <= 2 && sld.length >= 4) {
        lookalikeBrand = brand.name;
        lookalikeDist = dist;
        signals.push(
          makeSignal({
            code: "brand_lookalike",
            title: `Domaine ressemblant à ${brand.name}`,
            severity: "high",
            confidence: 75,
            description: `Le nom de domaine « ${host} » ressemble à une marque connue (${brand.name}).`,
            evidence: [`hostname=${host}`, `brand=${brand.name}`, `distance=${dist}`],
            recommendation:
              "Vérifiez l'adresse officielle de la marque avant de saisir des informations.",
          }),
        );
      }
    }
  }

  if (lookalikeBrand) {
    const officialDomain =
      brands.find((b) => b.name === lookalikeBrand)?.domains[0] ?? null;
    const identity: IdentityEvidence = {
      claimed_entity: lookalikeBrand,
      identified_entity: null,
      official_domain: officialDomain,
      identity_confidence: 0.15,
      impersonation_risk: "high",
      match_type: "lookalike",
    };
    evidence.push(
      makeEvidence({
        tool,
        category: "identity",
        claim: `Usurpation possible de ${lookalikeBrand} (similarité de domaine)`,
        status: "established",
        data: { ...identity, distance: lookalikeDist },
        source: "brand_watchlist",
      }),
    );
    return { tool, identity, evidence, signals };
  }

  const embedded = brandNameInHostname(host, brands);
  if (embedded) {
    const officialDomain = embedded.brand.domains[0] ?? null;
    const identity: IdentityEvidence = {
      claimed_entity: embedded.brand.name,
      identified_entity: null,
      official_domain: officialDomain,
      identity_confidence: 0.1,
      impersonation_risk: "high",
      match_type: "brand_in_name",
    };
    evidence.push(
      makeEvidence({
        tool,
        category: "identity",
        claim: `Marque « ${embedded.brand.name} » dans le nom, domaine non officiel`,
        status: "established",
        data: identity,
        source: "brand_watchlist",
      }),
    );
    signals.push(
      makeSignal({
        code: "brand_impersonation_name",
        title: `Usurpation possible de ${embedded.brand.name}`,
        severity: "high",
        confidence: 78,
        description: `Le domaine contient le nom « ${embedded.brand.name} » sans correspondre au domaine officiel (${officialDomain}).`,
        evidence: [
          `hostname=${host}`,
          `brand=${embedded.brand.name}`,
          `official=${officialDomain}`,
          "name_contains_brand≠ownership",
        ],
        recommendation:
          "Ne saisissez aucune information. Utilisez uniquement le domaine officiel de la marque.",
      }),
    );
    return { tool, identity, evidence, signals };
  }

  const identity: IdentityEvidence = {
    claimed_entity: null,
    identified_entity: null,
    official_domain: null,
    identity_confidence: 0,
    impersonation_risk: "unknown",
    match_type: "none",
  };
  evidence.push(
    makeEvidence({
      tool,
      category: "identity",
      claim: "Identité de l'opérateur non établie",
      status: "information_not_established",
      data: { hostname: host, status: "information_not_established" },
      source: "brand_watchlist",
    }),
  );
  signals.push(
    makeSignal({
      code: "identity_not_established",
      title: "Identité non établie",
      severity: "info",
      confidence: 80,
      description:
        "Aucune association officielle confirmée pour ce domaine. HTTPS, DNS ou HTTP 200 ne prouvent pas la légitimité.",
      evidence: [`hostname=${host}`, "status=information_not_established"],
    }),
  );
  return { tool, identity, evidence, signals };
}
