import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { acceptDeposit } from "@/lib/safefind/service";

const bodyZ = z.object({
  casePublicId: z.string().min(8),
  documentPresent: z.boolean(),
  conditionNotes: z.string().max(500).optional(),
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
    const result = await acceptDeposit({
      agentUserId: userId,
      casePublicId: parsed.data.casePublicId.toUpperCase(),
      documentPresent: parsed.data.documentPresent,
      conditionNotes: parsed.data.conditionNotes,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "partner_forbidden" || msg === "partner_case_forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (msg === "case_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
