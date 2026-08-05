import { isIP } from "net";
import {
  isBlockedHostname,
  isPrivateOrBlockedIp,
} from "@/lib/security-core/gateway";
import { makeEvidence, makeSignal, type EvidenceItem } from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";

export type DnsToolResult = {
  tool: "DNSResolverTool";
  ips: string[];
  evidence: EvidenceItem[];
  signals: LinkSignal[];
  ssrfError?: string;
};

export async function runDnsResolverTool(hostname: string): Promise<DnsToolResult> {
  const tool = "DNSResolverTool";
  if (isBlockedHostname(hostname)) {
    return {
      tool,
      ips: [],
      evidence: [
        makeEvidence({
          tool,
          category: "dns",
          claim: "Hostname bloqué (SSRF)",
          status: "failed",
          data: { hostname },
          source: "local",
        }),
      ],
      signals: [],
      ssrfError: "ssrf_blocked_host",
    };
  }

  if (isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) {
      return {
        tool,
        ips: [],
        evidence: [
          makeEvidence({
            tool,
            category: "dns",
            claim: "IP privée / metadata bloquée",
            status: "failed",
            data: { ip: hostname },
            source: "local",
          }),
        ],
        signals: [],
        ssrfError: "ssrf_blocked_ip",
      };
    }
    return {
      tool,
      ips: [hostname],
      evidence: [
        makeEvidence({
          tool,
          category: "dns",
          claim: "Cible est une IP publique littérale",
          status: "established",
          data: { ips: [hostname] },
          source: "local",
        }),
      ],
      signals: [
        makeSignal({
          code: "dns_ok",
          title: "Adresse IP publique",
          severity: "info",
          confidence: 80,
          description: "La cible est une IP publique. Cela ne prouve pas la légitimité.",
          evidence: [`ip=${hostname}`],
        }),
      ],
    };
  }

  const dns = await import("dns/promises");
  const addresses: string[] = [];
  try {
    addresses.push(...(await dns.resolve4(hostname)));
  } catch {
    /* NXDOMAIN A */
  }
  try {
    addresses.push(...(await dns.resolve6(hostname)));
  } catch {
    /* NXDOMAIN AAAA */
  }

  if (addresses.length === 0) {
    return {
      tool,
      ips: [],
      evidence: [
        makeEvidence({
          tool,
          category: "dns",
          claim: "Aucune IP publique résolue",
          status: "information_not_established",
          data: { hostname },
          source: "dns",
        }),
      ],
      signals: [
        makeSignal({
          code: "dns_unknown",
          title: "Réputation / DNS inconnu",
          severity: "medium",
          confidence: 60,
          description: "Aucune adresse IP publique n'a pu être résolue pour ce domaine.",
          evidence: [`hostname=${hostname}`],
        }),
      ],
    };
  }

  for (const ip of addresses) {
    if (isPrivateOrBlockedIp(ip)) {
      return {
        tool,
        ips: [],
        evidence: [
          makeEvidence({
            tool,
            category: "dns",
            claim: "DNS résout vers IP privée / interdite",
            status: "failed",
            data: { hostname, ip },
            source: "dns",
          }),
        ],
        signals: [],
        ssrfError: "ssrf_blocked_ip",
      };
    }
  }

  return {
    tool,
    ips: addresses,
    evidence: [
      makeEvidence({
        tool,
        category: "dns",
        claim: "DNS résolu vers des IP publiques",
        status: "established",
        data: { hostname, ips: addresses.slice(0, 5) },
        source: "dns",
      }),
    ],
    signals: [
      makeSignal({
        code: "dns_ok",
        title: "DNS résolu (adresses publiques)",
        severity: "info",
        confidence: 80,
        description:
          "Le domaine résout vers des adresses IP publiques. DNS OK ≠ site légitime.",
        evidence: [`ips=${addresses.slice(0, 3).join(",")}`],
      }),
    ],
  };
}
