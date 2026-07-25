"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveMsg, type Publish } from "@/lib/api";
import { slugify } from "@/lib/schema";
import { STATIC_PAGES } from "@/lib/pages";
import "../hub.css";

/**
 * Pages hub — every page the site can show, as one uniform card grid:
 *   · Site pages   — the seven hand-built pages (open the site builder)
 *   · Custom pages — block-composed pages, each opening the visual builder
 *   · Offer pages  — one per offer, built with the same block system
 */

const SITE =
  process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://alvee-wellness.vercel.app";

type PageRow = {
  id: string;
  title: string;
  slug: string;
  nav: boolean;
  active: boolean;
  sort_order: number;
  subtitle: string;
  /** True on the seven built-in site pages (absent pre-migration). */
  system?: boolean;
  screenshot_url?: string;
  screenshot_updated_at?: string | null;
};

/** The "home" system page renders at the site root. */
const pagePath = (slug: string) => (slug === "home" ? "/" : `/${slug}`);

type SectionRow = {
  id: string;
  page_id: string;
  kind: string;
  active: boolean;
  sort_order: number;
};

type OfferRow = {
  id: string;
  title: string;
  slug: string;
  page_enabled: boolean;
  active: boolean;
  price: string;
  screenshot_url?: string;
  screenshot_updated_at?: string | null;
};


/**
 * A card's preview area. Shows the live screenshot once it exists; until then
 * a quiet placeholder (a shimmer while it's being captured). The corner button
 * re-captures on demand. No block list — the preview *is* the page.
 */
function PreviewThumb({
  href,
  screenshot,
  busy,
  canShoot,
  onShot,
}: {
  href: string;
  screenshot?: string;
  busy: boolean;
  canShoot: boolean;
  onShot: () => void;
}) {
  return (
    <div className="pgcard__thumb">
      <Link href={href} className="pgcard__thumblink" title="Open in the builder">
        {screenshot ? (
          <img className="pgcard__shot" src={screenshot} alt="" loading="lazy" />
        ) : (
          <span className={`pgcard__loading ${busy ? "is-busy" : ""}`}>
            <em>{busy ? "📸" : canShoot ? "🖼️" : "🚫"}</em>
            {busy ? "Capturing preview…" : canShoot ? "Preview loading…" : "No public page"}
          </span>
        )}
        <span className="pgcard__cta">Open builder →</span>
      </Link>
      {canShoot && (
        <button
          type="button"
          className="pgcard__shotbtn"
          title={screenshot ? "Refresh preview" : "Capture preview"}
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShot();
          }}
        >
          {busy ? "⏳" : screenshot ? "🔄" : "📸"}
        </button>
      )}
    </div>
  );
}

