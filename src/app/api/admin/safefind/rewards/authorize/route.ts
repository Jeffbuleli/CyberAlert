import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, safefindRewards } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { processSafefindRewardPayout } from "@/lib/safefind/payout";

export const dynamic = "force-dynamic";

const bodyZ = z.object({
  rewardId: z.string().uuid(),
  phoneNumber: z.string().min(6),
  provider: z.string().min(2),
});

export async function POST(req: Request) {
  const staff = await getSessionUser();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodyZ.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  const [reward] = await db
    .select()
    .from(safefindRewards)
    .where(eq(safefindRewards.id, parsed.data.rewardId))
    .limit(1);
  if (!reward) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Ensure authorized before payout
  if (reward.status === "PENDING" || reward.status === "LOCKED") {
    await db
      .update(safefindRewards)
      .set({ status: "AUTHORIZED", authorizedAt: new Date(), updatedAt: new Date() })
      .where(eq(safefindRewards.id, reward.id));
  }

  const result = await processSafefindRewardPayout({
    rewardId: parsed.data.rewardId,
    phoneNumber: parsed.data.phoneNumber,
    provider: parsed.data.provider,
    actorUserId: staff.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, reference: result.reference });
}
