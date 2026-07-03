import { NextResponse } from "next/server";
import { sb } from "@/lib/db";
import { publishSite } from "@/lib/publish";

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
const SLOTS = ["gallery", "about", "before-after"];
const MAX_BYTES = 4 * 1024 * 1024; // stay under Vercel's request body limit

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is larger than 4 MB — please compress it first" },
      { status: 400 }
    );
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json(
      { error: `Only ${ALLOWED.join(", ")} files are allowed` },
      { status: 400 }
    );
  }

  const client = sb();
  const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: upErr } = await client.storage
    .from("media")
    .upload(path, buffer, { contentType: file.type || `image/${ext}` });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = client.storage.from("media").getPublicUrl(path);

  const rawSlot = String(form.get("slot") ?? "gallery");
  const slot = SLOTS.includes(rawSlot) ? rawSlot : "gallery";

  const { data: row, error: insErr } = await client
    .from("gallery_images")
    .insert({
      url: pub.publicUrl,
      alt: String(form.get("alt") ?? ""),
      caption: String(form.get("caption") ?? ""),
      slot,
      sort_order: Math.floor(Date.now() / 1000),
    })
    .select()
    .single();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await publishSite();
  return NextResponse.json({ row });
}
