import { NextResponse } from "next/server";
import { publishSite } from "@/lib/publish";

export async function POST() {
  const result = await publishSite();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
