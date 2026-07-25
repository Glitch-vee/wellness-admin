import { NextResponse } from "next/server";
import { sb } from "@/lib/db";

/**
 * A/B experiments over content blocks.
 *
 * GET  → { tests: [{ ...ab_tests row, stats }] } newest-first, where stats is
 *        computed in JS from site_events since the test started:
 *        exposures = distinct visitors with an ab_expose for that variant,
 *        conversions = distinct visitors with ≥1 cta_click/lead carrying that
 *        variant in their `ab` assignment map.
 * POST { block_key, name?, variant_b? } → { test } — snapshots the block's
 *        current value as variant A and creates a draft.
 */

type TestRow = {
  id: string;
  block_key: string;
  name: string;
  variant_a: string;
  variant_b: string;
  status: "draft" | "running" | "finished";
  winner: "" | "a" | "b";
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type Ev = {
  created_at: string;
  type: string;
  visitor: string | null;
  meta: Record<string, unknown> | null;
  ab: Record<string, unknown> | null;
};

type VariantStats = { exposed: number; converted: number; rate: number };

const MIN_EXPOSURES = 30;

function variantStats(exposed: Set<string>, converted: Set<string>): VariantStats {
  const rate = exposed.size > 0 ? converted.size / exposed.size : 0;
  return { exposed: exposed.size, converted: converted.size, rate };
}

export async function GET() {
  const client = sb();
  const { data, error } = await client
    .from("ab_tests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tests = (data ?? []) as TestRow[];

  // One paged fetch covers every started test; stats are computed per test.
  const startedAts = tests
    .map((t) => t.started_at)
    .filter((s): s is string => Boolean(s))
    .sort();
  const events: Ev[] = [];
  if (startedAts.length > 0) {
    const PAGE = 1000;
    for (let from = 0; from < 20_000; from += PAGE) {
      const { data: rows, error: evError } = await client
        .from("site_events")
        .select("created_at,type,visitor,meta,ab")
        .in("type", ["ab_expose", "cta_click", "lead"])
        .gte("created_at", startedAts[0])
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (evError) {
        return NextResponse.json({ error: evError.message }, { status: 500 });
      }
      events.push(...((rows ?? []) as Ev[]));
      if (!rows || rows.length < PAGE) break;
    }
  }

  const withStats = tests.map((t) => {
    const exposed = { a: new Set<string>(), b: new Set<string>() };
    const converted = { a: new Set<string>(), b: new Set<string>() };
    if (t.started_at) {
      const since = Date.parse(t.started_at);
      for (const e of events) {
        if (!e.visitor || Date.parse(e.created_at) < since) continue;
        if (e.type === "ab_expose") {
          const meta = e.meta ?? {};
          if (meta.test !== t.id) continue;
          if (meta.variant === "a") exposed.a.add(e.visitor);
          else if (meta.variant === "b") exposed.b.add(e.visitor);
        } else {
          const variant = e.ab ? e.ab[t.id] : undefined;
          if (variant === "a") converted.a.add(e.visitor);
          else if (variant === "b") converted.b.add(e.visitor);
        }
      }
    }
    const a = variantStats(exposed.a, converted.a);
    const b = variantStats(exposed.b, converted.b);
    const ready = a.exposed >= MIN_EXPOSURES && b.exposed >= MIN_EXPOSURES;
    const lift = a.rate > 0 ? (b.rate - a.rate) / a.rate : null;
    return { ...t, stats: { a, b, ready, lift } };
  });

  return NextResponse.json({ tests: withStats });
}

export async function POST(request: Request) {
  let body: { block_key?: string; name?: string; variant_b?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.block_key) {
    return NextResponse.json({ error: "block_key required" }, { status: 400 });
  }

  const client = sb();
  const { data: block, error: blockError } = await client
    .from("content_blocks")
    .select("key,value")
    .eq("key", body.block_key)
    .maybeSingle();
  if (blockError) {
    return NextResponse.json({ error: blockError.message }, { status: 500 });
  }
  if (!block) {
    return NextResponse.json({ error: "Unknown block" }, { status: 404 });
  }

  const { data: test, error } = await client
    .from("ab_tests")
    .insert({
      block_key: block.key,
      name: String(body.name ?? "").trim(),
      variant_a: String(block.value ?? ""),
      variant_b: String(body.variant_b ?? ""),
      status: "draft",
      winner: "",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ test });
}
