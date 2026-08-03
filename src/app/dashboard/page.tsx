import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb, projects, securityScans, findings } from "@/db";
import { getActivePlanForUser, getQuotaRemaining } from "@/lib/quotas";
import { Section, Badge, Button } from "@/components/ui/primitives";
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

  return (
    <Section className="py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--ca-ink-muted)]">Cyber Alert DRC</p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Bonjour, {user.name || user.email.split("@")[0]}
          </h1>
          <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
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
          <Link href="/pricing">
            <Button variant="secondary">Passer à Pro</Button>
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Critical" value={counts.critical} tone="high" />
        <Stat label="High" value={counts.high} tone="caution" />
        <Stat label="Medium" value={counts.medium} tone="info" />
        <Stat label="Low" value={counts.low} tone="low" />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">Nouveau scan</h2>
          {scanQuota.remaining <= 0 ? (
            <div className="mt-3 rounded-2xl border border-[var(--ca-border)] bg-white p-5">
              <p className="font-medium">Vous avez utilisé vos scans gratuits.</p>
              <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
                Continuez à analyser et améliorer la sécurité de vos applications.
              </p>
              <Link href="/pricing" className="mt-4 inline-block">
                <Button>Passer à Developer Pro</Button>
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <NewScanForm
                projects={userProjects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  url: p.primaryUrl,
                }))}
              />
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold">Projects</h2>
          <ul className="mt-3 space-y-2">
            {userProjects.length === 0 ? (
              <li className="text-sm text-[var(--ca-ink-muted)]">
                Aucun projet - lancez un premier scan.
              </li>
            ) : (
              userProjects.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-[var(--ca-border)] bg-white px-4 py-3 text-sm"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="mt-0.5 block truncate text-[var(--ca-ink-muted)]">
                    {p.primaryUrl}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-semibold">Recent scans</h2>
        <ul className="mt-3 space-y-2">
          {recentScans.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/scans/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-[var(--ca-border)] bg-white px-4 py-3 text-sm hover:border-[var(--ca-accent)]"
              >
                <span className="truncate">{s.targetUrl}</span>
                <Badge tone={s.status === "completed" ? "low" : "neutral"}>{s.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "high" | "caution" | "info" | "low";
}) {
  return (
    <div className="rounded-2xl border border-[var(--ca-border)] bg-white p-4">
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
