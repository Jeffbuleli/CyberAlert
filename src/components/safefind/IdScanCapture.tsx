"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  parseIdScanPayload,
  type ParsedIdFields,
} from "@/lib/safefind/id-scan/parse";

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

type Props = {
  onParsed: (fields: ParsedIdFields) => void;
  /** When true, prefer sleeve-style tokens without requiring identity fields. */
  sleeveMode?: boolean;
  label?: string;
};

export function IdScanCapture({
  onParsed,
  sleeveMode = false,
  label = "Scanner la pièce",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

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
        setCamErr("Code non reconnu — collez le texte ou saisissez manuellement.");
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

  async function startCam() {
    setCamErr(null);
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("no_video");
      video.srcObject = stream;
      await video.play();

      const detector = getBarcodeDetector();
      if (!detector) {
        setCamErr(
          "Scan caméra limité sur ce navigateur — collez le contenu QR/MRZ ci-dessous.",
        );
        setBusy(false);
        return;
      }

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
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
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCamErr("Caméra indisponible — autorisez l’accès ou collez le code.");
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
        {open ? "Fermer le scan" : label}
      </button>

      {open ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--ca-border)] bg-black/90">
          <video
            ref={videoRef}
            id={`safefind-scan-${uid}`}
            className="aspect-[4/3] w-full object-cover"
            playsInline
            muted
          />
          <div className="space-y-2 bg-[var(--ca-surface-raised)] p-3">
            {camErr ? <p className="text-xs text-amber-600">{camErr}</p> : null}
            {busy ? (
              <p className="text-xs text-[var(--ca-ink-muted)]">Démarrage caméra…</p>
            ) : null}
            <label className="block text-xs text-[var(--ca-ink-muted)]">
              Coller QR / MRZ
              <textarea
                className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2 font-mono text-xs"
                rows={3}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="P&lt;COD… ou JSON / n° document"
              />
            </label>
            <button
              type="button"
              onClick={() => emitRaw(manual)}
              disabled={!manual.trim()}
              className="w-full rounded-xl bg-[var(--ca-accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Utiliser ce code
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
