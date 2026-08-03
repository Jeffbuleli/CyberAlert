import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, linkChecks } from "@/db";
import { Section } from "@/components/ui/primitives";
import { LinkCheckResultView } from "@/components/link-check/result-view";
import type { LinkSignal, RiskLevel } from "@/types/security";

type Props = { params: Promise<{ id: string }> };

export default async function CheckResultPage({ params }: Props) {
  const { id } = await params;
  let row;
  try {
    const db = getDb();
    [row] = await db.select().from(linkChecks).where(eq(linkChecks.id, id)).limit(1);
  } catch {
    notFound();
  }
  if (!row) notFound();

  return (
    <Section className="py-10 sm:py-14">
      <LinkCheckResultView
        id={row.id}
        url={row.urlNormalized}
        riskLevel={row.riskLevel as RiskLevel}
        summary={row.aiSummary || ""}
        recommendation={row.aiRecommendation || ""}
        signals={(row.signals || []) as LinkSignal[]}
      />
    </Section>
  );
}
