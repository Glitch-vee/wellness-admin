import { NextResponse } from "next/server";
import sharp from "sharp";
import { sb } from "@/lib/db";

const SITE = process.env.MAIN_SITE_URL || "https://alvee-wellness.vercel.app";
const SHOTTABLES = new Set(["pages", "offers"]);

// Capturing a live page can take a while — give the function room.
export const maxDuration = 60;

/**
 * Captures a live screenshot of a public page via Microlink (keyless, free
 * tier) and stores it in Supabase Storage so the Pages hub cards can show a
 * real preview. The Pages hub auto-fills any missing previews on load; the
 * corner button re-captures on demand.
 */
export async function POST(request: Request) {
  let payload: { table?: string; id?: string; path?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { table, id, path } = payload;
  if (!table || !SHOTTABLES.has(table) || !id || typeof path !== "string") {
    return NextResponse.json({ error: "Missing table/id/path" }, { status: 400 });
  }

  const target = `${SITE.replace(/\/$/, "")}${path}`;
  const captureUrl =
    `https://api.microlink.io/?url=${encodeURIComponent(target)}` +
    `&screenshot=true&meta=false&viewport.width=1200&viewport.height=900&waitFor=600`;

  let ml: { status?: string; message?: string; data?: { screenshot?: { url?: string } } };
  try {
    const mlRes = await fetch(captureUrl, { cache: "no-store" });
    ml = await mlRes.json();
  } catch {
    return NextResponse.json({ error: "Screenshot service unreachable" }, { status: 502 });
  }
  const shotSrc = ml?.data?.screenshot?.url;
  if (ml?.status !== "success" || !shotSrc) {
    return NextResponse.json(
      { error: ml?.message || "Screenshot service failed" },
      { status: 502 }
    );
  }

  const imgRes = await fetch(shotSrc);
  if (!imgRes.ok) {
    return NextResponse.json({ error: "Couldn't fetch generated screenshot" }, { status: 502 });
  }
  // Microlink returns a retina PNG (~2400px, >1MB). Cards render it a few
  // hundred px wide, so downscale to a light JPEG before storing.
  const raw = Buffer.from(await imgRes.arrayBuffer());
  const buffer = await sharp(raw)
    .resize({ width: 1000, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();

  const client = sb();
  const storagePath = `screenshots/${table}-${id}.jpg`;
  const { error: upErr } = await client.storage
    .from("media")
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = client.storage.from("media").getPublicUrl(storagePath);
  const updated_at = new Date().toISOString();
  const url = `${pub.publicUrl}?t=${Date.now()}`;

  const { error: dbErr } = await client
    .from(table)
    .update({ screenshot_url: url, screenshot_updated_at: updated_at })
    .eq("id", id);
  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ url, updated_at });
}
