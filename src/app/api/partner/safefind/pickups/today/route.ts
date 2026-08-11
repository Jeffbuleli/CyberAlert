import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listTodayPickups } from "@/lib/safefind/logistics";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const slotDate =
    url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  try {
    const rows = await listTodayPickups(session.id, slotDate);
    return NextResponse.json({ pickups: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}