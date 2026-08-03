export const REPORT_CATEGORIES = [
  { value: "phishing", label: "Phishing", hint: "Faux site pour voler des identifiants" },
  { value: "brand_impersonation", label: "Usurpation de marque", hint: "Imite une banque, opérateur…" },
  { value: "fake_contest", label: "Faux concours", hint: "Gain / tirage au sort trompeur" },
  { value: "fake_promo", label: "Fausse promotion", hint: "Offre trop belle pour être vraie" },
  { value: "financial_scam", label: "Arnaque financière", hint: "Paiement, transfert, investissement" },
  { value: "fake_service", label: "Faux service", hint: "Service ou support inventé" },
  { value: "suspected_malware", label: "Malware suspecté", hint: "Téléchargement ou infection" },
  { value: "other", label: "Autre", hint: "Autre risque à signaler" },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["value"];

export const REPORT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.value, c.label]),
);

export const REPORT_STATUS_META: Record<
  string,
  { label: string; tone: "caution" | "info" | "neutral" | "low" | "high" }
> = {
  pending: { label: "En attente", tone: "caution" },
  reviewed: { label: "Vu", tone: "info" },
  dismissed: { label: "Rejeté", tone: "neutral" },
  actioned: { label: "Traité", tone: "low" },
};

export function categoryLabel(value: string): string {
  return REPORT_CATEGORY_LABELS[value] || value;
}

export function statusMeta(status: string) {
  return REPORT_STATUS_META[status] || { label: status, tone: "neutral" as const };
}

export function shortReportId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function domainFromUrl(url: string): string | null {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
