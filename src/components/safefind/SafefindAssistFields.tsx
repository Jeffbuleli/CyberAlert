"use client";

import { useState } from "react";
import type { SafefindDocOption } from "@/components/safefind/doc-types";
import {
  emptyPickedLocation,
  type PickedLocation,
} from "@/components/safefind/LocationPicker";
import { IdScanCapture } from "@/components/safefind/IdScanCapture";
import type { ParsedIdFields } from "@/lib/safefind/id-scan/parse";

type Props = {
  documentType: SafefindDocOption;
  setDocumentType: (v: SafefindDocOption) => void;
  setHolderFirstName: (v: string) => void;
  setHolderLastName: (v: string) => void;
  setDocumentNumber: (v: string) => void;
  setLocation: (v: PickedLocation) => void;
  setVisualNotes?: (v: string) => void;
  scanLabel?: string;
};

export function SafefindAssistFields({
  documentType,
  setDocumentType,
  setHolderFirstName,
  setHolderLastName,
  setDocumentNumber,
  setLocation,
  setVisualNotes,
  scanLabel = "Scanner la pièce (QR / MRZ)",
}: Props) {
  const [freeText, setFreeText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [suggested, setSuggested] = useState(false);

  function applyScan(fields: ParsedIdFields) {
    if (fields.documentType) setDocumentType(fields.documentType);
    if (fields.holderFirstName) setHolderFirstName(fields.holderFirstName);
    if (fields.holderLastName) setHolderLastName(fields.holderLastName);
    if (fields.documentNumber) setDocumentNumber(fields.documentNumber);
    setSuggested(true);
    setAiHint("Champs préremplis depuis le scan — vérifiez avant d’envoyer.");
  }

  async function runNlParse() {
    if (freeText.trim().length < 3) return;
    setAiBusy(true);
    setAiHint(null);
    try {
      const res = await fetch("/api/safefind/ai/parse-declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: freeText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiHint(data.error ?? "Analyse impossible");
        return;
      }
      if (data.documentType) setDocumentType(data.documentType as SafefindDocOption);
      if (data.visualHints && setVisualNotes) {
        const hints = Object.entries(data.visualHints as Record<string, string>)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        if (hints) setVisualNotes(hints);
      }

      const locationText = String(data.locationText || freeText).trim();
      if (locationText) {
        const precisionMap: Record<string, string> = {
          commune: "COMMUNE",
          quartier: "QUARTER",
          landmark: "LANDMARK",
          gps: "EXACT",
        };
        const precision =
          precisionMap[String(data.locationPrecision || "landmark")] || "LANDMARK";
        const resolveRes = await fetch("/api/safefind/locations/resolve", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "geocode",
            address: locationText,
            landmark: locationText,
            precision,
          }),
        });
        const loc = await resolveRes.json().catch(() => null);
        if (resolveRes.ok && loc) {
          setLocation({
            locationId: loc.locationId ?? null,
            commune: loc.commune ?? "",
            quartier: loc.quartier ?? "",
            landmark: loc.landmark ?? locationText,
            latitude: loc.latitude ?? null,
            longitude: loc.longitude ?? null,
            precision: loc.precision ?? precision,
            label: loc.label ?? locationText,
            partners: loc.partners ?? [],
          });
        } else {
          setLocation({
            ...emptyPickedLocation(),
            landmark: locationText,
            label: locationText,
            precision,
          });
        }
      }

      setSuggested(true);
      setAiHint(
        `Suggéré par McBuleli AI (${Math.round((data.confidence ?? 0) * 100)}%) — modifiable.`,
      );
    } catch {
      setAiHint("Erreur réseau");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <IdScanCapture onParsed={applyScan} label={scanLabel} />
      <label className="block text-sm">
        <span className="text-[var(--ca-ink-muted)]">Décrire librement (FR / Lingala)</span>
        <textarea
          className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5 text-sm"
          rows={3}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Ex. J’ai perdu mon permis près de l’UPN samedi vers 18h"
        />
      </label>
      <button
        type="button"
        disabled={aiBusy || freeText.trim().length < 3}
        onClick={() => void runNlParse()}
        className="w-full rounded-xl border border-[var(--ca-accent)]/40 bg-[var(--ca-accent)]/10 py-2.5 text-sm font-semibold text-[var(--ca-accent)] disabled:opacity-50"
      >
        {aiBusy ? "McBuleli AI analyse…" : "Remplir avec McBuleli AI"}
      </button>
      {aiHint ? (
        <p className="text-xs text-[var(--ca-ink-muted)]">
          {suggested ? "✦ " : ""}
          {aiHint}
          <span className="sr-only"> type actuel {documentType}</span>
        </p>
      ) : null}
    </div>
  );
}
