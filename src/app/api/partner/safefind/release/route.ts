import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { releaseToOwner } from "@/lib/safefind/service";

const bodyZ = z.object({
  casePublicId: z.string().min(8),
  otp: z.string().min(4).max(12),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.id;
  const json = await req.json().catch(() => null);
  const parsed = bodyZ.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await releaseToOwner({
      agentUserId: userId,
      casePublicId: parsed.data.casePublicId.toUpperCase(),
      otp: parsed.data.otp,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "partner_forbidden" || msg === "partner_case_forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
