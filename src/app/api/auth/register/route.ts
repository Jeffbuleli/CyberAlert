import { POST_REGISTER } from "@/lib/auth/handlers";

export async function POST(req: Request) {
  return POST_REGISTER(req);
}
