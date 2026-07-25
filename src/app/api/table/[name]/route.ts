import { NextResponse } from "next/server";
import { sb, TABLES, sanitizeRow } from "@/lib/db";
import { publishSite } from "@/lib/publish";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const spec = TABLES[name];
  if (!spec) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

  const { data, error } = await sb()
    .from(name)
    .select("*")
    .order(spec.orderBy, { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const spec = TABLES[name];
  if (!spec) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = sanitizeRow(name, payload);

  // The built-in site pages own these addresses — a custom page there would
  // shadow the system page (and block its migration seed).
  if (name === "pages" && RESERVED_SLUGS.has(String(row.slug ?? ""))) {
    return NextResponse.json(
      { error: "That address belongs to a built-in site page — pick another." },
      { status: 409 }
    );
  }

  const { data, error } = await sb().from(name).insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const publish = await publishSite();
  return NextResponse.json({ row: data, publish });
}

const RESERVED_SLUGS = new Set([
  "home",
  "about",
  "offers",
  "results",
  "how-it-works",
  "gallery",
  "resources",
  "scorecard",
  "privacy",
  "terms",
]);
