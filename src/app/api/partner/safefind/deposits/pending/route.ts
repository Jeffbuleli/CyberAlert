import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listPartnerPendingDeposits } from "@/lib/safefind/service";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listPartnerPendingDeposits(session.id);
    return NextResponse.json({ cases: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "partner_forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
