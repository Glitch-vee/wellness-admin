import { NextResponse } from "next/server";
import { sb, TABLES } from "@/lib/db";
import { publishSite } from "@/lib/publish";

/**
 * Renumber a table's sort_order in one shot: { table, ids } where ids is the
 * full desired order. Rows get sort_order 10, 20, 30… so later single inserts
 * can slot between neighbours. One publish per reorder, not one per row.
 */
export async function POST(request: Request) {
  let payload: { table?: string; ids?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const table = String(payload.table ?? "");
  const spec = TABLES[table];
  if (!spec || !spec.fields.some((f) => f.name === "sort_order")) {
    return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  }

  const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No ids" }, { status: 400 });
  }

  const client = sb();
  const results = await Promise.all(
    ids.map((id, i) =>
      client
        .from(table)
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  const publish = await publishSite();
  return NextResponse.json({ ok: true, publish });
}
