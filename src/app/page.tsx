"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

const SITE_URL =
  process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://alvee-wellness.vercel.app";

const SECTIONS = [
  { href: "/manage/offers", table: "offers", label: "Offers", sub: "Pricing, tiers, badges" },
  { href: "/manage/testimonials", table: "testimonials", label: "Testimonials", sub: "Social proof quotes" },
  { href: "/manage/faqs", table: "faqs", label: "FAQs", sub: "Questions & answers" },
  { href: "/manage/lead_magnets", table: "lead_magnets", label: "Lead Magnets", sub: "Free resources" },
  { href: "/gallery", table: "gallery_images", label: "Gallery", sub: "Photos & media" },
];

export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pub, setPub] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    SECTIONS.forEach(async (s) => {
      try {
        const { rows } = await api<{ rows: unknown[] }>(`/api/table/${s.table}`);
        setCounts((c) => ({ ...c, [s.table]: rows.length }));
      } catch {
        /* table unreachable — leave count blank */
      }
    });
  }, []);

  const publish = async () => {
    setBusy(true);
    setPub("");
    try {
      await api("/api/publish", { method: "POST" });
      setPub("✅ Live site republished — changes are live.");
    } catch (e) {
      setPub(`⚠️ ${e instanceof Error ? e.message : "Publish failed"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="row-actions">
          <a
            className="btn"
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            View live site ↗
          </a>
          <button className="btn btn--green" onClick={publish} disabled={busy}>
            {busy ? "Publishing…" : "⚡ Publish now"}
          </button>
        </div>
        <p>
          Every save publishes automatically within seconds. The button above
          is a manual re-push if you ever want to force it.
        </p>
      </div>

      {pub && <div className={`msg ${pub.startsWith("⚠️") ? "msg--err" : ""}`}>{pub}</div>}

      <div className="tiles">
        {SECTIONS.map((s) => (
          <Link key={s.table} href={s.href} className="tile">
            <div className="num">{counts[s.table] ?? "…"}</div>
            <div className="lbl">{s.label}</div>
            <div className="sub">{s.sub}</div>
          </Link>
        ))}
        <Link href="/settings" className="tile">
          <div className="num">⚙️</div>
          <div className="lbl">Site Settings</div>
          <div className="sub">Calendly link, email, stats</div>
        </Link>
        <Link href="/content" className="tile">
          <div className="num">✏️</div>
          <div className="lbl">Page Text</div>
          <div className="sub">Headlines & paragraphs</div>
        </Link>
      </div>

      <div className="card card--flat">
        <strong>How this works</strong>
        <p style={{ color: "var(--body)", fontSize: 13.5, marginTop: 6 }}>
          Edit anything → hit Save → the live site regenerates itself within a
          few seconds. Text supports simple markup: <code>**bold**</code>,{" "}
          <code>*green word*</code>, <code>~red word~</code> and{" "}
          <code>[link text](/page)</code>. Images uploaded in Gallery get a
          public URL you can also use as a lead-magnet link.
        </p>
      </div>
    </>
  );
}
