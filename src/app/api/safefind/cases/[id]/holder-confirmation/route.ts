import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { confirmHeldByFinder } from "@/lib/safefind/logistics";

const bodyZ = z.object({
  circumstances: z.string().max(500).optional(),
  approxCommune: z.string().max(120).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const result = await confirmHeldByFinder({
      userId: session.id,
      casePublicId: id.toUpperCase(),
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = msg === "forbidden" ? 403 : msg === "case_not_found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}