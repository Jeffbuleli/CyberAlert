import { getDb, analyticsEvents } from "@/db";

export async function trackEvent(
  name: string,
  props: Record<string, unknown> = {},
  ipHash?: string | null,
) {
  try {
    const db = getDb();
    await db.insert(analyticsEvents).values({
      name,
      props,
      ipHash: ipHash ?? null,
    });
  } catch {
    // analytics must never break product flows
  }
}
