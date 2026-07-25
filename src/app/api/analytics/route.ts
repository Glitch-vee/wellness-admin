import { NextResponse } from "next/server";
import { sb } from "@/lib/db";

/**
 * Site analytics, aggregated in JS from raw `site_events` rows.
 *
 * GET /api/analytics?days=7|30|90  (default 7)
 * → { days, totals, prev, series, topPages, recent }
 *
 * The "current" window is the last N calendar days (UTC) including today;
 * "prev" is the N days immediately before it, so the tiles can show deltas.
 */

type Ev = {
  created_at: string;
  type: string;
  path: string | null;
  visitor: string | null;
  meta: Record<string, unknown> | null;
};

type Totals = {
  pageviews: number;
  visitors: number;
  ctaClicks: number;
  leads: number;
};

const DAY_MS = 86_400_000;
const WINDOWS = [7, 30, 90];

function tally(events: Ev[]): Totals {
  const visitors = new Set<string>();
  let pageviews = 0;
  let ctaClicks = 0;
  let leads = 0;
  for (const e of events) {
    if (e.visitor) visitors.add(e.visitor);
    if (e.type === "pageview") pageviews++;
    else if (e.type === "cta_click") ctaClicks++;
    else if (e.type === "lead") leads++;
  }
  return { pageviews, visitors: visitors.size, ctaClicks, leads };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wanted = Number(url.searchParams.get("days") || 7);
  const days = WINDOWS.includes(wanted) ? wanted : 7;

  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const start = todayUTC - (days - 1) * DAY_MS; // current window (inclusive)
  const prevStart = todayUTC - (2 * days - 1) * DAY_MS; // previous window

  const client = sb();

  // Retention: quietly trim events older than a year. Fire-and-forget — the
  // dashboard never waits on (or fails because of) housekeeping.
  void client
    .from("site_events")
    .delete()
    .lt("created_at", new Date(Date.now() - 365 * DAY_MS).toISOString())
    .then(
      () => undefined,
      () => undefined
    );

  // Both windows in one paged fetch, newest first (PostgREST caps a single
  // request at ~1000 rows, so page until short).
  const events: Ev[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data, error } = await client
      .from("site_events")
      .select("created_at,type,path,visitor,meta")
      .gte("created_at", new Date(prevStart).toISOString())
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    events.push(...((data ?? []) as Ev[]));
    if (!data || data.length < PAGE) break;
  }

  const current = events.filter((e) => Date.parse(e.created_at) >= start);
  const previous = events.filter((e) => Date.parse(e.created_at) < start);

  // ---- per-day series (zero-filled) ----
  const byDay = new Map<
    string,
    { pageviews: number; visitors: Set<string>; ctaClicks: number; leads: number }
  >();
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    byDay.set(date, { pageviews: 0, visitors: new Set(), ctaClicks: 0, leads: 0 });
  }
  for (const e of current) {
    const bucket = byDay.get(e.created_at.slice(0, 10));
    if (!bucket) continue;
    if (e.visitor) bucket.visitors.add(e.visitor);
    if (e.type === "pageview") bucket.pageviews++;
    else if (e.type === "cta_click") bucket.ctaClicks++;
    else if (e.type === "lead") bucket.leads++;
  }
  const series = [...byDay.entries()].map(([date, d]) => ({
    date,
    pageviews: d.pageviews,
    visitors: d.visitors.size,
    ctaClicks: d.ctaClicks,
    leads: d.leads,
  }));

  // ---- top pages by views ----
  const byPath = new Map<string, { views: number; visitors: Set<string> }>();
  for (const e of current) {
    if (e.type !== "pageview") continue;
    const path = e.path || "/";
    const entry = byPath.get(path) ?? { views: 0, visitors: new Set() };
    entry.views++;
    if (e.visitor) entry.visitors.add(e.visitor);
    byPath.set(path, entry);
  }
  const topPages = [...byPath.entries()]
    .map(([path, d]) => ({ path, views: d.views, visitors: d.visitors.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  // ---- recent activity (last 20 events, newest first) ----
  // Lead events only carry a visitor id, so pull the latest leads and match
  // them up (by visitor, else by closeness in time) for a friendly label.
  const { data: leadRows } = await client
    .from("leads")
    .select("email,name,visitor,created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  const leadByVisitor = new Map<string, { email: string; name: string }>();
  for (const l of leadRows ?? []) {
    if (l.visitor && !leadByVisitor.has(l.visitor)) {
      leadByVisitor.set(l.visitor, {
        email: l.email || "",
        name: l.name || "",
      });
    }
  }
  const leadLabel = (e: Ev): string => {
    const metaEmail = e.meta && typeof e.meta.email === "string" ? e.meta.email : "";
    if (metaEmail) return metaEmail;
    const byVisitor = e.visitor ? leadByVisitor.get(e.visitor) : undefined;
    if (byVisitor) return byVisitor.email || byVisitor.name;
    const at = Date.parse(e.created_at);
    const near = (leadRows ?? []).find(
      (l) => Math.abs(Date.parse(l.created_at) - at) < 2 * 60_000
    );
    return near ? near.email || near.name || "" : "";
  };
  const recent = events.slice(0, 20).map((e) => ({
    at: e.created_at,
    type: e.type,
    path: e.path || "",
    label:
      e.type === "cta_click"
        ? String((e.meta && e.meta.label) || "")
        : e.type === "lead"
          ? leadLabel(e)
          : "",
  }));

  return NextResponse.json({
    days,
    totals: tally(current),
    prev: tally(previous),
    series,
    topPages,
    recent,
  });
}
