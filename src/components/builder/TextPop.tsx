"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { api, type Publish } from "@/lib/api";

/**
 * The floating "edit this text" pop, ported from the Page Text screen so the
 * builder can offer it on every preview (static site pages, CMS pages and
 * offer pages alike). It anchors over the clicked text in the iframe,
 * live-updates the preview as you type (cms:set), saves on Enter and reverts
 * on Esc. The "Aa" toggle opens a compact style bar — size, weight, align,
 * font and color — previewed live via cms:style and saved with the text.
 *
 * The BUILDER owns the single window "message" listener and forwards what
 * this pop needs through the imperative handle: `setRect` for
 * cms:focus/cms:rect geometry and `notifyReady` after an iframe reload.
 * Which text is being edited (`activeKey`) is controlled by the builder.
 */

export type TextRow = {
  key: string;
  label: string;
  page: string;
  value: string;
  style?: Record<string, string>;
};
export type Rect = { top: number; left: number; width: number; height: number };

export type TextPopHandle = {
  /** Anchor geometry arrived from the preview (cms:focus / cms:rect). */
  setRect: (key: string, rect: Rect) => void;
  /** The iframe reloaded (cms:ready) — re-establish the current edit. */
  notifyReady: () => void;
};

type Pos = { top: number; left: number; width: number };

const SIZE_OPTIONS = [
  { value: "", label: "Default size" },
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
  { value: "xxl", label: "XXL" },
];

const WEIGHT_OPTIONS = [
  { value: "", label: "Default weight" },
  { value: "400", label: "Normal" },
  { value: "600", label: "Semibold" },
  { value: "800", label: "Bold" },
];

const FONT_OPTIONS = [
  { value: "", label: "Default font" },
  { value: "display", label: "Display" },
  { value: "body", label: "Body" },
  { value: "script", label: "Script" },
];

const ALIGN_OPTIONS: { value: string; icon: string; label: string }[] = [
  { value: "left", icon: "⬅", label: "Align left" },
  { value: "center", icon: "↔", label: "Align center" },
  { value: "right", icon: "➡", label: "Align right" },
];

const SWATCHES = ["#111111", "#444444", "#5CB800", "#2E6B00", "#CC2200", "#ffffff"];

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const TextPop = forwardRef<
  TextPopHandle,
  {
    iframeRef: RefObject<HTMLIFrameElement | null>;
    siteOrigin: string;
    rows: TextRow[];
    activeKey: string | null;
    onClose: () => void;
    onSaved: (
      key: string,
      value: string,
      style: Record<string, string> | undefined,
      publish?: Publish
    ) => void;
  }
