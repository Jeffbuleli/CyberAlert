import type { BlurRegion } from "@/lib/safefind/id-scan/redact-regions";

export type NormRect = { x: number; y: number; w: number; h: number };

/** Crop normalized rect from source canvas into a new canvas. */
export function cropCanvas(
  source: HTMLCanvasElement,
  rect: NormRect,
): HTMLCanvasElement {
  const sw = source.width;
  const sh = source.height;
  const x = Math.round(rect.x * sw);
  const y = Math.round(rect.y * sh);
  const w = Math.max(1, Math.round(rect.w * sw));
  const h = Math.max(1, Math.round(rect.h * sh));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
  return out;
}

/** Capture a high-res frame from video into canvas. */
export function captureVideoFrame(
  video: HTMLVideoElement,
  maxEdge = 1920,
): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("video_not_ready");
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

/** Compute normalized crop box for centered guide frame overlay. */
export function guideCropRect(
  sourceW: number,
  sourceH: number,
  frameAspect: number,
): NormRect {
  const sourceAspect = sourceW / sourceH;
  let w: number;
  let h: number;
  if (sourceAspect > frameAspect) {
    h = 0.92;
    w = h * frameAspect * (sourceH / sourceW);
  } else {
    w = 0.92;
    h = w / frameAspect * (sourceW / sourceH);
  }
  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    w,
    h,
  };
}

export function applyBlurRegions(
  canvas: HTMLCanvasElement,
  regions: BlurRegion[],
  blurPx = 14,
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const w = canvas.width;
  const h = canvas.height;

  for (const r of regions) {
    const rx = Math.round(r.x * w);
    const ry = Math.round(r.y * h);
    const rw = Math.max(1, Math.round(r.w * w));
    const rh = Math.max(1, Math.round(r.h * h));
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(canvas, rx, ry, rw, rh, rx, ry, rw, rh);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(rx, ry, rw, rh);
  }
  return canvas;
}

/** Draw live preview blur overlays on top of video (non-destructive). */
export function drawLiveBlurOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  regions: BlurRegion[],
  crop: NormRect,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(video, 0, 0, cw, ch);

  const ox = crop.x * cw;
  const oy = crop.y * ch;
  const ow = crop.w * cw;
  const oh = crop.h * ch;

  ctx.strokeStyle = "rgba(56,189,248,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(ox, oy, ow, oh);

  for (const r of regions) {
    const rx = ox + r.x * ow;
    const ry = oy + r.y * oh;
    const rw = r.w * ow;
    const rh = r.h * oh;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.filter = "blur(6px)";
    ctx.drawImage(canvas, rx, ry, rw, rh, rx, ry, rw, rh);
    ctx.restore();
    ctx.strokeStyle = "rgba(239,68,68,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
  }
}

export function canvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  quality = 0.88,
): string {
  return canvas.toDataURL("image/jpeg", quality);
}

export function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}
