"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveMsg, type Publish } from "@/lib/api";
import { STATIC_PAGES } from "@/lib/pages";

/**
 * Ctrl/Cmd+K command palette — jump anywhere in the admin, spawn the common
 * "new …" flows, or republish the site, all without touching the mouse.
 * Zero dependencies: plain fetch, plain subsequence filtering.
 */

const SITE =
  process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://alvee-wellness.vercel.app";

type Command = {
  id: string;
  icon: string;
  title: string;
  /** Quiet right-aligned context (a path, mostly). */
  hint?: string;
  action: { kind: "nav"; href: string } | { kind: "site" } | { kind: "publish" };
};

const STATIC_COMMANDS: Command[] = [
  { id: "nav-dash", icon: "📊", title: "Dashboard", hint: "/", action: { kind: "nav", href: "/" } },
  { id: "nav-pages", icon: "📄", title: "Pages", hint: "/pages", action: { kind: "nav", href: "/pages" } },
  { id: "nav-sitemap", icon: "🗺️", title: "Site map", hint: "/sitemap", action: { kind: "nav", href: "/sitemap" } },
  { id: "nav-offers", icon: "💰", title: "Offer pricing list", hint: "/manage/offers", action: { kind: "nav", href: "/manage/offers" } },
  { id: "nav-design", icon: "🎨", title: "Design", hint: "/style", action: { kind: "nav", href: "/style" } },
  { id: "nav-analytics", icon: "📈", title: "Analytics", hint: "/analytics", action: { kind: "nav", href: "/analytics" } },
  { id: "nav-experiments", icon: "🧪", title: "Experiments", hint: "/experiments", action: { kind: "nav", href: "/experiments" } },
  { id: "nav-leads", icon: "📥", title: "Leads", hint: "/leads", action: { kind: "nav", href: "/leads" } },
  { id: "nav-testimonials", icon: "⭐", title: "Testimonials", hint: "/manage/testimonials", action: { kind: "nav", href: "/manage/testimonials" } },
  { id: "nav-faqs", icon: "❓", title: "FAQs", hint: "/manage/faqs", action: { kind: "nav", href: "/manage/faqs" } },
  { id: "nav-magnets", icon: "🎁", title: "Lead Magnets", hint: "/manage/lead_magnets", action: { kind: "nav", href: "/manage/lead_magnets" } },
  { id: "nav-media", icon: "🖼", title: "Media", hint: "/gallery", action: { kind: "nav", href: "/gallery" } },
  { id: "nav-settings", icon: "⚙️", title: "Settings", hint: "/settings", action: { kind: "nav", href: "/settings" } },
  { id: "act-new-page", icon: "✨", title: "New page", action: { kind: "nav", href: "/pages?new=1" } },
  { id: "act-new-offer", icon: "✨", title: "New offer", action: { kind: "nav", href: "/pages?newoffer=1" } },
  { id: "act-new-exp", icon: "🧪", title: "New experiment", action: { kind: "nav", href: "/experiments" } },
  { id: "act-view-site", icon: "↗", title: "View live site ↗", action: { kind: "site" } },
  { id: "act-publish", icon: "⚡", title: "Publish site now", action: { kind: "publish" } },
  ...STATIC_PAGES.map<Command>((p) => ({
    id: `site-${p.key}`,
    icon: "🏗️",
    title: `Edit ${p.label}`,
    hint: p.path,
    action: { kind: "nav", href: `/builder/site/${p.key}` },
  })),
];

/** Case-insensitive subsequence match: "faq" hits "FAQs", "nw pg" hits "New page". */
function matches(query: string, title: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  const t = title.toLowerCase();
  let i = 0;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) i++;
  }
  return i === q.length;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [dynamic, setDynamic] = useState<Command[]>([]);
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const fetched = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- open / close ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setSel(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  // ---- lazy builder entries on first open; failures just mean fewer rows ----
  useEffect(() => {
    if (!open || fetched.current) return;
    fetched.current = true;
    type Row = { id: string; title?: string };
    api<{ rows: Row[] }>("/api/table/pages")
      .then((d) =>
        setDynamic((cmds) => [
          ...cmds,
          ...d.rows.map<Command>((r) => ({
            id: `pg-${r.id}`,
            icon: "🏗️",
            title: `Edit ${String(r.title ?? "page")} (builder)`,
            action: { kind: "nav", href: `/builder/page/${r.id}` },
          })),
        ])
      )
      .catch(() => {});
    api<{ rows: Row[] }>("/api/table/offers")
      .then((d) =>
        setDynamic((cmds) => [
          ...cmds,
          ...d.rows.map<Command>((r) => ({
            id: `of-${r.id}`,
            icon: "🏗️",
            title: `Edit ${String(r.title ?? "offer")} page (builder)`,
            action: { kind: "nav", href: `/builder/offer/${r.id}` },
          })),
        ])
      )
      .catch(() => {});
  }, [open]);

  const all = useMemo(() => [...STATIC_COMMANDS, ...dynamic], [dynamic]);
  const results = useMemo(
    () => all.filter((c) => matches(query, c.title)).slice(0, 10),
    [all, query]
  );
  const selected = Math.min(sel, Math.max(results.length - 1, 0));

  const showFlash = useCallback((m: { text: string; tone: "ok" | "warn" }) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(m);
    flashTimer.current = setTimeout(
      () => setFlash(null),
      m.tone === "warn" ? 6000 : 2400
    );
  }, []);

  const run = useCallback(
    async (cmd: Command) => {
      setOpen(false);
      if (cmd.action.kind === "nav") {
        router.push(cmd.action.href);
      } else if (cmd.action.kind === "site") {
        window.open(SITE, "_blank", "noopener,noreferrer");
      } else {
        try {
          const d = await api<{ publish?: Publish }>("/api/publish", {
            method: "POST",
          });
          showFlash(saveMsg(d.publish));
        } catch {
          showFlash(
            saveMsg({ ok: false, detail: "", at: new Date().toISOString() })
          );
        }
      }
    },
    [router, showFlash]
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (results.length === 0 ? 0 : (s + 1) % results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) =>
        results.length === 0 ? 0 : (s - 1 + results.length) % results.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[selected];
      if (cmd) run(cmd);
    }
  };

  return (
    <>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div
            className="cmdk"
            role="dialog"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              className="cmdk__input"
              placeholder="Jump to… (type to filter)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSel(0);
              }}
              onKeyDown={onInputKey}
              spellCheck={false}
            />
            <div className="cmdk__list">
              {results.length === 0 && (
                <div className="cmdk__none">No matches — try fewer letters.</div>
              )}
              {results.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cmdk__row ${i === selected ? "on" : ""}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => run(c)}
                >
                  <span className="cmdk__icon" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="cmdk__title">{c.title}</span>
                  {c.hint && <span className="cmdk__hint">{c.hint}</span>}
                </button>
              ))}
            </div>
            <div className="cmdk__foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> open
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      )}
      {flash && (
        <div
          className={`cms-flash ${flash.tone === "warn" ? "cms-flash--warn" : ""}`}
        >
          {flash.text}
        </div>
      )}
    </>
  );
}
