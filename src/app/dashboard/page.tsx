import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, projects, securityScans, findings } from "@/db";
import { getActivePlanForUser, getQuotaRemaining } from "@/lib/quotas";
import { Section, Badge, Button, SurfaceCard } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/visuals";
import { NewScanForm } from "@/components/dashboard/new-scan-form";
import { LogoutButton } from "@/components/dashboard/logout-button";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const db = getDb();
  const plan = await getActivePlanForUser(user.id);
  const scanQuota = await getQuotaRemaining(user.id, "scans");
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt));
  const recentScans = await db
    .select()
    .from(securityScans)
    .where(eq(securityScans.userId, user.id))
    .orderBy(desc(securityScans.createdAt))
    .limit(10);

  const scanIds = recentScans.map((s) => s.id);
  const allFindings =
    scanIds.length > 0
      ? await db.select().from(findings).where(inArray(findings.scanId, scanIds))
      : [];

  const counts = {
    critical: allFindings.filter((f) => f.severity === "critical").length,
    high: allFindings.filter((f) => f.severity === "high").length,
    medium: allFindings.filter((f) => f.severity === "medium").length,
    low: allFindings.filter((f) => f.severity === "low").length,
  };

  const isPro = plan?.code === "developer_pro";

  return (
    <Section className="py-10 sm:py-14">
      <SurfaceCard variant="panther" className="overflow-hidden p-6 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              Espace développeur
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Bonjour, {user.name || user.email.split("@")[0]}
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Plan : {plan?.name || "Free"} - scans restants : {scanQuota.remaining}/
              {scanQuota.limit}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role === "admin" ? (
              <Link href="/admin">
                <Button variant="secondary">Admin</Button>
              </Link>
            ) : null}
            <Link href="/dashboard/settings">
              <Button variant="secondary">Paramètres</Button>
            </Link>
            <Link href="/dashboard/org">
              <Button variant="secondary">Actifs org</Button>
            </Link>
            {!isPro ? (
              <Link href="/pricing/pay">
                <Button variant="secondary">Passer à Pro</Button>
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </SurfaceCard>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Critique" value={counts.critical} tone="critical" hint="À traiter d'abord" />
        <StatCard label="Élevé" value={counts.high} tone="high" hint="Priorité haute" />
        <StatCard label="Moyen" value={counts.medium} tone="medium" hint="Planifier" />
        <StatCard label="Faible" value={counts.low} tone="low" hint="Surveillance" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold text-[var(--ca-ink)]">Nouveau scan</h2>
          {scanQuota.remaining <= 0 ? (
            <SurfaceCard className="p-5">
              <p className="font-medium">Vous avez utilisé vos scans gratuits.</p>
              <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
                Continuez à analyser et améliorer la sécurité de vos applications.
              </p>
              <Link href="/pricing/pay" className="mt-4 inline-block">
                <Button>Passer à Developer Pro</Button>
              </Link>
            </SurfaceCard>
          ) : (
            <NewScanForm
              projects={userProjects.map((p) => ({
                id: p.id,
                name: p.name,
                url: p.primaryUrl,
              }))}
            />
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-[var(--ca-ink)]">Projets</h2>
          <ul className="space-y-2">
            {userProjects.length === 0 ? (
              <li>
                <SurfaceCard variant="inset" className="px-4 py-3 text-sm text-[var(--ca-ink-muted)]">
                  Aucun projet - lancez un premier scan.
                </SurfaceCard>
              </li>
            ) : (
              userProjects.map((p) => (
                <li key={p.id}>
                  <SurfaceCard className="px-4 py-3 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="mt-0.5 block truncate text-[var(--ca-ink-muted)]">
                      {p.primaryUrl}
                    </span>
                  </SurfaceCard>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-semibold text-[var(--ca-ink)]">Scans récents</h2>
        <ul className="space-y-2">
          {recentScans.map((s) => (
            <li key={s.id}>
              <Link href={`/dashboard/scans/${s.id}`} className="block">
                <SurfaceCard className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:-translate-y-0.5 hover:shadow-[var(--ca-shadow-lift)]">
                  <span className="truncate">{s.targetUrl}</span>
                  <Badge tone={s.status === "completed" ? "low" : "neutral"}>{s.status}</Badge>
                </SurfaceCard>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
