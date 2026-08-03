import { isIP } from "net";
import type { LinkSignal, LinkAnalysisResult, RiskLevel } from "@/types/security";

const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
]);

const DEFAULT_BRANDS: { name: string; domains: string[] }[] = [
  { name: "Rawbank", domains: ["rawbank.com", "rawbank.cd"] },
  { name: "Equity BCDC", domains: ["equitybcdc.com", "equitybankgroup.com"] },
  { name: "Vodacom", domains: ["vodacom.cd", "mpesa.com"] },
  { name: "Airtel", domains: ["airtel.cd", "airtel.com"] },
  { name: "Orange", domains: ["orange.cd", "orange.com"] },
  { name: "Facebook", domains: ["facebook.com", "fb.com", "meta.com"] },
  { name: "WhatsApp", domains: ["whatsapp.com", "wa.me"] },
  { name: "Google", domains: ["google.com", "gmail.com"] },
  { name: "McBuleli", domains: ["mcbuleli.org", "mcbuleli.online"] },
];

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;

function signal(
  partial: Omit<LinkSignal, "id"> & { id?: string },
): LinkSignal {
  return {
    id: partial.id ?? partial.code,
    ...partial,
  };
}

export function isPrivateOrBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 0) return true;

  if (v === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    if (isIP(mapped) === 4) return isPrivateOrBlockedIp(mapped);
  }
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;
  if (h.endsWith(".internal") || h.endsWith(".intranet")) return true;
  if (isIP(h) && isPrivateOrBlockedIp(h)) return true;
  return false;
}

export function normalizeUrlInput(raw: string): URL {
  let s = raw.trim();
  if (!s) throw new Error("empty_url");
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("unsupported_scheme");
  }
  if (!u.hostname) throw new Error("invalid_url");
  return u;
}

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
  // Cyrillic / lookalike chars commonly used in phishing
  return /[аеорсухіјӏ]|xn--/i.test(hostname);
}

