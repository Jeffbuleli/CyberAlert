import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession } from "@/lib/auth/session";

export async function POST() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  await destroySession(raw);
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
