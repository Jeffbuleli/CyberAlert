import tls from "tls";
import { makeEvidence, makeSignal, type EvidenceItem } from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";

export type TlsToolResult = {
  tool: "TLSInspectionTool";
  tls_valid: boolean | null;
  tls_issuer: string | null;
  tls_expires_at: string | null;
  tls_hostname_match: boolean | null;
  evidence: EvidenceItem[];
  signals: LinkSignal[];
};

const TLS_TIMEOUT_MS = 4500;

/** Inspect TLS certificate. Valid TLS ≠ legitimacy. */
export async function runTlsInspectionTool(
  hostname: string,
  port = 443,
): Promise<TlsToolResult> {
  const tool = "TLSInspectionTool";

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: TLS_TIMEOUT_MS,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          const authorized = socket.authorized;
          const issuer =
            typeof cert.issuer === "object" && cert.issuer
              ? [cert.issuer.O, cert.issuer.CN].filter(Boolean).join(" / ") || null
              : null;
          const expires = cert.valid_to
            ? new Date(cert.valid_to).toISOString()
            : null;
          const subjectCn =
            typeof cert.subject === "object" && cert.subject?.CN
              ? String(cert.subject.CN)
              : null;
          const hostnameMatch = subjectCn
            ? subjectCn === hostname ||
              subjectCn === `*.${hostname.split(".").slice(1).join(".")}` ||
              (typeof cert.subjectaltname === "string"
                ? cert.subjectaltname.includes(`DNS:${hostname}`)
                : null)
            : null;

          socket.end();

          resolve({
            tool,
            tls_valid: authorized || Boolean(cert.raw),
            tls_issuer: issuer,
            tls_expires_at: expires,
            tls_hostname_match: hostnameMatch,
            evidence: [
              makeEvidence({
                tool,
                category: "tls",
                claim: authorized
                  ? "Certificat TLS présenté (chaîne acceptée par OpenSSL)"
                  : "Certificat TLS présenté (validation stricte non garantie)",
                status: "established",
                data: {
                  authorized,
                  issuer,
                  expires,
                  subjectCn,
                  hostnameMatch,
                  note: "TLS valide ≠ site légitime",
                },
                source: "tls",
              }),
            ],
            signals: [
              makeSignal({
                code: "https_ok",
                title: "HTTPS / TLS détecté",
                severity: "info",
                confidence: authorized ? 85 : 70,
                description:
                  "Un certificat TLS est présent. Cela prouve un chiffrement technique, pas la légitimité du site.",
                evidence: [
                  `hostname=${hostname}`,
                  `issuer=${issuer ?? "unknown"}`,
                  "tls_ne_legitimacy=true",
                ],
              }),
            ],
          });
        } catch (err) {
          socket.destroy();
          resolve(tlsUnavailable(tool, hostname, err));
        }
      },
    );

    socket.on("error", (err) => {
      resolve(tlsUnavailable(tool, hostname, err));
    });

    socket.setTimeout(TLS_TIMEOUT_MS, () => {
      socket.destroy();
      resolve(tlsUnavailable(tool, hostname, new Error("tls_timeout")));
    });
  });
}

function tlsUnavailable(
  tool: "TLSInspectionTool",
  hostname: string,
  err: unknown,
): TlsToolResult {
  const msg = err instanceof Error ? err.message : "tls_failed";
  return {
    tool,
    tls_valid: null,
    tls_issuer: null,
    tls_expires_at: null,
    tls_hostname_match: null,
    evidence: [
      makeEvidence({
        tool,
        category: "tls",
        claim: "Inspection TLS non établie",
        status: "information_not_established",
        data: { hostname, reason: msg },
        source: "tls",
      }),
    ],
    signals: [],
  };
}
