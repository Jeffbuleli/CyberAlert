import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import {
  previewPublicUrl,
  storeRedactedPreview,
} from "@/lib/safefind/preview-storage";

const bodyZ = z.object({
  imageDataUrl: z.string().min(100).max(4_000_000),
  previewToken: z.string().regex(/^[a-f0-9]{32}$/).optional(),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodyZ.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const raw = parsed.data.imageDataUrl;
  const idx = raw.indexOf(",");
  const b64 = idx >= 0 ? raw.slice(idx + 1) : raw;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  if (bytes.length < 500 || bytes.length > 2_500_000) {
    return NextResponse.json({ error: "image_size" }, { status: 400 });
  }

  try {
    const { token, url, storage } = await storeRedactedPreview(
      bytes,
      parsed.data.previewToken,
    );
    return NextResponse.json({
      ok: true,
      previewToken: token,
      previewUrl: url,
      storage,
    });
  } catch (e) {
    console.error("[safefind/preview/store]", e);
    return NextResponse.json({ error: "store_failed" }, { status: 500 });
  }
}

export { previewPublicUrl };
