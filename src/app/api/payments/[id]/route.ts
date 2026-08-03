import { and, eq } from "drizzle-orm";
import { getDb, payments } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { reconcilePaymentById } from "@/lib/payments/reconcile";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

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
      providerRef: payments.providerRef,
      phone: payments.phone,
    })
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, user.id)))
    .limit(1);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  // Heal missed webhooks while the UI polls (Hackathon pattern).
  if (row.status === "pending" || row.status === "processing") {
    await reconcilePaymentById(row.id).catch((e) => {
      console.warn("[payments] reconcile", row.id, e);
    });
  }

  const [fresh] = await db
    .select({
      id: payments.id,
      status: payments.status,
      localAmount: payments.localAmount,
      localCurrency: payments.localCurrency,
      planCode: payments.planCode,
      providerRef: payments.providerRef,
      phone: payments.phone,
    })
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, user.id)))
    .limit(1);

  return Response.json(fresh ?? row);
}
