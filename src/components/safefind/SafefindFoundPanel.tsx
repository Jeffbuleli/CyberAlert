"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LocationPicker,
  emptyPickedLocation,
  type PickedLocation,
} from "@/components/safefind/LocationPicker";
import {
  SAFEFIND_DOC_OPTIONS,
  type SafefindDocOption,
} from "@/components/safefind/doc-types";
import { SafefindAssistFields } from "@/components/safefind/SafefindAssistFields";

type DepositPartner = {
  id: string;
  name: string;
  commune: string;
  address: string;
};

type DoneState = {
  message: string;
  casePublicId: string | null;
  depositPartner: DepositPartner | null;
};

export function SafefindFoundPanel({
  showHeading = true,
  onSuccess,
}: {
  showHeading?: boolean;
  onSuccess?: (payload: DoneState) => void;
}) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState<SafefindDocOption>("carte_electeur");
  const [holderFirstName, setHolderFirstName] = useState("");
  const [holderLastName, setHolderLastName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [location, setLocation] = useState<PickedLocation>(emptyPickedLocation());
  const [visualNotes, setVisualNotes] = useState("");
  const [previewMeta, setPreviewMeta] = useState<{
    previewUrl: string;
    previewToken: string;
  } | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [possessionMode, setPossessionMode] = useState<"held" | "deposited">("held");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (location.partners.length > 0 && !selectedPartnerId) {
      setError("Choisissez un Point SafeFind pour le dépôt.");
      return;
    }
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
          partnerIdHint: selectedPartnerId ?? undefined,
          previewUrl: previewMeta?.previewUrl,
          previewToken: previewMeta?.previewToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "kyc_required" ? "Vérification email requise" : data.error ?? "Erreur");
        return;
      }

      const localPartner = selectedPartnerId
        ? location.partners.find((p) => p.id === selectedPartnerId)
        : null;
      const depositPartner: DepositPartner | null =
        data.depositPartner ??
        (localPartner
          ? {
              id: localPartner.id,
              name: localPartner.name,
              commune: localPartner.commune,
              address: "",
            }
          : null);

      const next: DoneState = {
        message: data.message,
        casePublicId: data.casePublicId ?? null,
        depositPartner,
      };
      setDone(next);
      onSuccess?.(next);
      if (data.casePublicId) {
        router.prefetch("/?view=mine&mode=found");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {showHeading ? (
        <>
          <h2 className="text-xl font-semibold text-[var(--ca-ink)]">J’ai retrouvé</h2>
          <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
            Déclarez puis déposez au Point SafeFind le plus proche. Pas de remise en main
            propre au propriétaire.
          </p>
        </>
      ) : null}

      {done ? (
        <div className="mt-5 rounded-2xl border border-[var(--ca-accent)]/30 bg-[var(--ca-surface-raised)] p-5">
          <p className="text-sm leading-relaxed text-[var(--ca-ink)]">{done.message}</p>
          {done.casePublicId ? (
            <p className="mt-3 font-mono text-lg text-[var(--ca-accent)]">{done.casePublicId}</p>
          ) : null}

          {done.depositPartner ? (
            <div className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                Point de dépôt assigné
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--ca-ink)]">
                {done.depositPartner.name}
              </p>
              <p className="text-sm text-[var(--ca-ink-muted)]">
                {done.depositPartner.commune}
                {done.depositPartner.address ? ` · ${done.depositPartner.address}` : ""}
              </p>
              <p className="mt-2 text-xs text-[var(--ca-ink-muted)]">
                Présentez ce dossier au guichet SafeFind du point ci-dessus. Le dépôt est
                gratuit pour le trouveur.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-[var(--ca-ink-muted)]">
              Choisissez un Point SafeFind lors de votre prochaine déclaration pour lier le
              dépôt à votre dossier.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/?view=mine&mode=found"
              className="inline-flex flex-1 justify-center rounded-xl bg-[var(--ca-accent)] px-4 py-2.5 text-sm font-medium text-white"
            >
              Voir mon dossier
            </Link>
            {done.depositPartner ? (
              <Link
                href={`/safefind/partners?partner=${done.depositPartner.id}`}
                className="inline-flex flex-1 justify-center rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-4 py-2.5 text-sm font-medium text-[var(--ca-ink)]"
              >
                Détails du point
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <SafefindAssistFields
            documentType={documentType}
            setDocumentType={setDocumentType}
            setHolderFirstName={setHolderFirstName}
            setHolderLastName={setHolderLastName}
            setDocumentNumber={setDocumentNumber}
            setVisualNotes={setVisualNotes}
            onPreviewCapture={setPreviewMeta}
          />
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

          <LocationPicker
            value={location}
            onChange={(loc) => {
              setLocation(loc);
              setSelectedPartnerId(null);
            }}
            selectedPartnerId={selectedPartnerId}
            onPartnerSelect={setSelectedPartnerId}
            label="Lieu de découverte"
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
            <legend className="text-[var(--ca-ink-muted)]">
              Où se trouve actuellement le document ?
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="poss"
                checked={possessionMode === "held"}
                onChange={() => setPossessionMode("held")}
              />
              Je le détiens encore
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="poss"
                checked={possessionMode === "deposited"}
                onChange={() => setPossessionMode("deposited")}
              />
              Je l’ai déjà déposé chez un partenaire
            </label>
            {possessionMode === "held" ? (
              <p className="text-xs text-[var(--ca-ink-muted)]">
                Conservez le document en sécurité. Ne le remettez pas directement à une
                personne qui prétend en être propriétaire. Utilisez uniquement SafeFind.
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
