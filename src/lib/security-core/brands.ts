import type { BrandEntry } from "@/lib/link-analysis/verdict";

export const DEFAULT_BRANDS: BrandEntry[] = [
  { name: "Rawbank", domains: ["rawbank.com", "rawbank.cd"] },
  { name: "Equity BCDC", domains: ["equitybcdc.com", "equitybankgroup.com"] },
  { name: "Vodacom", domains: ["vodacom.cd", "mpesa.com"] },
  { name: "Airtel", domains: ["airtel.cd", "airtel.com"] },
  { name: "Orange", domains: ["orange.cd", "orange.com"] },
  { name: "Facebook", domains: ["facebook.com", "fb.com", "meta.com"] },
  { name: "WhatsApp", domains: ["whatsapp.com", "wa.me"] },
  { name: "Google", domains: ["google.com", "gmail.com"] },
  { name: "McBuleli", domains: ["mcbuleli.org", "mcbuleli.online"] },
  { name: "Cyber Alert DRC", domains: ["cyberalert-rdc.org"] },
];

function mergeBrands(primary: BrandEntry[], secondary: BrandEntry[]): BrandEntry[] {
  const byName = new Map<string, BrandEntry>();
  for (const b of [...secondary, ...primary]) {
    const key = b.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, { name: b.name, domains: [...b.domains] });
      continue;
    }
    const domains = new Set([...prev.domains, ...b.domains]);
    byName.set(key, { name: prev.name, domains: [...domains] });
  }
  return [...byName.values()];
}

/**
 * Load brand watchlist from DB when available; always fall back to DEFAULT_BRANDS.
 * Never throws — DB outage must not block URL checks.
 */
export async function loadBrandWatchlist(): Promise<BrandEntry[]> {
  try {
    const { getDb, brandWatchlist } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const rows = await db
      .select({
        brandName: brandWatchlist.brandName,
        domains: brandWatchlist.domains,
      })
      .from(brandWatchlist)
      .where(eq(brandWatchlist.active, true));

    const fromDb: BrandEntry[] = rows
      .map((r) => ({
        name: r.brandName,
        domains: Array.isArray(r.domains)
          ? (r.domains as unknown[]).filter((d): d is string => typeof d === "string")
          : [],
      }))
      .filter((b) => b.domains.length > 0);

    return mergeBrands(fromDb, DEFAULT_BRANDS);
  } catch {
    return DEFAULT_BRANDS;
  }
}
