"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, saveMsg, type Publish } from "@/lib/api";
import StatTile from "@/components/molecules/StatTile";
import HBar from "@/components/atoms/HBar";
import Feed, { timeAgo, type FeedItem } from "@/components/molecules/Feed";
import "./grow.css";

/**
 * Dashboard v2 — the morning-coffee view: is the site live, what happened
 * this week, which experiments are running, and one-click jumps into the
 * things you edit most. Every card degrades quietly if its API is missing.
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://alvee-wellness.vercel.app";

type Totals = { pageviews: number; visitors: number; ctaClicks: number; leads: number };
type Analytics = {
  days: number;
  totals: Totals;
  prev: Totals;
  series: (Totals & { date: string })[];
  recent: FeedItem[];
};

type VariantStats = { exposed: number; converted: number; rate: number };
type Test = {
  id: string;
  name: string;
  block_key: string;
  status: "draft" | "running" | "finished";
  stats: { a: VariantStats; b: VariantStats; ready: boolean; lift: number | null };
};

const QUICK_ACTIONS = [
  { icon: "✏️", label: "Edit home page", href: "/builder/site/home" },
  { icon: "📄", label: "New page", href: "/pages?new=1" },
  { icon: "🗺️", label: "Site map", href: "/sitemap" },
  { icon: "🧪", label: "New experiment", href: "/experiments" },
  { icon: "💰", label: "Add offer", href: "/manage/offers" },
  { icon: "🎨", label: "Open Design", href: "/style" },
];

export default function Dashboard() {
  const [lastPub, setLastPub] = useState<Publish | null>(null);
  const [an, setAn] = useState<Analytics | null>(null);
  const [anState, setAnState] = useState<"loading" | "ok" | "err">("loading");
  const [running, setRunning] = useState<Test[] | null>(null);
  const [busy, setBusy] = useState(false);

  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFlash = useCallback((m: { text: string; tone: "ok" | "warn" }) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(m);
    flashTimer.current = setTimeout(() => setFlash(null), m.tone === "warn" ? 6000 : 2400);
  }, []);

  /** Read the recorded outcome of the most recent publish, if any. */
  const loadStatus = useCallback(async () => {
    try {
      const d = await api<{ rows: { key: string; value: string }[] }>("/api/settings");
      const row = d.rows.find((r) => r.key === "last_publish");
      if (!row) {
        setLastPub(null);
        return;
      }
      const parsed = JSON.parse(row.value) as Partial<Publish>;
      if (typeof parsed.ok === "boolean" && typeof parsed.at === "string") {
        setLastPub({ ok: parsed.ok, at: parsed.at, detail: String(parsed.detail ?? "") });
      } else {
        setLastPub(null);
      }
    } catch {
      setLastPub(null); // no record → neutral "auto-publishes on every save"
    }
  }, []);

  useEffect(() => {
    loadStatus();
    api<Analytics>("/api/analytics?days=7")
      .then((d) => {
        setAn(d);
        setAnState("ok");
      })
      .catch(() => setAnState("err"));
    api<{ tests: Test[] }>("/api/experiments")
      .then((d) => setRunning(d.tests.filter((t) => t.status === "running")))
      .catch(() => setRunning([]));
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [loadStatus]);

  const publish = async () => {
    setBusy(true);
    try {
      const d = await api<{ publish?: Publish }>("/api/publish", { method: "POST" });
      showFlash(saveMsg(d.publish));
    } catch {
      showFlash(saveMsg({ ok: false, detail: "", at: new Date().toISOString() }));
    } finally {
      setBusy(false);
      loadStatus();
    }
  };

  const failed = lastPub !== null && lastPub.ok === false;

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>

      {flash && (
        <div className={`cms-flash ${flash.tone === "warn" ? "cms-flash--warn" : ""}`}>
          {flash.text}
        </div>
      )}

      {/* ---------- row 1: site status + KPIs ---------- */}
      <div className="ob-row1">
        <div className={`card ob-status ${failed ? "ob-status--warn" : ""}`}>
          <div className="ob-status__line">
            <span className="ob-status__dot" aria-hidden />
            {failed ? (
              <strong>
                Last publish failed {timeAgo(lastPub.at)} — your latest saves may
                not be live
              </strong>
            ) : lastPub ? (
              <strong>Live — published {timeAgo(lastPub.at)} ✓</strong>
            ) : (
              <strong>Live — auto-publishes on every save</strong>
            )}
          </div>
          {failed && lastPub.detail && (
            <p className="ob-status__detail">{lastPub.detail}</p>
          )}
          <div className="ob-status__actions">
            <button className="btn btn--green btn--sm" onClick={publish} disabled={busy}>
              {busy ? "Publishing…" : "⚡ Publish now"}
            </button>
            <a
              className="btn btn--sm"
              href={SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              View site ↗
            </a>
          </div>
        </div>

        <div className="ob-row1__tiles">
          {anState === "ok" && an ? (
            <>
              <Link href="/analytics" className="ob-tilelink">
                <StatTile
                  label="Visitors"
                  value={an.totals.visitors}
                  prev={an.prev.visitors}
                  series={an.series.map((s) => s.visitors)}
                />
              </Link>
              <Link href="/analytics" className="ob-tilelink">
                <StatTile
                  label="Pageviews"
                  value={an.totals.pageviews}
                  prev={an.prev.pageviews}
                  series={an.series.map((s) => s.pageviews)}
                />
              </Link>
              <Link href="/analytics" className="ob-tilelink">
                <StatTile
                  label="CTA clicks"
                  value={an.totals.ctaClicks}
                  prev={an.prev.ctaClicks}
                  series={an.series.map((s) => s.ctaClicks)}
                />
              </Link>
              <Link href="/leads" className="ob-tilelink">
                <StatTile
                  label="Leads"
                  value={an.totals.leads}
                  prev={an.prev.leads}
                  series={an.series.map((s) => s.leads)}
                />
              </Link>
            </>
          ) : (
            <div className="ob-quiet">
              {anState === "loading"
                ? "Loading this week's numbers…"
                : "Last 7 days will appear here once analytics is set up."}
            </div>
          )}
        </div>
      </div>

      {/* ---------- row 2: activity + experiments ---------- */}
      <div className="ob-cols">
        <div className="card">
          <h2 className="gw-h">Recent activity</h2>
          <Feed
            items={an?.recent ?? []}
            empty="Activity appears once your site gets visits."
          />
        </div>

        <div className="card">
          <h2 className="gw-h">Experiments</h2>
          {running && running.length > 0 ? (
            <>
              {running.slice(0, 2).map((t) => {
                const max = Math.max(t.stats.a.rate, t.stats.b.rate, 0.0001);
                const bLeads = t.stats.b.rate > t.stats.a.rate;
                return (
                  <div className="ob-exp" key={t.id}>
                    <Link href="/experiments" className="ob-exp__name">
                      🧪 {t.name || t.block_key}
                    </Link>
                    <HBar
                      label="A"
                      value={t.stats.a.rate}
                      max={max}
                      tone={bLeads ? "neutral" : "green"}
                      meta={`${(t.stats.a.rate * 100).toFixed(1)}% · ${t.stats.a.exposed} seen`}
                    />
                    <HBar
                      label="B"
                      value={t.stats.b.rate}
                      max={max}
                      tone={bLeads ? "green" : "neutral"}
                      meta={`${(t.stats.b.rate * 100).toFixed(1)}% · ${t.stats.b.exposed} seen`}
                    />
                  </div>
                );
              })}
              <Link href="/experiments" className="ob-more">
                Open experiments →
              </Link>
            </>
          ) : (
            <p className="gw-none">
              Test a headline →{" "}
              <Link href="/experiments" className="ob-more">
                + New experiment
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ---------- row 3: quick actions ---------- */}
      <div className="ob-quick">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.label} href={a.href} className="ob-pill">
            <span aria-hidden>{a.icon}</span> {a.label}
          </Link>
        ))}
      </div>
    </>
  );
}
