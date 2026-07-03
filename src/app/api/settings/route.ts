import { NextResponse } from "next/server";
import { sb } from "@/lib/db";
import { publishSite } from "@/lib/publish";

export async function GET() {
  const { data, error } = await sb()
    .from("site_settings")
    .select("key,value,label")
    .order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function PUT(request: Request) {
  let body: { rows?: { key: string; value: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows[] required" }, { status: 400 });
  }
  const client = sb();
  for (const row of body.rows) {
    if (!row.key) continue;
    const { error } = await client
      .from("site_settings")
      .update({ value: String(row.value ?? ""), updated_at: new Date().toISOString() })
      .eq("key", row.key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await publishSite();
  return NextResponse.json({ ok: true });
}
