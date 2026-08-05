import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import {
  getDb,
  linkChecks,
  siteReports,
  payments,
  users,
  pricingPlans,
  securityScans,
  auditRequests,
} from "@/db";
import { Section, Badge, Button, SurfaceCard } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/visuals";
import { ReportModeration } from "@/components/admin/report-moderation";
import { PricingEditor } from "@/components/admin/pricing-editor";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const db = getDb();
  const allChecks = await db.select({ id: linkChecks.id }).from(linkChecks);
  const allReports = await db.select({ id: siteReports.id, status: siteReports.moderationStatus }).from(siteReports);
  const allScans = await db.select({ id: securityScans.id }).from(securityScans);
  const allPayments = await db.select({ id: payments.id }).from(payments);
  const allUsers = await db.select({ id: users.id }).from(users);
  const counts = {
    checks: allChecks.length,
    reports: allReports.length,
    pendingReports: allReports.filter((r) => r.status === "pending").length,
    scans: allScans.length,
    payments: allPayments.length,
    users: allUsers.length,
  };

  const recentChecks = await db
    .select({
      id: linkChecks.id,
      url: linkChecks.urlNormalized,
      risk: linkChecks.riskLevel,
      createdAt: linkChecks.createdAt,
    })
    .from(linkChecks)
    .orderBy(desc(linkChecks.createdAt))
    .limit(15);

  const pendingReports = await db
    .select()
    .from(siteReports)
    .where(eq(siteReports.moderationStatus, "pending"))
    .orderBy(desc(siteReports.createdAt))
    .limit(20);

  const recentReports = await db
    .select()
    .from(siteReports)
    .orderBy(desc(siteReports.updatedAt))
    .limit(30)
    .then((rows) => rows.filter((r) => r.moderationStatus !== "pending").slice(0, 15));

  const plans = await db.select().from(pricingPlans).orderBy(pricingPlans.sortOrder);
  const recentPayments = await db
    .select()
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(15);
  const audits = await db
    .select()
    .from(auditRequests)
    .orderBy(desc(auditRequests.createdAt))
    .limit(10);

  return (
    <Section className="py-10 sm:py-14">
      <SurfaceCard variant="panther" className="mb-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              Operations
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">Administration</h1>
            <p className="text-sm text-white/65">Cyber Alert DRC - contrôle opérationnel</p>
          </div>
          <Link href="/dashboard">
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </SurfaceCard>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Checks" value={counts.checks} tone="info" />
        <StatCard label="Reports" value={counts.reports} tone="medium" />
        <StatCard label="Pending" value={counts.pendingReports} tone="caution" />
        <StatCard label="Scans" value={counts.scans} tone="high" />
        <StatCard label="Payments" value={counts.payments} tone="low" />
        <StatCard label="Users" value={counts.users} tone="critical" />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <SurfaceCard variant="lift" className="p-5 sm:p-6">
          <ReportModeration
            pending={pendingReports.map((r) => ({
              id: r.id,
              url: r.url,
              category: r.category,
              comment: r.comment,
              source: r.source,
              moderationStatus: r.moderationStatus,
              moderatorNote: r.moderatorNote,
              createdAt: r.createdAt,
            }))}
            recent={recentReports.map((r) => ({
              id: r.id,
              url: r.url,
              category: r.category,
              comment: r.comment,
              source: r.source,
              moderationStatus: r.moderationStatus,
              moderatorNote: r.moderatorNote,
              createdAt: r.createdAt,
            }))}
          />
        </SurfaceCard>
        <div>
          <h2 className="font-semibold">Pricing</h2>
          <PricingEditor
            plans={plans.map((p) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              priceUsdCents: p.priceUsdCents,
              active: p.active,
              quotas: p.quotas as Record<string, unknown>,
            }))}
          />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-semibold">Link checks récents</h2>
        <ul className="mt-3 space-y-2">
          {recentChecks.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ca-border)] bg-white px-3 py-2 text-sm"
            >
              <span className="truncate">{c.url}</span>
              <Badge
                tone={
                  c.risk === "high"
                    ? "high"
                    : c.risk === "caution"
                      ? "caution"
                      : c.risk === "unknown"
                        ? "unknown"
                        : "low"
                }
              >
                {c.risk}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">Payments</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recentPayments.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--ca-border)] bg-white px-3 py-2"
              >
                <div className="flex justify-between gap-2">
                  <span>{p.planCode || p.purpose}</span>
                  <Badge>{p.status}</Badge>
                </div>
                <p className="text-[var(--ca-ink-muted)]">
                  ${(p.usdAmountCents / 100).toFixed(2)} - {p.localAmount} {p.localCurrency}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">Demandes d&apos;audit</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {audits.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-[var(--ca-border)] bg-white px-3 py-2"
              >
                <p className="font-medium">{a.organization}</p>
                <p className="text-[var(--ca-ink-muted)]">
                  {a.serviceType} - {a.contactEmail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
