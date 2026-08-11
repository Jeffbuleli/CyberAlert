import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { reportPartnerIncident } from "@/lib/safefind/service";
import { SAFEFIND_INCIDENT_TYPES } from "@/lib/safefind/types";

const bodyZ = z.object({
  casePublicId: z.string().optional(),
  incidentType: z.string(),
  description: z.string().max(2000).optional(),
  evidenceRefs: z.array(z.string()).max(10).optional(),
  allUnderCustody: z.boolean().optional(),
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
  if (
    !(SAFEFIND_INCIDENT_TYPES as readonly string[]).includes(
      parsed.data.incidentType,
    )
  ) {
    return NextResponse.json({ error: "invalid_incident_type" }, { status: 400 });
  }

  try {
    const result = await reportPartnerIncident({
      agentUserId: userId,
      casePublicId: parsed.data.casePublicId?.toUpperCase(),
      incidentType: parsed.data.incidentType,
      description: parsed.data.description,
      evidenceRefs: parsed.data.evidenceRefs,
      allUnderCustody: parsed.data.allUnderCustody,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "partner_forbidden" || msg === "partner_case_forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "incident_failed" }, { status: 500 });
  }
}
