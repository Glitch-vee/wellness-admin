import { NextResponse } from "next/server";
import { sb } from "@/lib/db";

/**
 * Inbox of leads captured by the live site.
 *
 * GET /api/leads?status=new|all      → { leads (newest 500), counts }
 * GET /api/leads?count=1             → { counts } only — cheap badge polling
 * counts = { new, seen, archived }
 */

const STATUSES = ["new", "seen", "archived"] as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") === "new" ? "new" : "all";
  const countOnly = url.searchParams.get("count") === "1";

  const client = sb();

  const countRows = await Promise.all(
    STATUSES.map((s) =>
      client
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", s)
    )
  );
  for (const r of countRows) {
    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 500 });
    }
  }
  const counts = {
    new: countRows[0].count ?? 0,
    seen: countRows[1].count ?? 0,
    archived: countRows[2].count ?? 0,
  };

  if (countOnly) return NextResponse.json({ counts });

  let query = client
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status === "new") query = query.eq("status", "new");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [], counts });
}
