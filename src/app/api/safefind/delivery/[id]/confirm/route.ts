import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { confirmDeliveryToOwner } from "@/lib/safefind/logistics";

const bodyZ = z.object({
  otp: z.string().min(4).max(12),
  recipientIsVerifiedOwner: z.boolean(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await confirmDeliveryToOwner({
      courierUserId: session.id,
      deliveryId: id,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}