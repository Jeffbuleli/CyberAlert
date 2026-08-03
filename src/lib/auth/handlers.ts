import { z } from "zod";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, users, subscriptions, pricingPlans } from "@/db";
import {
  SESSION_COOKIE,
  createSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/session";
import { checkRateLimit, clientIpFromRequest, rateLimitedResponse } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional(),
});

async function setSessionCookie(raw: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
}

export async function POST_LOGIN(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`login:${ip}`, 5, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterMs);

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Identifiants invalides." }, { status: 400 });
  }
  const db = getDb();
  const email = parsed.data.email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return Response.json({ error: "auth_failed", message: "Email ou mot de passe incorrect." }, { status: 401 });
  }
  const raw = await createSession(user.id);
  await setSessionCookie(raw);
  return Response.json({ ok: true, role: user.role });
}

export async function POST_REGISTER(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`register:${ip}`, 3, 600_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterMs);

  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Données invalides." }, { status: 400 });
  }
  const db = getDb();
  const email = parsed.data.email.toLowerCase().trim();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return Response.json({ error: "email_taken", message: "Cet email est déjà utilisé." }, { status: 409 });
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: parsed.data.name?.trim() || null,
      role: "developer",
    })
    .returning();

  const [free] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.code, "developer_free"))
    .limit(1);
  if (free) {
    await db.insert(subscriptions).values({
      userId: user.id,
      planId: free.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  const raw = await createSession(user.id);
  await setSessionCookie(raw);
  return Response.json({ ok: true, role: user.role });
}