function lookalikeSignals(hostname: string, brands = DEFAULT_BRANDS): LinkSignal[] {
  const out: LinkSignal[] = [];
  const host = hostname.toLowerCase();
  const labels = host.split(".");
  const sld = labels.length >= 2 ? labels[labels.length - 2] : labels[0];

  for (const brand of brands) {
    for (const d of brand.domains) {
      if (host === d || host.endsWith(`.${d}`)) continue;
      const brandSld = d.split(".")[0];
      const dist = levenshtein(sld, brandSld);
      if (dist > 0 && dist <= 2 && sld.length >= 4) {
        out.push(
          signal({
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
  return out;
}

async function resolveAndAssertPublic(hostname: string): Promise<string[]> {
  if (isBlockedHostname(hostname)) {
    throw new Error("ssrf_blocked_host");
  }
  if (isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) throw new Error("ssrf_blocked_ip");
    return [hostname];
  }

  const dns = await import("dns/promises");
  const addresses: string[] = [];
  try {
    const v4 = await dns.resolve4(hostname);
    addresses.push(...v4);
  } catch {
    // ignore NXDOMAIN for A
  }
  try {
    const v6 = await dns.resolve6(hostname);
    addresses.push(...v6);
  } catch {
    // ignore
  }

  if (addresses.length === 0) {
    // No DNS - still allow heuristic-only analysis without fetch
    return [];
  }
  for (const ip of addresses) {
    if (isPrivateOrBlockedIp(ip)) throw new Error("ssrf_blocked_ip");
  }
  return addresses;
}

async function safeFetchHead(
  url: URL,
): Promise<{ finalUrl: URL; redirectCount: number; https: boolean; status?: number }> {
  let current = url;
  let redirects = 0;
  let lastStatus: number | undefined;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await resolveAndAssertPublic(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "CyberAlertDRC-LinkChecker/1.0 (+https://cyberalert.mcbuleli.org)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      lastStatus = res.status;
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current);
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          throw new Error("ssrf_blocked_scheme");
        }
        await resolveAndAssertPublic(next.hostname);
        current = next;
        redirects += 1;
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    finalUrl: current,
    redirectCount: redirects,
    https: current.protocol === "https:",
    status: lastStatus,
  };
}

function scoreToRisk(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 35) return "caution";
  return "low";
}

function severityWeight(s: LinkSignal["severity"]): number {
  switch (s) {
    case "high":
      return 35;
    case "medium":
      return 20;
    case "low":
      return 10;
    default:
      return 2;
  }
}

export async function analyzeLink(
  rawUrl: string,
  options?: { brands?: { name: string; domains: string[] }[]; fetchRemote?: boolean },
): Promise<LinkAnalysisResult> {
  const fetchRemote = options?.fetchRemote !== false;
  const brands = options?.brands ?? DEFAULT_BRANDS;
  const signals: LinkSignal[] = [];

  let url: URL;
  try {
    url = normalizeUrlInput(rawUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_url";
    return {
      urlRaw: rawUrl,
      urlNormalized: rawUrl,
      domain: null,
      riskLevel: "high",
      score: 100,
      signals: [
        signal({
          code: "invalid_url",
          title: "URL invalide",
          severity: "high",
          confidence: 95,
          description: "L'adresse fournie ne peut pas être analysée correctement.",
          evidence: [`reason=${msg}`],
          recommendation: "Vérifiez le lien auprès de l'expéditeur avant de cliquer.",
        }),
      ],
      blocked: false,
    };
  }

  if (isBlockedHostname(url.hostname)) {
    return {
      urlRaw: rawUrl,
      urlNormalized: url.toString(),
      domain: url.hostname,
      riskLevel: "high",
      score: 100,
      signals: [
        signal({
          code: "blocked_destination",
          title: "Destination interdite",
          severity: "high",
          confidence: 99,
          description:
            "Cette adresse pointe vers une ressource locale ou interne et ne peut pas être vérifiée.",
          evidence: [`hostname=${url.hostname}`],
        }),
      ],
      blocked: true,
      blockReason: "ssrf_blocked_host",
    };
  }

  if (url.protocol !== "https:") {
    signals.push(
      signal({
        code: "no_https",
        title: "Connexion non chiffrée (HTTP)",
        severity: "medium",
        confidence: 90,
        description: "Le lien n'utilise pas HTTPS. Les données pourraient être interceptées.",
        evidence: [`protocol=${url.protocol}`],
        recommendation: "Évitez de saisir des mots de passe ou données bancaires sur HTTP.",
      }),
    );
  }

  if (url.username || url.password) {
    signals.push(
      signal({
        code: "userinfo_in_url",
        title: "Identifiants dans l'URL",
        severity: "high",
        confidence: 85,
        description: "L'URL contient un nom d'utilisateur ou un mot de passe intégré.",
        evidence: ["userinfo_present=true"],
      }),
    );
  }

  if (hasHomoglyphs(url.hostname)) {
    signals.push(
      signal({
        code: "homoglyph",
        title: "Caractères suspects dans le domaine",
        severity: "high",
        confidence: 80,
        description:
          "Le domaine utilise des caractères qui peuvent imiter une marque (homoglyphes / punycode).",
        evidence: [`hostname=${url.hostname}`],
      }),
    );
  }

  if (SHORTENER_HOSTS.has(url.hostname.toLowerCase())) {
    signals.push(
      signal({
        code: "url_shortener",
        title: "URL raccourcie",
        severity: "medium",
        confidence: 70,
        description:
          "Les liens raccourcis masquent la destination réelle. Nous tentons d'examiner la redirection.",
        evidence: [`shortener=${url.hostname}`],
      }),
    );
  }

  // Suspicious path / query patterns
  const full = url.toString().toLowerCase();
  if (/login|signin|verify|account|secure|update|password|wallet|otp/i.test(url.pathname + url.search)) {
    signals.push(
      signal({
        code: "phishing_keywords",
        title: "Mots-clés souvent liés au phishing",
        severity: "medium",
        confidence: 55,
        description:
          "Le chemin ou les paramètres contiennent des termes fréquemment utilisés dans des pages de connexion frauduleuses.",
        evidence: [`path=${url.pathname}`],
      }),
    );
  }

  if (url.hostname.split(".").length > 4) {
    signals.push(
      signal({
        code: "deep_subdomains",
        title: "Sous-domaines inhabituellement nombreux",
        severity: "low",
        confidence: 50,
        description: "Une profondeur élevée de sous-domaines peut servir à tromper l'œil.",
        evidence: [`hostname=${url.hostname}`],
      }),
    );
  }

  signals.push(...lookalikeSignals(url.hostname, brands));

  let finalUrl = url;
  let redirectCount = 0;

  if (fetchRemote) {
    try {
      const ips = await resolveAndAssertPublic(url.hostname);
      if (ips.length === 0) {
        signals.push(
          signal({
            code: "dns_unknown",
            title: "Réputation / DNS inconnu",
            severity: "medium",
            confidence: 60,
            description: "Aucune adresse IP publique n'a pu être résolue pour ce domaine.",
            evidence: [`hostname=${url.hostname}`],
          }),
        );
      } else {
        signals.push(
          signal({
            code: "dns_ok",
            title: "DNS résolu (adresses publiques)",
            severity: "info",
            confidence: 80,
            description: "Le domaine résout vers des adresses IP publiques autorisées pour l'analyse.",
            evidence: [`ips=${ips.slice(0, 3).join(",")}`],
          }),
        );
      }

      try {
        const remote = await safeFetchHead(url);
        finalUrl = remote.finalUrl;
        redirectCount = remote.redirectCount;
        if (redirectCount >= 3) {
          signals.push(
            signal({
              code: "unusual_redirects",
              title: "Redirections inhabituelles",
              severity: "medium",
              confidence: 65,
              description: `La chaîne de redirections est longue (${redirectCount}).`,
              evidence: [`redirects=${redirectCount}`, `final=${finalUrl.toString()}`],
            }),
          );
        }
        if (finalUrl.hostname !== url.hostname) {
          signals.push(
            signal({
              code: "redirect_host_change",
              title: "Redirection vers un autre domaine",
              severity: "medium",
              confidence: 70,
              description: `Le lien mène finalement vers ${finalUrl.hostname}.`,
              evidence: [`from=${url.hostname}`, `to=${finalUrl.hostname}`],
            }),
          );
          signals.push(...lookalikeSignals(finalUrl.hostname, brands));
        }
        if (!remote.https) {
          signals.push(
            signal({
              code: "final_no_https",
              title: "Destination finale sans HTTPS",
              severity: "medium",
              confidence: 85,
              description: "Après redirection, la destination n'est pas chiffrée.",
              evidence: [`final=${finalUrl.toString()}`],
            }),
          );
        } else {
          signals.push(
            signal({
              code: "https_ok",
              title: "HTTPS détecté",
              severity: "info",
              confidence: 80,
              description: "La destination utilise HTTPS.",
              evidence: [`final=${finalUrl.toString()}`],
            }),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "fetch_failed";
        if (msg.startsWith("ssrf_")) {
          return {
            urlRaw: rawUrl,
            urlNormalized: url.toString(),
            domain: url.hostname,
            riskLevel: "high",
            score: 100,
            signals: [
              signal({
                code: "ssrf_blocked",
                title: "Analyse bloquée pour sécurité",
                severity: "high",
                confidence: 99,
                description:
                  "La destination ou une redirection pointe vers une ressource interne interdite.",
                evidence: [`reason=${msg}`],
              }),
            ],
            blocked: true,
            blockReason: msg,
          };
        }
        signals.push(
          signal({
            code: "fetch_failed",
            title: "Impossible de joindre le site",
            severity: "low",
            confidence: 50,
            description:
              "Le site n'a pas répondu à temps ou a refusé la connexion. L'analyse repose sur les signaux locaux.",
            evidence: [`reason=${msg}`],
          }),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "dns_failed";
      if (msg.startsWith("ssrf_")) {
        return {
          urlRaw: rawUrl,
          urlNormalized: url.toString(),
          domain: url.hostname,
          riskLevel: "high",
          score: 100,
          signals: [
            signal({
              code: "ssrf_blocked",
              title: "Destination interne bloquée",
              severity: "high",
              confidence: 99,
              description: "Cette adresse ne peut pas être analysée (protection SSRF).",
              evidence: [`reason=${msg}`],
            }),
          ],
          blocked: true,
          blockReason: msg,
        };
      }
    }
  }

  // Deduplicate by code (keep highest severity)
  const byCode = new Map<string, LinkSignal>();
  for (const s of signals) {
    const prev = byCode.get(s.code);
    if (!prev || severityWeight(s.severity) > severityWeight(prev.severity)) {
      byCode.set(s.code, s);
    }
  }
  const unique = [...byCode.values()];

  let score = 0;
  for (const s of unique) {
    if (s.severity === "info") continue;
    score += severityWeight(s.severity) * (s.confidence / 100);
  }
  score = Math.min(100, Math.round(score));
  const riskLevel = scoreToRisk(score);

  return {
    urlRaw: rawUrl,
    urlNormalized: finalUrl.toString(),
    domain: finalUrl.hostname,
    riskLevel,
    score,
    signals: unique,
    blocked: false,
  };
}
