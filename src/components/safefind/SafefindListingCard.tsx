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
  foundZone?: { commune: string | null; quartier: string | null };
  foundApproxDate?: string | null;
  visualNotes?: string | null;
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

function DocIcon({ type, className }: { type: string; className?: string }) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ca-accent)]/12 text-[var(--ca-accent)] ${className ?? ""}`}
      aria-hidden
    >
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
        {type === "passeport" ? (
          <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        ) : type === "permis_conduire" ? (
          <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        ) : (
          <path d="M8 9h8M8 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
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

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] shadow-sm">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-emerald-700">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M7 11V8a5 5 0 0 1 10 0v3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          TROUVÉ
        </span>
        <span className="text-[11px] text-[var(--ca-ink-muted)]">
          🇨🇩 {zone}
        </span>
      </div>

      <div className="flex items-start gap-3 px-4 pt-3">
        <DocIcon type={listing.documentType} />
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
            {listing.documentNumberLast4
              ? ` · …${listing.documentNumberLast4}`
              : ""}
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
            {listing.partner?.commune ?? zone} · Point partenaire
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-[var(--ca-ink-muted)]">
          {listing.publicId}
        </span>
      </div>

      {listing.visualNotes ? (
        <p className="px-4 pt-2 text-xs text-[var(--ca-ink-muted)]">
          Conditions : {listing.visualNotes}
        </p>
      ) : (
        <p className="px-4 pt-2 text-xs text-[var(--ca-ink-muted)]">
          Conditions : retrait au Point SafeFind uniquement
        </p>
      )}

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
