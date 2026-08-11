"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DOCS = [
  { value: "carte_electeur", label: "Carte d'électeur" },
  { value: "passeport", label: "Passeport" },
  { value: "permis_conduire", label: "Permis de conduire" },
] as const;

export default function SafefindFoundPage() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState<string>("carte_electeur");
  const [holderFirstName, setHolderFirstName] = useState("");
  const [holderLastName, setHolderLastName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [commune, setCommune] = useState("");
  const [visualNotes, setVisualNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    message: string;
    casePublicId: string | null;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/safefind/found", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          holderFirstName: holderFirstName || undefined,
          holderLastName: holderLastName || undefined,
          documentNumber: documentNumber || undefined,
          commune: commune || undefined,
          visualNotes: visualNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "kyc_required" ? "KYC requis" : data.error ?? "Erreur");
        return;
      }
      setDone({ message: data.message, casePublicId: data.casePublicId });
      if (data.casePublicId) {
        router.prefetch(`/safefind/cases/${data.casePublicId}`);
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/safefind" className="text-sm text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">J’ai trouvé</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        Déclarez puis déposez au Point SafeFind le plus proche. Pas de rencontre avec le
        propriétaire.
      </p>

      {done ? (
        <div className="mt-8 rounded-2xl border border-[var(--ca-accent)]/30 bg-[var(--ca-surface-raised)] p-5">
          <p className="text-sm leading-relaxed text-[var(--ca-ink)]">{done.message}</p>
          {done.casePublicId ? (
            <p className="mt-3 font-mono text-lg text-[var(--ca-accent)]">{done.casePublicId}</p>
          ) : null}
          <Link
            href="/safefind/partners"
            className="mt-5 inline-flex rounded-xl bg-[var(--ca-accent)] px-4 py-2.5 text-sm font-medium text-white"
          >
            Choisir un point
          </Link>
        </div>
      ) : (
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
              <span className="text-[var(--ca-ink-muted)]">Prénom (visible)</span>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
                value={holderFirstName}
                onChange={(e) => setHolderFirstName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--ca-ink-muted)]">Nom (visible)</span>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
                value={holderLastName}
                onChange={(e) => setHolderLastName(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--ca-ink-muted)]">N° document (optionnel)</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ca-ink-muted)]">Commune de découverte</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              placeholder="ex. Ngaliema"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ca-ink-muted)]">Apparence</span>
            <textarea
              className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
              rows={3}
              value={visualNotes}
              onChange={(e) => setVisualNotes(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Envoi…" : "Enregistrer"}
          </button>
        </form>
      )}
    </div>
  );
}
