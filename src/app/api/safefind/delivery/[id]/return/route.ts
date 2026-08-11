import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { confirmReturnToPartner } from "@/lib/safefind/logistics";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const result = await confirmReturnToPartner({
      agentUserId: session.id,
      deliveryId: id,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}