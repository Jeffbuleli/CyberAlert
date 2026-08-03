import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, siteReports, adminAuditLog } from "@/db";
import { getSessionUser } from "@/lib/auth/session";

const schema = z.object({
  moderationStatus: z.enum(["pending", "reviewed", "dismissed", "actioned"]),
  moderatorNote: z.string().max(2000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const db = getDb();
  await db
    .update(siteReports)
    .set({
      moderationStatus: parsed.data.moderationStatus,
      moderatorNote: parsed.data.moderatorNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(siteReports.id, id));

  await db.insert(adminAuditLog).values({
    actorUserId: user.id,
    action: "report.moderate",
    meta: { id, status: parsed.data.moderationStatus },
  });

  return Response.json({ ok: true });
}
