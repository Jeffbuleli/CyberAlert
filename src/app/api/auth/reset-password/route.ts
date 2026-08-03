import { POST_RESET_PASSWORD } from "@/lib/auth/email-handlers";

export async function POST(req: Request) {
  return POST_RESET_PASSWORD(req);
}
