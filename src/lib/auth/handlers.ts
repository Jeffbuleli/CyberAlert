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
import { checkPasswordStrength, passwordSchemaRefine } from "@/lib/auth/password-policy";
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
  const httpsApp =
    (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").startsWith(
      "https://",
    ) || process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: httpsApp,
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
}

export async function POST_LOGIN(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`login:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Trop de tentatives de connexion. Réessayez dans une minute.",
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

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
  if (!rl.ok) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Trop d'inscriptions depuis cette adresse. Réessayez plus tard.",
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Données invalides." }, { status: 400 });
  }
  if (!passwordSchemaRefine(parsed.data.password)) {
    const check = checkPasswordStrength(parsed.data.password);
    return Response.json(
      {
        error: "weak_password",
        message: check.message || "Mot de passe trop faible (8+ caractères, lettre + chiffre).",
      },
      { status: 400 },
    );
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

  try {
    const { sendEmailVerification } = await import("@/lib/auth/tokens");
    const { sendAuthEmail, appBaseUrl } = await import("@/lib/email/send");
    await sendEmailVerification(user.id, user.email);
    await sendAuthEmail({
      to: user.email,
      kind: "welcome",
      actionUrl: `${appBaseUrl()}/dashboard`,
    });
  } catch (e) {
    console.error("[auth] welcome/verify email failed", e);
  }

  const raw = await createSession(user.id);
  await setSessionCookie(raw);
  return Response.json({ ok: true, role: user.role });
}
