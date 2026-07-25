"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import "../hub.css";

/**
 * Site map — the whole site as a top-down tree on a pan/zoom canvas.
 * Each page hangs under the page that first leads to it (menu → footer →
 * links → CTAs), so the skeleton reads like an org chart. Every *other*
 * connection (booking CTAs, footer duplicates, cross-links, lead magnets)
 * is drawn as a faint thread that lights up when you hover a card. Orphaned
 * pages and broken links get called out — those are the ones costing visitors.
 */

type NodeKind = "site" | "page" | "offer" | "external" | "missing";

type Node = {
  id: string;
  kind: NodeKind;
  title: string;
  path: string;
  active?: boolean;
  nav?: boolean;
  builderHref?: string;
  pageEnabled?: boolean;
};

type Edge = { from: string; to: string; via: string; label?: string; broken?: boolean };

type Stats = {
  pages: number;
  links: number;
  orphans: string[];
  broken: { from: string; to: string; label: string }[];
};

type Graph = { nodes: Node[]; edges: Edge[]; stats: Stats };

const ICON: Record<NodeKind, string> = {
  site: "🏠",
  page: "📄",
  offer: "💰",
  external: "🔗",
  missing: "⚠️",
};

// ---- canvas geometry (uniform cards, like the reference diagram) ----
const NODE_W = 208;
const NODE_H = 104;
const GAP_X = 34;
const GAP_Y = 78;
const COL = NODE_W + GAP_X; // one horizontal slot
const ROW = NODE_H + GAP_Y; // one vertical band

type Placed = Node & { x: number; y: number; depth: number };
type Anchored = { d: string; mid: { x: number; y: number }; edge: Edge; pair: string };

type Layout = {
  nodes: Placed[];
  tree: Anchored[];
  cross: Anchored[];
  width: number;
  height: number;
};

