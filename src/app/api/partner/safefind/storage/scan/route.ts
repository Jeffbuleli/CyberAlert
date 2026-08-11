import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { lookupBySleeveQr } from "@/lib/safefind/logistics";

const bodyZ = z.object({ sleeveQrToken: z.string().min(8).max(64) });

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await lookupBySleeveQr({
      agentUserId: session.id,
      sleeveQrToken: parsed.data.sleeveQrToken,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: msg === "not_found" ? 404 : 403 });
  }
}