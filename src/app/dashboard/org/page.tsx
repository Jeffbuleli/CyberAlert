import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, orgAssets } from "@/db";
import { Button, Section, SurfaceCard } from "@/components/ui/primitives";
import { OrgAssetsClient } from "@/components/dashboard/org-assets-client";

const MAX_FREE_ASSETS = 10;

export default async function DashboardOrgPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const db = getDb();
  const rows = await db
    .select()
    .from(orgAssets)
    .where(eq(orgAssets.userId, user.id))
    .orderBy(desc(orgAssets.updatedAt));

  return (
    <Section className="py-10 sm:py-14">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[var(--ca-accent)] hover:underline"
        >
          ← Espace développeur
        </Link>
        <Link href="/business">
          <Button variant="secondary">Services entreprises</Button>
        </Link>
      </div>

      <SurfaceCard variant="panther" className="mb-6 p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
          Module 3 · Organisation
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Actifs surveillés</h1>
        <p className="mt-2 max-w-xl text-sm text-white/65">
          Inventaire MVP : ajoutez vos domaines et lancez une vérification Evidence / McBuleli.
          Pas de pentest offensif. UNKNOWN reste distinct de TRUSTED.
        </p>
      </SurfaceCard>

      <OrgAssetsClient
        initialAssets={rows.map((r) => ({
          id: r.id,
          label: r.label,
          url: r.url,
          domain: r.domain,
          lastVerdict: r.lastVerdict,
          lastRiskLevel: r.lastRiskLevel,
          lastConfidence: r.lastConfidence,
          lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
          lastSummary: r.lastSummary,
        }))}
        limit={MAX_FREE_ASSETS}
      />
    </Section>
  );
}
