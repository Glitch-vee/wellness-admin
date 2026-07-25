"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, saveMsg, type Publish } from "@/lib/api";
import { TABLES } from "@/lib/schema";
import { BLOCK_KINDS, SEC_KINDS, kindMeta, isSecKind } from "@/lib/blocks";
import { canConvert } from "@/lib/convert";
import { hasStyle } from "@/lib/blockstyle";
import { sectionTextRows } from "@/lib/sectext";
import { STATIC_PAGES } from "@/lib/pages";
import BlockEditor, { type BlockDraft } from "@/components/builder/BlockEditor";
import BlockPalette from "@/components/builder/BlockPalette";
import TextPop, {
  type TextPopHandle,
  type TextRow,
  type Rect,
} from "@/components/builder/TextPop";
import BlockStylePop, {
  type BlockStylePopHandle,
} from "@/components/builder/BlockStylePop";
import MediaPop, {
  type MediaPopHandle,
} from "@/components/builder/MediaPop";
import FieldInput from "@/components/FieldInput";
import InlinePreview from "@/components/InlinePreview";

/**
 * The visual page builder: block rail on the left, the real live page on the
 * right. Click a section in the preview to select its block, drag cards to
 * reorder, add blocks from a visual palette. Works for CMS pages
 * (/builder/page/<id>), offer pages (/builder/offer/<id>) — they share the
 * same block system — and the seven hand-built site pages
 * (/builder/site/<key>), where the rail lists the page's editable text.
 *
 * On every type, clicking keyed text in the preview opens the floating
 * TextPop editor. The builder owns the ONE window "message" listener and
 * forwards cms:focus / cms:rect / cms:ready to TextPop through its handle,
 * so block selection and text editing coexist without duplicate listeners.
 */

const SITE =
  process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://alvee-wellness.vercel.app";
// Fail closed: no parsable site origin → no preview, no postMessage at all.
const SITE_ORIGIN = (() => {
  try {
    return new URL(SITE).origin;
  } catch {
    return "";
  }
})();

type Row = Record<string, unknown> & { id: string };

/** One of a row's jsonb columns, defensively read ({} when absent). */
function jsonOf(row: Row, column: string): Record<string, unknown> {
  const v = row[column];
  return v && typeof v === "object" && !Array.isArray(v)
    ? { ...(v as Record<string, unknown>) }
    : {};
}

/** A block row's layout jsonb, defensively read ({} when absent). */
function layoutOf(row: Row): Record<string, unknown> {
  return jsonOf(row, "layout");
}

/**
 * The editable draft for a block row — kind, copy, media, grid layout, the
 * per-element style and the typed props. The last two arrive with a pending
 * migration, so they read as {} on rows saved before it lands.
 */
function draftOf(row: Row): BlockDraft {
  return {
    kind: String(row.kind ?? "text"),
    heading: String(row.heading ?? ""),
    body: String(row.body ?? ""),
    media_url: String(row.media_url ?? ""),
    layout: layoutOf(row),
    style: jsonOf(row, "style"),
    props: jsonOf(row, "props"),
  };
}

/** Merge a style patch into a style map; null / "" clears that prop. */
function mergeStyle(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "" || v === undefined) delete next[k];
    else next[k] = v;
  }
  return next;
}

/** Tiny "½ / ⅓ / ⅔ / align" chips for a collapsed block card. */
function layoutChips(row: Row): string[] {
  const l = layoutOf(row);
  const chips: string[] = [];
  const span = Number(l.span);
  if (span === 5) chips.push("⅚");
  else if (span === 4) chips.push("⅔");
  else if (span === 3) chips.push("½");
  else if (span === 2) chips.push("⅓");
  else if (span === 1) chips.push("⅙");
  if (l.align === "left") chips.push("←");
  else if (l.align === "center") chips.push("↔");
  else if (l.align === "right") chips.push("→");
  if (l.shape === "circle") chips.push("◯");
  if (l.size === "big") chips.push("L");
  return chips;
}

/** A block row's parent_id (container link), "" when none. */
function parentIdOf(row: Row): string {
  return String(row.parent_id ?? "").trim();
}

/** True for the `row` container kind. */
function isRowKind(row: Row): boolean {
  return String(row.kind ?? "") === "row";
}

type Tree = { top: Row[]; childrenOf: Map<string, Row[]> };

/**
 * Split the flat, sort-ordered block list into a tree that mirrors the
 * site's builder: parent_id null → top level; a block whose parent is ANY
 * row (top-level or itself nested) becomes that row's child in childrenOf,
 * keyed by the parent's own id — so childrenOf works at any depth, not just
 * one level. The renderer/palette still cap actual nesting at 2 levels; this
 * function just reflects whatever parent_id structure exists (matches
 * blocktree.ts on the site side). Order within each scope is by sort_order.
 */
function buildTree(list: Row[]): Tree {
  const sorted = [...list].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );
  const byId = new Map(sorted.map((r) => [r.id, r]));
  const childrenOf = new Map<string, Row[]>();
  const top: Row[] = [];
  for (const b of sorted) {
    const pid = parentIdOf(b);
    const parent = pid ? byId.get(pid) : undefined;
    if (parent && isRowKind(parent)) {
      const arr = childrenOf.get(pid) ?? [];
      arr.push(b);
      childrenOf.set(pid, arr);
    } else {
      top.push(b);
    }
  }
  return { top, childrenOf };
}

/** Flatten a tree back to one DFS list: each row immediately followed by its
 *  children (recursing into a nested row's own children too, capped at the
 *  same 2-level depth the renderer enforces). This is the desired global
 *  sort_order for a reorder. */
function flattenTree(
  top: Row[],
  childrenOf: Map<string, Row[]>,
  depth = 0
): Row[] {
  const out: Row[] = [];
  for (const t of top) {
    out.push(t);
    if (isRowKind(t) && depth < 2) {
      out.push(...flattenTree(childrenOf.get(t.id) ?? [], childrenOf, depth + 1));
    }
  }
  return out;
}

/**
 * Columns that land with the pending migration. A save that mentions one of
 * them in its error is retried without ALL of them, so copy edits never
 * hard-fail while the database catches up.
 */
const PENDING_COLS = ["layout", "style", "props", "parent_id"];

/** The warn toast for a save that had to drop pending columns. */
function pendingFlash(
  skipped: string[]
): { text: string; tone: "warn" } | null {
  if (skipped.length === 0) return null;
  return {
    text: skipped.some((c) => c !== "layout")
      ? "Saved — styling needs the pending database update."
      : "Saved — layout needs the pending database update.",
    tone: "warn",
  };
}

type Cfg = {
  table: string;
  childTable: string;
  fk: string;
  backHref: string;
  backLabel: string;
  pathOf: (row: Row) => string;
};

const CFGS: Record<string, Cfg> = {
  page: {
    table: "pages",
    childTable: "page_sections",
    fk: "page_id",
    backHref: "/pages",
    backLabel: "Pages",
    // The "home" system page renders at the site root.
    pathOf: (r) =>
      String(r.slug ?? "") === "home" ? "/" : `/${String(r.slug ?? "")}`,
  },
  offer: {
    table: "offers",
    childTable: "offer_sections",
    fk: "offer_id",
    backHref: "/manage/offers",
    backLabel: "Offers",
    pathOf: (r) => `/offers/${String(r.slug ?? "")}`,
  },
};

