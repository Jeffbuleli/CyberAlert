import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { declareFound } from "@/lib/safefind/service";
import { isSafefindDocType } from "@/lib/safefind/types";

const bodyZ = z.object({
  documentType: z.string().min(2),
  holderFirstName: z.string().max(128).optional(),
  holderLastName: z.string().max(128).optional(),
  documentNumber: z.string().max(64).optional(),
  visualNotes: z.string().max(500).optional(),
  appearanceMeta: z.record(z.string(), z.unknown()).optional(),
  commune: z.string().max(120).optional(),
  quartier: z.string().max(120).optional(),
  approxDate: z.string().datetime().optional(),
  partnerIdHint: z.string().uuid().optional(),
  possessionMode: z.enum(["held", "deposited"]).optional(),
  locationId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationPrecision: z.string().max(32).optional(),
  previewUrl: z.string().max(256).optional(),
  previewToken: z.string().regex(/^[a-f0-9]{32}$/).optional(),
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

  try {
    const result = await declareFound({
      userId,
      documentType: parsed.data.documentType,
      holderFirstName: parsed.data.holderFirstName,
      holderLastName: parsed.data.holderLastName,
      documentNumber: parsed.data.documentNumber,
      visualNotes: parsed.data.visualNotes,
      appearanceMeta: parsed.data.appearanceMeta,
      commune: parsed.data.commune,
      quartier: parsed.data.quartier,
      approxDate: parsed.data.approxDate
        ? new Date(parsed.data.approxDate)
        : undefined,
      partnerIdHint: parsed.data.partnerIdHint,
      possessionMode: parsed.data.possessionMode,
      locationId: parsed.data.locationId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      locationPrecision: parsed.data.locationPrecision,
      previewUrl: parsed.data.previewUrl,
      previewToken: parsed.data.previewToken,
    });

    // Never leak silent link of prior case to recovery finder
    return NextResponse.json({
      ok: true,
      message: result.message,
      declarationId: result.declarationId,
      casePublicId: result.casePublicId,
      depositHintPartnerId: result.depositHintPartnerId,
      depositPartner:
        "depositPartner" in result ? result.depositPartner : null,
      nearbyPartners: "nearbyPartners" in result ? result.nearbyPartners : [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "kyc_required") {
      return NextResponse.json({ error: "kyc_required" }, { status: 403 });
    }
    return NextResponse.json({ error: "safefind_found_failed" }, { status: 500 });
  }
}
