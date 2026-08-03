import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, payments } from "@/db";
import { Section } from "@/components/ui/primitives";
import { PaymentStatusClient } from "@/components/payments/payment-status-client";

type Props = { params: Promise<{ id: string }> };

export default async function PricingPaymentPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const db = getDb();
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.userId, user.id)))
    .limit(1);
  if (!row) notFound();

  return (
    <Section className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <PaymentStatusClient paymentId={row.id} />
      </div>
    </Section>
  );
}
