"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { STATIC_PAGES } from "@/lib/pages";

/**
 * An href input with a "Pick a page" popover listing every internal
 * destination: the static site pages, custom CMS pages (/<slug>), offer
 * pages (/offers/<slug>) and the scorecard. Free typing still works for
 * external URLs — the popover is just a shortcut.
 *
 * Destinations are fetched lazily the first time the popover opens; if the
 * API is unreachable the static pages still list.
 */

type Dest = { label: string; path: string };

export default function LinkPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dests, setDests] = useState<Dest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadDests = useCallback(async () => {
    setLoading(true);
    const out: Dest[] = STATIC_PAGES.map((p) => ({
      label: p.label,
      path: p.path,
    }));
    const [pages, offers] = await Promise.all([
      api<{ rows: Record<string, unknown>[] }>("/api/table/pages").catch(
        () => ({ rows: [] as Record<string, unknown>[] })
      ),
      api<{ rows: Record<string, unknown>[] }>("/api/table/offers").catch(
        () => ({ rows: [] as Record<string, unknown>[] })
      ),
    ]);
    for (const r of pages.rows) {
      const slug = String(r.slug ?? "").trim();
      if (slug)
        out.push({ label: String(r.title ?? slug), path: `/${slug}` });
    }
    for (const r of offers.rows) {
      const slug = String(r.slug ?? "").trim();
      if (slug && r.page_enabled)
        out.push({ label: String(r.title ?? slug), path: `/offers/${slug}` });
    }
    if (!out.some((d) => d.path === "/scorecard"))
      out.push({ label: "Scorecard", path: "/scorecard" });
    // Dedupe by path — a custom page could shadow a static one.
    const seen = new Set<string>();
    setDests(
      out.filter((d) => {
        if (seen.has(d.path)) return false;
        seen.add(d.path);
        return true;
      })
    );
    setLoading(false);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && dests === null && !loading) loadDests();
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="field linkpick" ref={wrapRef}>
      <label>Link to</label>
      <div className="linkpick__row">
        <input
          value={value}
          placeholder="/about or https://…"
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn btn--sm" onClick={toggle}>
          Pick a page
        </button>
      </div>
      {open && (
        <div className="linkpick__pop">
          {loading && <div className="linkpick__note">Loading pages…</div>}
          {!loading && dests !== null && dests.length === 0 && (
            <div className="linkpick__note">No pages found — type a URL.</div>
          )}
          {!loading &&
            dests?.map((d) => (
              <button
                type="button"
                key={d.path}
                className={`linkpick__item ${
                  d.path === value ? "linkpick__item--on" : ""
                }`}
                onClick={() => {
                  onChange(d.path);
                  setOpen(false);
                }}
              >
                <span className="linkpick__label">{d.label}</span>
                <code className="linkpick__path">{d.path}</code>
              </button>
            ))}
        </div>
      )}
      <span className="hint">
        Pick an internal page or paste any address (external links welcome).
      </span>
    </div>
  );
}
