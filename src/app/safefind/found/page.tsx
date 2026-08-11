"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LocationPicker,
  emptyPickedLocation,
  type PickedLocation,
} from "@/components/safefind/LocationPicker";

const DOCS = [
  { value: "carte_electeur", label: "Carte d'electeur" },
  { value: "passeport", label: "Passeport" },
  { value: "permis_conduire", label: "Permis de conduire" },
] as const;

export default function SafefindFoundPage() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState<string>("carte_electeur");
  const [holderFirstName, setHolderFirstName] = useState("");
  const [holderLastName, setHolderLastName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [location, setLocation] = useState<PickedLocation>(emptyPickedLocation());
  const [visualNotes, setVisualNotes] = useState("");
  const [possessionMode, setPossessionMode] = useState<"held" | "deposited">("held");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    message: string;
    casePublicId: string | null;
    nearbyPartners: Array<{ id: string; name: string; distanceKm: number }>;
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
          commune: location.commune || undefined,
          quartier: location.quartier || location.landmark || undefined,
          visualNotes: visualNotes || undefined,
          possessionMode,
          locationId: location.locationId || undefined,
          latitude: location.latitude ?? undefined,
          longitude: location.longitude ?? undefined,
          locationPrecision: location.precision || undefined,
          partnerIdHint: location.partners[0]?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "kyc_required" ? "KYC requis" : data.error ?? "Erreur");
        return;
      }
      setDone({
        message: data.message,
        casePublicId: data.casePublicId,
        nearbyPartners: data.nearbyPartners ?? location.partners,
      });
      if (data.casePublicId) {
        router.prefetch(`/safefind/cases/${data.casePublicId}`);
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/safefind" className="text-sm text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">J&apos;ai trouve</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        Declarez puis deposez au Point SafeFind le plus proche. Pas de rencontre avec le
        proprietaire.
      </p>

      {done ? (
        <div className="mt-8 rounded-2xl border border-[var(--ca-accent)]/30 bg-[var(--ca-surface-raised)] p-5">
          <p className="text-sm leading-relaxed text-[var(--ca-ink)]">{done.message}</p>
          {done.casePublicId ? (
            <p className="mt-3 font-mono text-lg text-[var(--ca-accent)]">{done.casePublicId}</p>
          ) : null}
          {done.nearbyPartners?.length ? (
            <ul className="mt-4 space-y-1 text-sm text-[var(--ca-ink-muted)]">
              <li className="font-medium text-[var(--ca-ink)]">Deposez au point le plus proche</li>
              {done.nearbyPartners.slice(0, 5).map((p) => (
                <li key={p.id}>
                  {p.name} - {Number(p.distanceKm).toFixed(1)} km
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href="/safefind/partners"
            className="mt-5 inline-flex rounded-xl bg-[var(--ca-accent)] px-4 py-2.5 text-sm font-medium text-white"
          >
            Voir les points
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
              <span className="text-[var(--ca-ink-muted)]">Prenom (visible)</span>
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

          <LocationPicker
            value={location}
            onChange={setLocation}
            label="Lieu de decouverte"
          />

          <label className="block text-sm">
            <span className="text-[var(--ca-ink-muted)]">Apparence</span>
            <textarea
              className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5"
              rows={3}
              value={visualNotes}
              onChange={(e) => setVisualNotes(e.target.value)}
            />
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="text-[var(--ca-ink-muted)]">Ou se trouve actuellement le document ?</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="poss" checked={possessionMode === "held"} onChange={() => setPossessionMode("held")} />
              Je le detiens encore
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="poss" checked={possessionMode === "deposited"} onChange={() => setPossessionMode("deposited")} />
              Je l&apos;ai deja depose chez un partenaire
            </label>
            {possessionMode === "held" ? (
              <p className="text-xs text-[var(--ca-ink-muted)]">
                Conservez le document en securite. Ne le remettez pas directement a une personne qui pretend en etre proprietaire. Utilisez uniquement SafeFind.
              </p>
            ) : null}
          </fieldset>
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
