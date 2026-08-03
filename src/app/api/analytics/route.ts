import { z } from "zod";
import { trackEvent } from "@/lib/analytics";
import { clientIpFromRequest, hashIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1).max(64),
  props: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  await trackEvent(parsed.data.name, parsed.data.props || {}, hashIp(clientIpFromRequest(req)));
  return Response.json({ ok: true });
}
