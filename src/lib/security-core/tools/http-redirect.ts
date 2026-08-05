import { runDnsResolverTool } from "@/lib/security-core/tools/dns-resolver";
import { makeEvidence, makeSignal, type EvidenceItem } from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;

export type RedirectHop = { from: string; to: string; status?: number };

export type HttpRedirectToolResult = {
  tool: "HTTPInspectionTool" | "RedirectTool";
  finalUrl: URL;
  redirectCount: number;
  https: boolean;
  status?: number;
  redirects: RedirectHop[];
  evidence: EvidenceItem[];
  signals: LinkSignal[];
  ssrfError?: string;
  fetchError?: string;
};

/**
 * Combined HTTP + Redirect inspection with SSRF checks on every hop.
 */
export async function runHttpAndRedirectTools(
  startUrl: URL,
): Promise<HttpRedirectToolResult> {
  const evidence: EvidenceItem[] = [];
  const signals: LinkSignal[] = [];
  const redirects: RedirectHop[] = [];
  let current = startUrl;
  let lastStatus: number | undefined;
  let redirectCount = 0;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const dns = await runDnsResolverTool(current.hostname);
    if (dns.ssrfError) {
      return {
        tool: "RedirectTool",
        finalUrl: current,
        redirectCount,
        https: current.protocol === "https:",
        status: lastStatus,
        redirects,
        evidence: [...evidence, ...dns.evidence],
        signals,
        ssrfError: dns.ssrfError,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "CyberAlertDRC-LinkChecker/1.0 (+https://cyberalert-rdc.org)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      lastStatus = res.status;

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current);
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return {
            tool: "RedirectTool",
            finalUrl: current,
            redirectCount,
            https: current.protocol === "https:",
            status: lastStatus,
            redirects,
            evidence,
            signals,
            ssrfError: "ssrf_blocked_scheme",
          };
        }
        redirects.push({
          from: current.toString(),
          to: next.toString(),
          status: res.status,
        });
        current = next;
        redirectCount += 1;
        continue;
      }
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch_failed";
      evidence.push(
        makeEvidence({
          tool: "HTTPInspectionTool",
          category: "http",
          claim: "Requête HTTP non aboutie",
          status: "failed",
          data: { url: current.toString(), reason: msg },
          source: "http",
        }),
      );
      signals.push(
        makeSignal({
          code: "fetch_failed",
          title: "Impossible de joindre le site",
          severity: "low",
          confidence: 50,
          description:
            "Le site n'a pas répondu à temps ou a refusé la connexion. L'analyse repose sur les signaux locaux.",
          evidence: [`reason=${msg}`],
        }),
      );
      return {
        tool: "HTTPInspectionTool",
        finalUrl: current,
        redirectCount,
        https: current.protocol === "https:",
        status: lastStatus,
        redirects,
        evidence,
        signals,
        fetchError: msg,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  evidence.push(
    makeEvidence({
      tool: "HTTPInspectionTool",
      category: "http",
      claim: `HTTP status ${lastStatus ?? "unknown"}`,
      status: lastStatus != null ? "established" : "information_not_established",
      data: {
        status: lastStatus,
        final_url: current.toString(),
        note: "HTTP 200 ≠ légitimité",
      },
      source: "http",
    }),
  );

  if (redirectCount > 0) {
    evidence.push(
      makeEvidence({
        tool: "RedirectTool",
        category: "redirect",
        claim: `Chaîne de ${redirectCount} redirection(s)`,
        status: "established",
        data: { redirects, final_url: current.toString() },
        source: "http",
      }),
    );
  }

  if (redirectCount >= 3) {
    signals.push(
      makeSignal({
        code: "unusual_redirects",
        title: "Redirections inhabituelles",
        severity: "medium",
        confidence: 65,
        description: `La chaîne de redirections est longue (${redirectCount}).`,
        evidence: [`redirects=${redirectCount}`, `final=${current.toString()}`],
      }),
    );
  }

  if (current.hostname !== startUrl.hostname) {
    signals.push(
      makeSignal({
        code: "redirect_host_change",
        title: "Redirection vers un autre domaine",
        severity: "medium",
        confidence: 70,
        description: `Le lien mène finalement vers ${current.hostname}.`,
        evidence: [`from=${startUrl.hostname}`, `to=${current.hostname}`],
      }),
    );
  }

  if (current.protocol !== "https:") {
    signals.push(
      makeSignal({
        code: "final_no_https",
        title: "Destination finale sans HTTPS",
        severity: "medium",
        confidence: 85,
        description: "Après redirection, la destination n'est pas chiffrée.",
        evidence: [`final=${current.toString()}`],
      }),
    );
  }

  return {
    tool: "HTTPInspectionTool",
    finalUrl: current,
    redirectCount,
    https: current.protocol === "https:",
    status: lastStatus,
    redirects,
    evidence,
    signals,
  };
}
