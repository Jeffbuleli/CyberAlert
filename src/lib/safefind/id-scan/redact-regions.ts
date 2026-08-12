/**
 * Normalized blur zones (0–1) for DRC ID previews.
 * Photo zones stay visible for KYC / self-recognition.
 * Only value areas are blurred — labels remain readable when possible.
 */

export type BlurRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  field?: string;
};

export type DocFrame = {
  /** Guide overlay aspect ratio width/height */
  aspect: number;
  label: string;
};

export const DOC_CAPTURE_FRAMES: Record<
  "carte_electeur" | "passeport" | "permis_conduire",
  DocFrame
> = {
  carte_electeur: { aspect: 1.58, label: "Cadrez la carte d'électeur" },
  passeport: { aspect: 1.45, label: "Cadrez la page données du passeport" },
  permis_conduire: { aspect: 1.45, label: "Cadrez le permis de conduire" },
};

/** Default value-only blur zones per document type. */
export function defaultBlurRegions(
  documentType: "carte_electeur" | "passeport" | "permis_conduire",
): BlurRegion[] {
  switch (documentType) {
    case "carte_electeur":
      return [
        { x: 0.4, y: 0.06, w: 0.56, h: 0.11, field: "nn" },
        { x: 0.4, y: 0.2, w: 0.56, h: 0.08, field: "nom" },
        { x: 0.4, y: 0.3, w: 0.56, h: 0.1, field: "post_prenom" },
        { x: 0.4, y: 0.42, w: 0.56, h: 0.14, field: "birth" },
        { x: 0.02, y: 0.76, w: 0.3, h: 0.12, field: "photo_number" },
        { x: 0.68, y: 0.52, w: 0.28, h: 0.4, field: "qr" },
        { x: 0.02, y: 0.86, w: 0.96, h: 0.12, field: "mrz" },
      ];
    case "passeport":
      return [
        { x: 0.36, y: 0.1, w: 0.6, h: 0.06, field: "passport_no" },
        { x: 0.36, y: 0.18, w: 0.6, h: 0.05, field: "nom" },
        { x: 0.36, y: 0.25, w: 0.6, h: 0.05, field: "postnom" },
        { x: 0.36, y: 0.32, w: 0.6, h: 0.05, field: "prenom" },
        { x: 0.36, y: 0.4, w: 0.6, h: 0.05, field: "birth_place" },
        { x: 0.36, y: 0.47, w: 0.6, h: 0.05, field: "birth_date" },
        { x: 0.36, y: 0.54, w: 0.6, h: 0.04, field: "nationality" },
        { x: 0.36, y: 0.6, w: 0.6, h: 0.14, field: "dates_authority" },
        { x: 0.52, y: 0.7, w: 0.44, h: 0.1, field: "signature" },
        { x: 0.02, y: 0.8, w: 0.96, h: 0.18, field: "mrz" },
      ];
    case "permis_conduire":
      return [
        { x: 0.38, y: 0.08, w: 0.56, h: 0.1, field: "permis_no" },
        { x: 0.38, y: 0.2, w: 0.56, h: 0.08, field: "nom" },
        { x: 0.38, y: 0.3, w: 0.56, h: 0.1, field: "post_prenom" },
        { x: 0.38, y: 0.42, w: 0.56, h: 0.14, field: "birth" },
        { x: 0.02, y: 0.76, w: 0.3, h: 0.12, field: "photo_number" },
        { x: 0.02, y: 0.88, w: 0.96, h: 0.1, field: "mrz" },
      ];
  }
}

export function mergeBlurRegions(
  base: BlurRegion[],
  extra: BlurRegion[] | null | undefined,
): BlurRegion[] {
  if (!extra?.length) return base;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const normalized = extra
    .filter((r) => r.w > 0.01 && r.h > 0.01)
    .map((r) => ({
      x: clamp(r.x),
      y: clamp(r.y),
      w: clamp(r.w),
      h: clamp(r.h),
      field: r.field,
    }));
  return [...base, ...normalized];
}

export function normalizeAiRegions(raw: unknown): BlurRegion[] {
  if (!Array.isArray(raw)) return [];
  const out: BlurRegion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const x = Number(r.x);
    const y = Number(r.y);
    const w = Number(r.w ?? r.width);
    const h = Number(r.h ?? r.height);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (w <= 0 || h <= 0) continue;
    out.push({
      x,
      y,
      w,
      h,
      field: typeof r.field === "string" ? r.field : undefined,
    });
  }
  return out;
}

/**
 * Drop unsafe AI blur regions that would hide the whole document or the portrait.
 * SafeFind keeps the document photo visible for recognition/KYC.
 */
export function sanitizeAiBlurRegions(
  documentType: "carte_electeur" | "passeport" | "permis_conduire",
  regions: BlurRegion[],
): BlurRegion[] {
  const blockedFields = new Set(["photo", "portrait", "face", "selfie"]);
  const maxArea = documentType === "carte_electeur" ? 0.22 : 0.3;

  return regions.filter((r) => {
    const field = String(r.field ?? "").toLowerCase();
    if (blockedFields.has(field)) return false;
    if (r.w * r.h > maxArea) return false;
    if (r.w > 0.92 || r.h > 0.92) return false;
    return true;
  });
}
