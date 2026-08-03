import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth/session";
import { checkPasswordStrength, passwordSchemaRefine } from "@/lib/auth/password-policy";
import { checkRateLimit, clientIpFromRequest, rateLimitedResponse } from "@/lib/rate-limit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`pwd:${user.id}:${ip}`, 5, 600_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterMs);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid", message: "Données invalides." }, { status: 400 });
  }

  if (!passwordSchemaRefine(parsed.data.newPassword)) {
    const check = checkPasswordStrength(parsed.data.newPassword);
    return Response.json(
      {
        error: "weak_password",
        message: check.message || "Mot de passe trop faible (8+ caractères, lettre + chiffre).",
      },
      { status: 400 },
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return Response.json(
      { error: "same_password", message: "Le nouveau mot de passe doit être différent." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
    return Response.json(
      { error: "auth_failed", message: "Mot de passe actuel incorrect." },
      { status: 401 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return Response.json({ ok: true });
}
