import { NextResponse } from "next/server";
import { readPreviewFile } from "@/lib/safefind/preview-storage";

type Params = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { name } = await params;
  const token = name.replace(/\.jpg$/i, "");
  const file = await readPreviewFile(token);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
