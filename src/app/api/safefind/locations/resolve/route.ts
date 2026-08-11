import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { resolveAndPersist } from "@/lib/safefind/location/service";
import { LOCATION_PRECISIONS } from "@/lib/safefind/location/types";

const bodyZ = z.object({
  mode: z.enum(["place_id", "gps", "map_pin", "manual", "geocode"]),
  placeId: z.string().max(256).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  commune: z.string().max(120).optional(),
  quartier: z.string().max(120).optional(),
  landmark: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  precision: z.enum(LOCATION_PRECISIONS).optional(),
  documentType: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    let placeId = parsed.data.placeId;
    let mode = parsed.data.mode;
    if (placeId?.startsWith("local:commune:")) {
      mode = "manual";
      const commune = placeId.replace("local:commune:", "");
      const result = await resolveAndPersist({
        mode: "manual",
        commune,
        precision: "COMMUNE",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await resolveAndPersist({
      mode,
      placeId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      commune: parsed.data.commune,
      quartier: parsed.data.quartier,
      landmark: parsed.data.landmark,
      address: parsed.data.address,
      precision: parsed.data.precision,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
