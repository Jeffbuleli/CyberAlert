/**
 * Regenerate PWA / home-screen icons from the high-res brand mark.
 *
 * logo-mark.png content almost fills the canvas (~8px margins), so icons need
 * enough padding that a circular OS mask does not clip shield corners or wings.
 * A square of side s fits in a circle of diameter D only if s ≤ D/√2 ≈ 0.707D
 * → pad each side ≥ (1 - 0.707)/2 ≈ 0.147.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public/brand/logo-mark.png");
const outDir = path.join(root, "public/icons");

async function writeIcon(file, size, padRatio) {
  const pad = Math.round(size * padRatio);
  const inner = Math.max(1, size - pad * 2);
  const mark = await sharp(src)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outDir, file));

  console.log("wrote", file, `${size}x${size}`, `pad=${padRatio}`, `mark=${inner}px`);
}

// any / apple: just inside circular safe square (0.70 of canvas)
await writeIcon("icon-144.png", 144, 0.15);
await writeIcon("icon-192.png", 192, 0.15);
await writeIcon("icon-256.png", 256, 0.15);
await writeIcon("icon-512.png", 512, 0.15);
await writeIcon("apple-touch-icon.png", 180, 0.15);

// maskable: extra margin for adaptive icons (wings + shield peaks)
await writeIcon("icon-maskable-192.png", 192, 0.2);
await writeIcon("icon-maskable-512.png", 512, 0.2);
