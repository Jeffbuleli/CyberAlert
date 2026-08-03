import { eq } from "drizzle-orm";
import { getDb, linkChecks } from "@/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select().from(linkChecks).where(eq(linkChecks.id, id)).limit(1);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    id: row.id,
    url: row.urlNormalized,
    riskLevel: row.riskLevel,
    score: row.score,
    signals: row.signals,
    summary: row.aiSummary,
    recommendation: row.aiRecommendation,
    createdAt: row.createdAt,
  });
}
