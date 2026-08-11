import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { suggestStorageSlot } from "@/lib/safefind/logistics";

const bodyZ = z.object({
  casePublicId: z.string().min(4),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await suggestStorageSlot({
      agentUserId: session.id,
      casePublicId: parsed.data.casePublicId.toUpperCase(),
    });
    return NextResponse.json({
      ok: true,
      path: result.path,
      zone: result.zone
        ? { id: result.zone.id, code: result.zone.code, name: result.zone.name }
        : null,
      location: result.location
        ? {
            id: result.location.id,
            rackCode: result.location.rackCode,
            binCode: result.location.binCode,
            positionCode: result.location.positionCode,
          }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
