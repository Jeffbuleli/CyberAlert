import { isIP } from "net";

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
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
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

export type GatewayAdmitResult =
  | {
      ok: true;
      url: URL;
      urlRaw: string;
      urlNormalized: string;
    }
  | {
      ok: false;
      urlRaw: string;
      urlNormalized: string;
      domain: string | null;
      reason: string;
      code: "invalid_url" | "ssrf_blocked_host" | "unsupported_scheme";
    };

/**
 * Security Gateway — normalize + SSRF admit before any tool runs.
 */
export function admitUrl(rawUrl: string): GatewayAdmitResult {
  let url: URL;
  try {
    url = normalizeUrlInput(rawUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_url";
    return {
      ok: false,
      urlRaw: rawUrl,
      urlNormalized: rawUrl,
      domain: null,
      reason: msg,
      code: msg === "unsupported_scheme" ? "unsupported_scheme" : "invalid_url",
    };
  }

  if (isBlockedHostname(url.hostname)) {
    return {
      ok: false,
      urlRaw: rawUrl,
      urlNormalized: url.toString(),
      domain: url.hostname,
      reason: "ssrf_blocked_host",
      code: "ssrf_blocked_host",
    };
  }

  return {
    ok: true,
    url,
    urlRaw: rawUrl,
    urlNormalized: url.toString(),
  };
}
