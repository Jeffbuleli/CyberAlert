import { z } from "zod";
import { getDb, auditRequests } from "@/db";
import { trackEvent } from "@/lib/analytics";
import { checkRateLimit, clientIpFromRequest, rateLimitedResponse } from "@/lib/rate-limit";

const schema = z.object({
  organization: z.string().min(2).max(255),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(32).optional().nullable(),
  serviceType: z.string().min(2).max(64),
  message: z.string().max(4000).optional().nullable(),
});

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`audit:${ip}`, 5, 600_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterMs);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .insert(auditRequests)
    .values({
      organization: parsed.data.organization.trim(),
      contactName: parsed.data.contactName.trim(),
      contactEmail: parsed.data.contactEmail.toLowerCase().trim(),
      contactPhone: parsed.data.contactPhone?.trim() || null,
      serviceType: parsed.data.serviceType,
      message: parsed.data.message?.trim() || null,
    })
    .returning({ id: auditRequests.id });

  await trackEvent("audit_request_submitted", { id: row.id });
  return Response.json({ id: row.id });
}
