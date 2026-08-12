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
    return new BD({ formats: ["qr_code", "pdf417", "aztec", "data_matrix"] });
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

  const [cameraOpen, setCameraOpen] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
        setCamErr("Code non reconnu.");
        return;
      }
      if (!sleeveMode && parsed.rawKind === "sleeve") {
        setCamErr("QR pochette partenaire détecté.");
        return;
      }
      onParsed(parsed);
      setCameraOpen(false);
      stopCam();
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
    setAiHint(null);
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCamErr("Caméra non supportée - ouvrez dans Chrome ou Safari.");
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

      if (sleeveMode) {
        const detector = getBarcodeDetector();
        if (detector) {
          const tick = async () => {
            if (!cameraOpen || !videoRef.current || videoRef.current.readyState < 2) {
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
      } else {
        rafRef.current = requestAnimationFrame(liveLoop);
      }
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCamErr(
          "Accès caméra bloqué. Autorisez la caméra via le cadenas dans la barre d'adresse.",
        );
      } else if (name === "NotFoundError") {
        setCamErr("Aucune caméra détectée.");
      } else if (name === "NotReadableError") {
        setCamErr("Caméra occupée par une autre application.");
      } else {
        setCamErr("Impossible d'ouvrir la caméra.");
      }
    } finally {
      setBusy(false);
    }
  }

  function openCamera() {
    setPreview(null);
    setCameraOpen(true);
  }

  function retake() {
    setPreview(null);
    setAiHint(null);
    setCamErr(null);
    setCameraOpen(true);
  }

  async function captureAndAnalyze() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    setBusy(true);
    setCamErr(null);
    setAiHint("McBuleli AI analyse la pièce…");
    try {
      const full = captureVideoFrame(video, 1920);
      let cropped = cropCanvas(full, cropRef.current);

      const aiRes = await fetch("/api/safefind/ai/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrlToBase64(canvasToJpegDataUrl(cropped, 0.92)),
          documentTypeHint: docType,
        }),
      });
      const ai = await aiRes.json();
      if (!aiRes.ok) {
        setCamErr(ai.error ?? "Analyse impossible");
        return;
      }

      if (ai.cropBox?.w > 0.1) {
        cropped = cropCanvas(cropped, ai.cropBox);
      }

      const regions = mergeBlurRegions(
        defaultBlurRegions((ai.documentType as SafefindDocOption) ?? docType),
        normalizeAiRegions(ai.blurRegions),
      );
      applyBlurRegions(cropped, regions, 16);
      const redactedDataUrl = canvasToJpegDataUrl(cropped, 0.88);

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

      setPreview(redactedDataUrl);
      setCameraOpen(false);
      stopCam();

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

      const pct = Math.round((ai.confidence ?? 0.5) * 100);
      setAiHint(
        ai.duplicateCheck?.alreadyListed
          ? ai.duplicateCheck.message
          : `Scan terminé (${pct}%) - cette photo sera publiée sur le Marketplace.`,
      );
    } catch {
      setCamErr("Erreur lors de la capture. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (cameraOpen) void startCam();
    else stopCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  if (sleeveMode) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setCameraOpen((v) => !v)}
          className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-2)] py-2.5 text-sm font-semibold"
        >
          {cameraOpen ? "Fermer le scan" : label}
        </button>
        {cameraOpen ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--ca-border)] bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
            {camErr ? <p className="p-2 text-xs text-amber-600">{camErr}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!cameraOpen && !preview ? (
        <button
          type="button"
          onClick={openCamera}
          className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-2)] py-2.5 text-sm font-semibold text-[var(--ca-ink)]"
        >
          {label}
        </button>
      ) : null}

      {cameraOpen ? (
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
          <div className="space-y-2 bg-[var(--ca-surface-raised)] p-3">
            {camErr ? <p className="text-xs text-amber-600">{camErr}</p> : null}
            {busy && aiHint ? (
              <p className="text-xs text-[var(--ca-accent)]">{aiHint}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void captureAndAnalyze()}
              disabled={busy}
              className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "McBuleli AI analyse…" : "Prendre la photo"}
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(false)}
              disabled={busy}
              className="w-full rounded-xl border border-[var(--ca-border)] py-2 text-sm text-[var(--ca-ink-muted)]"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--ca-ink)]">
            Photo Marketplace (données sensibles brouillées)
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Aperçu pièce brouillée"
            className="w-full rounded-xl border border-[var(--ca-border)]"
          />
          {aiHint ? (
            <p className="mt-2 text-xs text-[var(--ca-accent)]">{aiHint}</p>
          ) : null}
          <button
            type="button"
            onClick={retake}
            className="mt-3 w-full rounded-xl border border-[var(--ca-accent)]/40 bg-[var(--ca-accent)]/10 py-2.5 text-sm font-semibold text-[var(--ca-accent)]"
          >
            Reprendre la photo
          </button>
        </div>
      ) : null}
    </div>
  );
}
