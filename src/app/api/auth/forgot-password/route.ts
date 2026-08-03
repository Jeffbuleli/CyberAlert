import { POST_FORGOT_PASSWORD } from "@/lib/auth/email-handlers";

export async function POST(req: Request) {
  return POST_FORGOT_PASSWORD(req);
}
