import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { requestDelivery } from "@/lib/safefind/logistics";

const bodyZ = z.object({
  destinationCommune: z.string().min(2).max(120),
  destinationQuartier: z.string().max(120).optional(),
  destinationAddress: z.string().min(5).max(400),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await requestDelivery({
      ownerUserId: session.id,
      casePublicId: id.toUpperCase(),
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}