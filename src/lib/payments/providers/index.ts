export type PaymentInitInput = {
  amountLocal: string;
  currency: string;
  phone: string;
  depositId: string;
  correspondence?: string;
};

export type PaymentInitResult = {
  accepted: boolean;
  providerRef: string;
  rawStatus?: string;
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

function formatPawapayAmount(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(String(amount).trim());
  if (!Number.isFinite(n) || n < 0) throw new Error("invalid_amount");
  if (n === 0) return "0";
  let s = n.toFixed(3);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("243")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `243${digits.slice(1)}`;
  if (digits.length === 9) return `243${digits}`;
  return digits;
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

  async createDeposit(input: PaymentInitInput): Promise<PaymentInitResult> {
    if (!this.config.token) {
      throw new Error("pawapay_not_configured");
    }
    const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/deposits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        depositId: input.depositId,
        amount: formatPawapayAmount(input.amountLocal),
        currency: input.currency,
        payer: {
          type: "MMO",
          accountDetails: {
            phoneNumber: normalizePhone(input.phone),
          },
        },
        correspondent: input.correspondence,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; depositId?: string };
    const status = String(data.status || "").toUpperCase();
    const accepted = status === "ACCEPTED" || status === "DUPLICATE_IGNORED" || res.ok;
    return {
      accepted,
      providerRef: data.depositId || input.depositId,
      rawStatus: status,
    };
  }

  async lookupStatus(providerRef: string): Promise<PaymentStatus> {
    if (!this.config.token) return "PROCESSING";
    const res = await fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/deposits/${encodeURIComponent(providerRef)}`,
      {
        headers: { Authorization: `Bearer ${this.config.token}` },
      },
    );
    const remote = (await res.json().catch(() => ({}))) as {
      status?: string;
      data?: { status?: string };
    };
    const s = String(remote.data?.status || remote.status || "").toUpperCase();
    if (s === "COMPLETED") return "COMPLETED";
    if (s === "FAILED" || s === "REJECTED") return "FAILED";
    return "PROCESSING";
  }

  async verifyWebhook(req: Request, body: unknown) {
    const ip =
      req.headers.get("cf-connecting-ip")?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";

    if (this.config.ipAllowlist.length && ip && !this.config.ipAllowlist.includes(ip)) {
      return { ok: false };
    }

    const secret = req.headers.get("x-pawapay-secret") || req.headers.get("x-callback-secret");
    if (this.config.callbackSecret && secret !== this.config.callbackSecret) {
      return { ok: false };
    }

    const b = body as { depositId?: string; status?: string; data?: { status?: string; depositId?: string } };
    const providerRef = b.depositId || b.data?.depositId;
    const raw = String(b.data?.status || b.status || "").toUpperCase();
    let status: PaymentStatus = "PROCESSING";
    if (raw === "COMPLETED") status = "COMPLETED";
    if (raw === "FAILED" || raw === "REJECTED") status = "FAILED";
    return { ok: Boolean(providerRef), providerRef, status };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new PawaPayProvider({
    baseUrl: process.env.PAWAPAY_API_BASE_URL || "https://api.sandbox.pawapay.io",
    token: process.env.PAWAPAY_API_TOKEN || "",
    callbackSecret: process.env.PAWAPAY_CALLBACK_SECRET || "",
    ipAllowlist: (process.env.PAWAPAY_CALLBACK_IP_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
}
