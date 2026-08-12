import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { safefindParseDocumentImage } from "@/lib/safefind/ai-assist";
import { checkDocumentAlreadyListed } from "@/lib/safefind/service";
import { isSafefindDocType } from "@/lib/safefind/types";

const bodyZ = z.object({
  imageBase64: z.string().min(100).max(3_000_000),
  documentTypeHint: z.string().optional(),
  qrPayload: z.string().max(500).optional(),
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

  const hint = parsed.data.documentTypeHint;
  if (hint && !isSafefindDocType(hint)) {
    return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
  }

  try {
    const ai = await safefindParseDocumentImage({
      imageBase64: parsed.data.imageBase64,
      documentTypeHint: hint,
      qrPayload: parsed.data.qrPayload,
    });

    let duplicateCheck: {
      alreadyListed: boolean;
      message: string | null;
    } = { alreadyListed: false, message: null };

    if (ai.documentNumber) {
      duplicateCheck = await checkDocumentAlreadyListed({
        documentNumber: ai.documentNumber,
        documentType: ai.documentType ?? undefined,
        userId: session.id,
      });
    }

    return NextResponse.json({
      ...ai,
      duplicateCheck,
    });
  } catch (e) {
    console.error("[safefind/ai/parse-document]", e);
    return NextResponse.json({ error: "parse_failed" }, { status: 500 });
  }
}
