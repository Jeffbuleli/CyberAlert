"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LocationPicker,
  emptyPickedLocation,
  type PickedLocation,
} from "@/components/safefind/LocationPicker";
import {
  SAFEFIND_DOC_OPTIONS,
  type SafefindDocOption,
} from "@/components/safefind/doc-types";

type LostTab = "declare" | "search";

export function SafefindLostPanel({
  initialTab = "declare",
  showHeading = true,
}: {
  initialTab?: LostTab;
  showHeading?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<LostTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function selectTab(next: LostTab) {
    setTab(next);
    const q = new URLSearchParams(searchParams.toString());
    q.set("mode", "lost");
    if (next === "search") q.set("tab", "search");
    else q.delete("tab");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }
  const [documentType, setDocumentType] = useState<SafefindDocOption>("carte_electeur");
  const [holderFirstName, setHolderFirstName] = useState("");
  const [holderLastName, setHolderLastName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [location, setLocation] = useState<PickedLocation>(emptyPickedLocation());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<
    Array<{ publicId: string; scoreBand: string }>
  >([]);
  const [publicId, setPublicId] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  async function submitDeclare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/safefind/lost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          holderFirstName: holderFirstName || undefined,
          holderLastName: holderLastName || undefined,
          documentNumber: documentNumber || undefined,
          commune: location.commune || undefined,
          quartier: location.quartier || location.landmark || undefined,
          locationId: location.locationId || undefined,
          latitude: location.latitude ?? undefined,
          longitude: location.longitude ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setCandidates(data.candidates ?? []);
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    const id = publicId.trim().toUpperCase();
    if (!/^SF-\d{4}-\d{6}$/.test(id)) {
      setSearchError("Format attendu : SF-2026-000001");
      return;
    }
    const res = await fetch(`/api/safefind/cases/${id}`);
    if (!res.ok) {
      setSearchError("Dossier introuvable");
      return;
    }
    router.push(`/safefind/cases/${id}`);
  }

  return (
    <div>
      {showHeading ? (
        <>
          <h2 className="text-xl font-semibold text-[var(--ca-ink)]">J’ai perdu</h2>
          <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
            Déclarez la perte ou ouvrez un dossier avec un SafeFind ID. Aucune rencontre
            avec le trouveur.
          </p>
        </>
      ) : null}

      <div
        className="mt-4 flex rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)]/60 p-1"
        role="tablist"
        aria-label="Actions propriétaire"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "declare"}
          onClick={() => selectTab("declare")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === "declare"
              ? "bg-[var(--ca-accent)] text-white"
              : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
          }`}
        >
          Déclarer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "search"}
          onClick={() => selectTab("search")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === "search"
              ? "bg-[var(--ca-accent)] text-white"
              : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
          }`}
        >
          J’ai un ID
        </button>
      </div>

      {tab === "declare" ? (
        <>
          <form onSubmit={submitDeclare} className="mt-5 space-y-4">
            <fieldset>
              <legend className="text-sm text-[var(--ca-ink-muted)]">Type de pièce</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SAFEFIND_DOC_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDocumentType(d.value)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      documentType === d.value
                        ? "border-[var(--ca-accent)] bg-[var(--ca-accent)]/10 font-semibold text-[var(--ca-ink)]"
                        : "border-[var(--ca-border)] bg-[var(--ca-surface-raised)] text-[var(--ca-ink-muted)] hover:border-[var(--ca-accent)]/40"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-[var(--ca-ink-muted)]">Prénom</span>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
                  value={holderFirstName}
                  onChange={(e) => setHolderFirstName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--ca-ink-muted)]">Nom</span>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
                  value={holderLastName}
                  onChange={(e) => setHolderLastName(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-[var(--ca-ink-muted)]">N° (si connu)</span>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </label>
            <LocationPicker
              value={location}
              onChange={setLocation}
              label="Lieu de perte"
            />
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Recherche…" : "Déclarer la perte"}
            </button>
          </form>

          {candidates.length > 0 ? (
            <ul className="mt-8 space-y-2">
              {candidates.map((c) => (
                <li key={c.publicId}>
                  <Link
                    href={`/safefind/cases/${c.publicId}`}
                    className="flex items-center justify-between rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-4 py-3"
                  >
                    <span className="font-mono text-sm">{c.publicId}</span>
                    <span className="text-xs text-[var(--ca-ink-muted)]">{c.scoreBand}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <form onSubmit={submitSearch} className="mt-5 space-y-3">
          <p className="text-sm text-[var(--ca-ink-muted)]">
            Si vous avez déjà un numéro de dossier (affiché au Point SafeFind ou reçu par
            message), ouvrez-le ici.
          </p>
          <input
            className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-3 font-mono text-sm tracking-wide"
            placeholder="SF-2026-000001"
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            autoComplete="off"
          />
          {searchError ? <p className="text-sm text-red-400">{searchError}</p> : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-semibold text-white"
          >
            Ouvrir le dossier
          </button>
        </form>
      )}
    </div>
  );
}
