"use client";

import Link from "next/link";
import { SAFEFIND_DOC_OPTIONS } from "@/components/safefind/doc-types";

export type SafefindListing = {
  publicId: string;
  documentType: string;
  status: string;
  holderFirstNameMasked?: string | null;
  holderLastNameMasked?: string | null;
  documentNumberLast4?: string | null;
  birthYearMasked?: string | null;
  foundZone?: { commune: string | null; quartier: string | null };
  foundApproxDate?: string | null;
  visualNotes?: string | null;
  listingSummary?: string | null;
  previewUrl?: string | null;
  isSpecimen?: boolean;
  rewardHint?: { amount: string; currency: string } | null;
  createdAt: string;
  partner: { id: string; name: string; commune: string } | null;
};

function docLabel(type: string) {
  return SAFEFIND_DOC_OPTIONS.find((d) => d.value === type)?.label ?? type;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    securise: "Sécurisé",
    pret_retrait: "Prêt au retrait",
    retrait_reserve: "Retrait réservé",
    correspondance: "Correspondance",
    verification: "Vérification",
    declare: "Déclaré",
    enregistre: "Enregistré",
    depot_en_attente: "Dépôt en attente",
    livraison: "Livraison",
    remis: "Remis",
    restitue: "Restitué",
    perdu: "Perdu",
    en_cours: "En cours",
  };
  return map[status] ?? status;
}

export function SafefindListingCard({
  listing,
  mode,
  onFoundCta,
}: {
  listing: SafefindListing;
  mode: "lost" | "found";
  onFoundCta?: () => void;
}) {
  const name = [listing.holderFirstNameMasked, listing.holderLastNameMasked]
    .filter(Boolean)
    .join(" ");
  const zone =
    listing.partner?.commune ||
    listing.foundZone?.commune ||
    listing.foundZone?.quartier ||
    "Kinshasa";
  const summary =
    listing.listingSummary ||
    listing.visualNotes ||
    "Retrait au Point SafeFind uniquement";

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] shadow-sm">
      <div className="flex items-center justify-between px-4 pt-3">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
            mode === "lost"
              ? "bg-amber-500/15 text-amber-800"
              : "bg-emerald-600/15 text-emerald-700"
          }`}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M7 11V8a5 5 0 0 1 10 0v3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          {mode === "lost" ? "JE CHERCHE" : "TROUVÉ"}
        </span>
        <span className="text-[11px] text-[var(--ca-ink-muted)]">🇨🇩 {zone}</span>
      </div>

      {listing.previewUrl ? (
        <div className="relative mx-4 mt-3 overflow-hidden rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-2)]">
          {/* Specimen / redacted preview: blur photo & MRZ zones for privacy */}
          <div className="relative aspect-[16/10] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.previewUrl}
              alt=""
              className="h-full w-full object-cover object-top opacity-90"
            />
            <div
              className="pointer-events-none absolute inset-y-[12%] left-[4%] w-[28%] rounded-md bg-black/25 backdrop-blur-[6px]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-[4%] bottom-[4%] h-[18%] rounded-md bg-black/35 backdrop-blur-[8px]"
              aria-hidden
            />
            {listing.isSpecimen ? (
              <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Spécimen
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--ca-ink)]">
            {docLabel(listing.documentType)}
          </p>
          {listing.rewardHint ? (
            <p className="mt-0.5 text-lg font-bold text-[var(--ca-ink)]">
              {Number(listing.rewardHint.amount).toLocaleString("fr-CD")}{" "}
              {listing.rewardHint.currency}
              <span className="ml-1 text-xs font-medium text-[var(--ca-ink-muted)]">
                récompense
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-base font-semibold text-[var(--ca-ink)]">
              Dépôt sécurisé
            </p>
          )}
          <p className="mt-0.5 text-xs text-[var(--ca-ink-muted)]">
            {name || "Titulaire masqué"}
            {listing.documentNumberLast4 ? ` · …${listing.documentNumberLast4}` : ""}
            {listing.birthYearMasked ? ` · né(e) ${listing.birthYearMasked}` : ""}
            {" · "}
            {statusLabel(listing.status)}
          </p>
        </div>
      </div>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-[var(--ca-surface-2)] px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ca-accent)]/15 text-[var(--ca-accent)]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ca-ink)]">
            {listing.partner?.name ?? "Point SafeFind"}
          </p>
          <p className="text-[11px] text-[var(--ca-ink-muted)]">
            {listing.partner?.commune ?? zone} - Point partenaire
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-[var(--ca-ink-muted)]">
          {listing.publicId}
        </span>
      </div>

      <p className="px-4 pt-2 text-xs text-[var(--ca-ink-muted)]">
        Conditions : {summary}
      </p>

      <div className="p-4 pt-3">
        {mode === "lost" ? (
          <Link
            href={`/safefind/cases/${listing.publicId}`}
            className="flex w-full items-center justify-center rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-bold text-white transition hover:opacity-95"
          >
            C’est le mien
          </Link>
        ) : (
          <button
            type="button"
            onClick={onFoundCta}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            Déposer une pièce
          </button>
        )}
      </div>
    </article>
  );
}
