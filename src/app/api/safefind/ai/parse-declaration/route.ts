import { NextResponse } from "next/server";
import { z } from "zod";
import { safefindParseDeclaration } from "@/lib/safefind/ai-assist";

const bodyZ = z.object({
  text: z.string().min(3).max(800),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodyZ.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await safefindParseDeclaration(parsed.data.text);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[safefind/ai/parse]", e);
    return NextResponse.json({ error: "parse_failed" }, { status: 500 });
  }
}
