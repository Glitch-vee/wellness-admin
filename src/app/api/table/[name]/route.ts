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
  const { data, error } = await sb().from(name).insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publishSite();
  return NextResponse.json({ row: data });
}
