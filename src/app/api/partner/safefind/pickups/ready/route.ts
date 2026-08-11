import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { markReadyForPickup } from "@/lib/safefind/logistics";

const bodyZ = z.object({ casePublicId: z.string().min(8) });

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await markReadyForPickup({
      agentUserId: session.id,
      casePublicId: parsed.data.casePublicId.toUpperCase(),
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}