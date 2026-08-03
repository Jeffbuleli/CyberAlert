import { randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, authTokens, users } from "@/db";
import { appBaseUrl, sendAuthEmail } from "@/lib/email/send";
import { hashToken } from "@/lib/auth/session";

export type AuthTokenType = "email_verify" | "password_reset";

export async function issueAuthToken(userId: string, type: AuthTokenType, ttlMs: number) {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const db = getDb();
  await db.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)));
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return raw;
}

export async function consumeAuthToken(raw: string, type: AuthTokenType) {
  const db = getDb();
  const tokenHash = hashToken(raw);
  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, row.id));
  return row;
}

export async function sendEmailVerification(userId: string, email: string) {
  const raw = await issueAuthToken(userId, "email_verify", 24 * 60 * 60 * 1000);
  const actionUrl = `${appBaseUrl()}/verify-email?token=${raw}`;
  await sendAuthEmail({ to: email, kind: "verify", actionUrl });
}

export async function sendPasswordResetEmail(userId: string, email: string) {
  const raw = await issueAuthToken(userId, "password_reset", 60 * 60 * 1000);
  const actionUrl = `${appBaseUrl()}/reset-password?token=${raw}`;
  await sendAuthEmail({ to: email, kind: "passwordReset", actionUrl });
}

export async function markEmailVerified(userId: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}