export default function PagesHub() {
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  // one save/publish toast vocabulary
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFlash = (m: { text: string; tone: "ok" | "warn" }) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(m);
    flashTimer.current = setTimeout(() => setFlash(null), m.tone === "warn" ? 6000 : 2400);
  };

  // ---- new page modal ----
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [nav, setNav] = useState(true);

  // ---- new offer modal ----
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerTitle, setOfferTitle] = useState("");
  const [offerSlug, setOfferSlug] = useState("");
  const [offerSlugTouched, setOfferSlugTouched] = useState(false);

  const load = async () => {
    let freshPages: PageRow[] = [];
    let freshOffers: OfferRow[] = [];
    try {
      const [p, s] = await Promise.all([
        api<{ rows: PageRow[] }>("/api/table/pages"),
        api<{ rows: SectionRow[] }>("/api/table/page_sections"),
      ]);
      setPages(p.rows);
      setSections(s.rows);
      freshPages = p.rows;
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Load failed"}`);
    } finally {
      setLoaded(true);
    }
    // Offers are a bonus group — the hub still works if they fail to load.
    try {
      const o = await api<{ rows: OfferRow[] }>("/api/table/offers");
      setOffers(o.rows);
      freshOffers = o.rows;
    } catch {
      setOffers([]);
    }
    // Auto-capture a live preview for anything that doesn't have one yet.
    autoGenerate(freshPages, freshOffers);
  };

  useEffect(() => {
    load();
    // ?new=1 / ?newoffer=1 (palette / dashboard quick action) open the modals.
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") openCreate();
    if (params.get("newoffer") === "1") openCreateOffer();
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocksOf = useMemo(() => {
    const map = new Map<string, SectionRow[]>();
    for (const s of sections) {
      const list = map.get(s.page_id) ?? [];
      list.push(s);
      map.set(s.page_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [sections]);

  // Post-migration the seven site pages live in the pages table (system =
  // true) and open the full builder; pre-migration the column/rows don't
  // exist, so the hub falls back to the hand-built STATIC_PAGES cards.
  const systemRows = pages.filter((p) => p.system === true);
  const customPages = pages.filter((p) => p.system !== true);

  // ---- search across all three groups ----
  const q = search.trim().toLowerCase();
  const hit = (...hay: string[]) =>
    !q || hay.some((h) => h.toLowerCase().includes(q));
  const staticShown = STATIC_PAGES.filter((p) => hit(p.label, p.path));
  const systemShown = systemRows.filter((p) => hit(p.title, pagePath(p.slug)));
  const pagesShown = customPages.filter((p) => hit(p.title, p.slug));
  const offersShown = offers.filter((o) => hit(o.title, o.slug));

  const openCreate = () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setNav(true);
    setCreating(true);
  };

  const openCreateOffer = () => {
    setOfferTitle("");
    setOfferSlug("");
    setOfferSlugTouched(false);
    setCreatingOffer(true);
  };

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ row: PageRow }>("/api/table/pages", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          slug: slug || slugify(title),
          nav,
          nav_label: "",
          eyebrow: "",
          subtitle: "",
          seo_description: "",
          sort_order: (pages.length + 1) * 10,
          active: true,
        }),
      });
      router.push(`/builder/page/${d.row.id}`);
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Create failed"}`
      );
      setBusy(false);
    }
  };

  const createOffer = async () => {
    if (!offerTitle.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ row: OfferRow }>("/api/table/offers", {
        method: "POST",
        body: JSON.stringify({
          title: offerTitle.trim(),
          slug: offerSlug || slugify(offerTitle),
          page_enabled: true,
          active: true,
          featured: false,
          highlight: false,
          sort_order: (offers.length + 1) * 10,
          category: "free",
          outcome: "",
          price: "",
          period: "",
          note: "",
          description: "",
          features: [],
          badge: "",
          cta_label: "",
          cta_href: "",
        }),
      });
      router.push(`/builder/offer/${d.row.id}`);
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Create failed"}`
      );
      setBusy(false);
    }
  };

  const toggleActive = async (page: PageRow) => {
    const next = { ...page, active: !page.active };
    setPages((ps) => ps.map((p) => (p.id === page.id ? next : p)));
    try {
      const d = await api<{ row: PageRow; publish?: Publish }>(
        `/api/table/pages/${page.id}`,
        { method: "PUT", body: JSON.stringify(next) }
      );
      showFlash(saveMsg(d.publish));
    } catch (e) {
      setPages((ps) => ps.map((p) => (p.id === page.id ? page : p)));
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    }
  };

  // ---- preview screenshots (generate + refresh) ----
  const [shotBusy, setShotBusy] = useState<Set<string>>(new Set());

  const genShot = async (
    table: "pages" | "offers",
    id: string,
    path: string,
    opts?: { silent?: boolean }
  ) => {
    const key = `${table}:${id}`;
    setShotBusy((s) => new Set(s).add(key));
    try {
      const d = await api<{ url: string; updated_at: string }>("/api/screenshot", {
        method: "POST",
        body: JSON.stringify({ table, id, path }),
      });
      if (table === "pages") {
        setPages((ps) =>
          ps.map((p) =>
            p.id === id ? { ...p, screenshot_url: d.url, screenshot_updated_at: d.updated_at } : p
          )
        );
      } else {
        setOffers((os) =>
          os.map((o) =>
            o.id === id ? { ...o, screenshot_url: d.url, screenshot_updated_at: d.updated_at } : o
          )
        );
      }
    } catch (e) {
      // Auto-capture failures stay quiet — the card just keeps its placeholder.
      if (!opts?.silent) {
        setMsg(`Couldn't generate preview. ${e instanceof Error ? e.message : "Screenshot failed"}`);
      }
    } finally {
      setShotBusy((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  // Fill in missing previews automatically, a few at a time so we stay gentle
  // on the screenshot service. Only pages/offers that have a live public URL.
  const autoGenerate = (ps: PageRow[], os: OfferRow[]) => {
    const targets: { table: "pages" | "offers"; id: string; path: string }[] = [];
    for (const p of ps) {
      if (p.screenshot_url) continue;
      const live = p.system === true || p.active; // otherwise the URL 404s
      if (live) targets.push({ table: "pages", id: p.id, path: pagePath(p.slug) });
    }
    for (const o of os) {
      if (o.screenshot_url) continue;
      if (o.page_enabled && o.active) {
        targets.push({ table: "offers", id: o.id, path: `/offers/${o.slug}` });
      }
    }
    if (!targets.length) return;

    let i = 0;
    const worker = async () => {
      while (i < targets.length) {
        const t = targets[i++];
        await genShot(t.table, t.id, t.path, { silent: true });
      }
    };
    const CONCURRENCY = 3;
    for (let w = 0; w < Math.min(CONCURRENCY, targets.length); w++) worker();
  };

  const toggleOfferActive = async (offer: OfferRow) => {
    const next = { ...offer, active: !offer.active };
    setOffers((os) => os.map((o) => (o.id === offer.id ? next : o)));
    try {
      const d = await api<{ row: OfferRow; publish?: Publish }>(
        `/api/table/offers/${offer.id}`,
        { method: "PUT", body: JSON.stringify(next) }
      );
      showFlash(saveMsg(d.publish));
    } catch (e) {
      setOffers((os) => os.map((o) => (o.id === offer.id ? offer : o)));
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    }
  };

  const remove = async (page: PageRow) => {
    const n = (blocksOf.get(page.id) ?? []).length;
    if (
      !window.confirm(
        `Delete “${page.title}” and its ${n} block${n === 1 ? "" : "s"}? This can't be undone.`
      )
    )
      return;
    setBusy(true);
    try {
      const d = await api<{ ok: boolean; publish?: Publish }>(
        `/api/table/pages/${page.id}`,
        { method: "DELETE" }
      );
      await load();
      showFlash(saveMsg(d.publish));
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Delete failed"}`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Pages</h1>
        <div className="row-actions ob-hubtools">
          <input
            className="ob-search"
            type="search"
            placeholder="Search pages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search pages"
          />
          <Link className="btn" href="/sitemap">
            🗺️ Site map
          </Link>
          <button className="btn btn--green" onClick={openCreate}>
            + New page
          </button>
          <button className="btn btn--green" onClick={openCreateOffer}>
            + New offer
          </button>
        </div>
      </div>

      {msg && <div className="msg msg--err">{msg}</div>}
      {flash && (
        <div className={`cms-flash ${flash.tone === "warn" ? "cms-flash--warn" : ""}`}>
          {flash.text}
        </div>
      )}

      {/* ============ a) Site pages ============ */}
      <h2 className="ob-ghead">Site pages</h2>

      {systemRows.length > 0 && (
        <div className="pg-grid">
          {systemShown.map((p) => {
            return (
              <div className="pgcard" key={p.id}>
                <PreviewThumb
                  href={`/builder/page/${p.id}`}
                  screenshot={p.screenshot_url}
                  busy={shotBusy.has(`pages:${p.id}`)}
                  canShoot
                  onShot={() => genShot("pages", p.id, pagePath(p.slug))}
                />
                <div className="pgcard__body">
                  <div className="pgcard__titleline">
                    <strong>{p.title}</strong>
                  </div>
                  <div className="pgcard__meta">
                    <span className="chip">{pagePath(p.slug)}</span>
                    <span className="chip">Site page</span>
                  </div>
                  <div className="pgcard__actions">
                    <Link
                      className="btn btn--sm btn--dark"
                      href={`/builder/page/${p.id}`}
                    >
                      🏗️ Edit page
                    </Link>
                    <Link className="btn btn--sm" href="/style">
                      🎨 Design
                    </Link>
                    <a
                      className="btn btn--sm"
                      href={`${SITE}${pagePath(p.slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View ↗
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {systemRows.length > 0 && systemShown.length === 0 && (
        <div className="ob-rows">
          <div className="ob-row ob-row--none">No site page matches “{search}”.</div>
        </div>
      )}

      {systemRows.length === 0 && (
      <div className="pg-grid">
        {staticShown.map((p) => (
          <div className="pgcard" key={p.key}>
            <div className="pgcard__thumb">
              <Link
                href={`/builder/site/${p.key}`}
                className="pgcard__thumblink"
                title="Open in the builder"
              >
                <span className="pgcard__loading">
                  <em>🖼️</em>
                  {p.label}
                </span>
                <span className="pgcard__cta">Open builder →</span>
              </Link>
            </div>
            <div className="pgcard__body">
              <div className="pgcard__titleline">
                <strong>{p.label}</strong>
              </div>
              <div className="pgcard__meta">
                <span className="chip">{p.path}</span>
              </div>
              <div className="pgcard__actions">
                <Link className="btn btn--sm btn--dark" href={`/builder/site/${p.key}`}>
                  🏗️ Edit page
                </Link>
                <Link className="btn btn--sm" href="/style">
                  🎨 Design
                </Link>
                <a
                  className="btn btn--sm"
                  href={`${SITE}${p.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
      {systemRows.length === 0 && staticShown.length === 0 && (
        <div className="ob-rows">
          <div className="ob-row ob-row--none">No site page matches “{search}”.</div>
        </div>
      )}

      {/* ============ b) Custom pages ============ */}
      <h2 className="ob-ghead">Custom pages</h2>

      {loaded && customPages.length === 0 && (
        <div className="card pg-empty">
          <div className="pg-empty__art" aria-hidden>
            🏗️
          </div>
          <strong>No custom pages yet</strong>
          <p>
            Create your first page and build it visually — add blocks, drag
            them into order, and watch the live preview update.
          </p>
          <button className="btn btn--green" onClick={openCreate}>
            + Create your first page
          </button>
        </div>
      )}

      <div className="pg-grid">
        {pagesShown.map((p) => {
          const blocks = blocksOf.get(p.id) ?? [];
          return (
            <div className={`pgcard ${p.active ? "" : "pgcard--off"}`} key={p.id}>
              <PreviewThumb
                href={`/builder/page/${p.id}`}
                screenshot={p.screenshot_url}
                busy={shotBusy.has(`pages:${p.id}`)}
                canShoot={p.active}
                onShot={() => genShot("pages", p.id, `/${p.slug}`)}
              />
              <div className="pgcard__body">
                <div className="pgcard__titleline">
                  <strong>{p.title}</strong>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.active}
                    title={p.active ? "Live — click to hide" : "Hidden — click to publish"}
                    className={`switch ${p.active ? "switch--on" : ""}`}
                    onClick={() => toggleActive(p)}
                  >
                    <span className="switch__knob" />
                  </button>
                </div>
                <div className="pgcard__meta">
                  <span className="chip">/{p.slug}</span>
                  {p.nav && <span className="chip">In menu</span>}
                  <span className="chip chip--off">
                    {blocks.length} block{blocks.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="pgcard__actions">
                  <Link className="btn btn--sm btn--dark" href={`/builder/page/${p.id}`}>
                    🏗️ Edit page
                  </Link>
                  <a
                    className="btn btn--sm"
                    href={`${SITE}/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View ↗
                  </a>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => remove(p)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {loaded && customPages.length > 0 && pagesShown.length === 0 && (
        <div className="ob-rows">
          <div className="ob-row ob-row--none">No custom page matches “{search}”.</div>
        </div>
      )}

      {/* ============ c) Offer pages ============ */}
      <h2 className="ob-ghead hub-ghead">
        Offer pages
        <Link className="hub-glink" href="/manage/offers">
          Pricing list ↗
        </Link>
      </h2>
      <div className="pg-grid">
        {offersShown.map((o) => {
          return (
            <div className={`pgcard ${o.active ? "" : "pgcard--off"}`} key={o.id}>
              <PreviewThumb
                href={`/builder/offer/${o.id}`}
                screenshot={o.screenshot_url}
                busy={shotBusy.has(`offers:${o.id}`)}
                canShoot={o.page_enabled && o.active}
                onShot={() => genShot("offers", o.id, `/offers/${o.slug}`)}
              />
              <div className="pgcard__body">
                <div className="pgcard__titleline">
                  <strong>{o.title}</strong>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={o.active}
                    title={o.active ? "Live — click to hide" : "Hidden — click to publish"}
                    className={`switch ${o.active ? "switch--on" : ""}`}
                    onClick={() => toggleOfferActive(o)}
                  >
                    <span className="switch__knob" />
                  </button>
                </div>
                <div className="pgcard__meta">
                  <span className="chip">/offers/{o.slug}</span>
                  {o.price && <span className="chip chip--hl">{o.price}</span>}
                  {!o.page_enabled && (
                    <span className="chip chip--off">No page yet</span>
                  )}
                </div>
                <div className="pgcard__actions">
                  <Link className="btn btn--sm btn--dark" href={`/builder/offer/${o.id}`}>
                    🏗️ Edit page
                  </Link>
                  {o.page_enabled && (
                    <a
                      className="btn btn--sm"
                      href={`${SITE}/offers/${o.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {loaded && offers.length === 0 && (
        <div className="ob-rows">
          <div className="ob-row ob-row--none">
            No offers yet —{" "}
            <button className="hub-glink" onClick={openCreateOffer} type="button">
              create your first offer
            </button>
            .
          </div>
        </div>
      )}
      {offers.length > 0 && offersShown.length === 0 && (
        <div className="ob-rows">
          <div className="ob-row ob-row--none">No offer matches “{search}”.</div>
        </div>
      )}

      {!loaded && <div className="card">Loading…</div>}

      {creating && (
        <div className="overlay" onClick={() => !busy && setCreating(false)}>
          <div
            className="modal"
            role="dialog"
            aria-label="New page"
            onClick={(e) => e.stopPropagation()}
          >
            <strong className="modal__title">New page</strong>
            <div className="field">
              <label>Page title</label>
              <input
                autoFocus
                value={title}
                placeholder="e.g. Corporate Wellness"
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
              />
            </div>
            <div className="field">
              <label>Page address</label>
              <div className="modal__slug">
                <span>/</span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
              </div>
              <span className="hint">
                The page's URL — don't change it once shared.
              </span>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={nav}
                onChange={(e) => setNav(e.target.checked)}
              />
              Show in the site's top menu
            </label>
            <div className="form-foot">
              <button
                className="btn btn--green"
                onClick={create}
                disabled={busy || !title.trim()}
              >
                {busy ? "Creating…" : "Create & open builder"}
              </button>
              <button
                className="btn"
                onClick={() => setCreating(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {creatingOffer && (
        <div className="overlay" onClick={() => !busy && setCreatingOffer(false)}>
          <div
            className="modal"
            role="dialog"
            aria-label="New offer"
            onClick={(e) => e.stopPropagation()}
          >
            <strong className="modal__title">New offer</strong>
            <div className="field">
              <label>Offer title</label>
              <input
                autoFocus
                value={offerTitle}
                placeholder="e.g. Brand Audit Sprint"
                onChange={(e) => {
                  setOfferTitle(e.target.value);
                  if (!offerSlugTouched) setOfferSlug(slugify(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createOffer();
                }}
              />
            </div>
            <div className="field">
              <label>Page address</label>
              <div className="modal__slug">
                <span>/offers/</span>
                <input
                  value={offerSlug}
                  onChange={(e) => {
                    setOfferSlugTouched(true);
                    setOfferSlug(slugify(e.target.value));
                  }}
                />
              </div>
              <span className="hint">
                The offer page's URL — don't change it once shared.
              </span>
            </div>
            <div className="form-foot">
              <button
                className="btn btn--green"
                onClick={createOffer}
                disabled={busy || !offerTitle.trim()}
              >
                {busy ? "Creating…" : "Create & open builder"}
              </button>
              <button
                className="btn"
                onClick={() => setCreatingOffer(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
