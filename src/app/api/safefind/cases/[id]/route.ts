import { NextResponse } from "next/server";
import { getCasePublicById } from "@/lib/safefind/service";

const PUBLIC_ID_RE = /^SF-\d{4}-\d{6}$/i;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  // Enumeration protection: reject malformed IDs without DB hit patterns
  if (!PUBLIC_ID_RE.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const view = await getCasePublicById(id.toUpperCase());
  if (!view) {
    // Identical response shape timing-ish — always 404 for unknown
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ case: view });
}
