"use client";

import { useState } from "react";
import Link from "next/link";

const DOCS = [
  { value: "carte_electeur", label: "Carte d'électeur" },
  { value: "passeport", label: "Passeport" },
  { value: "permis_conduire", label: "Permis de conduire" },
] as const;

export default function SafefindLostPage() {
  const [documentType, setDocumentType] = useState("carte_electeur");
  const [holderFirstName, setHolderFirstName] = useState("");
  const [holderLastName, setHolderLastName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [commune, setCommune] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<
    Array<{ publicId: string; scoreBand: string }>
  >([]);

  async function submit(e: React.FormEvent) {
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
          commune: commune || undefined,
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

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/safefind" className="text-sm text-[var(--ca-ink-muted)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">J’ai perdu</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        Déclarez la perte. Le matching reste confidentiel.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="text-[var(--ca-ink-muted)]">Type</span>
          <select
            className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            {DOCS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
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
        <label className="block text-sm">
          <span className="text-[var(--ca-ink-muted)]">Commune de perte</span>
          <input
            className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Recherche…" : "Déclarer"}
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
    </div>
  );
}
