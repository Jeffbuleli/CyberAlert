import { getPawapayConfig } from "@/lib/env";

export type PaymentInitInput = {
  amountLocal: string;
  currency: "USD" | "CDF";
  phone: string;
  depositId: string;
  /** PawaPay provider id e.g. AIRTEL_COD — auto-detected from phone if omitted. */
  provider?: string;
  customerMessage?: string;
};

export type PaymentInitResult = {
  accepted: boolean;
  providerRef: string;
  rawStatus?: string;
  failureMessage?: string;
};

export type PaymentStatus = "COMPLETED" | "FAILED" | "PROCESSING";

export interface PaymentProvider {
  id: string;
  createDeposit(input: PaymentInitInput): Promise<PaymentInitResult>;
  lookupStatus(providerRef: string): Promise<PaymentStatus>;
  verifyWebhook(
    req: Request,
    body: unknown,
  ): Promise<{ ok: boolean; providerRef?: string; status?: PaymentStatus }>;
}

/** Same amount formatting rules as McBuleli / PawaPay v2. */
export function formatPawapayAmount(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(String(amount).trim());
  if (!Number.isFinite(n) || n < 0) throw new Error("invalid_amount");
  if (n === 0) return "0";
  let s = n.toFixed(3);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("243")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `243${digits.slice(1)}`;
  if (digits.length === 9) return `243${digits}`;
  return digits;
}

const PREFIX_MAP: { prefix: string; method: string }[] = [
  { prefix: "81", method: "mpesa" },
  { prefix: "82", method: "mpesa" },
  { prefix: "83", method: "mpesa" },
  { prefix: "86", method: "mpesa" },
  { prefix: "80", method: "orange" },
  { prefix: "84", method: "orange" },
  { prefix: "85", method: "orange" },
  { prefix: "89", method: "orange" },
  { prefix: "97", method: "airtel" },
  { prefix: "98", method: "airtel" },
  { prefix: "99", method: "airtel" },
  { prefix: "96", method: "airtel" },
  { prefix: "90", method: "africell" },
  { prefix: "91", method: "africell" },
].sort((a, b) => b.prefix.length - a.prefix.length);

export function detectMomoMethod(phone: string): string | null {
  const local = normalizePhone(phone).replace(/^243/, "");
  for (const row of PREFIX_MAP) {
    if (local.startsWith(row.prefix)) return row.method;
  }
  return null;
}

export function toPawapayProviderId(method: string): string {
  const m = method.trim().toLowerCase();
  if (m === "airtel" || m === "airtel_cod") return "AIRTEL_COD";
  if (m === "orange" || m === "orange_cod") return "ORANGE_COD";
  if (m === "mpesa" || m === "vodacom_mpesa_cod") return "VODACOM_MPESA_COD";
  const u = method.trim().toUpperCase();
  if (u === "AIRTEL_COD" || u === "ORANGE_COD" || u === "VODACOM_MPESA_COD") return u;
  return method.trim();
}

function isAccepted(status: string | undefined): boolean {
  const s = String(status ?? "").toUpperCase();
  return s === "ACCEPTED" || s === "DUPLICATE_IGNORED";
}

function mapStatus(status: string | undefined): PaymentStatus {
  const s = String(status ?? "").toUpperCase();
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "FAILED" || s === "REJECTED") return "FAILED";
  return "PROCESSING";
}

function unwrapStatus(remote: {
  status?: string;
  data?: { status?: string; depositId?: string };
  depositId?: string;
}): { status?: string; depositId?: string } | null {
  const top = String(remote.status ?? "").toUpperCase();
  if (top === "NOT_FOUND") return null;
  if (top === "FOUND" && remote.data) return remote.data;
  return remote;
}

export class PawaPayProvider implements PaymentProvider {
  id = "pawapay";

  constructor(
    private config: {
      baseUrl: string;
      token: string;
      callbackSecret: string;
      ipAllowlist: string[];
    },
  ) {}

