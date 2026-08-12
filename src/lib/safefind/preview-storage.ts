import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

const PREVIEW_DIR =
  process.env.SAFEFIND_PREVIEW_DIR?.trim() ||
  path.join(process.cwd(), "data", "safefind-previews");

export function previewPublicUrl(token: string): string {
  return `/api/safefind/preview/${token}.jpg`;
}

export async function ensurePreviewDir(): Promise<string> {
  await mkdir(PREVIEW_DIR, { recursive: true });
  return PREVIEW_DIR;
}

export function newPreviewToken(): string {
  return randomBytes(16).toString("hex");
}

/** Store redacted JPEG; returns public API URL token path. */
export async function storeRedactedPreview(
  jpegBytes: Buffer,
  token?: string,
): Promise<{ token: string; url: string }> {
  await ensurePreviewDir();
  const id = token ?? newPreviewToken();
  const file = path.join(PREVIEW_DIR, `${id}.jpg`);
  await writeFile(file, jpegBytes);
  return { token: id, url: previewPublicUrl(id) };
}

export async function readPreviewFile(
  token: string,
): Promise<{ bytes: Buffer; path: string } | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const file = path.join(PREVIEW_DIR, `${token}.jpg`);
  try {
    await stat(file);
    const bytes = await readFile(file);
    return { bytes, path: file };
  } catch {
    return null;
  }
}

export function hashPreviewContent(dataUrlOrBase64: string): string {
  const raw = dataUrlOrBase64.includes(",")
    ? dataUrlOrBase64.slice(dataUrlOrBase64.indexOf(",") + 1)
    : dataUrlOrBase64;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
