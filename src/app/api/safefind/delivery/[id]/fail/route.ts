import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { failDelivery } from "@/lib/safefind/logistics";

const bodyZ = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = bodyZ.safeParse(await req.json().catch(() => ({})));
  try {
    const result = await failDelivery({
      courierUserId: session.id,
      deliveryId: id,
      reason: parsed.success ? parsed.data.reason : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}