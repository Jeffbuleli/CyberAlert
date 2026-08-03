import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, sessions, users } from "@/db";
import { getSessionSecret } from "@/lib/env";

export const SESSION_COOKIE = "ca_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw + getSessionSecret()).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(sessions).values({ userId, tokenHash, expiresAt });
  return raw;
}

export async function destroySession(raw: string | undefined) {
  if (!raw) return;
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(raw)));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const db = getDb();
  const tokenHash = hashToken(raw);
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function requireRole(user: SessionUser, roles: string[]) {
  if (!roles.includes(user.role)) {
    throw new Error("forbidden");
  }
}
