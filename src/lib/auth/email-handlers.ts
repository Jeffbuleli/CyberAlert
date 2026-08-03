import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { getSessionUser, hashPassword } from "@/lib/auth/session";
import { checkPasswordStrength, passwordSchemaRefine } from "@/lib/auth/password-policy";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import {
  consumeAuthToken,
  markEmailVerified,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "@/lib/auth/tokens";

export async function POST_FORGOT_PASSWORD(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`forgot:${ip}`, 5, 600_000);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Trop de demandes. Réessayez plus tard." },
      { status: 429 },
    );
  }
  const parsed = z.object({ email: z.string().email() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Email invalide." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    try {
      await sendPasswordResetEmail(user.id, user.email);
    } catch (e) {
      console.error("[auth] reset email failed", e);
    }
  }
  return Response.json({
    ok: true,
    message: "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.",
  });
}

export async function POST_RESET_PASSWORD(req: Request) {
  const parsed = z
    .object({
      token: z.string().min(20),
      password: z.string().min(8).max(128),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Données invalides." }, { status: 400 });
  }
  if (!passwordSchemaRefine(parsed.data.password)) {
    const check = checkPasswordStrength(parsed.data.password);
    return Response.json(
      { error: "weak_password", message: check.message || "Mot de passe trop faible." },
      { status: 400 },
    );
  }
  const row = await consumeAuthToken(parsed.data.token, "password_reset");
  if (!row) {
    return Response.json(
      { error: "invalid_token", message: "Lien invalide ou expiré." },
      { status: 400 },
    );
  }
  const db = getDb();
  const passwordHash = await hashPassword(parsed.data.password);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, row.userId));
  return Response.json({ ok: true, message: "Mot de passe mis à jour. Vous pouvez vous connecter." });
}

export async function POST_VERIFY_EMAIL(req: Request) {
  const parsed = z.object({ token: z.string().min(20) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Token invalide." }, { status: 400 });
  }
  const row = await consumeAuthToken(parsed.data.token, "email_verify");
  if (!row) {
    return Response.json(
      { error: "invalid_token", message: "Lien invalide ou expiré." },
      { status: 400 },
    );
  }
  await markEmailVerified(row.userId);
  return Response.json({ ok: true, message: "Email confirmé." });
}

export async function POST_RESEND_VERIFICATION() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user.emailVerifiedAt) {
    return Response.json({ ok: true, message: "Email déjà vérifié." });
  }
  const ip = user.id;
  const rl = checkRateLimit(`resend-verify:${ip}`, 3, 600_000);
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", message: "Trop de renvois. Réessayez plus tard." },
      { status: 429 },
    );
  }
  try {
    await sendEmailVerification(user.id, user.email);
  } catch (e) {
    console.error("[auth] resend verify failed", e);
    return Response.json(
      { error: "send_failed", message: "Envoi impossible pour le moment." },
      { status: 503 },
    );
  }
  return Response.json({ ok: true, message: "Email de vérification envoyé." });
}

export async function PATCH_PROFILE(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z
    .object({ name: z.string().max(120).optional() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Données invalides." }, { status: 400 });
  }
  const db = getDb();
  await db
    .update(users)
    .set({
      name: parsed.data.name?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  return Response.json({ ok: true });
}
