"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SafefindLostPanel } from "@/components/safefind/SafefindLostPanel";
import { SafefindFoundPanel } from "@/components/safefind/SafefindFoundPanel";
import {
  SafefindListingCard,
  type SafefindListing,
} from "@/components/safefind/SafefindListingCard";
import { SAFEFIND_DOC_OPTIONS } from "@/components/safefind/doc-types";

type HubTab = "marketplace" | "mine" | "orders";
type RoleMode = "lost" | "found";

type PartnerOpt = { id: string; name: string; commune: string };

function parseMode(raw: string | null): RoleMode {
  return raw === "found" || raw === "retrouve" ? "found" : "lost";
}

function parseHubTab(raw: string | null): HubTab {
  if (raw === "mine" || raw === "dossiers") return "mine";
  if (raw === "orders" || raw === "restitutions") return "orders";
  return "marketplace";
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 4.5 7v5.2c0 4.4 3.2 7.6 7.5 8.8 4.3-1.2 7.5-4.4 7.5-8.8V7L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12.2 11 14.7l4.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SafefindHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = useMemo(() => parseMode(searchParams.get("mode")), [searchParams]);
  const hubTab = useMemo(() => parseHubTab(searchParams.get("view")), [searchParams]);

  const [documentType, setDocumentType] = useState<string>("");
  const [commune, setCommune] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [listings, setListings] = useState<SafefindListing[]>([]);
  const [partners, setPartners] = useState<PartnerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const patchQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const q = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") q.delete(k);
        else q.set(k, v);
      }
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setMode = (next: RoleMode) => patchQuery({ mode: next });
  const setHubTab = (next: HubTab) =>
    patchQuery({ view: next === "marketplace" ? null : next });

  useEffect(() => {
    if (!nearMe) return;
    if (!navigator.geolocation) {
      setNearMe(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setNearMe(false),
      { timeout: 8000 },
    );
  }, [nearMe]);

  const loadMarketplace = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthNeeded(false);
    try {
      const q = new URLSearchParams();
      if (documentType) q.set("documentType", documentType);
      if (commune.trim()) q.set("commune", commune.trim());
      if (partnerId) q.set("partnerId", partnerId);
      if (readyOnly) q.set("readyOnly", "1");
      if (nearMe && coords) {
        q.set("lat", String(coords.lat));
        q.set("lng", String(coords.lng));
      }
      const res = await fetch(`/api/safefind/marketplace?${q}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        setListings([]);
        return;
      }
      setListings(data.listings ?? []);
      setPartners(data.partners ?? []);
    } catch {
      setError("Erreur réseau");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [commune, coords, documentType, nearMe, partnerId, readyOnly]);

  const loadMine = useCallback(
    async (bucket: "all" | "active") => {
      setLoading(true);
      setError(null);
      setAuthNeeded(false);
      try {
        const res = await fetch(`/api/safefind/mine?bucket=${bucket}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.status === 401) {
          setAuthNeeded(true);
          setListings([]);
          return;
        }
        if (!res.ok) {
          setError(data.error ?? "Erreur");
          setListings([]);
          return;
        }
        setListings(data.listings ?? []);
      } catch {
        setError("Erreur réseau");
        setListings([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (searchParams.get("tab") === "search" || searchParams.get("compose") === "1") {
      setComposeOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (hubTab === "marketplace") void loadMarketplace();
    else if (hubTab === "mine") void loadMine("all");
    else void loadMine("active");
  }, [hubTab, loadMarketplace, loadMine]);

  const communes = useMemo(() => {
    const set = new Set<string>();
    for (const p of partners) if (p.commune) set.add(p.commune);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [partners]);

  const composeTitle =
    mode === "lost" ? "Déclarer une perte" : "Déclarer un trouvé";

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-28 pt-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ca-accent)]/15 text-[var(--ca-accent)]">
            <IconShield className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[var(--ca-ink)]">
                SafeFind
              </h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                Point partenaire
              </span>
            </div>
            <p className="text-[11px] text-[var(--ca-ink-muted)]">
              Cyber Alert RDC · carte, passeport, permis
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="shrink-0 rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2 text-xs font-semibold text-[var(--ca-ink)]"
        >
          Règles
        </button>
      </header>

      <div
        className="mb-3 flex rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-1"
        role="tablist"
        aria-label="Sections SafeFind"
      >
        {(
          [
            ["marketplace", "Marketplace"],
            ["mine", "Mes dossiers"],
            ["orders", "Restitutions"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={hubTab === id}
            onClick={() => setHubTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm ${
              hubTab === id
                ? "bg-[var(--ca-accent)] text-white"
                : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="mb-4 flex rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)]/80 p-1.5"
        role="tablist"
        aria-label="Votre rôle"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "lost"}
          onClick={() => setMode("lost")}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
            mode === "lost"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
          }`}
        >
          J’ai perdu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "found"}
          onClick={() => setMode("found")}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
            mode === "found"
              ? "bg-emerald-700 text-white shadow-sm"
              : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
          }`}
        >
          J’ai retrouvé
        </button>
      </div>

      {hubTab === "marketplace" ? (
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] text-[var(--ca-ink-muted)]">
              Type
              <select
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-2.5 py-2 text-sm"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="">Tous</option>
                {SAFEFIND_DOC_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-[var(--ca-ink-muted)]">
              Commune
              <select
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-2.5 py-2 text-sm"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
              >
                <option value="">Toutes</option>
                {communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-[var(--ca-ink-muted)]">
              Point
              <select
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-2.5 py-2 text-sm"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              >
                <option value="">Tous</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-[var(--ca-ink-muted)]">
              Statut
              <select
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-2.5 py-2 text-sm"
                value={readyOnly ? "ready" : "all"}
                onChange={(e) => setReadyOnly(e.target.value === "ready")}
              >
                <option value="all">Tous</option>
                <option value="ready">Prêt au retrait</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDocumentType("")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                !documentType
                  ? "bg-[var(--ca-accent)] text-white"
                  : "bg-[var(--ca-surface-2)] text-[var(--ca-ink-muted)]"
              }`}
            >
              Tous
            </button>
            {SAFEFIND_DOC_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDocumentType(d.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  documentType === d.value
                    ? "bg-[var(--ca-accent)] text-white"
                    : "bg-[var(--ca-surface-2)] text-[var(--ca-ink-muted)]"
                }`}
              >
                {d.label.replace("Carte d’électeur", "Carte").replace("Permis de conduire", "Permis")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReadyOnly((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                readyOnly
                  ? "bg-emerald-700 text-white"
                  : "bg-[var(--ca-surface-2)] text-[var(--ca-ink-muted)]"
              }`}
            >
              Prêt au retrait
            </button>
            <button
              type="button"
              onClick={() => setNearMe((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                nearMe
                  ? "bg-emerald-700 text-white"
                  : "bg-[var(--ca-surface-2)] text-[var(--ca-ink-muted)]"
              }`}
            >
              Proche de moi
            </button>
          </div>
        </div>
      ) : null}

      {authNeeded ? (
        <div className="rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-5 text-center">
          <p className="text-sm text-[var(--ca-ink)]">
            Connectez-vous pour voir vos dossiers.
          </p>
          <Link
            href="/login?next=/safefind"
            className="mt-3 inline-flex rounded-xl bg-[var(--ca-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Connexion
          </Link>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}

      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--ca-ink-muted)]">
          Chargement…
        </p>
      ) : null}

      {!loading && !authNeeded && listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--ca-border)] bg-[var(--ca-surface-raised)]/50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--ca-ink)]">
            {hubTab === "marketplace"
              ? "Aucune pièce sécurisée pour ces filtres"
              : hubTab === "orders"
                ? "Aucune restitution en cours"
                : "Aucun dossier pour le moment"}
          </p>
          <p className="mt-1 text-xs text-[var(--ca-ink-muted)]">
            {mode === "lost"
              ? "Déclarez une perte ou ouvrez un dossier avec un SafeFind ID."
              : "Déposez une pièce trouvée au Point SafeFind le plus proche."}
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {listings.map((l) => (
          <SafefindListingCard
            key={l.publicId}
            listing={l}
            mode={hubTab === "marketplace" ? mode : "lost"}
            onFoundCta={() => setComposeOpen(true)}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-[var(--ca-ink-muted)]">
        <Link href="/safefind/partners" className="underline-offset-4 hover:underline">
          Points SafeFind près de moi
        </Link>
        <Link href="/safefind/partner" className="underline-offset-4 hover:underline">
          Espace partenaire
        </Link>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ca-border)] bg-[var(--ca-surface)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className={`flex-1 rounded-xl py-3.5 text-sm font-bold text-white shadow-sm ${
              mode === "lost" ? "bg-amber-500" : "bg-emerald-700"
            }`}
          >
            {mode === "lost" ? "Déclarer une perte" : "Déclarer un trouvé"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {composeOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setComposeOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--ca-surface)] px-4 pb-8 pt-4 shadow-xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[var(--ca-ink)]">{composeTitle}</h2>
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="rounded-lg px-2 py-1 text-sm text-[var(--ca-ink-muted)]"
                >
                  Fermer
                </button>
              </div>
              {mode === "lost" ? (
                <SafefindLostPanel
                  initialTab={searchParams.get("tab") === "search" ? "search" : "declare"}
                  showHeading={false}
                />
              ) : (
                <SafefindFoundPanel showHeading={false} />
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {rulesOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRulesOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="w-full max-w-lg rounded-t-3xl bg-[var(--ca-surface)] p-5 shadow-xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-[var(--ca-ink)]">Comment ça marche</h2>
              <ol className="mt-4 space-y-3 text-sm text-[var(--ca-ink)]">
                <li>
                  <span className="font-semibold text-[var(--ca-accent)]">1.</span> Le
                  trouveur déclare la pièce et la dépose à un Point SafeFind.
                </li>
                <li>
                  <span className="font-semibold text-[var(--ca-accent)]">2.</span> Le
                  propriétaire retrouve le dossier (Marketplace ou déclaration) et
                  revendique.
                </li>
                <li>
                  <span className="font-semibold text-[var(--ca-accent)]">3.</span>{" "}
                  Vérification, puis retrait au Point - jamais de rencontre trouveur /
                  propriétaire.
                </li>
                <li>
                  <span className="font-semibold text-[var(--ca-accent)]">4.</span>{" "}
                  Récompense au trouveur après restitution.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="mt-5 w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-bold text-white"
              >
                Compris
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
