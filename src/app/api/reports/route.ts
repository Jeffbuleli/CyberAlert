import { z } from "zod";
import { getDb, siteReports } from "@/db";
import { trackEvent } from "@/lib/analytics";
import {
  checkRateLimit,
  clientIpFromRequest,
  hashIp,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { getRateLimit } from "@/lib/env";

const schema = z.object({
  url: z.string().min(3).max(2048),
  category: z.enum([
    "phishing",
    "brand_impersonation",
    "fake_contest",
    "fake_promo",
    "financial_scam",
    "fake_service",
    "suspected_malware",
    "other",
  ]),
  comment: z.string().max(2000).optional(),
  source: z.string().max(64).optional(),
  linkCheckId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`report:${ip}`, getRateLimit("report"), 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterMs);

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Formulaire invalide." }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .insert(siteReports)
    .values({
      url: parsed.data.url.trim(),
      category: parsed.data.category,
      comment: parsed.data.comment?.trim() || null,
      source: parsed.data.source?.trim() || null,
      moderationStatus: "pending",
      ipHash: hashIp(ip),
    })
    .returning({ id: siteReports.id });

  await trackEvent("report_submitted", { id: row.id, category: parsed.data.category }, hashIp(ip));

  return Response.json({ id: row.id, status: "pending" });
}
