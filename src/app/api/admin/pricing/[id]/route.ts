import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, pricingPlans, adminAuditLog } from "@/db";
import { getSessionUser } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  priceUsdCents: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  quotas: z.record(z.string(), z.unknown()).optional(),
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
    .update(pricingPlans)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(pricingPlans.id, id));

  await db.insert(adminAuditLog).values({
    actorUserId: user.id,
    action: "pricing.update",
    meta: { id, ...parsed.data },
  });

  return Response.json({ ok: true });
}
