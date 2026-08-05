import { makeEvidence, makeSignal, type EvidenceItem } from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";
import type { DomainEvidence } from "@/lib/security-core/types";

export type DomainInfoToolResult = {
  tool: "DomainInfoTool";
  domain_info: DomainEvidence;
  evidence: EvidenceItem[];
  signals: LinkSignal[];
};

const RDAP_TIMEOUT_MS = 4000;

function parentDomain(hostname: string): string | null {
  const parts = hostname.toLowerCase().replace(/\.$/, "").split(".");
  if (parts.length < 2) return null;
  return parts.slice(-2).join(".");
}

/**
 * DomainInfoTool — RDAP public lookup when available.
 * Failure → information_not_established (never invent registrar/age).
 */
export async function runDomainInfoTool(hostname: string): Promise<DomainInfoToolResult> {
  const tool = "DomainInfoTool";
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const parent = parentDomain(host);

  const base: DomainEvidence = {
    hostname: host,
    parent_domain: parent,
    registrar: null,
    created_at: null,
    rdap_status: "skipped",
  };

  if (!parent || parent.includes("localhost")) {
    return {
      tool,
      domain_info: { ...base, rdap_status: "information_not_established" },
      evidence: [
        makeEvidence({
          tool,
          category: "domain",
          claim: "Informations de domaine non établies",
          status: "information_not_established",
          data: base,
          source: "rdap",
        }),
      ],
      signals: [],
    };
  }

  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(parent)}`, {
      method: "GET",
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
    });

    if (!res.ok) {
      return notEstablished(tool, base, `rdap_http_${res.status}`);
    }

    const data = (await res.json()) as {
      entities?: { roles?: string[]; vcardArray?: unknown[] }[];
      events?: { eventAction?: string; eventDate?: string }[];
      ldhName?: string;
    };

    let registrar: string | null = null;
    for (const ent of data.entities || []) {
      if (ent.roles?.includes("registrar")) {
        const vcard = ent.vcardArray;
        // RDAP vcard: ["vcard", [["fn", {}, "text", "Name"], ...]]
        if (Array.isArray(vcard) && Array.isArray(vcard[1])) {
          for (const row of vcard[1] as unknown[]) {
            if (Array.isArray(row) && row[0] === "fn" && typeof row[3] === "string") {
              registrar = row[3];
              break;
            }
          }
        }
        if (registrar) break;
      }
    }

    const created =
      data.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;

    const domain_info: DomainEvidence = {
      hostname: host,
      parent_domain: parent,
      registrar,
      created_at: created,
      rdap_status: "ok",
    };

    const evidence = [
      makeEvidence({
        tool,
        category: "domain",
        claim: "Informations RDAP publiques récupérées",
        status: "established",
        data: domain_info,
        source: "rdap.org",
      }),
    ];

    const signals: LinkSignal[] = [];
    if (created) {
      const ageMs = Date.now() - new Date(created).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (Number.isFinite(ageDays) && ageDays >= 0 && ageDays < 30) {
        signals.push(
          makeSignal({
            code: "domain_very_new",
            title: "Domaine très récent",
            severity: "medium",
            confidence: 70,
            description: `Le domaine parent semble enregistré depuis moins de 30 jours (${Math.floor(ageDays)} j).`,
            evidence: [`created_at=${created}`, `parent=${parent}`],
          }),
        );
      }
    }

    return { tool, domain_info, evidence, signals };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "rdap_failed";
    return notEstablished(tool, base, msg);
  }
}

function notEstablished(
  tool: "DomainInfoTool",
  base: DomainEvidence,
  reason: string,
): DomainInfoToolResult {
  const domain_info: DomainEvidence = {
    ...base,
    rdap_status: "information_not_established",
  };
  return {
    tool,
    domain_info,
    evidence: [
      makeEvidence({
        tool,
        category: "domain",
        claim: "Informations de domaine non établies",
        status: "information_not_established",
        data: { ...domain_info, reason },
        source: "rdap",
      }),
    ],
    signals: [],
  };
}
