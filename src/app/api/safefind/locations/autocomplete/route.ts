import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import {
  autocompletePlaces,
  locationProviderConfigured,
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
  // local known places + Geoapify (min 3 chars inside provider/facade)
  const places = await autocompletePlaces({
    input: q,
    sessionToken: parsed.data.sessionToken,
  });

  const communes =
    q.length >= 2
      ? KINSHASA_COMMUNES.filter((c) =>
          c.toLowerCase().includes(q.toLowerCase()),
        ).map((c) => ({
          placeId: `local:commune:${c}`,
          primaryText: c,
          secondaryText: "Commune · Kinshasa",
          fullText: `${c}, Kinshasa`,
          provider: "manual",
          local: true as const,
        }))
      : [];

  return NextResponse.json({
    provider: locationProviderConfigured() ? "geoapify" : "offline",
    providerConfigured: locationProviderConfigured(),
    attribution: locationProviderConfigured()
      ? "Powered by Geoapify / OpenStreetMap"
      : null,
    suggestions: [...places, ...communes].slice(0, 10),
  });
}
