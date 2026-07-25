"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import StatTile from "@/components/stats/StatTile";
import Bars, { type BarDatum } from "@/components/stats/Bars";
import HBar from "@/components/stats/HBar";
import Feed, { type FeedItem } from "@/components/stats/Feed";
import "../grow.css";

/**
 * Analytics — what the live site did over the last 7 / 30 / 90 days:
 * KPI tiles with deltas + sparklines, visitors-per-day bars, top pages,
 * and a recent-activity feed.
 */

type Totals = {
  pageviews: number;
  visitors: number;
  ctaClicks: number;
  leads: number;
};

type SeriesDay = Totals & { date: string };

type TopPage = { path: string; views: number; visitors: number };

type Data = {
  days: number;
  totals: Totals;
  prev: Totals;
  series: SeriesDay[];
  topPages: TopPage[];
  recent: FeedItem[];
};

const RANGES = [7, 30, 90] as const;

export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Data>(`/api/analytics?days=${days}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setMsg("");
      })
      .catch((e) => {
        if (alive) setMsg(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [days]);

  const barData = useMemo<BarDatum[]>(() => {
    if (!data) return [];
    return data.series.map((s) => {
      const d = new Date(`${s.date}T00:00:00Z`);
      const weekday = d.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      });
      const monthDay = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      return {
        label: days === 7 ? weekday : monthDay,
        value: s.visitors,
        title: `${weekday} · ${monthDay} — ${s.visitors} visitor${s.visitors === 1 ? "" : "s"}`,
      };
    });
  }, [data, days]);

  const empty =
    !!data &&
    data.totals.pageviews === 0 &&
    data.totals.visitors === 0 &&
    data.totals.ctaClicks === 0 &&
    data.totals.leads === 0 &&
    data.recent.length === 0;

  const maxViews = data
    ? Math.max(...data.topPages.map((p) => p.views), 0)
    : 0;

  return (
    <>
      <div className="page-head">
        <h1>Analytics</h1>
        <div className="gw-seg" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r}
              className={r === days ? "on" : ""}
              onClick={() => setDays(r)}
              aria-pressed={r === days}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="msg msg--err">⚠️ {msg}</div>}
      {loading && !data && <div className="card">Loading…</div>}

      {empty && (
        <div className="card gw-empty">
          <div className="gw-empty__art" aria-hidden>
            📡
          </div>
          <strong>Collecting data</strong>
          <p>
            Visit your live site, then refresh — pageviews, clicks and leads
            will land here.
          </p>
        </div>
      )}

      {data && !empty && (
        <div className={loading ? "gw-dim" : ""}>
          <div className="gw-tiles">
            <StatTile
              label="Visitors"
              value={data.totals.visitors}
              prev={data.prev.visitors}
              series={data.series.map((s) => s.visitors)}
            />
            <StatTile
              label="Pageviews"
              value={data.totals.pageviews}
              prev={data.prev.pageviews}
              series={data.series.map((s) => s.pageviews)}
            />
            <StatTile
              label="CTA clicks"
              value={data.totals.ctaClicks}
              prev={data.prev.ctaClicks}
              series={data.series.map((s) => s.ctaClicks)}
            />
            <StatTile
              label="Leads"
              value={data.totals.leads}
              prev={data.prev.leads}
              series={data.series.map((s) => s.leads)}
            />
          </div>

          <div className="card">
            <h2 className="gw-h">Visitors per day</h2>
            <Bars
              data={barData}
              ariaLabel={`Visitors per day over the last ${days} days`}
            />
          </div>

          <div className="gw-cols">
            <div className="card">
              <h2 className="gw-h">Top pages</h2>
              {data.topPages.length === 0 ? (
                <p className="gw-none">No pageviews in this period yet.</p>
              ) : (
                data.topPages.map((p) => (
                  <HBar
                    key={p.path}
                    label={p.path}
                    value={p.views}
                    max={maxViews}
                    meta={`${p.views.toLocaleString("en-US")} views · ${p.visitors.toLocaleString("en-US")} visitors`}
                    title={`${p.path} — ${p.views} views from ${p.visitors} visitors`}
                  />
                ))
              )}
            </div>
            <div className="card">
              <h2 className="gw-h">Recent activity</h2>
              <Feed items={data.recent} empty="No activity in this period yet." />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
