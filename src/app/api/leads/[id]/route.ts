import { NextResponse } from "next/server";
import { sb } from "@/lib/db";

/** PUT { status: "new" | "seen" | "archived" } → { lead } */

const ALLOWED = new Set(["new", "seen", "archived"]);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.status || !ALLOWED.has(body.status)) {
    return NextResponse.json(
      { error: "status must be new, seen or archived" },
      { status: 400 }
    );
  }

  const { data, error } = await sb()
    .from("leads")
    .update({ status: body.status })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ lead: data });
}
