import { NextResponse } from "next/server";
import { sb } from "@/lib/db";
import { publishSite } from "@/lib/publish";

/**
 * One experiment's lifecycle.
 *
 * PUT { action: "start" }                  draft → running (409 if the block
 *                                          already has a running test)
 * PUT { action: "stop" }                   running → finished, no winner
 * PUT { action: "winner", winner: "a"|"b" } running → finished; "b" also
 *                                          copies variant B into the live
 *                                          content block and republishes.
 *                                          → { test, publish }
 * PUT { variant_b }                        edit a draft's challenger text
 * DELETE                                   allowed unless running (409)
 */

type TestRow = {
  id: string;
  block_key: string;
  status: "draft" | "running" | "finished";
  variant_b: string;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: {
    action?: "start" | "stop" | "winner";
    winner?: "a" | "b";
    variant_b?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const client = sb();
  const { data: test, error: findError } = await client
    .from("ab_tests")
    .select("id,block_key,status,variant_b")
    .eq("id", id)
    .maybeSingle();
  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!test) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }
  const row = test as TestRow;
  const now = new Date().toISOString();

  // ---- edit a draft's variant B (no action given) ----
  if (!body.action) {
    if (typeof body.variant_b !== "string") {
      return NextResponse.json(
        { error: "Nothing to update — send an action or variant_b" },
        { status: 400 }
      );
    }
    if (row.status !== "draft") {
      return NextResponse.json(
        { error: "Only a draft's variant B can be edited" },
        { status: 409 }
      );
    }
    const { data, error } = await client
      .from("ab_tests")
      .update({ variant_b: body.variant_b, updated_at: now })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ test: data });
  }

  switch (body.action) {
    case "start": {
      if (row.status === "running") {
        return NextResponse.json(
          { error: "This experiment is already running" },
          { status: 409 }
        );
      }
      if (row.status === "finished") {
        return NextResponse.json(
          { error: "A finished experiment can't be reopened — create a new one" },
          { status: 409 }
        );
      }
      const patch: Record<string, string> = {
        status: "running",
        started_at: now,
        updated_at: now,
      };
      if (typeof body.variant_b === "string") patch.variant_b = body.variant_b;
      const { data, error } = await client
        .from("ab_tests")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          return NextResponse.json(
            {
              error:
                "You're already testing this block — finish that experiment first",
            },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ test: data });
    }

    case "stop": {
      if (row.status !== "running") {
        return NextResponse.json(
          { error: "Only a running experiment can be stopped" },
          { status: 409 }
        );
      }
      const { data, error } = await client
        .from("ab_tests")
        .update({
          status: "finished",
          winner: "",
          finished_at: now,
          updated_at: now,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ test: data });
    }

    case "winner": {
      if (row.status !== "running") {
        return NextResponse.json(
          { error: "Only a running experiment can declare a winner" },
          { status: 409 }
        );
      }
      const winner = body.winner;
      if (winner !== "a" && winner !== "b") {
        return NextResponse.json(
          { error: "winner must be 'a' or 'b'" },
          { status: 400 }
        );
      }
      // B wins → its text becomes the live site copy.
      if (winner === "b") {
        const { error: blockError } = await client
          .from("content_blocks")
          .update({ value: row.variant_b, updated_at: now })
          .eq("key", row.block_key);
        if (blockError) {
          return NextResponse.json(
            { error: blockError.message },
            { status: 500 }
          );
        }
      }
      const { data, error } = await client
        .from("ab_tests")
        .update({
          status: "finished",
          winner,
          finished_at: now,
          updated_at: now,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const publish = await publishSite();
      return NextResponse.json({ test: data, publish });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = sb();
  const { data: test, error: findError } = await client
    .from("ab_tests")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!test) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }
  if (test.status === "running") {
    return NextResponse.json(
      { error: "Stop the experiment before deleting it" },
      { status: 409 }
    );
  }
  const { error } = await client.from("ab_tests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
