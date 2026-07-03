import { NextResponse } from "next/server";
import { sb, TABLES, sanitizeRow } from "@/lib/db";
import { publishSite } from "@/lib/publish";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const { name, id } = await params;
  const spec = TABLES[name];
  if (!spec) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = sanitizeRow(name, payload);
  const { data, error } = await sb()
    .from(name)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publishSite();
  return NextResponse.json({ row: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const { name, id } = await params;
  const spec = TABLES[name];
  if (!spec) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

  const client = sb();

  // Gallery rows also own a file in storage — clean it up with the row.
  if (name === "gallery_images") {
    const { data: img } = await client
      .from("gallery_images")
      .select("url")
      .eq("id", id)
      .single();
    const marker = "/object/public/media/";
    const idx = img?.url ? String(img.url).indexOf(marker) : -1;
    if (idx >= 0) {
      const path = decodeURIComponent(String(img!.url).slice(idx + marker.length));
      await client.storage.from("media").remove([path]);
    }
  }

  const { error } = await client.from(name).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publishSite();
  return NextResponse.json({ ok: true });
}
