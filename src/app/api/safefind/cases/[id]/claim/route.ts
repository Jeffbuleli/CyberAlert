import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { startOwnerClaim } from "@/lib/safefind/service";

const bodyZ = z.object({
  firstName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  documentNumber: z.string().max(64).optional(),
  lostCommune: z.string().max(120).optional(),
  lostApproxDate: z.string().datetime().optional(),
  appearanceHints: z.record(z.string(), z.unknown()).optional(),
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
    const result = await startOwnerClaim({
      userId,
      casePublicId: id.toUpperCase(),
      ...parsed.data,
      lostApproxDate: parsed.data.lostApproxDate
        ? new Date(parsed.data.lostApproxDate)
        : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "case_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }
}