>(function TextPop({ iframeRef, siteOrigin, rows, activeKey, onClose, onSaved }, ref) {
  const [draft, setDraft] = useState("");
  const [styleDraft, setStyleDraft] = useState<Record<string, string>>({});
  const [styleDirty, setStyleDirty] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  // Anchor rect of the edited text, relative to the iframe viewport.
  const anchor = useRef<Rect | null>(null);
  // Rect that arrived before (or with) the activeKey change — consumed by
  // the activeKey effect so message order doesn't matter.
  const stashedRect = useRef<{ key: string; rect: Rect } | null>(null);
  // Live refs so handlers never read stale state.
  const activeKeyRef = useRef<string | null>(null);
  const draftRef = useRef("");
  const styleDraftRef = useRef<Record<string, string>>({});
  const styleDirtyRef = useRef(false);
  const rowsRef = useRef(rows);
  activeKeyRef.current = activeKey;
  draftRef.current = draft;
  styleDraftRef.current = styleDraft;
  styleDirtyRef.current = styleDirty;
  rowsRef.current = rows;

  const post = useCallback(
    (m: Record<string, unknown>) => {
      if (!siteOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(m, siteOrigin);
    },
    [iframeRef, siteOrigin]
  );

  // ---- position the pop over the anchored text ----
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
  }, [iframeRef]);

  const setAnchor = useCallback(
    (r: Rect | null) => {
      anchor.current = r;
      reposition();
    },
    [reposition]
  );

  // Keep the pop glued to the text when the admin page scrolls or resizes.
  useEffect(() => {
    const on = () => reposition();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [reposition]);

  /** Undo the unsaved live changes to `key`, so the preview stays honest. */
  const revertKey = useCallback(
    (key: string | null) => {
      if (!key) return;
      const original = rowsRef.current.find((r) => r.key === key);
      if (original) {
        post({ type: "cms:set", key, value: original.value });
        post({ type: "cms:style", key, style: original.style ?? null });
      }
    },
    [post]
  );

  // ---- react to the builder switching (or clearing) the edited key ----
  const prevKey = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevKey.current;
    if (prev && prev !== activeKey && prev !== null) {
      // Left a block without saving — put its live text and style back.
      revertKey(prev);
    }
    prevKey.current = activeKey;
    if (!activeKey) {
      setAnchor(null);
      setErr("");
      setNote("");
      return;
    }
    const row = rowsRef.current.find((r) => r.key === activeKey);
    setDraft(row ? row.value : "");
    setStyleDraft(row?.style ? { ...row.style } : {});
    setStyleDirty(false);
    setStyleOpen(false);
    setHexDraft(row?.style?.color ?? "");
    setErr("");
    setNote("");
    const stash = stashedRect.current;
    setAnchor(stash && stash.key === activeKey ? stash.rect : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // ---- imperative surface for the builder's message listener ----
  useImperativeHandle(
    ref,
    () => ({
      setRect(key, rect) {
        stashedRect.current = { key, rect };
        if (key === activeKeyRef.current) setAnchor(rect);
      },
      notifyReady() {
        const key = activeKeyRef.current;
        if (!key) return;
        // The iframe reloaded mid-edit — re-highlight, re-apply the drafts
        // and ask it to scroll the text back into view (it answers cms:rect).
        post({ type: "cms:active", key });
        post({ type: "cms:set", key, value: draftRef.current });
        post({ type: "cms:style", key, style: styleDraftRef.current });
        post({ type: "cms:locate", key });
      },
    }),
    [post, setAnchor]
  );

  const close = useCallback(() => {
    post({ type: "cms:active", key: null });
    setAnchor(null);
    onClose();
  }, [post, setAnchor, onClose]);

  const onDraft = (value: string) => {
    setDraft(value);
    const key = activeKeyRef.current;
    if (key) post({ type: "cms:set", key, value });
  };

  /** Apply a style change: null values clear a prop; live-preview the rest. */
  const patchStyle = useCallback(
    (patch: Record<string, string | null>) => {
      const next = { ...styleDraftRef.current };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") delete next[k];
        else next[k] = v;
      }
      setStyleDraft(next);
      setStyleDirty(true);
      const key = activeKeyRef.current;
      if (key) post({ type: "cms:style", key, style: next });
    },
    [post]
  );

  const onHex = (raw: string) => {
    setHexDraft(raw);
    const v = raw.trim();
    if (v === "") patchStyle({ color: null });
    else if (HEX_RE.test(v)) patchStyle({ color: v });
  };

  const cancel = useCallback(() => {
    revertKey(activeKeyRef.current);
    close();
  }, [revertKey, close]);

  const save = useCallback(async () => {
    const key = activeKeyRef.current;
    if (!key) return;
    const value = draftRef.current;
    const style = styleDirtyRef.current ? styleDraftRef.current : undefined;
    
    const row = rowsRef.current.find((r) => r.key === key);
    const origValue = row ? row.value : "";
    const origStyle = row?.style ? { ...row.style } : undefined;

    // Close and update state immediately
    onSaved(key, value, style, undefined);
    close();

    try {
      await api<{
        ok: boolean;
        publish?: Publish;
        styleSkipped?: boolean;
      }>("/api/blocks", {
        method: "PUT",
        body: JSON.stringify({
          rows: [style ? { key, value, style } : { key, value }],
        }),
      });
    } catch (e) {
      // Revert on error
      onSaved(key, origValue, origStyle, undefined);
      console.error("Optimistic save failed, reverting:", e);
    }
  }, [onSaved, close]);

  const row = activeKey ? rows.find((r) => r.key === activeKey) : null;
  if (!activeKey || !row || !pos) return null;

  const styled = Object.keys(styleDraft).length > 0;
  const color = styleDraft.color ?? "";

  return (
    <>
      <div
        className="cms-pop-backdrop"
        onClick={cancel}
        aria-hidden="true"
      />
      <div
        className="cms-pop"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
      <div className="cms-pop__head">
        <div className="cms-pop__label">{row.label}</div>
        <button
          type="button"
          className={`cms-pop__stylebtn ${
            styleOpen || styled ? "cms-pop__stylebtn--on" : ""
          }`}
          title="Text style"
          aria-pressed={styleOpen}
          onClick={() => setStyleOpen((o) => !o)}
        >
          Aa
        </button>
      </div>
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
      {styleOpen && (
        <div className="cms-pop__style">
          <div className="cms-pop__stylerow">
            <select
              className="cms-pop__styleselect"
              title="Text size"
              value={styleDraft.size ?? ""}
              onChange={(e) => patchStyle({ size: e.target.value || null })}
            >
              {SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="cms-pop__styleselect"
              title="Text weight"
              value={styleDraft.weight ?? ""}
              onChange={(e) => patchStyle({ weight: e.target.value || null })}
            >
              {WEIGHT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="cms-pop__styleselect"
              title="Font"
              value={styleDraft.font ?? ""}
              onChange={(e) => patchStyle({ font: e.target.value || null })}
            >
              {FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="cms-pop__aligns" role="group" aria-label="Alignment">
              {ALIGN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`cms-pop__alignbtn ${
                    styleDraft.align === o.value ? "cms-pop__alignbtn--on" : ""
                  }`}
                  title={o.label}
                  onClick={() =>
                    patchStyle({
                      align: styleDraft.align === o.value ? null : o.value,
                    })
                  }
                >
                  {o.icon}
                </button>
              ))}
            </div>
          </div>
          <div className="cms-pop__stylerow">
            <button
              type="button"
              className={`cms-pop__swatch cms-pop__swatch--none ${
                color === "" ? "cms-pop__swatch--on" : ""
              }`}
              title="Default color"
              onClick={() => {
                setHexDraft("");
                patchStyle({ color: null });
              }}
            >
              ∅
            </button>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`cms-pop__swatch ${
                  color.toLowerCase() === c.toLowerCase()
                    ? "cms-pop__swatch--on"
                    : ""
                }`}
                style={{ background: c }}
                title={c}
                onClick={() => {
                  setHexDraft(c);
                  patchStyle({ color: c });
                }}
              />
            ))}
            <input
              className="cms-pop__hex"
              value={hexDraft}
              placeholder="#hex"
              spellCheck={false}
              onChange={(e) => onHex(e.target.value)}
            />
          </div>
        </div>
      )}
      {err && <div className="cms-pop__err">{err}</div>}
      {note && <div className="cms-pop__note">{note}</div>}
      <div className="cms-pop__foot">
        <span className="cms-pop__hint">Enter to save · Esc to cancel</span>
        <div className="cms-pop__btns">
          <button className="btn btn--sm" onClick={cancel} disabled={busy}>
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
  );
});

export default TextPop;
