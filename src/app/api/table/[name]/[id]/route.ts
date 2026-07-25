import { NextResponse } from "next/server";
import { sb, TABLES, sanitizeRow } from "@/lib/db";
import { publishSite } from "@/lib/publish";

/**
 * Is this pages row one of the built-in site pages? Pre-migration the
 * `system` column doesn't exist — any query error means "no".
 */
async function isSystemPage(id: string): Promise<boolean> {
  try {
    const { data, error } = await sb()
      .from("pages")
      .select("system")
      .eq("id", id)
      .single();
    if (error) return false;
    return data?.system === true;
  } catch {
    return false;
  }
}

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

  // System pages keep their address and menu wiring, whatever the client sent.
  if (name === "pages" && (await isSystemPage(id))) {
    delete row.slug;
    delete row.nav;
    delete row.nav_label;
  }

  const { data, error } = await sb()
    .from(name)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const publish = await publishSite();
  return NextResponse.json({ row: data, publish });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const { name, id } = await params;
  const spec = TABLES[name];
  if (!spec) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

  // The built-in site pages must always exist — refuse to delete them.
  if (name === "pages" && (await isSystemPage(id))) {
    return NextResponse.json(
      { error: "System pages can't be deleted." },
      { status: 409 }
    );
  }

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

  const publish = await publishSite();
  return NextResponse.json({ ok: true, publish });
}
