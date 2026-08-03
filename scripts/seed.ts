import { eq } from "drizzle-orm";
import { getDb, users, pricingPlans, brandWatchlist } from "../src/db";
import { hashPassword } from "../src/lib/auth/session";

async function main() {
  const db = getDb();

  const plans = [
    {
      code: "developer_free",
      name: "Developer Free",
      description: "1 projet - 2 scans / mois - résultats principaux",
      priceUsdCents: 0,
      quotas: { maxProjects: 1, scansPerMonth: 2, fullReports: false },
      sortOrder: 1,
    },
    {
      code: "developer_pro",
      name: "Developer Pro",
      description: "Scans étendus - historique - rapports détaillés",
      priceUsdCents: 1500,
      quotas: { maxProjects: 10, scansPerMonth: 50, fullReports: true },
      sortOrder: 2,
    },
    {
      code: "business_audit",
      name: "Security Audit",
      description: "Audit ponctuel à partir de 100 USD",
      priceUsdCents: 10000,
      quotas: {},
      sortOrder: 10,
    },
    {
      code: "business_professional",
      name: "Professional Audit",
      description: "Audit professionnel 250 USD+",
      priceUsdCents: 25000,
      quotas: {},
      sortOrder: 11,
    },
    {
      code: "business_monitoring",
      name: "Monitoring",
      description: "Monitoring dès 50 USD / mois",
      priceUsdCents: 5000,
      billingPeriod: "monthly",
      quotas: {},
      sortOrder: 12,
    },
  ];

  for (const p of plans) {
    const [existing] = await db
      .select({ id: pricingPlans.id })
      .from(pricingPlans)
      .where(eq(pricingPlans.code, p.code))
      .limit(1);
    if (existing) {
      await db
        .update(pricingPlans)
        .set({
          name: p.name,
          description: p.description,
          priceUsdCents: p.priceUsdCents,
          quotas: p.quotas,
          sortOrder: p.sortOrder,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(pricingPlans.id, existing.id));
    } else {
      await db.insert(pricingPlans).values({
        code: p.code,
        name: p.name,
        description: p.description,
        priceUsdCents: p.priceUsdCents,
        billingPeriod: p.billingPeriod || "monthly",
        quotas: p.quotas,
        sortOrder: p.sortOrder,
        active: true,
      });
    }
  }

  const brands = [
    { brandName: "Rawbank", domains: ["rawbank.com", "rawbank.cd"] },
    { brandName: "Vodacom", domains: ["vodacom.cd"] },
    { brandName: "Airtel", domains: ["airtel.cd"] },
    { brandName: "McBuleli", domains: ["mcbuleli.org"] },
  ];
  for (const b of brands) {
    const [ex] = await db
      .select({ id: brandWatchlist.id })
      .from(brandWatchlist)
      .where(eq(brandWatchlist.brandName, b.brandName))
      .limit(1);
    if (!ex) {
      await db.insert(brandWatchlist).values(b);
    }
  }

  const adminEmail = (process.env.ADMIN_SEED_EMAIL || "admin@cyberalert.local").toLowerCase();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "change-me-admin-password";
  const [admin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!admin) {
    await db.insert(users).values({
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      name: "Admin",
      role: "admin",
    });
    console.log(`Admin created: ${adminEmail}`);
  } else {
    console.log(`Admin exists: ${adminEmail}`);
  }

  console.log("Seed OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
