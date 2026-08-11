import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { declareLost } from "@/lib/safefind/service";
import { isSafefindDocType } from "@/lib/safefind/types";

const bodyZ = z.object({
  documentType: z.string().min(2),
  holderFirstName: z.string().max(128).optional(),
  holderLastName: z.string().max(128).optional(),
  documentNumber: z.string().max(64).optional(),
  commune: z.string().max(120).optional(),
  quartier: z.string().max(120).optional(),
  approxDate: z.string().datetime().optional(),
  appearanceHints: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.id;

  const json = await req.json().catch(() => null);
  const parsed = bodyZ.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isSafefindDocType(parsed.data.documentType)) {
    return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
  }

  const result = await declareLost({
    userId,
    documentType: parsed.data.documentType,
    holderFirstName: parsed.data.holderFirstName,
    holderLastName: parsed.data.holderLastName,
    documentNumber: parsed.data.documentNumber,
    commune: parsed.data.commune,
    quartier: parsed.data.quartier,
    approxDate: parsed.data.approxDate
      ? new Date(parsed.data.approxDate)
      : undefined,
    appearanceHints: parsed.data.appearanceHints,
  });

  return NextResponse.json({ ok: true, ...result });
}
