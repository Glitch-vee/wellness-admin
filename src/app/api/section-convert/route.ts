import { NextResponse } from "next/server";
import { sb } from "@/lib/db";
import { publishSite } from "@/lib/publish";
import { sanitizeRow } from "@/lib/schema";
import {
  canConvert,
  convertSection,
  type ConvertSpec,
  type ConvertCtx,
} from "@/lib/convert";

/**
 * Break ONE designed section (sec-*) into editable molecule elements, in place.
 * Reads the section's real current text from content_blocks / site_settings,
 * runs its recipe (see lib/convert), and replaces the sec-* row with the
 * generated elements — rows carrying their children via parent_id — keeping the
 * surrounding sections where they are. Reversal is page-level: the builder's
 * "Reset to designed layout" restores the whole designed composition.
 */

type Row = Record<string, unknown> & { id: string };

export async function POST(request: Request) {
  let payload: { sectionId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sectionId = String(payload.sectionId ?? "");
  if (!sectionId) {
    return NextResponse.json({ error: "sectionId required" }, { status: 400 });
  }

  const client = sb();

  // The target section.
  const { data: target, error: tErr } = await client
    .from("page_sections")
    .select("id,page_id,kind,body,sort_order")
    .eq("id", sectionId)
    .single();
  if (tErr || !target) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }
  const kind = String(target.kind ?? "");
  if (!canConvert(kind)) {
    return NextResponse.json(
      { error: "This section can't be broken into elements." },
      { status: 400 }
    );
  }
  const pageId = String(target.page_id ?? "");

  // Current text: content_blocks + site_settings, as simple lookups.
  const [blocks, settings] = await Promise.all([
    client.from("content_blocks").select("key,value"),
    client.from("site_settings").select("key,value"),
  ]);
  const blockMap = new Map<string, string>();
  for (const r of blocks.data ?? [])
    blockMap.set(String(r.key), String(r.value ?? ""));
  const settingMap = new Map<string, string>();
  for (const r of settings.data ?? [])
    settingMap.set(String(r.key), String(r.value ?? ""));

  const bodyLines = String(target.body ?? "")
    .split("\n")
    .map((l) => l.trim());
  const ctx: ConvertCtx = {
    text: (k) => blockMap.get(k) ?? "",
    setting: (k) => settingMap.get(k) ?? "",
    prefix: bodyLines[0] ?? "",
    flags: bodyLines.slice(1),
  };

  const specs = convertSection(kind, ctx);
  if (specs.length === 0) {
    return NextResponse.json(
      { error: "Nothing to break out — this section has no text yet." },
      { status: 400 }
    );
  }

  // The page's current top-level order, so the new elements land exactly where
  // the section was and the neighbours keep their places.
  const { data: allRows, error: aErr } = await client
    .from("page_sections")
    .select("id,parent_id,sort_order")
    .eq("page_id", pageId);
  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }
  const top = (allRows ?? [])
    .filter((r) => !r.parent_id)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const idx = top.findIndex((r) => r.id === sectionId);

  // Remove the sec-* row (it has no children).
  const del = await client.from("page_sections").delete().eq("id", sectionId);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }

  // New top-level order: existing before → generated specs → existing after.
  type Slot = { existing?: Row; spec?: ConvertSpec };
  const before = top.slice(0, idx < 0 ? top.length : idx);
  const after = idx < 0 ? [] : top.slice(idx + 1);
  const order: Slot[] = [
    ...before.map((r) => ({ existing: r as Row })),
    ...specs.map((spec) => ({ spec })),
    ...after.map((r) => ({ existing: r as Row })),
  ];

  // Build a page_sections insert row from a spec (children handled by caller).
  const rowFrom = (spec: ConvertSpec, sortOrder: number, parent?: string) => {
    const base: Record<string, unknown> = {
      kind: spec.kind,
      heading: spec.heading ?? "",
      body: spec.body ?? "",
      media_url: spec.media_url ?? "",
      props: spec.props ?? {},
      style: spec.style ?? {},
      layout: spec.layout ?? {},
    };
    // Reuse the same allowlist the builder writes through, so a recipe can
    // never smuggle an unknown prop/style into the row.
    const clean = sanitizeRow("page_sections", base);
    return {
      ...clean,
      page_id: pageId,
      parent_id: parent ?? null,
      sort_order: sortOrder,
      active: true,
    };
  };

  try {
    for (let i = 0; i < order.length; i++) {
      const slot = order[i];
      const sortOrder = (i + 1) * 10;
      if (slot.existing) {
        if (Number(slot.existing.sort_order ?? 0) !== sortOrder) {
          const up = await client
            .from("page_sections")
            .update({ sort_order: sortOrder })
            .eq("id", slot.existing.id);
          if (up.error) throw new Error(up.error.message);
        }
        continue;
      }
      const spec = slot.spec!;
      const ins = await client
        .from("page_sections")
        .insert(rowFrom(spec, sortOrder))
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      if (spec.kind === "row" && spec.children?.length) {
        const childRows = spec.children.map((child, j) =>
          rowFrom(child, (j + 1) * 10, String(ins.data.id))
        );
        const cIns = await client.from("page_sections").insert(childRows);
        if (cIns.error) throw new Error(cIns.error.message);
      }
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: `Convert failed — ${
          e instanceof Error ? e.message : "unknown error"
        }. Use “Reset to designed layout” to restore the page.`,
      },
      { status: 500 }
    );
  }

  const publish = await publishSite();
  return NextResponse.json({ ok: true, publish });
}
