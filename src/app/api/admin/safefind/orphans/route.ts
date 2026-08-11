import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listOrphanCases } from "@/lib/safefind/logistics";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const minAgeDays = url.searchParams.get("minAgeDays");
  const orphans = await listOrphanCases({
    minAgeDays: minAgeDays ? Number(minAgeDays) : undefined,
  });
  return NextResponse.json({ orphans });
}
