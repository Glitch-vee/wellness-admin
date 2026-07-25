import { NextResponse } from "next/server";
import { sb } from "@/lib/db";
import { publishSite } from "@/lib/publish";

/**
 * Restore a system page's original designed layout: wipe its page_sections
 * and re-insert the canonical seed list — the exact sections the
 * system-pages migration seeded, so "Reset to designed layout" always lands
 * on the site's hand-built composition.
 */

const SEEDS: Record<string, { kind: string; body: string }[]> = {
  home: [
    { kind: "sec-hero", body: "" },
    { kind: "sec-proof", body: "" },
    { kind: "sec-journey", body: "" },
    { kind: "sec-spotlight", body: "" },
    { kind: "sec-testimonials", body: "" },
    { kind: "sec-scoreband", body: "" },
    { kind: "sec-finalcta", body: "" },
  ],
  about: [
    { kind: "sec-about-intro", body: "" },
    { kind: "sec-about-gallery", body: "" },
    { kind: "sec-bookband", body: "about" },
  ],
  offers: [
    { kind: "sec-subhero", body: "offers" },
    { kind: "sec-offers-catalog", body: "" },
    { kind: "sec-guarantees", body: "" },
    { kind: "sec-faq", body: "" },
    { kind: "sec-bookband", body: "offers" },
  ],
  results: [
    { kind: "sec-subhero", body: "results" },
    { kind: "sec-results-metrics", body: "" },
    { kind: "sec-results-ba", body: "" },
    { kind: "sec-results-timeline", body: "" },
    { kind: "sec-bookband", body: "results" },
  ],
  "how-it-works": [
    { kind: "sec-subhero", body: "how\nsetup" },
    { kind: "sec-how-pillars", body: "" },
    { kind: "sec-how-steps", body: "" },
    { kind: "sec-bookband", body: "how" },
  ],
  gallery: [
    { kind: "sec-subhero", body: "gallery\nreveal" },
    { kind: "sec-gallery-grid", body: "" },
  ],
  resources: [
    { kind: "sec-subhero", body: "resources\nreveal" },
    { kind: "sec-magnets", body: "" },
  ],
};

export async function POST(request: Request) {
  let payload: { pageId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const pageId = String(payload.pageId ?? "");
  if (!pageId) {
    return NextResponse.json({ error: "pageId required" }, { status: 400 });
  }

  const client = sb();
  const { data: page, error } = await client
    .from("pages")
    .select("id,slug,system")
    .eq("id", pageId)
    .single();
  // Pre-migration the `system` column doesn't exist — the select errors and
  // there is nothing designed to reset to.
  if (error || !page) {
    return NextResponse.json(
      { error: "Page not found — or system pages aren't set up yet." },
      { status: 400 }
    );
  }
  if (page.system !== true) {
    return NextResponse.json(
      { error: "Only built-in site pages can be reset." },
      { status: 400 }
    );
  }
  const seeds = SEEDS[String(page.slug ?? "")];
  if (!seeds) {
    return NextResponse.json(
      { error: "This page has no designed layout to restore." },
      { status: 400 }
    );
  }

  const del = await client.from("page_sections").delete().eq("page_id", pageId);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }

  const ins = await client.from("page_sections").insert(
    seeds.map((s, i) => ({
      page_id: pageId,
      kind: s.kind,
      heading: "",
      body: s.body,
      media_url: "",
      sort_order: (i + 1) * 10,
      active: true,
    }))
  );
  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  const publish = await publishSite();
  return NextResponse.json({ ok: true, publish });
}
