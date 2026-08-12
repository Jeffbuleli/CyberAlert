"use client";

import { useState } from "react";
import type { SafefindDocOption } from "@/components/safefind/doc-types";
import {
  IdScanCapture,
  type DocumentCaptureResult,
} from "@/components/safefind/IdScanCapture";
import type { ParsedIdFields } from "@/lib/safefind/id-scan/parse";

type Props = {
  documentType: SafefindDocOption;
  setDocumentType: (v: SafefindDocOption) => void;
  setHolderFirstName: (v: string) => void;
  setHolderLastName: (v: string) => void;
  setDocumentNumber: (v: string) => void;
  setVisualNotes?: (v: string) => void;
  onPreviewCapture?: (preview: {
    previewUrl: string;
    previewToken: string;
  }) => void;
  scanLabel?: string;
};

export function SafefindAssistFields({
  documentType,
  setDocumentType,
  setHolderFirstName,
  setHolderLastName,
  setDocumentNumber,
  setVisualNotes,
  onPreviewCapture,
  scanLabel = "Photographier la pièce",
}: Props) {
  const [aiHint, setAiHint] = useState<string | null>(null);

  function applyScan(fields: ParsedIdFields) {
    if (fields.documentType) setDocumentType(fields.documentType);
    if (fields.holderFirstName) setHolderFirstName(fields.holderFirstName);
    if (fields.holderLastName) setHolderLastName(fields.holderLastName);
    if (fields.documentNumber) setDocumentNumber(fields.documentNumber);
    if (fields.birthDate && setVisualNotes) {
      setVisualNotes(`Année de naissance: ${fields.birthDate.slice(0, 4)}`);
    }
  }

  function applyDocumentCapture(result: DocumentCaptureResult) {
    applyScan(result.fields);
    onPreviewCapture?.({
      previewUrl: result.previewUrl,
      previewToken: result.previewToken,
    });
    const pct = Math.round((result.fields.confidence ?? 0.5) * 100);
    setAiHint(
      result.duplicateWarning ??
        `McBuleli AI a rempli les champs (${pct}%) - vérifiez avant d'envoyer.`,
    );
  }

  return (
    <div className="space-y-3">
      <IdScanCapture
        onParsed={applyScan}
        onDocumentCapture={applyDocumentCapture}
        documentTypeHint={documentType}
        label={scanLabel}
      />
      {aiHint ? (
        <p className="text-xs text-[var(--ca-ink-muted)]">✦ {aiHint}</p>
      ) : null}
    </div>
  );
}
