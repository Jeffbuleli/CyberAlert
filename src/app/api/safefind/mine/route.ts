import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listMySafefindCases } from "@/lib/safefind/service";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") === "active" ? "active" : "all";

  try {
    const rows = await listMySafefindCases({
      userId: session.id,
      bucket,
    });

    const listings = rows.map((l) => ({
      publicId: l.publicId,
      documentType: l.documentType,
      status: l.status,
      holderFirstNameMasked: l.holderFirstNameMasked,
      holderLastNameMasked: l.holderLastNameMasked,
      documentNumberLast4: l.documentNumberLast4,
      birthYearMasked: l.birthYearMasked ?? null,
      foundZone: l.foundZone,
      foundApproxDate: l.foundApproxDate,
      visualNotes: l.visualNotes,
      listingSummary: l.listingSummary ?? null,
      previewUrl: l.previewUrl ?? null,
      isSpecimen: Boolean(l.isSpecimen),
      rewardHint: l.rewardHint,
      createdAt: l.createdAt,
      partner: l.partner,
    }));

    return NextResponse.json({ listings });
  } catch (e) {
    console.error("[safefind/mine]", e);
    return NextResponse.json({ error: "mine_failed" }, { status: 500 });
  }
}
