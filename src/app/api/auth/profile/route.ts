import { PATCH_PROFILE } from "@/lib/auth/email-handlers";

export async function PATCH(req: Request) {
  return PATCH_PROFILE(req);
}
