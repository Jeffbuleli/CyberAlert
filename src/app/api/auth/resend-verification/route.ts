import { POST_RESEND_VERIFICATION } from "@/lib/auth/email-handlers";

export async function POST() {
  return POST_RESEND_VERIFICATION();
}
