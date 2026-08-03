import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, findings, securityScans } from "@/db";
import { getSessionUser } from "@/lib/auth/session";

const schema = z.object({
  status: z.enum([
    "new",
    "confirmed",
    "in_progress",
    "fixed",
    "retest_pending",
    "resolved",
    "false_positive",
  ]),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .select({ id: findings.id, userId: securityScans.userId })
    .from(findings)
    .innerJoin(securityScans, eq(findings.scanId, securityScans.id))
    .where(eq(findings.id, id))
    .limit(1);
  if (!row || row.userId !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await db
    .update(findings)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(and(eq(findings.id, id)));

  return Response.json({ ok: true });
}
