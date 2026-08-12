/**
 * Client-side QR detection for CENI carte d'électeur (BarcodeDetector + jsQR fallback).
 */

import jsQR from "jsqr";

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
    return new BD({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function imageDataFromVideo(video: HTMLVideoElement): ImageData | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function imageDataFromCanvas(canvas: HTMLCanvasElement): ImageData | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function detectWithJsQr(imageData: ImageData): string | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  return code?.data?.trim() || null;
}

async function detectWithBarcodeApi(
  source: ImageBitmapSource,
): Promise<string | null> {
  const detector = getBarcodeDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    return codes.find((c) => c.rawValue)?.rawValue?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Try BarcodeDetector then jsQR on a video frame. */
export async function detectQrFromVideo(
  video: HTMLVideoElement,
): Promise<string | null> {
  const fromApi = await detectWithBarcodeApi(video);
  if (fromApi) return fromApi;
  const imageData = imageDataFromVideo(video);
  if (!imageData) return null;
  return detectWithJsQr(imageData);
}

/** Try BarcodeDetector then jsQR on a canvas snapshot. */
export async function detectQrFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const fromApi = await detectWithBarcodeApi(canvas);
  if (fromApi) return fromApi;
  const imageData = imageDataFromCanvas(canvas);
  if (!imageData) return null;
  return detectWithJsQr(imageData);
}
