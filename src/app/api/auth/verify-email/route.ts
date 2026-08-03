import { POST_VERIFY_EMAIL } from "@/lib/auth/email-handlers";

export async function POST(req: Request) {
  return POST_VERIFY_EMAIL(req);
}
