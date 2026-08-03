import { POST_LOGIN } from "@/lib/auth/handlers";

export async function POST(req: Request) {
  return POST_LOGIN(req);
}
