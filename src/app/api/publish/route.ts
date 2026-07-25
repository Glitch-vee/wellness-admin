import { NextResponse } from "next/server";
import { publishSite } from "@/lib/publish";

/**
 * Manual republish. Always 200 — the outcome travels in `publish` so the
 * client can show the one save/publish vocabulary instead of a raw HTTP error.
 */
export async function POST() {
  const publish = await publishSite();
  return NextResponse.json({ publish });
}