export default function BuilderPage() {
  const params = useParams<{ type: string; id: string }>();
  const router = useRouter();
  const isSite = params.type === "site";
  const cfg = isSite ? undefined : CFGS[params.type];
  const parentId = params.id;
  const sitePage = isSite
    ? STATIC_PAGES.find((p) => p.key === parentId)
    : undefined;

  const [parent, setParent] = useState<Row | null>(null);
  const [blocks, setBlocks] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [palette, setPalette] = useState(false);
  // When the palette is opened via a row's "＋ Add inside", this holds that
  // row's id so the new block is inserted as its child; null = top level.
  const [paletteParent, setPaletteParent] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // Keyed page text (content_blocks) — powers the site rail and TextPop.
  const [textRows, setTextRows] = useState<TextRow[]>([]);
  const [activeTextKey, setActiveTextKey] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());
  const [dirtyTextKeys, setDirtyTextKeys] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [activeMediaKind, setActiveMediaKind] = useState<string | null>(null);
  const [activeMediaUrl, setActiveMediaUrl] = useState("");
  const [activeMediaCaption, setActiveMediaCaption] = useState("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragIdx = useRef<number | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const textCardRefs = useRef(new Map<string, HTMLDivElement>());
  const textPopRef = useRef<TextPopHandle>(null);
  const blockPopRef = useRef<BlockStylePopHandle>(null);
  const mediaPopRef = useRef<MediaPopHandle>(null);
  const selectedRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const textRowsRef = useRef<TextRow[]>([]);
  const draftRef = useRef<BlockDraft | null>(null);
  selectedRef.current = selected;
  dirtyRef.current = dirty;
  textRowsRef.current = textRows;
  draftRef.current = draft;

  const post = useCallback((m: Record<string, unknown>) => {
    if (!SITE_ORIGIN) return;
    iframeRef.current?.contentWindow?.postMessage(m, SITE_ORIGIN);
  }, []);

  const showFlash = useCallback((m: { text: string; tone: "ok" | "warn" }) => {
    setFlash(m);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(
      () => setFlash(null),
      m.tone === "warn" ? 6000 : 2400
    );
  }, []);

  /**
   * Reload the live preview — but only when the save actually reached the
   * live site; after a failed publish the old preview is the honest one.
   */
  const bumpPreview = useCallback((publish?: Publish) => {
    if (publish?.ok === false) return;
    post({ type: "cms:reload" });
  }, [post]);

  const load = useCallback(async () => {
    if (!cfg) return;
    try {
      const [p, s] = await Promise.all([
        api<{ rows: Row[] }>(`/api/table/${cfg.table}`),
        api<{ rows: Row[] }>(`/api/table/${cfg.childTable}`),
      ]);
      const row = p.rows.find((r) => r.id === parentId) ?? null;
      setParent(row);
      setBlocks(
        s.rows
          .filter((r) => String(r[cfg.fk] ?? "") === parentId)
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      );
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Load failed"}`);
    } finally {
      setLoaded(true);
    }
  }, [cfg, parentId]);

  useEffect(() => {
    load();
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [load]);

  // Keyed page text, fetched once for every builder type. On the `site`
  // type this IS the rail; on page/offer it lets keyed text (e.g. the
  // booking band) open TextPop. Failure there is non-fatal.
  useEffect(() => {
    api<{ rows: TextRow[] }>("/api/blocks")
      .then((d) => setTextRows(d.rows))
      .catch((e) => {
        // Without the rows, clicked text can't open an editor on any type —
        // say so instead of silently ignoring clicks.
        setMsg(`⚠️ ${e instanceof Error ? e.message : "Couldn't load page text"}`);
      })
      .finally(() => {
        if (isSite) setLoaded(true);
      });
  }, [isSite]);

  const confirmDiscard = useCallback(() => {
    if (!dirtyRef.current) return true;
    return window.confirm("Discard unsaved changes to this block?");
  }, []);

  const blocksRef = useRef<Row[]>([]);
  blocksRef.current = blocks;

  // The rail is a one-level tree: top-level cards, with a row's children
  // indented beneath it. Rebuilt whenever the flat block list changes.
  const tree = useMemo(() => buildTree(blocks), [blocks]);

  const selectBlock = useCallback(
    (id: string | null, opts?: { locate?: boolean }) => {
      const prev = selectedRef.current;
      if (id === prev) return;
      if (!confirmDiscard()) return;
      // Leaving a block drops its unsaved styling — put the preview back to
      // what's actually stored, so what you see stays what's saved.
      if (prev) {
        const pb = blocksRef.current.find((r) => r.id === prev);
        if (pb) {
          post({ type: "cms:block-style", id: prev, style: jsonOf(pb, "style") });
        }
      }
      setSelected(id);
      setDirty(false);

      // Close media pop on switch or clear
      setActiveMediaId(null);
      setActiveMediaKind(null);
      setActiveMediaUrl("");
      setActiveMediaCaption("");

      if (id) {
        const b = blocksRef.current.find((r) => r.id === id);
        setDraft(b ? draftOf(b) : null);
        post({ type: "cms:block-active", id });
        if (opts?.locate !== false) post({ type: "cms:block-locate", id });

        // Bring the card into view in the rail.
        requestAnimationFrame(() => {
          cardRefs.current
            .get(id)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      } else {
        setDraft(null);
        post({ type: "cms:block-active", id: null });
      }
    },
    [confirmDiscard, post]
  );

  const openSettings = useCallback(() => {
    if (!parent) return;
    setSettingsDraft({ ...parent });
    setSettings(true);
  }, [parent]);

  /**
   * Open the floating text editor for a keyed text row. From the rail we
   * also tell the preview to highlight + scroll to it (it answers with
   * cms:rect, which anchors the pop); from a preview click the site already
   * did both and sent the rect along with cms:focus.
   */
  const openTextKey = useCallback(
    (key: string, opts?: { locate?: boolean }) => {
      setActiveTextKey(key);
      if (opts?.locate) {
        post({ type: "cms:active", key });
        post({ type: "cms:locate", key });
      }
      requestAnimationFrame(() => {
        textCardRefs.current
          .get(key)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [post]
  );

  // ---- messages from the previewed page (the ONE listener) ----
  useEffect(() => {
    if (!SITE_ORIGIN) return; // preview disabled — accept nothing
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== SITE_ORIGIN) return;
      const d = e.data as {
        type?: string;
        id?: string;
        key?: string;
        rect?: Rect;
        beforeId?: string | null;
        span?: number;
        value?: string;
        width?: string;
        height?: string;
        top?: string;
        left?: string;
        rotate?: string;
        k?: string; // cms:block-key's pressed key — NOT `key` (that's the keyed-text field above)
        shift?: boolean;
        action?: "front" | "back" | "forward" | "backward"; // cms:block-layer
        draggedId?: string; // cms:block-relayout
        targetId?: string;
        side?: "left" | "right";
      };
      /** Shared z-nudge for cms:block-key's [ / ] and the on-canvas layer
       * buttons — only ever acts on the currently selected block. */
      const nudgeLayer = (action: "front" | "back" | "forward" | "backward") => {
        const style = draftRef.current?.style ?? {};
        const cur = Number(style.z ?? 0) || 0;
        const z =
          action === "front"
            ? 999
            : action === "back"
              ? 0
              : Math.min(999, Math.max(0, cur + (action === "forward" ? 1 : -1)));
        patchBlockStyleRef.current({ z: String(z) });
      };
      if (d?.type === "cms:block-focus" && d.id) {
        if (d.id === "hero") {
          openSettings();
          return;
        }
        // Clicking a block in the preview selects its rail card and opens
        // the rail — every field a block has (text, media, style, layout)
        // lives there. No on-canvas popup.
        selectBlock(d.id, { locate: false });
        setRailOpen(true);
      } else if (d?.type === "cms:block-drop" && d.id) {
        // Preview drag-drop: slot a block immediately before a sibling in its
        // OWN scope (top level, or within one row), then persist the reflowed
        // order via the same /api/reorder path the rail drag uses.
        if (!cfg) return;
        const list = blocksRef.current;
        const block = list.find((r) => r.id === d.id);
        if (!block || d.beforeId === d.id) return;
        const { top, childrenOf } = buildTree(list);
        const pid = parentIdOf(block);
        // The scope to reorder — the other scope stays untouched.
        const scope = pid ? [...(childrenOf.get(pid) ?? [])] : [...top];
        const from = scope.findIndex((r) => r.id === d.id);
        if (from < 0) return;
        const [moved] = scope.splice(from, 1);
        // beforeId absent / in another scope → land at the end.
        const at = d.beforeId
          ? scope.findIndex((r) => r.id === d.beforeId)
          : -1;
        const insertAt = at < 0 ? scope.length : at;
        if (insertAt === from) return; // already before beforeId — no move
        scope.splice(insertAt, 0, moved);
        if (pid) childrenOf.set(pid, scope);
        applyOrderRef.current(flattenTree(pid ? top : scope, childrenOf));
      } else if (d?.type === "cms:block-resize" && d.id) {
        // Preview resize handle: set a TOP-LEVEL block's grid width. Row
        // children size by their column, not span — ignore those. Draft
        // only, like every other on-canvas edit — no write, no reload,
        // until Save Changes.
        if (!cfg) return;
        const resizeId = d.id;
        const block = blocksRef.current.find((r) => r.id === resizeId);
        if (!block || parentIdOf(block) !== "") return;
        const span = Number(d.span);
        const layout = layoutOf(block);
        // 6 (or anything invalid) → clear span for full width; 5/4/3/2/1 set it.
        if (span >= 1 && span <= 5) layout.span = span;
        else delete layout.span;
        setBlocks((bs) => bs.map((b) => (b.id === resizeId ? { ...b, layout } : b)));
        setDirtyBlockIds((prev) => {
          const next = new Set(prev);
          next.add(resizeId);
          return next;
        });
        showFlash({ text: "Width draft updated", tone: "ok" });
      } else if (d?.type === "cms:block-freesize" && d.id) {
        // Corner/edge free-resize (width/height/top/left, all px) — draft
        // only, same as cms:block-resize above.
        if (!cfg) return;
        const id = d.id;
        const block = blocksRef.current.find((r) => r.id === id);
        if (!block) return;
        const style = jsonOf(block, "style");
        if (d.width !== undefined) style.width = d.width;
        if (d.height !== undefined) style.height = d.height;
        if (d.top !== undefined) style.top = d.top;
        if (d.left !== undefined) style.left = d.left;
        setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, style } : b)));
        if (id === selectedRef.current)
          setDraft((cur) => (cur ? { ...cur, style } : cur));
        setDirtyBlockIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        showFlash({ text: "Size draft updated", tone: "ok" });
      } else if (d?.type === "cms:block-rotate" && d.id) {
        if (!cfg) return;
        const id = d.id;
        const block = blocksRef.current.find((r) => r.id === id);
        if (!block) return;
        const style = jsonOf(block, "style");
        style.rotate = d.rotate;
        setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, style } : b)));
        if (id === selectedRef.current)
          setDraft((cur) => (cur ? { ...cur, style } : cur));
        setDirtyBlockIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        showFlash({ text: "Rotation draft updated", tone: "ok" });
      } else if (d?.type === "cms:block-move" && d.id) {
        // Free drag-to-move for an overlay block — top/left, px.
        if (!cfg) return;
        const id = d.id;
        const block = blocksRef.current.find((r) => r.id === id);
        if (!block) return;
        const style = jsonOf(block, "style");
        style.top = d.top;
        style.left = d.left;
        setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, style } : b)));
        if (id === selectedRef.current)
          setDraft((cur) => (cur ? { ...cur, style } : cur));
        setDirtyBlockIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        showFlash({ text: "Position draft updated", tone: "ok" });
      } else if (d?.type === "cms:block-key" && d.id) {
        // Keyboard nudge, forwarded from the preview (it owns keyboard focus
        // inside its own iframe — see PreviewBridge.tsx's onKeyDown). Only
        // the currently selected block can be nudged.
        const id = d.id;
        if (id !== selectedRef.current) return;
        const block = blocksRef.current.find((r) => r.id === id);
        if (!block) return;
        const style = draftRef.current?.style ?? {};
        const overlay = style.position === "overlay";
        const step = d.shift ? 10 : 1;
        if (d.k === "[" || d.k === "]") {
          const fwd = d.k === "]";
          nudgeLayer(d.shift ? (fwd ? "front" : "back") : fwd ? "forward" : "backward");
        } else if (overlay && (d.k === "ArrowUp" || d.k === "ArrowDown")) {
          const cur = Number.parseInt(String(style.top ?? "0"), 10) || 0;
          patchBlockStyleRef.current({
            top: `${cur + (d.k === "ArrowDown" ? step : -step)}px`,
          });
        } else if (overlay && (d.k === "ArrowLeft" || d.k === "ArrowRight")) {
          const cur = Number.parseInt(String(style.left ?? "0"), 10) || 0;
          patchBlockStyleRef.current({
            left: `${cur + (d.k === "ArrowRight" ? step : -step)}px`,
          });
        } else if (!overlay && (d.k === "ArrowUp" || d.k === "ArrowDown")) {
          // Overlay blocks are out of flow — reordering has no visual
          // effect, so only non-overlay blocks alias the rail's up/down.
          const dir = d.k === "ArrowDown" ? 1 : -1;
          const { top, childrenOf } = buildTree(blocksRef.current);
          const pid = parentIdOf(block);
          if (pid) {
            const idx = (childrenOf.get(pid) ?? []).findIndex((k) => k.id === id);
            if (idx >= 0) moveChildRef.current(pid, idx, dir as -1 | 1);
          } else {
            const idx = top.findIndex((t) => t.id === id);
            if (idx >= 0) moveTopRef.current(idx, dir as -1 | 1);
          }
        }
      } else if (
        d?.type === "cms:block-relayout" &&
        d.draggedId &&
        d.targetId &&
        d.side
      ) {
        // Dropped block B beside block A's edge: A already in a row -> join
        // it; otherwise wrap both into a brand-new row. Real DB writes (row
        // creation can't be optimistic), reuses the exact moveInto/
        // wrapIntoRow paths the rail's own row controls use.
        if (!cfg) return;
        const dragged = blocksRef.current.find((r) => r.id === d.draggedId);
        const target = blocksRef.current.find((r) => r.id === d.targetId);
        if (!dragged || !target) return;
        const targetParent = parentIdOf(target);
        if (targetParent) void moveIntoRef.current(dragged, targetParent);
        else void wrapIntoRowRef.current(target, dragged, d.side);
      } else if (d?.type === "cms:block-layer" && d.id && d.action) {
        // On-canvas layer buttons — same constraint as cms:block-key.
        if (d.id !== selectedRef.current) return;
        nudgeLayer(d.action);
      } else if (d?.type === "cms:focus" && d.key) {
        // Keyed text clicked in the preview — open TextPop over it.
        if (!textRowsRef.current.some((r) => r.key === d.key)) return;
        if (d.rect) textPopRef.current?.setRect(d.key, d.rect);
        openTextKey(d.key);
      } else if (d?.type === "cms:text-change" && d.key && d.value !== undefined) {
        const key = d.key;
        const value = d.value;
        setTextRows((rs) =>
          rs.map((r) => (r.key === key ? { ...r, value } : r))
        );
        setDirtyTextKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        showFlash({ text: "Draft updated inline", tone: "ok" });
      } else if (d?.type === "cms:rect" && d.key && d.rect) {
        textPopRef.current?.setRect(d.key, d.rect);
      } else if (d?.type === "cms:ready") {
        const id = selectedRef.current;
        if (id) {
          post({ type: "cms:block-active", id });
          post({ type: "cms:block-locate", id });
        }
        textPopRef.current?.notifyReady();
        blockPopRef.current?.notifyReady();
        mediaPopRef.current?.notifyReady();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selectBlock, openSettings, post, openTextKey, cfg, showFlash, bumpPreview]);

  // ---- block mutations ----

  /**
   * Send a section insert/update. Pre-migration the layout / style / props /
   * parent_id columns don't exist and Postgres rejects the payload naming the
   * missing one — retry once without ALL of them (a single retry can't chase
   * them one at a time) so copy edits never hard-fail; `skipped` lets callers
   * say which half of the save is waiting on the database.
   */
  const sendSection = useCallback(
    async (
      url: string,
      method: "POST" | "PUT",
      payload: Record<string, unknown>
    ): Promise<{ d: { row: Row; publish?: Publish }; skipped: string[] }> => {
      try {
        const d = await api<{ row: Row; publish?: Publish }>(url, {
          method,
          body: JSON.stringify(payload),
        });
        return { d, skipped: [] };
      } catch (e) {
        const text = e instanceof Error ? e.message : "";
        const sent = PENDING_COLS.filter((c) => c in payload);
        // Drop only the column Postgres actually named, so a combined
        // width + colour edit doesn't silently lose the half that would save.
        const named = sent.filter((c) => text.toLowerCase().includes(c));
        if (named.length === 0) throw e;
        const rest = { ...payload };
        for (const c of named) delete rest[c];
        const d = await api<{ row: Row; publish?: Publish }>(url, {
          method,
          body: JSON.stringify(rest),
        });
        return { d, skipped: named };
      }
    },
    []
  );

  const saveAllChanges = useCallback(async () => {
    if (!cfg) return;
    setSavingAll(true);
    setMsg("");
    try {
      const promises: Promise<unknown>[] = [];

      if (dirtyBlockIds.size > 0) {
        const blockPromises = Array.from(dirtyBlockIds).map(async (id) => {
          const block = blocksRef.current.find((b) => b.id === id);
          if (!block) return;
          const { d } = await sendSectionRef.current(
            `/api/table/${cfg.childTable}/${id}`,
            "PUT",
            block
          );
          setBlocks((bs) => bs.map((b) => (b.id === id ? d.row : b)));
        });
        promises.push(...blockPromises);
      }

      if (dirtyTextKeys.size > 0) {
        const rowsToSave = textRowsRef.current.filter((r) => dirtyTextKeys.has(r.key));
        if (rowsToSave.length > 0) {
          const textPromise = api("/api/blocks", {
            method: "PUT",
            body: JSON.stringify({ rows: rowsToSave }),
          });
          promises.push(textPromise);
        }
      }

      await Promise.all(promises);

      setDirtyBlockIds(new Set());
      setDirtyTextKeys(new Set());
      showFlash({ text: "All drafts saved to database", tone: "ok" });
      post({ type: "cms:reload" });
    } catch (e) {
      setMsg(`Save failed: ${e instanceof Error ? e.message : "Error saving changes"}`);
    } finally {
      setSavingAll(false);
    }
  }, [cfg, dirtyBlockIds, dirtyTextKeys, showFlash, post]);

  const saveMediaUrl = useCallback(
    (id: string, url: string, caption: string) => {
      if (!cfg) return;
      const block = blocks.find((b) => b.id === id);
      if (!block) return;

      setBlocks((bs) =>
        bs.map((b) => (b.id === id ? { ...b, media_url: url, heading: caption } : b))
      );
      setDirtyBlockIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      post({ type: "cms:block-media", id, url, caption });
      showFlash({ text: "Media draft updated", tone: "ok" });
    },
    [cfg, blocks, post, showFlash]
  );

  const saveBlock = useCallback(() => {
    const id = selectedRef.current;
    if (!cfg || !id || !draft) return;
    const block = blocksRef.current.find((b) => b.id === id);
    if (!block) return;

    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...draft } : b)));
    setDirtyBlockIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setDirty(false);
    showFlash({ text: "Draft updated", tone: "ok" });
  }, [cfg, draft, showFlash]);

  const cancelEdit = useCallback(() => {
    const id = selectedRef.current;
    const b = blocksRef.current.find((r) => r.id === id);
    if (b) {
      setDraft(draftOf(b));
      // Discarding also un-does the live style the panel was previewing.
      post({ type: "cms:block-style", id: b.id, style: jsonOf(b, "style") });
    }
    setDirty(false);
  }, [post]);

  /**
   * The on-canvas toolbar edits the SAME draft.style the rail's Style tab does:
   * merge the patch into draft.style, mark dirty, and post the live style so
   * the preview updates — identical to the inline onPatch the rail passes to
   * BlockEditor, so both surfaces stay in lock-step.
   */
  const patchBlockStyle = useCallback(
    (patch: Record<string, unknown>) => {
      const id = selectedRef.current;
      const d = draftRef.current;
      if (!id || !d) return;
      const style = mergeStyle(d.style ?? {}, patch);
      setDraft((cur) => (cur ? { ...cur, style } : cur));
      setDirty(true);
      post({ type: "cms:block-style", id, style });
    },
    [post]
  );
  // Reached from the ONE message listener above via a ref — same
  // temporal-dead-zone dodge as applyOrderRef/sendSectionRef.
  const patchBlockStyleRef = useRef(patchBlockStyle);
  patchBlockStyleRef.current = patchBlockStyle;

  /** Esc in the toolbar: drop the unsaved style, live-revert to what's saved. */
  const revertBlockStyle = useCallback(() => {
    const id = selectedRef.current;
    const b = blocksRef.current.find((r) => r.id === id);
    if (!b) return;
    const saved = jsonOf(b, "style");
    setDraft((d) => (d ? { ...d, style: saved } : d));
    post({ type: "cms:block-style", id: b.id, style: saved });
  }, [post]);

  const addBlock = useCallback(
    async (kind: string, containerId?: string | null) => {
      if (!cfg) return;
      const meta = kindMeta(kind);
      // Inside a row: land after that row's last child (or the row itself).
      // Top level: land after every block. Ordering is only ever compared
      // within a scope, so a modest offset is enough to sit last.
      let sortOrder: number;
      if (containerId) {
        const { childrenOf } = buildTree(blocksRef.current);
        const kids = childrenOf.get(containerId) ?? [];
        const rowRow = blocksRef.current.find((b) => b.id === containerId);
        const base = kids.length
          ? Math.max(...kids.map((k) => Number(k.sort_order ?? 0)))
          : Number(rowRow?.sort_order ?? 0);
        sortOrder = base + 5;
      } else {
        sortOrder =
          blocksRef.current.reduce(
            (m, b) => Math.max(m, Number(b.sort_order ?? 0)),
            0
          ) + 10;
      }
      setPalette(false);
      setBusy(true);
      setMsg("");
      try {
        const { d } = await sendSection(`/api/table/${cfg.childTable}`, "POST", {
          [cfg.fk]: parentId,
          kind,
          heading: meta.starter.heading,
          body: meta.starter.body,
          media_url: "",
          layout: {},
          style: {},
          // Seed the typed settings from the kind's starter (e.g. shape
          // form=circle, card style=plain, icon name=star) so a fresh block
          // renders sensibly before it's touched.
          props: meta.starter.props ?? {},
          // A container link only when adding inside a row.
          ...(containerId ? { parent_id: containerId } : {}),
          sort_order: sortOrder,
          active: true,
        });
        setBlocks((bs) => [...bs, d.row]);
        setSelected(d.row.id);
        setDirty(false);
        setDraft(draftOf(d.row));
        showFlash(saveMsg(d.publish));
        bumpPreview(d.publish);
        requestAnimationFrame(() => {
          cardRefs.current
            .get(d.row.id)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      } catch (e) {
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Add failed"}`
        );
      } finally {
        setBusy(false);
      }
    },
    [cfg, parentId, sendSection, showFlash, bumpPreview]
  );

  /** Persist a full new order (drag-drop, arrows, duplicate). */
  const applyOrder = useCallback(
    async (list: Row[]) => {
      if (!cfg) return;
      setBlocks(list.map((b, i) => ({ ...b, sort_order: (i + 1) * 10 })));
      try {
        const d = await api<{ ok: boolean; publish?: Publish }>("/api/reorder", {
          method: "POST",
          body: JSON.stringify({
            table: cfg.childTable,
            ids: list.map((b) => b.id),
          }),
        });
        if (d.publish?.ok === false) showFlash(saveMsg(d.publish));
        bumpPreview(d.publish);
      } catch (e) {
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Reorder failed"}`
        );
        await load();
      }
    },
    [cfg, bumpPreview, load, showFlash]
  );

  // The preview's drag-drop / resize branches live in the ONE message
  // listener defined ABOVE these helpers — reach the latest applyOrder /
  // sendSection through refs so the listener never re-subscribes or trips
  // the temporal dead zone by naming them in its dependency array.
  const applyOrderRef = useRef(applyOrder);
  applyOrderRef.current = applyOrder;
  const sendSectionRef = useRef(sendSection);
  sendSectionRef.current = sendSection;

  /** Persist a rearranged tree by flattening it to one DFS order. */
  const applyTree = useCallback(
    (top: Row[], childrenOf: Map<string, Row[]>) =>
      applyOrder(flattenTree(top, childrenOf)),
    [applyOrder]
  );

  /** Move a TOP-LEVEL card among its top-level peers only. */
  const moveTop = useCallback(
    (index: number, dir: -1 | 1) => {
      const { top, childrenOf } = buildTree(blocksRef.current);
      const j = index + dir;
      if (j < 0 || j >= top.length) return;
      [top[index], top[j]] = [top[j], top[index]];
      applyTree(top, childrenOf);
    },
    [applyTree]
  );
  const moveTopRef = useRef(moveTop);
  moveTopRef.current = moveTop;

  /** Move a child card among its siblings inside the same row only. */
  const moveChild = useCallback(
    (rowId: string, index: number, dir: -1 | 1) => {
      const { top, childrenOf } = buildTree(blocksRef.current);
      const kids = childrenOf.get(rowId) ?? [];
      const j = index + dir;
      if (j < 0 || j >= kids.length) return;
      [kids[index], kids[j]] = [kids[j], kids[index]];
      childrenOf.set(rowId, kids);
      applyTree(top, childrenOf);
    },
    [applyTree]
  );
  const moveChildRef = useRef(moveChild);
  moveChildRef.current = moveChild;

  /** Warn + reload when a parent_id write couldn't stick (pre-migration). */
  const nestingBlocked = useCallback(
    (skipped: string[]) => {
      if (!skipped.includes("parent_id")) return false;
      showFlash({
        text: "Columns need the pending database update.",
        tone: "warn",
      });
      load();
      return true;
    },
    [showFlash, load]
  );

  /** Detach a child back to top level, right after its former row. */
  const moveOut = useCallback(
    async (block: Row) => {
      if (!cfg) return;
      const rowId = parentIdOf(block);
      setBusy(true);
      setMsg("");
      try {
        const { d, skipped } = await sendSection(
          `/api/table/${cfg.childTable}/${block.id}`,
          "PUT",
          { ...block, parent_id: null }
        );
        if (nestingBlocked(skipped)) return;
        const list = blocksRef.current.map((b) => (b.id === block.id ? d.row : b));
        const { top, childrenOf } = buildTree(list);
        const rest = top.filter((t) => t.id !== block.id);
        const at = rest.findIndex((t) => t.id === rowId);
        rest.splice(at >= 0 ? at + 1 : rest.length, 0, d.row);
        await applyTree(rest, childrenOf);
        showFlash(saveMsg(d.publish));
      } catch (e) {
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Move failed"}`
        );
      } finally {
        setBusy(false);
      }
    },
    [cfg, sendSection, nestingBlocked, applyTree, showFlash]
  );

  /** Pull a top-level card into the row directly above it, as its last child. */
  const moveInto = useCallback(
    async (block: Row, rowId: string) => {
      if (!cfg) return;
      setBusy(true);
      setMsg("");
      try {
        const { d, skipped } = await sendSection(
          `/api/table/${cfg.childTable}/${block.id}`,
          "PUT",
          { ...block, parent_id: rowId }
        );
        if (nestingBlocked(skipped)) return;
        const list = blocksRef.current.map((b) => (b.id === block.id ? d.row : b));
        const { top, childrenOf } = buildTree(list);
        const kids = (childrenOf.get(rowId) ?? []).filter((k) => k.id !== block.id);
        childrenOf.set(rowId, [...kids, d.row]);
        await applyTree(top, childrenOf);
        showFlash(saveMsg(d.publish));
      } catch (e) {
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Move failed"}`
        );
      } finally {
        setBusy(false);
      }
    },
    [cfg, sendSection, nestingBlocked, applyTree, showFlash]
  );
  const moveIntoRef = useRef(moveInto);
  moveIntoRef.current = moveInto;

  /** Wrap two top-level blocks into a brand-new row, side by side — the
   * drag-to-relayout counterpart of moveInto (for when the drop target
   * isn't already in a row). Reuses moveInto twice to place both children
   * in the right order once the row itself exists. */
  const wrapIntoRow = useCallback(
    async (target: Row, dragged: Row, side: "left" | "right") => {
      if (!cfg) return;
      setBusy(true);
      setMsg("");
      try {
        const { d } = await sendSection(`/api/table/${cfg.childTable}`, "POST", {
          [cfg.fk]: parentId,
          kind: "row",
          heading: "",
          body: "",
          media_url: "",
          layout: {},
          style: {},
          props: { columns: 2 },
          sort_order: Number(target.sort_order ?? 0),
          active: true,
        });
        const rowId = d.row.id;
        const first = side === "left" ? dragged : target;
        const second = side === "left" ? target : dragged;
        await moveInto(first, rowId);
        await moveInto(second, rowId);
        showFlash({ text: "Arranged into a Columns block", tone: "ok" });
      } catch (e) {
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Group failed"}`
        );
      } finally {
        setBusy(false);
      }
    },
    [cfg, parentId, sendSection, moveInto, showFlash]
  );
  const wrapIntoRowRef = useRef(wrapIntoRow);
  wrapIntoRowRef.current = wrapIntoRow;

  /** The POST body that clones one block's content into a fresh row. */
  const copyPayload = useCallback(
    (block: Row, over: Record<string, unknown>) => ({
      [cfg!.fk]: parentId,
      kind: block.kind,
      heading: block.heading,
      body: block.body,
      media_url: block.media_url,
      layout: layoutOf(block),
      style: jsonOf(block, "style"),
      props: jsonOf(block, "props"),
      sort_order: Number(block.sort_order ?? 0) + 1,
      active: block.active,
      ...over,
    }),
    [cfg, parentId]
  );

  const duplicateBlock = useCallback(
    async (block: Row) => {
      if (!cfg) return;
      setBusy(true);
      setMsg("");
      try {
        // A row is copied WITH its children: clone the row first, then each
        // child re-parented to the new row (parent_id has on-delete-cascade,
        // so the copies live and die with their new row). buildTree's
        // childrenOf now tracks children of ANY row (see buildTree above),
        // so this reads correctly whether `block` is top-level or nested.
        if (isRowKind(block)) {
          const kids = buildTree(blocksRef.current).childrenOf.get(block.id) ?? [];
          const { d: rowRes } = await sendSection(
            `/api/table/${cfg.childTable}`,
            "POST",
            copyPayload(block, { parent_id: parentIdOf(block) || null })
          );
          const newRow = rowRes.row;
          const newKids: Row[] = [];
          for (const [ci, c] of kids.entries()) {
            const { d: cRes } = await sendSection(
              `/api/table/${cfg.childTable}`,
              "POST",
              copyPayload(c, {
                parent_id: newRow.id,
                sort_order: Number(newRow.sort_order ?? 0) + ci + 1,
              })
            );
            newKids.push(cRes.row);
          }
          const { top, childrenOf: co } = buildTree([
            ...blocksRef.current,
            newRow,
            ...newKids,
          ]);
          co.set(newRow.id, newKids);
          await applyTree(top, co);
          if (rowRes.publish?.ok !== false) showFlash(saveMsg(rowRes.publish));
          return;
        }

        const { d } = await sendSection(
          `/api/table/${cfg.childTable}`,
          "POST",
          copyPayload(block, {
            parent_id: parentIdOf(block) || null,
          })
        );
        const { top, childrenOf } = buildTree([...blocksRef.current, d.row]);
        await applyTree(top, childrenOf);
        if (d.publish?.ok !== false) showFlash(saveMsg(d.publish));
      } catch (e) {
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Duplicate failed"}`
        );
      } finally {
        setBusy(false);
      }
    },
    [cfg, sendSection, copyPayload, applyTree, showFlash]
  );

  const deleteBlock = useCallback(
    async (block: Row) => {
      if (!cfg) return;
      const row = isRowKind(block);
      const m = kindMeta(String(block.kind ?? ""));
      if (
        !window.confirm(
          row
            ? "Delete this Columns block and everything inside it? This can't be undone."
            : `Delete this ${m.label} block? This can't be undone.`
        )
      )
        return;
      setBusy(true);
      setMsg("");
      try {
        const d = await api<{ ok: boolean; publish?: Publish }>(
          `/api/table/${cfg.childTable}/${block.id}`,
          { method: "DELETE" }
        );
        // The row's children are removed server-side by on-delete-cascade —
        // reload so the rail drops them too. Plain blocks prune in place.
        if (row) {
          setSelected(null);
          setDraft(null);
          setDirty(false);
          await load();
        } else {
          setBlocks((bs) => bs.filter((b) => b.id !== block.id));
          if (selectedRef.current === block.id) {
            setSelected(null);
            setDraft(null);
            setDirty(false);
          }
        }
        showFlash(saveMsg(d.publish));
        bumpPreview(d.publish);
      } catch (e) {
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Delete failed"}`
        );
      } finally {
        setBusy(false);
      }
    },
    [cfg, showFlash, bumpPreview, load]
  );

  /**
   * Break a designed section into editable molecule elements, in place. The
   * server copies the section's real text onto the new blocks; the whole page
   * is reversible via "Reset to designed layout".
   */
  const convertBlock = useCallback(
    async (secId: string) => {
      if (
        !window.confirm(
          "Break this designed section into editable elements? Its current text is copied into ordinary blocks you can then restyle and reorder. You can undo any time with “Reset to designed layout” in Page settings."
        )
      )
        return;
      setBusy(true);
      setMsg("");
      try {
        const d = await api<{ ok: boolean; publish?: Publish }>(
          "/api/section-convert",
          { method: "POST", body: JSON.stringify({ sectionId: secId }) }
        );
        setSelected(null);
        setDraft(null);
        setDirty(false);
        await load();
        showFlash(saveMsg(d.publish));
        bumpPreview(d.publish);
      } catch (e) {
        setMsg(
          `Couldn't convert — ${
            e instanceof Error ? e.message : "failed"
          }. The page is unchanged.`
        );
      } finally {
        setBusy(false);
      }
    },
    [load, showFlash, bumpPreview]
  );

  const toggleBlock = useCallback(
    async (block: Row) => {
      if (!cfg) return;
      const next = { ...block, active: !block.active };
      setBlocks((bs) => bs.map((b) => (b.id === block.id ? next : b)));
      try {
        const d = await api<{ row: Row; publish?: Publish }>(
          `/api/table/${cfg.childTable}/${block.id}`,
          { method: "PUT", body: JSON.stringify(next) }
        );
        if (d.publish?.ok === false) showFlash(saveMsg(d.publish));
        bumpPreview(d.publish);
      } catch (e) {
        setBlocks((bs) => bs.map((b) => (b.id === block.id ? block : b)));
        setMsg(
          `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
        );
      }
    },
    [cfg, bumpPreview, showFlash]
  );

  // ---- page settings ----
  const saveSettings = useCallback(async () => {
    if (!cfg || !parent) return;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ row: Row; publish?: Publish }>(
        `/api/table/${cfg.table}/${parent.id}`,
        { method: "PUT", body: JSON.stringify(settingsDraft) }
      );
      setParent(d.row);
      setSettings(false);
      showFlash(saveMsg(d.publish));
      bumpPreview(d.publish);
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    } finally {
      setBusy(false);
    }
  }, [cfg, parent, settingsDraft, showFlash, bumpPreview]);

  const deleteParent = useCallback(async () => {
    if (!cfg || !parent) return;
    if (
      !window.confirm(
        `Delete “${String(parent.title ?? "this page")}” and all its blocks? This can't be undone.`
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/api/table/${cfg.table}/${parent.id}`, { method: "DELETE" });
      router.push(cfg.backHref);
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Delete failed"}`
      );
      setBusy(false);
    }
  }, [cfg, parent, router]);

  /** System pages only: restore the page's original designed section list. */
  const resetLayout = useCallback(async () => {
    if (!cfg || !parent) return;
    if (
      !window.confirm(
        "Restore this page's original designed sections? Blocks you added are removed."
      )
    )
      return;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ ok: boolean; publish?: Publish }>(
        "/api/system-reset",
        { method: "POST", body: JSON.stringify({ pageId: parent.id }) }
      );
      setSettings(false);
      setSelected(null);
      setDraft(null);
      setDirty(false);
      await load();
      showFlash(saveMsg(d.publish));
      bumpPreview(d.publish);
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Reset failed"}`
      );
    } finally {
      setBusy(false);
    }
  }, [cfg, parent, load, showFlash, bumpPreview]);

  // ---- settings fields (skip order — the overview handles that) ----
  // System pages keep their address and menu wiring — those fields hide.
  const isSystem = parent?.system === true;
  const settingsFields = useMemo(
    () =>
      (TABLES[cfg?.table ?? ""]?.fields ?? []).filter(
        (f) =>
          f.type !== "parent" &&
          f.name !== "sort_order" &&
          (!isSystem || !["slug", "nav", "nav_label"].includes(f.name))
      ),
    [cfg, isSystem]
  );

  /**
   * One rail card. Top-level cards drag to reorder and, when they're a row,
   * host indented children; child cards can't drag (arrows + "move out" keep
   * their parent_id honest) and gain a "move out" action. Arrows only ever
   * move a card within its own scope.
   */
  const renderCard = (
    b: Row,
    ctx: {
      isChild: boolean;
      idx: number;
      count: number;
      rowId?: string;
      moveIntoRow?: string | null;
    }
  ) => {
    const m = kindMeta(String(b.kind ?? ""));
    const isSel = selected === b.id;
    const off = b.active === false;
    const isChild = ctx.isChild;
    const draggable = !isChild && !isSel;
    const kids = tree.childrenOf.get(b.id) ?? [];
    const cols = (() => {
      const n = Number(jsonOf(b, "props").columns);
      return [2, 3, 4].includes(n) ? n : 2;
    })();
    return (
      <div
        key={b.id}
        ref={(el) => {
          if (el) cardRefs.current.set(b.id, el);
          else cardRefs.current.delete(b.id);
        }}
        className={`bcard ${isSel ? "bcard--on" : ""} ${off ? "bcard--off" : ""} ${
          isChild ? "bcard--child" : ""
        } ${isRowKind(b) ? "bcard--row" : ""} ${
          !isChild && dragOver === ctx.idx ? "bcard--drop" : ""
        }`}
        draggable={draggable}
        onDragStart={
          draggable
            ? () => {
                dragIdx.current = ctx.idx;
              }
            : undefined
        }
        onDragOver={
          !isChild
            ? (e) => {
                e.preventDefault();
                if (dragOver !== ctx.idx) setDragOver(ctx.idx);
              }
            : undefined
        }
        onDragLeave={
          !isChild
            ? () => setDragOver((d) => (d === ctx.idx ? null : d))
            : undefined
        }
        onDrop={
          !isChild
            ? (e) => {
                e.preventDefault();
                setDragOver(null);
                const from = dragIdx.current;
                dragIdx.current = null;
                if (from == null || from === ctx.idx) return;
                const { top, childrenOf } = buildTree(blocksRef.current);
                const [moved] = top.splice(from, 1);
                top.splice(ctx.idx, 0, moved);
                applyTree(top, childrenOf);
              }
            : undefined
        }
        onDragEnd={
          !isChild
            ? () => {
                dragIdx.current = null;
                setDragOver(null);
              }
            : undefined
        }
      >
        <div
          className="bcard__head"
          onClick={() => selectBlock(isSel ? null : b.id)}
        >
          {!isChild && (
            <span className="bcard__grip" title="Drag to reorder" aria-hidden>
              ⠿
            </span>
          )}
          <span className="bcard__kind">
            {m.icon} {m.label}
          </span>
          {!isSel &&
            layoutChips(b).map((c) => (
              <span key={c} className="bcard__laychip" title="Layout">
                {c}
              </span>
            ))}
          {!isSel && hasStyle(b.style) && (
            <span className="bcard__stylechip" title="Custom styling">
              🎨
            </span>
          )}
          {!isSel && isRowKind(b) && (
            <span className="bcard__rowmeta" title="Columns · blocks inside">
              {cols} cols · {kids.length} inside
            </span>
          )}
          <strong className="bcard__title">
            {String(b.heading ?? "") || m.label}
          </strong>
          <div className="bcard__tools" onClick={(e) => e.stopPropagation()}>
            <div className="sorter">
              <button
                type="button"
                className="sorter__btn"
                title="Move up"
                disabled={ctx.idx === 0 || busy}
                onClick={() =>
                  isChild
                    ? moveChild(ctx.rowId!, ctx.idx, -1)
                    : moveTop(ctx.idx, -1)
                }
              >
                ▲
              </button>
              <button
                type="button"
                className="sorter__btn"
                title="Move down"
                disabled={ctx.idx === ctx.count - 1 || busy}
                onClick={() =>
                  isChild
                    ? moveChild(ctx.rowId!, ctx.idx, 1)
                    : moveTop(ctx.idx, 1)
                }
              >
                ▼
              </button>
            </div>
            {isChild && (
              <button
                type="button"
                className="ibtn bcard__movebtn"
                title="Move out of the columns"
                disabled={busy}
                onClick={() => moveOut(b)}
              >
                ⬆
              </button>
            )}
            {!isChild && ctx.moveIntoRow && (
              <button
                type="button"
                className="ibtn bcard__movebtn"
                title="Move into the columns above"
                disabled={busy}
                onClick={() => moveInto(b, ctx.moveIntoRow!)}
              >
                ⬇
              </button>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={!off}
              title={off ? "Hidden — click to show" : "Visible — click to hide"}
              className={`switch ${off ? "" : "switch--on"}`}
              onClick={() => toggleBlock(b)}
            >
              <span className="switch__knob" />
            </button>
            <button
              type="button"
              className="ibtn"
              title="Duplicate block"
              disabled={busy}
              onClick={() => duplicateBlock(b)}
            >
              ⧉
            </button>
            <button
              type="button"
              className="ibtn ibtn--del"
              title="Delete block"
              disabled={busy}
              onClick={() => deleteBlock(b)}
            >
              🗑
            </button>
          </div>
        </div>

        {!isSel && String(b.body ?? "") !== "" && (
          <InlinePreview
            className="preview preview--row bcard__snippet"
            text={String(b.body ?? "").split("\n")[0]}
          />
        )}

        {isSel && draft && (
          <div
            className="bcard__editor"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                saveBlock();
              }
            }}
          >
            {!isSecKind(draft.kind) && (
              <div className="field">
                <label>Block type</label>
                <select
                  value={draft.kind}
                  onChange={(e) => {
                    setDraft({ ...draft, kind: e.target.value });
                    setDirty(true);
                  }}
                >
                  {BLOCK_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.icon} {k.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <BlockEditor
              key={`${b.id}:${draft.kind}`}
              draft={draft}
              onPatch={(p) => {
                setDraft((d) => (d ? { ...d, ...p } : d));
                setDirty(true);
                if (p.style !== undefined) {
                  post({
                    type: "cms:block-style",
                    id: b.id,
                    style: p.style,
                  });
                }
                if (p.layout !== undefined) {
                  post({
                    type: "cms:block-layout",
                    id: b.id,
                    layout: p.layout,
                  });
                }
              }}
            />
            {isSecKind(draft.kind) &&
              (() => {
                const secRows = sectionTextRows(draft.kind, draft.body, textRows);
                if (secRows.length === 0) return null;
                return (
                  <div className="bcard__textlist">
                    <div className="bcard__textlist-title">
                      Text in this section
                    </div>
                    {secRows.map((r) => (
                      <div
                        key={r.key}
                        className="bcard__textlist-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => openTextKey(r.key, { locate: true })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            openTextKey(r.key, { locate: true });
                        }}
                      >
                        <span className="bcard__textlist-label">{r.label}</span>
                        <InlinePreview
                          className="bcard__textlist-snippet"
                          text={(r.value || "—").split("\n")[0]}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            <div className="form-foot">
              <button
                className="btn btn--sm btn--green"
                onClick={saveBlock}
                disabled={busy || !dirty}
              >
                {busy ? "Saving…" : "Save block"}
              </button>
              <button
                className="btn btn--sm"
                onClick={cancelEdit}
                disabled={busy || !dirty}
              >
                Discard
              </button>
              {isSecKind(draft.kind) && canConvert(draft.kind) && (
                <button
                  className="btn btn--sm"
                  title="Replace this designed section with editable element blocks carrying its current text"
                  disabled={busy}
                  onClick={() => convertBlock(b.id)}
                >
                  🧩 Break into elements
                </button>
              )}
              <span className="bcard__savehint">Ctrl+Enter saves</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * A row's children, recursively — a child that's itself a row gets its own
   * kids rendered under it too (one more level), capped at depth 2 to match
   * the renderer/palette's nesting limit. `depth` counts row-levels: 1 for a
   * top row's direct kids, 2 for a nested row's kids (the deepest allowed).
   */
  const renderRowKids = (rowId: string, depth: number) => {
    if (depth > 2) return null;
    const kids = tree.childrenOf.get(rowId) ?? [];
    return (
      <>
        {kids.map((c, ci) => (
          <Fragment key={c.id}>
            {renderCard(c, { isChild: true, idx: ci, count: kids.length, rowId })}
            {isRowKind(c) && renderRowKids(c.id, depth + 1)}
          </Fragment>
        ))}
        <button
          type="button"
          className="bcard-addinside"
          disabled={busy}
          onClick={() => {
            setPaletteParent(rowId);
            setPalette(true);
          }}
        >
          ＋ Add inside
        </button>
      </>
    );
  };

  if (!cfg && !isSite) {
    return <div className="msg msg--err">Unknown builder type.</div>;
  }

  if (isSite && !sitePage) {
    return (
      <div className="msg msg--err">
        That page isn&apos;t one of the site&apos;s pages — it may have been
        renamed. <Link href="/pages">Back to Pages</Link>
      </div>
    );
  }

  const pagePath = sitePage
    ? sitePage.path
    : parent && cfg
      ? cfg.pathOf(parent)
      : "";
  const previewSrc =
    (sitePage || parent) && SITE_ORIGIN
      ? `${SITE}${pagePath}?preview=1&v=${nonce}`
      : "";
  const offerPageOff =
    cfg?.table === "offers" && parent != null && parent.page_enabled === false;
  const siteTextRows = sitePage
    ? textRows.filter((r) => r.page === sitePage.key)
    : [];

  return (
    <>
      <div className="page-head builder-head builder-head--slim">
        <div className="builder-head__left">
          <Link className="btn btn--sm" href={cfg ? cfg.backHref : "/pages"}>
            ← {cfg ? cfg.backLabel : "Pages"}
          </Link>
          <h1>
            {sitePage
              ? sitePage.label
              : parent
                ? String(parent.title ?? "…")
                : "…"}
          </h1>
          {(sitePage || parent) && <span className="chip">{pagePath}</span>}
          {parent && parent.active === false && (
            <span className="chip chip--off">Hidden</span>
          )}
          <button
            type="button"
            className={`btn btn--sm ${railOpen ? "btn--green" : ""}`}
            style={{ marginLeft: 8 }}
            onClick={() => setRailOpen((o) => !o)}
          >
            {railOpen ? "📁 Hide Blocks" : "📁 Show Blocks"}
          </button>
        </div>
        <div className="row-actions">
          {(dirtyBlockIds.size > 0 || dirtyTextKeys.size > 0) && (
            <button
              type="button"
              className="btn btn--green"
              style={{ fontWeight: "bold" }}
              onClick={saveAllChanges}
              disabled={savingAll}
            >
              {savingAll ? "💾 Saving..." : "💾 Save Changes"}
            </button>
          )}
          {!isSite && (
            <button className="btn" onClick={openSettings} disabled={!parent}>
              ⚙️ Page settings
            </button>
          )}
          {(sitePage || parent) && (
            <a
              className="btn"
              href={`${SITE}${pagePath}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View live ↗
            </a>
          )}
          {!isSite && (
            <button
              className="btn btn--green"
              onClick={() => {
                setPaletteParent(null);
                setPalette(true);
              }}
              disabled={!parent}
            >
              + Add block
            </button>
          )}
        </div>
      </div>

      {!SITE_ORIGIN && (
        <div className="msg msg--err">
          Live preview disabled — NEXT_PUBLIC_MAIN_SITE_URL is not configured.
        </div>
      )}
      {msg && <div className="msg msg--err">{msg}</div>}
      {flash && (
        <div className={`cms-flash ${flash.tone === "warn" ? "cms-flash--warn" : ""}`}>
          {flash.text}
        </div>
      )}
      {offerPageOff && (
        <div className="msg">
          This offer's page is switched off — enable “Has own page” in Page
          settings to publish it.
        </div>
      )}

      {loaded && cfg && !parent && (
        <div className="msg msg--err">
          Not found — it may have been deleted.{" "}
          <Link href={cfg.backHref}>Back to {cfg.backLabel}</Link>
        </div>
      )}

      <div className="builder">
        {/* ---------- block rail (or text rail on site pages) ---------- */}
        <div className={`builder__rail ${railOpen ? "" : "builder__rail--closed"}`}>
          {!isSite && (
            <p className="builder__railhint">
              Click any text in the preview to edit it — blocks below are the
              page&apos;s sections.
            </p>
          )}

          {isSite && (
            <p className="builder__railhint">
              This page&apos;s text, ready to edit — click a card here or the
              text itself in the preview.
            </p>
          )}

          {isSite &&
            siteTextRows.map((r) => (
              <div
                key={r.key}
                ref={(el) => {
                  if (el) textCardRefs.current.set(r.key, el);
                  else textCardRefs.current.delete(r.key);
                }}
                className={`bcard bcard--textrow ${
                  activeTextKey === r.key ? "bcard--on" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => openTextKey(r.key, { locate: true })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openTextKey(r.key, { locate: true });
                }}
              >
                <div className="bcard__head">
                  <span className="bcard__kind">✏️</span>
                  <strong className="bcard__title">{r.label}</strong>
                  <span className="bcard__edithint">Edit</span>
                </div>
                <InlinePreview
                  className="preview preview--row bcard__snippet"
                  text={r.value || "—"}
                />
              </div>
            ))}

          {isSite && loaded && siteTextRows.length === 0 && (
            <div className="bcard bcard--empty">
              <p>No editable text found for this page yet.</p>
            </div>
          )}

          {cfg?.table === "pages" && parent && !isSystem && (
            <div
              className="bcard bcard--hero"
              onClick={openSettings}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") openSettings();
              }}
            >
              <div className="bcard__head">
                <span className="bcard__kind">🏷️ Hero</span>
                <strong className="bcard__title">
                  {String(parent.title ?? "")}
                </strong>
                <span className="bcard__edithint">Edit ⚙️</span>
              </div>
              {String(parent.subtitle ?? "") !== "" && (
                <InlinePreview
                  className="preview preview--row bcard__snippet"
                  text={String(parent.subtitle ?? "")}
                />
              )}
            </div>
          )}

          {tree.top.map((b, ti) => {
            const isRow = isRowKind(b);
            const prev = ti > 0 ? tree.top[ti - 1] : null;
            const moveIntoRow =
              prev && isRowKind(prev) && !isRow ? prev.id : null;
            return (
              <Fragment key={b.id}>
                {renderCard(b, {
                  isChild: false,
                  idx: ti,
                  count: tree.top.length,
                  moveIntoRow,
                })}
                {isRow && renderRowKids(b.id, 1)}
              </Fragment>
            );
          })}

          {loaded && parent && blocks.length === 0 && (
            <div className="bcard bcard--empty">
              <p>This page has no blocks yet.</p>
              <button
                className="btn btn--green btn--sm"
                onClick={() => {
                  setPaletteParent(null);
                  setPalette(true);
                }}
              >
                + Add the first block
              </button>
            </div>
          )}

          {blocks.length > 0 && (
            <button
              type="button"
              className="builder__addbtn"
              onClick={() => {
                setPaletteParent(null);
                setPalette(true);
              }}
              disabled={!parent}
            >
              + Add block
            </button>
          )}
        </div>

        {/* ---------- live preview ---------- */}
        <div className="builder__stage">
          <div className="cms__pane-head">
            <span className="cms__pane-title">
              {isSite
                ? "Live preview — click any text to edit it"
                : "Live preview — click a section to edit it"}
            </span>
            {(sitePage || parent) && (
              <a
                className="cms__open"
                href={`${SITE}${pagePath}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open page ↗
              </a>
            )}
          </div>
          <div className="cms__frame-wrap">
            {previewSrc && (
              <iframe
                key={pagePath}
                ref={iframeRef}
                className="cms__frame builder__frame"
                src={previewSrc}
                title="Live preview"
              />
            )}
          </div>
        </div>
      </div>

      {!loaded && <div className="card">Loading…</div>}

      {/* Floating text editor — every builder type gets it. */}
      <TextPop
        ref={textPopRef}
        iframeRef={iframeRef}
        siteOrigin={SITE_ORIGIN}
        rows={textRows}
        activeKey={activeTextKey}
        onClose={() => setActiveTextKey(null)}
        onSaved={(key, value, style) => {
          setTextRows((rs) =>
            rs.map((r) =>
              r.key === key
                ? { ...r, value, ...(style !== undefined ? { style } : {}) }
                : r
            )
          );
          setDirtyTextKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          showFlash({ text: "Text draft updated", tone: "ok" });
        }}
      />

      {/* On-canvas style toolbar — floats over the selected element block. */}
      <BlockStylePop
        ref={blockPopRef}
        iframeRef={iframeRef}
        siteOrigin={SITE_ORIGIN}
        activeId={selected}
        style={draft?.style ?? {}}
        onPatch={patchBlockStyle}
        onDone={saveBlock}
        onRevert={revertBlockStyle}
        onEditText={() => {
          // No keyed text on-canvas for this block (generic content block) —
          // the real editor is its Text field in the rail. Open it there
          // instead of posting a request the preview can't answer.
          if (selected) {
            setRailOpen(true);
            requestAnimationFrame(() => {
              cardRefs.current
                .get(selected)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
          }
        }}
      />

      {/* Floating media editor for image/video blocks */}
      <MediaPop
        ref={mediaPopRef}
        iframeRef={iframeRef}
        activeId={activeMediaId}
        activeKind={activeMediaKind}
        initialUrl={activeMediaUrl}
        initialCaption={activeMediaCaption}
        onSave={saveMediaUrl}
        onClose={() => {
          setActiveMediaId(null);
          setActiveMediaKind(null);
          setActiveMediaUrl("");
          setActiveMediaCaption("");
        }}
      />

      {palette && (
        <BlockPalette
          onPick={(kind) => addBlock(kind, paletteParent)}
          onClose={() => setPalette(false)}
          // Designed sections (sec-*) are no longer addable: they read GLOBAL
          // keyed text, so two of the same kind would show identical copy.
          // Rows already on a page keep rendering and stay editable.
          // Bands restyle the page wrapper — only pages compose that way.
          //
          // Inside a row (paletteParent set), bands are always excluded — a
          // band restyles the whole page, not a column. Rows are excluded
          // only when paletteParent is ITSELF already nested (its own
          // parent_id points at a row): the renderer caps nesting at 2
          // levels, so a 3rd would silently not render. One level of row-
          // inside-row is fine. sec-* never appear in the palette anyway.
          exclude={
            paletteParent
              ? [
                  ...(parentIdOf(
                    blocksRef.current.find((b) => b.id === paletteParent) ??
                      ({} as Row)
                  )
                    ? ["row"]
                    : []),
                  "band",
                  ...SEC_KINDS.map((k) => k.kind),
                ]
              : cfg?.table === "pages"
                ? undefined
                : ["band"]
          }
        />
      )}

      {settings && parent && (
        <div className="overlay" onClick={() => !busy && setSettings(false)}>
          <div
            className="drawer"
            role="dialog"
            aria-label="Page settings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer__head">
              <strong>Page settings</strong>
              <button
                type="button"
                className="ibtn"
                aria-label="Close"
                onClick={() => setSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="drawer__body">
              <div className="field-grid">
                {settingsFields.map((f) => (
                  <FieldInput
                    key={f.name}
                    spec={f}
                    value={settingsDraft[f.name]}
                    onChange={(v) =>
                      setSettingsDraft((d) => ({ ...d, [f.name]: v }))
                    }
                  />
                ))}
              </div>
            </div>
            <div className="drawer__foot">
              <button
                className="btn btn--green"
                onClick={saveSettings}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save settings"}
              </button>
              <button
                className="btn"
                onClick={() => setSettings(false)}
                disabled={busy}
              >
                Cancel
              </button>
              {isSystem && (
                <button
                  className="btn drawer__delete"
                  title="Restore this page's original designed sections"
                  onClick={resetLayout}
                  disabled={busy}
                >
                  ↩️ Reset to designed layout
                </button>
              )}
              {!isSystem && (
                <button
                  className="btn btn--danger drawer__delete"
                  onClick={deleteParent}
                  disabled={busy}
                >
                  Delete page
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