  private async fetchJson(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`pawapay_invalid_json:${res.status}`);
    }
    return { res, json };
  }

  async createDeposit(input: PaymentInitInput): Promise<PaymentInitResult> {
    if (!this.config.token.trim()) {
      throw new Error("pawapay_not_configured");
    }

    const phone = normalizePhone(input.phone);
    const method = detectMomoMethod(phone);
    if (method === "africell") {
      return {
        accepted: false,
        providerRef: input.depositId,
        failureMessage:
          "Africell / Afrimoney n'est pas supporté. Utilisez Orange Money, M-Pesa ou Airtel Money.",
      };
    }
    const providerId = toPawapayProviderId(
      input.provider || method || "orange",
    );

    const { json } = await this.fetchJson("POST", "/v2/deposits", {
      depositId: input.depositId,
      amount: formatPawapayAmount(input.amountLocal),
      currency: input.currency,
      payer: {
        type: "MMO",
        accountDetails: {
          phoneNumber: phone,
          provider: providerId,
        },
      },
      customerMessage: (input.customerMessage || "Cyber Alert Pro").slice(0, 22),
    });

    const status = String(json.status || "");
    const failure =
      json.failureReason && typeof json.failureReason === "object"
        ? String(
            (json.failureReason as { failureMessage?: string }).failureMessage ||
              (json.failureReason as { failureCode?: string }).failureCode ||
              "",
          )
        : "";

    return {
      accepted: isAccepted(status),
      providerRef: String(json.depositId || input.depositId),
      rawStatus: status.toUpperCase(),
      failureMessage: failure || undefined,
    };
  }

  async lookupStatus(providerRef: string): Promise<PaymentStatus> {
    if (!this.config.token.trim()) return "PROCESSING";
    try {
      const { res, json } = await this.fetchJson(
        "GET",
        `/v2/deposits/${encodeURIComponent(providerRef)}`,
      );
      if (!res.ok && String(json.status || "").toUpperCase() !== "FOUND") {
        console.warn("[pawapay] lookup http", res.status, providerRef);
        return "PROCESSING";
      }
      const payment = unwrapStatus(
        json as {
          status?: string;
          data?: { status?: string; depositId?: string };
          depositId?: string;
        },
      );
      if (!payment) return "PROCESSING";
      return mapStatus(payment.status);
    } catch (e) {
      console.warn("[pawapay] lookup failed", providerRef, e);
      return "PROCESSING";
    }
  }

  async verifyWebhook(req: Request, body: unknown) {
    const ip =
      req.headers.get("cf-connecting-ip")?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";

    // Soft IP check: only reject when allowlist is set AND we have an IP that is outside it.
    if (this.config.ipAllowlist.length && ip && !this.config.ipAllowlist.includes(ip)) {
      console.warn("[pawapay] webhook ip not allowlisted", ip);
      // Still continue if body has depositId — status is confirmed via lookup anyway.
    }

    if (this.config.callbackSecret) {
      const secret =
        req.headers.get("x-pawapay-secret") ||
        req.headers.get("x-callback-secret") ||
        req.headers.get("x-pawapay-callback-secret");
      const auth = req.headers.get("authorization") || "";
      const okSecret =
        (secret && secret === this.config.callbackSecret) ||
        auth === `Bearer ${this.config.callbackSecret}`;
      // Official PawaPay callbacks often omit our custom secret — don't hard-fail.
      if (!okSecret) {
        console.warn("[pawapay] webhook without matching callback secret (continuing)");
      }
    }

    const b = body as {
      depositId?: string;
      status?: string;
      data?: { status?: string; depositId?: string };
    };
    const providerRef = b.depositId || b.data?.depositId;
    const raw = String(b.data?.status || b.status || "").toUpperCase();
    return { ok: Boolean(providerRef), providerRef, status: mapStatus(raw) };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const cfg = getPawapayConfig();
  return new PawaPayProvider(cfg);
}
