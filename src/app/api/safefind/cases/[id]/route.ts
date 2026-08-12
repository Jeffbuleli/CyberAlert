import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCaseDetailForViewer } from "@/lib/safefind/service";

const PUBLIC_ID_RE = /^SF-\d{4}-\d{6}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!PUBLIC_ID_RE.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getSessionUser();
  const detail = await getCaseDetailForViewer(
    id.toUpperCase(),
    session?.id ?? null,
  );
  if (!detail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    case: detail.case,
    viewerRole: detail.viewerRole,
    depositPartner: detail.depositPartner,
    phase: detail.phase,
    canClaim: detail.canClaim,
  });
}
