import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import {
  getDb,
  safefindCases,
  safefindCustodyEvents,
  safefindIncidents,
  safefindRewards,
} from "@/db";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staff = await getSessionUser();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const db = getDb();

  const rows = status
    ? await db
        .select({
          id: safefindCases.id,
          publicId: safefindCases.publicId,
          documentType: safefindCases.documentType,
          status: safefindCases.status,
          rewardStatus: safefindCases.rewardStatus,
          rewardFrozen: safefindCases.rewardFrozen,
          currentPartnerId: safefindCases.currentPartnerId,
          createdAt: safefindCases.createdAt,
        })
        .from(safefindCases)
        .where(eq(safefindCases.status, status))
        .orderBy(desc(safefindCases.createdAt))
        .limit(100)
    : await db
        .select({
          id: safefindCases.id,
          publicId: safefindCases.publicId,
          documentType: safefindCases.documentType,
          status: safefindCases.status,
          rewardStatus: safefindCases.rewardStatus,
          rewardFrozen: safefindCases.rewardFrozen,
          currentPartnerId: safefindCases.currentPartnerId,
          createdAt: safefindCases.createdAt,
        })
        .from(safefindCases)
        .orderBy(desc(safefindCases.createdAt))
        .limit(100);

  return NextResponse.json({ cases: rows });
}

export async function POST(req: Request) {
  const staff = await getSessionUser();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    caseId?: string;
    note?: string;
  } | null;

  if (!body?.action || !body.caseId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  if (body.action === "freeze") {
    await db
      .update(safefindCases)
      .set({ rewardFrozen: true, rewardStatus: "LOCKED", updatedAt: new Date() })
      .where(eq(safefindCases.id, body.caseId));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "custody") {
    const events = await db
      .select()
      .from(safefindCustodyEvents)
      .where(eq(safefindCustodyEvents.caseId, body.caseId))
      .orderBy(desc(safefindCustodyEvents.createdAt))
      .limit(200);
    return NextResponse.json({ events });
  }

  if (body.action === "incidents") {
    const incidents = await db
      .select()
      .from(safefindIncidents)
      .where(eq(safefindIncidents.caseId, body.caseId));
    return NextResponse.json({ incidents });
  }

  if (body.action === "rewards") {
    const rewards = await db
      .select()
      .from(safefindRewards)
      .where(eq(safefindRewards.caseId, body.caseId));
    return NextResponse.json({ rewards });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
