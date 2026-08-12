/**
 * CENI carte d'électeur QR payload (RDC).
 * Format: {14 car. n° sous photo}/{11 car. NN Numéro National}/{11 car. bureau de vote}
 */

export type CeniElecteurQrFields = {
  photoCardNumber: string;
  nationalNumber: string;
  enrollmentBureauCode: string;
};

/** Parse CENI QR slash-separated payload. documentNumber for matching = nationalNumber (NN). */
export function parseCeniElecteurQr(raw: string): CeniElecteurQrFields | null {
  const text = raw.trim().replace(/\s+/g, "");
  if (!text.includes("/")) return null;

  const parts = text.split("/").map((p) => p.trim());
  if (parts.length < 3) return null;

  const photoCardNumber = parts[0].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const nationalNumber = parts[1].replace(/\D/g, "");
  const enrollmentBureauCode = parts[2].replace(/\D/g, "");

  if (photoCardNumber.length !== 14) return null;
  if (nationalNumber.length !== 11) return null;
  if (enrollmentBureauCode.length !== 11) return null;

  return { photoCardNumber, nationalNumber, enrollmentBureauCode };
}

/** Prefer NN (11 digits) over n° carte (14) for carte_electeur identity matching. */
export function resolveCarteElecteurDocumentNumber(
  ocrOrAiNumber: string | null | undefined,
  qr: CeniElecteurQrFields | null,
): string | null {
  if (qr?.nationalNumber) return qr.nationalNumber;
  const n = (ocrOrAiNumber ?? "").replace(/\s+/g, "");
  if (/^\d{11}$/.test(n)) return n;
  return ocrOrAiNumber?.trim() || null;
}
