import { NextResponse } from "next/server";
import { listMarketplaceCases } from "@/lib/safefind/service";
import { isSafefindDocType } from "@/lib/safefind/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentType = url.searchParams.get("documentType") || undefined;
  const commune = url.searchParams.get("commune") || undefined;
  const partnerId = url.searchParams.get("partnerId") || undefined;
  const readyOnly = url.searchParams.get("readyOnly") === "1";
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const nearLat = latRaw != null ? Number(latRaw) : undefined;
  const nearLng = lngRaw != null ? Number(lngRaw) : undefined;

  if (documentType && !isSafefindDocType(documentType)) {
    return NextResponse.json({ error: "invalid_document_type" }, { status: 400 });
  }
  if (partnerId && !/^[0-9a-f-]{36}$/i.test(partnerId)) {
    return NextResponse.json({ error: "invalid_partner" }, { status: 400 });
  }

  try {
    const { listings, partners } = await listMarketplaceCases({
      documentType,
      commune: commune?.slice(0, 120),
      partnerId,
      readyOnly,
      nearLat:
        nearLat != null && Number.isFinite(nearLat) ? nearLat : undefined,
      nearLng:
        nearLng != null && Number.isFinite(nearLng) ? nearLng : undefined,
    });

    // Strip any accidental sensitive keys — public contract only.
    const publicListings = listings.map((l) => ({
      publicId: l.publicId,
      documentType: l.documentType,
      status: l.status,
      holderFirstNameMasked: l.holderFirstNameMasked,
      holderLastNameMasked: l.holderLastNameMasked,
      documentNumberLast4: l.documentNumberLast4,
      foundZone: l.foundZone,
      foundApproxDate: l.foundApproxDate,
      visualNotes: l.visualNotes,
      rewardHint: l.rewardHint,
      createdAt: l.createdAt,
      partner: l.partner,
    }));

    return NextResponse.json({ listings: publicListings, partners });
  } catch (e) {
    console.error("[safefind/marketplace]", e);
    return NextResponse.json({ error: "marketplace_failed" }, { status: 500 });
  }
}
