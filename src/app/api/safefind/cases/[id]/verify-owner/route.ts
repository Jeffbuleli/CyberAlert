import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { verifyOwner } from "@/lib/safefind/service";

const bodyZ = z.object({
  firstName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  last4: z.string().max(8).optional(),
  lostCommune: z.string().max(120).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.id;

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = bodyZ.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await verifyOwner({
      userId,
      casePublicId: id.toUpperCase(),
      answers: parsed.data,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "kyc_required") {
      return NextResponse.json({ error: "kyc_required" }, { status: 403 });
    }
    if (msg === "case_blocked") {
      return NextResponse.json({ error: "case_blocked" }, { status: 403 });
    }
    if (msg === "case_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "verify_failed" }, { status: 500 });
  }
}
