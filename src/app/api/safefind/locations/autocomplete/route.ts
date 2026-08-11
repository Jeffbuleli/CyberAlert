import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import {
  autocompletePlaces,
  googleMapsConfigured,
} from "@/lib/safefind/location/places-google";
import { KINSHASA_COMMUNES } from "@/lib/safefind/location/types";

const qZ = z.object({
  q: z.string().min(1).max(120),
  sessionToken: z.string().max(64).optional(),
});

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const parsed = qZ.safeParse({
    q: url.searchParams.get("q") ?? "",
    sessionToken: url.searchParams.get("sessionToken") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const q = parsed.data.q.trim();
  const google = googleMapsConfigured()
    ? await autocompletePlaces({
        input: q,
        sessionToken: parsed.data.sessionToken,
      })
    : [];

  const local = KINSHASA_COMMUNES.filter((c) =>
    c.toLowerCase().includes(q.toLowerCase()),
  ).map((c) => ({
    placeId: `local:commune:${c}`,
    primaryText: c,
    secondaryText: "Commune · Kinshasa",
    fullText: `${c}, Kinshasa`,
    local: true as const,
  }));

  return NextResponse.json({
    googleConfigured: googleMapsConfigured(),
    suggestions: [...google, ...local].slice(0, 10),
  });
}
