import { NextResponse } from "next/server";
import { KINSHASA_COMMUNES } from "@/lib/safefind/location/types";

export async function GET() {
  return NextResponse.json({ communes: [...KINSHASA_COMMUNES] });
}
