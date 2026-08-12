"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SafefindDocOption } from "@/components/safefind/doc-types";
import {
  parseIdScanPayload,
  type ParsedIdFields,
} from "@/lib/safefind/id-scan/parse";
import {
  applyBlurRegions,
  canvasToJpegDataUrl,
  captureVideoFrame,
  cropCanvas,
  dataUrlToBase64,
  drawLiveBlurOverlay,
  guideCropRect,
} from "@/lib/safefind/id-scan/redact-canvas";
import {
  defaultBlurRegions,
  DOC_CAPTURE_FRAMES,
  mergeBlurRegions,
  normalizeAiRegions,
} from "@/lib/safefind/id-scan/redact-regions";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const BD = (
    globalThis as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!BD) return null;
  try {
    return new BD({
      formats: ["qr_code", "pdf417", "aztec", "data_matrix", "code_128"],
    });
  } catch {
    try {
      return new BD({ formats: ["qr_code"] });
    } catch {
      return null;
    }
  }
}

export type DocumentCaptureResult = {
  fields: ParsedIdFields;
  previewUrl: string;
  previewToken: string;
  redactedPreviewDataUrl: string;
  duplicateWarning?: string | null;
};

type Props = {
  onParsed: (fields: ParsedIdFields) => void;
  onDocumentCapture?: (result: DocumentCaptureResult) => void;
  documentTypeHint?: SafefindDocOption;
  sleeveMode?: boolean;
  label?: string;
};

