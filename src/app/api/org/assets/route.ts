import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb, orgAssets } from "@/db";
import { getSessionUser } from "@/lib/auth/session";

const MAX_FREE_ASSETS = 10;

const createSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().min(3).max(2048),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(orgAssets)
    .where(eq(orgAssets.userId, user.id))
    .orderBy(desc(orgAssets.updatedAt));

  return Response.json({ assets: rows, limit: MAX_FREE_ASSETS });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Label et URL requis." }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.select({ id: orgAssets.id }).from(orgAssets).where(eq(orgAssets.userId, user.id));
  if (existing.length >= MAX_FREE_ASSETS) {
    return Response.json(
      { error: "limit_exceeded", message: `Maximum ${MAX_FREE_ASSETS} actifs pour ce compte.` },
      { status: 402 },
    );
  }

  let domain: string | null = null;
  try {
    const u = new URL(parsed.data.url.includes("://") ? parsed.data.url : `https://${parsed.data.url}`);
    domain = u.hostname;
  } catch {
    return Response.json({ error: "invalid_url", message: "URL invalide." }, { status: 400 });
  }

  const [row] = await db
    .insert(orgAssets)
    .values({
      userId: user.id,
      label: parsed.data.label.trim(),
      url: parsed.data.url.trim(),
      domain,
      status: "active",
    })
    .returning();

  return Response.json({ asset: row });
}
