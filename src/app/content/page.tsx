"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, saveMsg, type Publish } from "@/lib/api";
import { pageMeta } from "@/lib/pages";

type Block = { key: string; label: string; page: string; value: string };
type Rect = { top: number; left: number; width: number; height: number };
type Pos = { top: number; left: number; width: number };

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

export default function ContentPage() {
  const [rows, setRows] = useState<Block[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activePage, setActivePage] = useState<string>("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Anchor rect of the block being edited, relative to the iframe viewport.
  const anchor = useRef<Rect | null>(null);
  // Edit queued until the iframe reports ready (after a page switch).
  const pending = useRef<string | null>(null);
  // Live refs so message/scroll handlers never read stale state.
  const editKeyRef = useRef<string | null>(null);
  const draftRef = useRef("");
  editKeyRef.current = editKey;
  draftRef.current = draft;

  const post = useCallback((m: Record<string, unknown>) => {
    if (!SITE_ORIGIN) return;
    iframeRef.current?.contentWindow?.postMessage(m, SITE_ORIGIN);
  }, []);

  // ---- position the floating editor over the anchored text ----
  const reposition = useCallback(() => {
    const a = anchor.current;
    const frame = iframeRef.current;
    if (!a || !frame) {
      setPos(null);
      return;
    }
    const box = frame.getBoundingClientRect();
    const width = Math.min(Math.max(a.width, 320), 460);
    let left = box.left + a.left;
    left = Math.min(left, box.right - width - 8);
    left = Math.max(box.left + 8, Math.max(8, left));

    const elTop = box.top + a.top;
    const elBottom = elTop + a.height;
    const EST_H = 168;
    let top = elBottom + 8;
    if (top + EST_H > window.innerHeight) {
      top = elTop - 8 - EST_H;
      if (top < 8) top = Math.max(8, window.innerHeight - EST_H - 8);
    }
    setPos({ top, left, width });
  }, []);

  const setAnchor = useCallback(
    (r: Rect | null) => {
      anchor.current = r;
      reposition();
    },
    [reposition]
  );

  // ---- load ----
  useEffect(() => {
    // Deep link: /content?page=<key> preselects that page's tab (palette,
    // Pages hub). Falls back to the first page when the key is unknown.
    const wanted = new URLSearchParams(window.location.search).get("page");
    api<{ rows: Block[] }>("/api/blocks")
      .then((d) => {
        setRows(d.rows);
        const ordered = [...d.rows]
          .map((r) => r.page)
          .sort((a, b) => pageMeta(a).order - pageMeta(b).order);
        const first =
          wanted && ordered.includes(wanted) ? wanted : ordered[0];
        if (first) setActivePage(first);
      })
      .catch((e) => setMsg(`⚠️ ${e.message}`))
      .finally(() => setLoaded(true));
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  // Keep the editor glued to the text when the admin page itself scrolls.
  useEffect(() => {
    const on = () => reposition();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [reposition]);

  const pages = useMemo(() => {
    const seen = Array.from(new Set(rows.map((r) => r.page)));
    return seen.sort((a, b) => pageMeta(a).order - pageMeta(b).order);
  }, [rows]);

  // ---- open / close ----
  // Undo any unsaved live change to the block we're leaving, so the preview
  // never keeps text that was never saved.
  const revertCurrent = useCallback(() => {
    const key = editKeyRef.current;
    if (!key) return;
    const original = rows.find((r) => r.key === key);
    if (original) post({ type: "cms:set", key, value: original.value });
  }, [rows, post]);

  const close = useCallback(() => {
    setEditKey(null);
    setAnchor(null);
    post({ type: "cms:active", key: null });
  }, [post, setAnchor]);

  const onDraft = (value: string) => {
    setDraft(value);
    if (editKeyRef.current)
      post({ type: "cms:set", key: editKeyRef.current, value });
  };

  const cancel = useCallback(() => {
    const key = editKeyRef.current;
    if (key) {
      const original = rows.find((r) => r.key === key);
      if (original) post({ type: "cms:set", key, value: original.value });
    }
    close();
  }, [rows, post, close]);

  const save = useCallback(async () => {
    const key = editKeyRef.current;
    if (!key) return;
    const value = draftRef.current;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ ok: boolean; publish?: Publish }>("/api/blocks", {
        method: "PUT",
        body: JSON.stringify({ rows: [{ key, value }] }),
      });
      setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));
      const m = saveMsg(d.publish);
      setFlash(m);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(
        () => setFlash(null),
        m.tone === "warn" ? 6000 : 2400
      );
      close();
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    } finally {
      setBusy(false);
    }
  }, [close]);

  // ---- messages from the previewed site ----
  useEffect(() => {
    if (!SITE_ORIGIN) return; // preview disabled — accept nothing
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== SITE_ORIGIN) return;
      const data = e.data as { type?: string; key?: string; rect?: Rect };

      if (data?.type === "cms:focus" && data.key) {
        // Clicked directly in the preview — open with the rect it sent.
        const b = rows.find((r) => r.key === data.key);
        if (!b) return;
        if (editKeyRef.current && editKeyRef.current !== b.key) revertCurrent();
        setEditKey(b.key);
        setDraft(b.value);
        if (data.rect) setAnchor(data.rect);
      } else if (data?.type === "cms:rect" && data.key) {
        if (data.key === editKeyRef.current && data.rect) setAnchor(data.rect);
      } else if (data?.type === "cms:ready") {
        const key = pending.current;
        if (key) {
          post({ type: "cms:active", key });
          post({ type: "cms:set", key, value: draftRef.current });
          post({ type: "cms:locate", key });
          pending.current = null;
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [rows, post, setAnchor, revertCurrent]);

  const previewSrc =
    activePage && SITE_ORIGIN
      ? `${SITE}${pageMeta(activePage).path}?preview=1`
      : "";
  const editingBlock = rows.find((r) => r.key === editKey) ?? null;

  return (
    <>
      <div className="page-head">
        <h1>Page Text</h1>
        <p>
          <code>**bold**</code> · <code>*green*</code> · <code>~red~</code> ·{" "}
          <code>[text](/page)</code>
        </p>
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

      {pages.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Pages">
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={activePage === p}
              className={`tab ${activePage === p ? "on" : ""}`}
              onClick={() => {
                setActivePage(p);
                close();
              }}
            >
              {pageMeta(p).label}
              <span className="tab__count">
                {rows.filter((r) => r.page === p).length}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="cms cms--solo">
        <div className="cms__pane cms__preview">
          <div className="cms__pane-head">
            <span className="cms__pane-title">
              Click any text to edit it
            </span>
            {previewSrc && (
              <a
                className="cms__open"
                href={`${SITE}${pageMeta(activePage).path}`}
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
                key={activePage}
                ref={iframeRef}
                className="cms__frame"
                src={previewSrc}
                title="Live preview"
              />
            )}
          </div>
        </div>
      </div>

      {!loaded && <div className="card">Loading…</div>}

      {/* Floating editor, anchored over the text in the preview */}
      {editKey && editingBlock && pos && (
        <>
          <div
            className="cms-pop"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="cms-pop__label">{editingBlock.label}</div>
            <textarea
              autoFocus
              className="cms-pop__input"
              rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 48)))}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  save();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
            />
            <div className="cms-pop__foot">
              <span className="cms-pop__hint">Enter to save · Esc to cancel</span>
              <div className="cms-pop__btns">
                <button
                  className="btn btn--sm"
                  onClick={cancel}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--sm btn--green"
                  onClick={save}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