export function IdScanCapture({
  onParsed,
  onDocumentCapture,
  documentTypeHint = "carte_electeur",
  sleeveMode = false,
  label = "Photographier la pièce",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cropRef = useRef({ x: 0.04, y: 0.06, w: 0.92, h: 0.88 });

  const [open, setOpen] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);

  const docType = documentTypeHint;
  const frame = DOC_CAPTURE_FRAMES[docType];
  const blurRegions = defaultBlurRegions(docType);

  const stopCam = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  const emitRaw = useCallback(
    (raw: string) => {
      const parsed = parseIdScanPayload(raw);
      if (!parsed) {
        setCamErr("Code non reconnu - collez le texte ou saisissez manuellement.");
        return;
      }
      if (!sleeveMode && parsed.rawKind === "sleeve") {
        setCamErr("Ceci semble être un QR de pochette partenaire, pas une pièce.");
        return;
      }
      onParsed(parsed);
      setOpen(false);
      stopCam();
      setManual("");
      setCamErr(null);
    },
    [onParsed, sleeveMode, stopCam],
  );

  const liveLoop = useCallback(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(liveLoop);
      return;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      rafRef.current = requestAnimationFrame(liveLoop);
      return;
    }
    if (overlay.width !== vw || overlay.height !== vh) {
      overlay.width = vw;
      overlay.height = vh;
    }
    cropRef.current = guideCropRect(vw, vh, frame.aspect);
    drawLiveBlurOverlay(overlay, video, blurRegions, cropRef.current);
    rafRef.current = requestAnimationFrame(liveLoop);
  }, [blurRegions, frame.aspect]);

  async function startCam() {
    setCamErr(null);
    setBusy(true);
    setPreview(null);
    setAiHint(null);
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCamErr(
          "Caméra non supportée ici - ouvrez dans Chrome/Safari ou choisissez une photo.",
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("no_video");
      video.setAttribute("playsinline", "true");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      rafRef.current = requestAnimationFrame(liveLoop);

      const detector = getBarcodeDetector();
      if (detector && sleeveMode) {
        const tick = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            requestAnimationFrame(tick);
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes.find((c) => c.rawValue)?.rawValue;
            if (raw) {
              emitRaw(raw);
              return;
            }
          } catch {
            // keep scanning
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCamErr(
          "Accès caméra bloqué. Appuyez sur le cadenas dans la barre d'adresse et autorisez la caméra.",
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCamErr("Aucune caméra détectée sur cet appareil.");
      } else if (name === "NotReadableError") {
        setCamErr("Caméra occupée par une autre application.");
      } else {
        setCamErr("Impossible d'ouvrir la caméra. Rechargez la page.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function captureAndAnalyze() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    setBusy(true);
    setCamErr(null);
    setAiHint("McBuleli AI analyse la pièce…");
    try {
      const full = captureVideoFrame(video, 1920);
      const crop = cropRef.current;
      let cropped = cropCanvas(full, crop);

      const aiCropRes = await fetch("/api/safefind/ai/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrlToBase64(canvasToJpegDataUrl(cropped, 0.92)),
          documentTypeHint: docType,
        }),
      });
      const ai = await aiCropRes.json();
      if (!aiCropRes.ok) {
        setCamErr(ai.error ?? "Analyse impossible");
        return;
      }

      if (ai.cropBox && ai.cropBox.w > 0.1) {
        cropped = cropCanvas(cropped, ai.cropBox);
      }

      const regions = mergeBlurRegions(
        defaultBlurRegions(
          (ai.documentType as SafefindDocOption) ?? docType,
        ),
        normalizeAiRegions(ai.blurRegions),
      );
      applyBlurRegions(cropped, regions, 16);
      const redactedDataUrl = canvasToJpegDataUrl(cropped, 0.88);
      setPreview(redactedDataUrl);

      const storeRes = await fetch("/api/safefind/preview/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: redactedDataUrl }),
      });
      const stored = await storeRes.json();
      if (!storeRes.ok) {
        setCamErr(stored.error ?? "Enregistrement preview impossible");
        return;
      }

      const fields: ParsedIdFields = {
        documentType: ai.documentType ?? docType,
        holderFirstName: ai.holderFirstName ?? null,
        holderLastName: ai.holderLastName ?? ai.holderPostName ?? null,
        documentNumber: ai.documentNumber ?? null,
        birthDate: ai.birthDate ?? null,
        source: "photo",
        confidence: ai.confidence ?? 0.6,
        rawKind: "photo",
      };
      onParsed(fields);

      if (onDocumentCapture) {
        onDocumentCapture({
          fields,
          previewUrl: stored.previewUrl,
          previewToken: stored.previewToken,
          redactedPreviewDataUrl: redactedDataUrl,
          duplicateWarning: ai.duplicateCheck?.alreadyListed
            ? ai.duplicateCheck.message
            : null,
        });
      }

      const pct = Math.round((ai.confidence ?? 0.5) * 100);
      setAiHint(
        ai.duplicateCheck?.alreadyListed
          ? `${ai.duplicateCheck.message} (${pct}% confiance)`
          : `Champs remplis par McBuleli AI (${pct}%) - vérifiez avant d'envoyer.`,
      );
    } catch {
      setCamErr("Erreur lors de la capture. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function onFilePick(file: File | null) {
    if (!file) return;
    setBusy(true);
    setCamErr(null);
    setAiHint("McBuleli AI analyse la photo…");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      const aiCropRes = await fetch("/api/safefind/ai/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrlToBase64(canvasToJpegDataUrl(canvas, 0.92)),
          documentTypeHint: docType,
        }),
      });
      const ai = await aiCropRes.json();
      if (!aiCropRes.ok) {
        setCamErr(ai.error ?? "Analyse impossible");
        return;
      }

      let cropped = canvas;
      if (ai.cropBox && ai.cropBox.w > 0.1) {
        cropped = cropCanvas(canvas, ai.cropBox);
      } else {
        cropRef.current = guideCropRect(
          canvas.width,
          canvas.height,
          frame.aspect,
        );
        cropped = cropCanvas(canvas, cropRef.current);
      }

      const regions = mergeBlurRegions(
        defaultBlurRegions(
          (ai.documentType as SafefindDocOption) ?? docType,
        ),
        normalizeAiRegions(ai.blurRegions),
      );
      applyBlurRegions(cropped, regions, 16);
      const redactedDataUrl = canvasToJpegDataUrl(cropped, 0.88);
      setPreview(redactedDataUrl);

      const storeRes = await fetch("/api/safefind/preview/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: redactedDataUrl }),
      });
      const stored = await storeRes.json();
      if (!storeRes.ok) {
        setCamErr(stored.error ?? "Enregistrement preview impossible");
        return;
      }

      const fields: ParsedIdFields = {
        documentType: ai.documentType ?? docType,
        holderFirstName: ai.holderFirstName ?? null,
        holderLastName: ai.holderLastName ?? ai.holderPostName ?? null,
        documentNumber: ai.documentNumber ?? null,
        birthDate: ai.birthDate ?? null,
        source: "photo",
        confidence: ai.confidence ?? 0.6,
        rawKind: "photo",
      };
      onParsed(fields);
      onDocumentCapture?.({
        fields,
        previewUrl: stored.previewUrl,
        previewToken: stored.previewToken,
        redactedPreviewDataUrl: redactedDataUrl,
        duplicateWarning: ai.duplicateCheck?.alreadyListed
          ? ai.duplicateCheck.message
          : null,
      });

      setAiHint("Photo analysée - vérifiez les champs.");
    } catch {
      setCamErr("Impossible de lire cette image.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) void startCam();
    else stopCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-2)] py-2.5 text-sm font-semibold text-[var(--ca-ink)]"
      >
        {open ? "Fermer la caméra" : label}
      </button>

      {open ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--ca-border)] bg-black/90">
          <div className="relative aspect-[3/4] w-full bg-black sm:aspect-[4/3]">
            <video
              ref={videoRef}
              id={`safefind-scan-${uid}`}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted
            />
            <canvas
              ref={overlayRef}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
            <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs font-semibold text-sky-200 drop-shadow">
              {frame.label}
            </p>
          </div>

          {preview ? (
            <div className="border-t border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--ca-ink)]">
                Aperçu Marketplace (données sensibles brouillées)
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Aperçu pièce brouillée"
                className="w-full rounded-xl border border-[var(--ca-border)]"
              />
            </div>
          ) : null}

          <div className="space-y-2 bg-[var(--ca-surface-raised)] p-3">
            {camErr ? <p className="text-xs text-amber-600">{camErr}</p> : null}
            {aiHint ? (
              <p className="text-xs text-[var(--ca-accent)]">{aiHint}</p>
            ) : null}
            {busy ? (
              <p className="text-xs text-[var(--ca-ink-muted)]">
                {aiHint ? "Traitement…" : "Démarrage caméra HD…"}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void captureAndAnalyze()}
              disabled={busy}
              className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "McBuleli AI analyse…" : "Prendre la photo"}
            </button>

            <label className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-[var(--ca-border)] py-2.5 text-sm font-semibold text-[var(--ca-ink)]">
              Choisir une photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => void onFilePick(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="w-full text-xs text-[var(--ca-ink-muted)] underline"
            >
              {showManual ? "Masquer QR / MRZ manuel" : "Coller QR / MRZ à la place"}
            </button>

            {showManual ? (
              <>
                <textarea
                  className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2 font-mono text-xs"
                  rows={3}
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="P<COD… ou JSON / n° document"
                />
                <button
                  type="button"
                  onClick={() => emitRaw(manual)}
                  disabled={!manual.trim()}
                  className="w-full rounded-xl border border-[var(--ca-accent)]/40 bg-[var(--ca-accent)]/10 py-2.5 text-sm font-semibold text-[var(--ca-accent)] disabled:opacity-50"
                >
                  Utiliser ce code
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
