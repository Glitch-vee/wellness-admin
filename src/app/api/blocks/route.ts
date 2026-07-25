import { NextResponse } from "next/server";
import { sb } from "@/lib/db";
import { publishSite } from "@/lib/publish";

/**
 * Keyed page text (content_blocks) plus its optional per-element text style.
 * The `style` jsonb column arrives with a pending migration — until it lands
 * every path here degrades gracefully: GET falls back to a style-less select
 * and PUT retries without style, flagging `styleSkipped` so the UI can say
 * "text saved, styling needs the database update" instead of hard-failing.
 */

// The style contract the site renders — anything else is stripped.
const STYLE_SIZES = new Set(["xs", "s", "m", "l", "xl", "xxl"]);
const STYLE_WEIGHTS = new Set(["400", "600", "800"]);
const STYLE_ALIGNS = new Set(["left", "center", "right"]);
const STYLE_FONTS = new Set(["display", "body", "script"]);
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Allowlist a style payload; null when it isn't an object at all. */
function cleanStyle(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const s = input as Record<string, unknown>;
  const out: Record<string, string> = {};
  if (STYLE_SIZES.has(String(s.size))) out.size = String(s.size);
  if (STYLE_WEIGHTS.has(String(s.weight))) out.weight = String(s.weight);
  if (STYLE_ALIGNS.has(String(s.align))) out.align = String(s.align);
  if (STYLE_FONTS.has(String(s.font))) out.font = String(s.font);
  if (typeof s.color === "string" && HEX_RE.test(s.color)) out.color = s.color;
  return out;
}

export async function GET() {
  const client = sb();
  const { data, error } = await client
    .from("content_blocks")
    .select("key,label,page,value,style")
    .order("page")
    .order("key");
  if (!error) return NextResponse.json({ rows: data });

  // Pre-migration: no style column — serve the rows without it.
  const fallback = await client
    .from("content_blocks")
    .select("key,label,page,value")
    .order("page")
    .order("key");
  if (fallback.error) {
    return NextResponse.json({ error: fallback.error.message }, { status: 500 });
  }
  return NextResponse.json({
    rows: (fallback.data ?? []).map((r) => ({ ...r, style: {} })),
  });
}

export async function PUT(request: Request) {
  let body: { rows?: { key: string; value: string; style?: unknown }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows[] required" }, { status: 400 });
  }
  const client = sb();
  let styleSkipped = false;
  for (const row of body.rows) {
    if (!row.key) continue;
    const patch: Record<string, unknown> = {
      value: String(row.value ?? ""),
      updated_at: new Date().toISOString(),
    };
    const style = "style" in row ? cleanStyle(row.style) : null;
    if (style) patch.style = style;
    const { error } = await client
      .from("content_blocks")
      .update(patch)
      .eq("key", row.key);
    if (error && "style" in patch) {
      // Pre-migration: the style column is missing — save the text anyway.
      delete patch.style;
      const retry = await client
        .from("content_blocks")
        .update(patch)
        .eq("key", row.key);
      if (retry.error) {
        return NextResponse.json({ error: retry.error.message }, { status: 500 });
      }
      styleSkipped = true;
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  const publish = await publishSite();
  return NextResponse.json(
    styleSkipped ? { ok: true, publish, styleSkipped } : { ok: true, publish }
  );
}
