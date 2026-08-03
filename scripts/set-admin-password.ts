import { eq } from "drizzle-orm";
import { getDb, users } from "../src/db";
import { hashPassword } from "../src/lib/auth/session";

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL || "admin@cyberalert.local")
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_SEED_PASSWORD || "admin";
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (row) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", updatedAt: new Date() })
      .where(eq(users.id, row.id));
    console.log(`Admin password updated: ${email}`);
  } else {
    await db.insert(users).values({
      email,
      passwordHash,
      name: "Admin",
      role: "admin",
    });
    console.log(`Admin created: ${email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
