export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getAppUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3010"
  );
}

export function getSessionSecret(): string {
  return requireEnv("SESSION_SECRET");
}

export function getAiGatewayConfig() {
  return {
    url: process.env.AI_GATEWAY_URL?.trim() || "http://127.0.0.1:8090",
    secret: process.env.AI_GATEWAY_SECRET?.trim() || "",
  };
}

export function getPawapayConfig() {
  return {
    baseUrl: process.env.PAWAPAY_API_BASE_URL?.trim() || "https://api.sandbox.pawapay.io",
    token: process.env.PAWAPAY_API_TOKEN?.trim() || "",
    callbackSecret: process.env.PAWAPAY_CALLBACK_SECRET?.trim() || "",
    ipAllowlist: (process.env.PAWAPAY_CALLBACK_IP_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function getUsdToCdfRate(): number {
  const n = Number(process.env.USD_TO_CDF_RATE || "2800");
  return Number.isFinite(n) && n > 0 ? n : 2800;
}

export function getSecurityScanProviderId(): string {
  return process.env.SECURITY_SCAN_PROVIDER?.trim() || "internal";
}

export function getRateLimit(name: "link" | "report"): number {
  if (name === "link") {
    return Number(process.env.LINK_CHECK_RATE_LIMIT_PER_MIN || "10") || 10;
  }
  return Number(process.env.REPORT_RATE_LIMIT_PER_MIN || "5") || 5;
}
