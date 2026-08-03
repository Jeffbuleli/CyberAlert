import { and, eq } from "drizzle-orm";
import { getDb, payments } from "@/db";
import { getSessionUser } from "@/lib/auth/session";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const [row] = await db
    .select({
      id: payments.id,
      status: payments.status,
      localAmount: payments.localAmount,
      localCurrency: payments.localCurrency,
      planCode: payments.planCode,
    })
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, user.id)))
    .limit(1);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(row);
}