type View = { x: number; y: number; k: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A rounded right-angle elbow from a card's bottom-centre to another's top-centre. */
function elbow(sx: number, sy: number, ex: number, ey: number): string {
  const midY = (sy + ey) / 2;
  if (Math.abs(ex - sx) < 0.5) return `M${sx},${sy} L${ex},${ey}`;
  const dir = ex > sx ? 1 : -1;
  const r = Math.min(14, Math.abs(ex - sx) / 2, Math.abs(midY - sy));
  return (
    `M${sx},${sy} L${sx},${midY - r}` +
    ` Q${sx},${midY} ${sx + r * dir},${midY}` +
    ` L${ex - r * dir},${midY}` +
    ` Q${ex},${midY} ${ex},${midY + r}` +
    ` L${ex},${ey}`
  );
}

/** A soft curved thread for a non-hierarchy connection. */
function thread(sx: number, sy: number, ex: number, ey: number): string {
  const c = Math.max(38, Math.abs(ey - sy) * 0.42);
  return `M${sx},${sy} C${sx},${sy + c} ${ex},${ey - c} ${ex},${ey}`;
}

export default function SiteMapPage() {
  const router = useRouter();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [err, setErr] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });

  const vpRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const movedRef = useRef(false);
  const didFit = useRef(false);

  useEffect(() => {
    api<Graph>("/api/sitemap")
      .then(setGraph)
      .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load the site map"));
  }, []);

  // ---- lay the graph out as a tidy top-down tree + cross-threads ----
  const layout = useMemo<Layout | null>(() => {
    if (!graph || graph.nodes.length === 0) return null;
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const order = new Map(graph.nodes.map((n, i) => [n.id, i]));

    // adjacency for the hierarchy skeleton (skip external hops — they're leaves)
    const adj = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (byId.get(e.to)?.kind === "external") continue;
      (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to);
    }

    // BFS from home → depth + the parent that first reaches each node
    const depth = new Map<string, number>();
    const parent = new Map<string, string>();
    if (byId.has("/")) {
      depth.set("/", 0);
      const q = ["/"];
      while (q.length) {
        const cur = q.shift()!;
        for (const nx of adj.get(cur) ?? []) {
          if (!byId.has(nx) || depth.has(nx)) continue;
          depth.set(nx, (depth.get(cur) ?? 0) + 1);
          parent.set(nx, cur);
          q.push(nx);
        }
      }
    }

    // children, stably ordered by their position in the node list
    const kids = new Map<string, string[]>();
    for (const [child, par] of parent) {
      (kids.get(par) ?? kids.set(par, []).get(par)!).push(child);
    }
    for (const list of kids.values()) {
      list.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    }

    // slot-x via post-order: leaves take the next slot, parents centre on kids
    const slot = new Map<string, number>();
    let cursor = 0;
    const place = (id: string) => {
      const cs = kids.get(id) ?? [];
      if (!cs.length) {
        slot.set(id, cursor);
        cursor += 1;
        return;
      }
      cs.forEach(place);
      const a = slot.get(cs[0])!;
      const b = slot.get(cs[cs.length - 1])!;
      slot.set(id, (a + b) / 2);
    };
    if (byId.has("/")) {
      place("/");
      cursor += 0.5; // breathing room before the extra bands
    }

    let treeSlots = Math.max(cursor, 1);
    let maxDepth = Math.max(0, ...[...depth.values()]);

    // extra bands below the tree: unlinked internal pages, then external targets
    const unlinked = graph.nodes.filter(
      (n) => n.kind !== "external" && !depth.has(n.id)
    );
    const externals = graph.nodes.filter((n) => n.kind === "external");

    const band = (list: Node[], d: number) => {
      if (!list.length) return;
      const start = (treeSlots - list.length) / 2; // centre the band under the tree
      list.forEach((n, i) => {
        slot.set(n.id, start + i);
        depth.set(n.id, d);
      });
      treeSlots = Math.max(treeSlots, list.length);
    };
    if (unlinked.length) band(unlinked, ++maxDepth);
    if (externals.length) band(externals, ++maxDepth);

    // → pixel coordinates
    const px = new Map<string, { x: number; y: number }>();
    for (const n of graph.nodes) {
      const s = slot.get(n.id) ?? 0;
      const d = depth.get(n.id) ?? 0;
      px.set(n.id, { x: s * COL, y: d * ROW });
    }

    const placed: Placed[] = graph.nodes.map((n) => ({
      ...n,
      x: px.get(n.id)!.x,
      y: px.get(n.id)!.y,
      depth: depth.get(n.id) ?? 0,
    }));

    const width = Math.max(...placed.map((n) => n.x)) + NODE_W;
    const height = Math.max(...placed.map((n) => n.y)) + NODE_H;

    // tree edges = the parent→child skeleton; everything else is a cross-thread
    const treeKey = new Set<string>();
    for (const [child, par] of parent) treeKey.add(`${par}→${child}`);

    const cx = (id: string) => px.get(id)!.x + NODE_W / 2;
    const top = (id: string) => px.get(id)!.y;
    const bot = (id: string) => px.get(id)!.y + NODE_H;

    const tree: Anchored[] = [];
    const crossByPair = new Map<string, Anchored>();

    for (const e of graph.edges) {
      if (!px.has(e.from) || !px.has(e.to)) continue;
      const pair = `${e.from}→${e.to}`;
      if (treeKey.has(pair)) {
        const sx = cx(e.from);
        const sy = bot(e.from);
        const ex = cx(e.to);
        const ey = top(e.to);
        tree.push({
          d: elbow(sx, sy, ex, ey),
          mid: { x: (sx + ex) / 2, y: (sy + ey) / 2 },
          edge: e,
          pair,
        });
      } else {
        if (crossByPair.has(pair)) continue; // collapse duplicate vias onto one thread
        const down = top(e.to) >= bot(e.from);
        const sy = down ? bot(e.from) : top(e.from);
        const ey = down ? top(e.to) : bot(e.to);
        const sx = cx(e.from);
        const ex = cx(e.to);
        crossByPair.set(pair, {
          d: thread(sx, sy, ex, ey),
          mid: { x: (sx + ex) / 2, y: (sy + ey) / 2 },
          edge: e,
          pair,
        });
      }
    }

    return { nodes: placed, tree, cross: [...crossByPair.values()], width, height };
  }, [graph]);

  // in/out counts per node for the "N in · N out" chip
  const io = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    if (!graph) return map;
    for (const n of graph.nodes) map.set(n.id, { in: 0, out: 0 });
    for (const e of graph.edges) {
      const f = map.get(e.from);
      const t = map.get(e.to);
      if (f) f.out += 1;
      if (t) t.in += 1;
    }
    return map;
  }, [graph]);

  // neighbours of the hovered card, for lighting connections + dimming the rest
  const neighbours = useMemo(() => {
    const set = new Set<string>();
    if (!graph || !hovered) return set;
    for (const e of graph.edges) {
      if (e.from === hovered) set.add(e.to);
      if (e.to === hovered) set.add(e.from);
    }
    return set;
  }, [graph, hovered]);

  // ---- fit the whole tree into the viewport ----
  const fit = useCallback(() => {
    const vp = vpRef.current;
    if (!vp || !layout) return;
    const pad = 44;
    const kx = (vp.clientWidth - pad * 2) / layout.width;
    const ky = (vp.clientHeight - pad * 2) / layout.height;
    const k = clamp(Math.min(kx, ky), 0.3, 1.1);
    setView({
      k,
      x: (vp.clientWidth - layout.width * k) / 2,
      y: Math.max(pad, (vp.clientHeight - layout.height * k) / 2),
    });
  }, [layout]);

  // auto-fit once the layout is ready, and on viewport resize
  useLayoutEffect(() => {
    if (!layout) return;
    if (!didFit.current) {
      fit();
      didFit.current = true;
    }
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [layout, fit]);

  // wheel zoom around the cursor (needs a non-passive listener)
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0016);
      setView((v) => {
        const k = clamp(v.k * factor, 0.3, 2);
        const r = k / v.k;
        return { k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r };
      });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const vp = vpRef.current;
    const mx = vp ? vp.clientWidth / 2 : 0;
    const my = vp ? vp.clientHeight / 2 : 0;
    setView((v) => {
      const k = clamp(v.k * factor, 0.3, 2);
      const r = k / v.k;
      return { k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onPointerUp = () => {
    movedRef.current = Boolean(drag.current?.moved);
    drag.current = null;
    // let the click handler read `moved`, then reset on the next tick
    requestAnimationFrame(() => (movedRef.current = false));
  };

  const titleOf = useCallback(
    (id: string) => graph?.nodes.find((n) => n.id === id)?.title ?? id,
    [graph]
  );

  const stats = graph?.stats;

  return (
    <>
      <div className="page-head">
        <h1>Site map</h1>
        <div className="row-actions">
          <Link className="btn" href="/pages">
            📄 Pages
          </Link>
        </div>
      </div>

      {err && <div className="msg msg--err">{err}</div>}
      {!graph && !err && <div className="card">Mapping your site…</div>}

      {graph && stats && (
        <>
          <div className="sm-stats">
            <span>
              <strong>{stats.pages}</strong> pages
            </span>
            <span className="sm-stats__dot">·</span>
            <span>
              <strong>{stats.links}</strong> connections
            </span>
            <span className="sm-stats__dot">·</span>
            <span>
              <strong>{stats.orphans.length}</strong> orphan
              {stats.orphans.length === 1 ? "" : "s"}
            </span>
            <span className="sm-stats__dot">·</span>
            <span>
              <strong>{stats.broken.length}</strong> broken link
              {stats.broken.length === 1 ? "" : "s"}
            </span>
          </div>

          {stats.orphans.length > 0 && (
            <div className="msg">
              🏝️ No other page links to:{" "}
              {stats.orphans.map((id) => titleOf(id)).join(", ")} — visitors can
              only reach {stats.orphans.length === 1 ? "it" : "them"} by typing
              the address.
            </div>
          )}
          {stats.broken.length > 0 && (
            <div className="msg">
              ⛓️‍💥 Broken links:{" "}
              {stats.broken
                .map((b) => `“${b.label}” on ${titleOf(b.from)} → ${b.to}`)
                .join(" · ")}
            </div>
          )}

          {graph.nodes.length === 0 || !layout ? (
            <div className="card">Nothing to map yet — create a page first.</div>
          ) : (
            <div className="sm-stage">
              <div
                className="sm-vp"
                ref={vpRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <div
                  className="sm-canvas"
                  style={{
                    width: layout.width,
                    height: layout.height,
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                  }}
                >
                  <svg
                    className="sm-links"
                    width={layout.width}
                    height={layout.height}
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    aria-hidden
                  >
                    {/* faint cross-threads first, so the tree sits on top */}
                    {layout.cross.map((l) => {
                      const hot =
                        hovered !== null &&
                        (l.edge.from === hovered || l.edge.to === hovered);
                      return (
                        <path
                          key={`x-${l.pair}`}
                          d={l.d}
                          className={`sm-thread ${hot ? "sm-thread--hot" : ""} ${
                            l.edge.broken ? "sm-thread--broken" : ""
                          }`}
                        >
                          <title>{l.edge.label ? `${l.edge.via} — ${l.edge.label}` : l.edge.via}</title>
                        </path>
                      );
                    })}
                    {layout.tree.map((l) => {
                      const hot =
                        hovered !== null &&
                        (l.edge.from === hovered || l.edge.to === hovered);
                      return (
                        <path
                          key={`t-${l.pair}`}
                          d={l.d}
                          className={`sm-wire ${hot ? "sm-wire--hot" : ""} ${
                            l.edge.broken ? "sm-wire--broken" : ""
                          }`}
                        >
                          <title>{l.edge.label ? `${l.edge.via} — ${l.edge.label}` : l.edge.via}</title>
                        </path>
                      );
                    })}
                    {/* labels on the connections touching the hovered card */}
                    {hovered !== null &&
                      [...layout.tree, ...layout.cross]
                        .filter((l) => l.edge.from === hovered || l.edge.to === hovered)
                        .map((l, i) => (
                          <g key={`lbl-${i}`} className="sm-elabel" transform={`translate(${l.mid.x}, ${l.mid.y})`}>
                            <text>{l.edge.label || l.edge.via}</text>
                          </g>
                        ))}
                  </svg>

                  {layout.nodes.map((n) => {
                    const counts = io.get(n.id) ?? { in: 0, out: 0 };
                    const clickable = Boolean(n.builderHref);
                    const dim =
                      hovered !== null && hovered !== n.id && !neighbours.has(n.id);
                    return (
                      <div
                        key={n.id}
                        className={`sm-node sm-node--${n.kind} ${
                          clickable ? "sm-node--link" : ""
                        } ${hovered === n.id ? "sm-node--hot" : ""} ${
                          n.active === false ? "sm-node--off" : ""
                        } ${dim ? "sm-node--dim" : ""}`}
                        style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                        role={clickable ? "link" : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onMouseEnter={() => setHovered(n.id)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => {
                          if (movedRef.current) return;
                          if (n.builderHref) router.push(n.builderHref);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && n.builderHref) router.push(n.builderHref);
                        }}
                        title={clickable ? "Open in the builder" : undefined}
                      >
                        <span className="sm-node__head">
                          <span className="sm-node__icon" aria-hidden>
                            {ICON[n.kind]}
                          </span>
                          <span className="sm-node__title">{n.title}</span>
                        </span>
                        <span className="sm-node__path">{n.path}</span>
                        <span className="sm-node__chips">
                          {n.nav && <span className="sm-chip">menu</span>}
                          {n.active === false && (
                            <span className="sm-chip sm-chip--warn">hidden</span>
                          )}
                          {n.kind === "missing" && (
                            <span className="sm-chip sm-chip--warn">doesn&apos;t exist</span>
                          )}
                          <span className="sm-chip sm-chip--io">
                            {counts.in} in · {counts.out} out
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* floating controls */}
                <div className="sm-toolbar">
                  <button className="sm-zbtn" onClick={() => zoomBy(1.2)} title="Zoom in" aria-label="Zoom in">
                    +
                  </button>
                  <span className="sm-zval">{Math.round(view.k * 100)}%</span>
                  <button className="sm-zbtn" onClick={() => zoomBy(1 / 1.2)} title="Zoom out" aria-label="Zoom out">
                    −
                  </button>
                  <button className="sm-fit" onClick={fit} title="Fit to screen">
                    ⤢ Fit
                  </button>
                </div>
              </div>

              <div className="sm-legend">
                <span className="sm-legend__i"><i className="sm-sw sm-sw--wire" /> Main path</span>
                <span className="sm-legend__i"><i className="sm-sw sm-sw--thread" /> Other links</span>
                <span className="sm-legend__i"><i className="sm-sw sm-sw--broken" /> Broken</span>
                <span className="sm-legend__hint">Drag to pan · scroll to zoom · click a card to edit</span>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
