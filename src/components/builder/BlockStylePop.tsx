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
import { StylePanel } from "@/components/builder/BlockEditor";
import { COLOR_SWATCHES, STYLE_SIZE_PX } from "@/lib/blockstyle";
import type { Rect } from "@/components/builder/TextPop";

/**
 * The on-canvas style toolbar: a floating bar that anchors over the block the
 * user clicked in the live preview and edits that block's `style` jsonb live.
 * It shares the anchoring mechanics with TextPop — the BUILDER owns the one
 * window "message" listener and feeds geometry (cms:block-focus /
 * cms:block-rect) through this handle's setRect.
 *
 * It edits the SAME `draft.style` the rail's Style tab does (via the passed
 * `style` + `onPatch`, where a null value clears a prop) and relies on the
 * builder to post cms:block-style for the live preview. "Done" persists through
 * the builder's normal block Save (onDone → saveBlock); Esc reverts the live
 * preview to the last-saved style (onRevert) and closes without saving.
 *
 * High-frequency controls sit inline (font, size, weight, align, colour); the
 * full box panel (background, padding, margins, radius, border, shadow, max
 * width, line-height, letter-spacing) folds out under "More…".
 */

export type BlockStylePopHandle = {
  /** Anchor geometry arrived from the preview (cms:block-focus / -rect). */
  setRect: (id: string, rect: Rect) => void;
  /** The iframe reloaded (cms:ready) — re-apply the live style. */
  notifyReady: () => void;
};

type Pos = { top: number; left: number; width: number };
type Style = Record<string, unknown>;

const FONT_OPTIONS = [
  { value: "display", label: "Display" },
  { value: "body", label: "Body" },
  { value: "script", label: "Script" },
];

const WEIGHT_OPTIONS = [
  { value: "400", label: "Normal" },
  { value: "600", label: "Medium" },
  { value: "800", label: "Bold" },
];

const SIZE_PRESETS = [
  { token: "s", label: "S" },
  { token: "m", label: "M" },
  { token: "l", label: "L" },
  { token: "xl", label: "XL" },
];

const ALIGN_OPTIONS = [
  { value: "left", icon: "⬅", label: "Align left" },
  { value: "center", icon: "↔", label: "Align center" },
  { value: "right", icon: "➡", label: "Align right" },
];

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const PX_RE = /^(\d{1,3})px$/;

/** The px a size value shows: a free "<n>px" as-is, a token via its map. */
function sizeToPx(size: unknown): string {
  if (typeof size !== "string" || size === "") return "";
  const m = PX_RE.exec(size);
  if (m) return m[1];
  return Object.hasOwn(STYLE_SIZE_PX, size) ? String(STYLE_SIZE_PX[size]) : "";
}

const BlockStylePop = forwardRef<
  BlockStylePopHandle,
  {
    iframeRef: RefObject<HTMLIFrameElement | null>;
    siteOrigin: string;
    activeId: string | null;
    style: Style;
    onPatch: (patch: Record<string, unknown>) => void;
    onDone: () => void;
    onRevert: () => void;
    onEditText?: () => void;
  }
>(function BlockStylePop(
  { iframeRef, siteOrigin, activeId, style, onPatch, onDone, onRevert, onEditText },
  ref
) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [more, setMore] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hex, setHex] = useState("");

  const anchor = useRef<Rect | null>(null);
  const stashedRect = useRef<{ id: string; rect: Rect } | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const styleRef = useRef<Style>(style);
  const moreRef = useRef(false);
  activeIdRef.current = activeId;
  styleRef.current = style;
  moreRef.current = more;

  const post = useCallback(
    (m: Record<string, unknown>) => {
      if (!siteOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(m, siteOrigin);
    },
    [iframeRef, siteOrigin]
  );

  // ---- position the bar over the anchored block ----
  const reposition = useCallback(() => {
    const a = anchor.current;
    const frame = iframeRef.current;
    if (!a || !frame) {
      setPos(null);
      return;
    }
    const box = frame.getBoundingClientRect();
    const width = Math.min(Math.max(a.width, 340), 520);
    let left = box.left + a.left;
    left = Math.min(left, box.right - width - 8);
    left = Math.max(box.left + 8, Math.max(8, left));

    const elTop = box.top + a.top;
    const elBottom = elTop + a.height;
    const estH = moreRef.current ? 380 : 96;
    let top = elBottom + 8;
    if (top + estH > window.innerHeight) {
      top = elTop - 8 - estH;
      if (top < 8) top = Math.max(8, window.innerHeight - estH - 8);
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

  // Keep the bar glued to the block as the admin page scrolls / resizes —
  // including layout shifts (the Blocks rail opening/closing) that move or
  // resize the iframe without firing a window resize event.
  useEffect(() => {
    const on = () => reposition();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    const frame = iframeRef.current;
    const ro = frame ? new ResizeObserver(on) : null;
    if (frame) ro?.observe(frame);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
      ro?.disconnect();
    };
  }, [reposition, iframeRef]);

  // Reposition when the drawer opens/closes (its estimated height changes).
  useEffect(() => {
    reposition();
  }, [more, reposition]);

  // ---- react to the builder selecting (or clearing) a block ----
  useEffect(() => {
    setMore(false);
    setDismissed(false);
    setHex(HEX_RE.test(String(styleRef.current.color ?? "")) ? String(styleRef.current.color) : "");
    if (!activeId) {
      setAnchor(null);
      return;
    }
    const stash = stashedRect.current;
    setAnchor(stash && stash.id === activeId ? stash.rect : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ---- imperative surface for the builder's message listener ----
  useImperativeHandle(
    ref,
    () => ({
      setRect(id, rect) {
        stashedRect.current = { id, rect };
        if (id === activeIdRef.current) {
          // A fresh focus on the block that's already selected (e.g. the
          // edit icon clicked again after Done/Esc dismissed the popup) —
          // reopen it. Without this, dismissed stays true forever because
          // the "selecting a new block" effect only fires on an activeId
          // change, and this is the same id.
          setDismissed(false);
          setAnchor(rect);
        }
      },
      notifyReady() {
        const id = activeIdRef.current;
        if (!id) return;
        // The iframe reloaded mid-edit — re-apply the unsaved live style.
        post({ type: "cms:block-style", id, style: styleRef.current });
      },
    }),
    [post, setAnchor]
  );

  const done = useCallback(() => {
    onDone();
    setDismissed(true);
  }, [onDone]);

  const cancel = useCallback(() => {
    onRevert();
    setDismissed(true);
  }, [onRevert]);

  // Esc closes without saving (reverting the live preview), Ctrl/Cmd+Enter saves.
  useEffect(() => {
    if (!activeId || dismissed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, dismissed, cancel]);

  const val = (prop: string) =>
    typeof style[prop] === "string" ? String(style[prop]) : "";

  /** Toggle a token prop: clicking the active value clears it. */
  const toggle = (prop: string, value: string) =>
    onPatch({ [prop]: val(prop) === value ? null : value });

  const stepSize = (delta: number) => {
    const base = Number(sizeToPx(style.size)) || 18;
    const n = Math.min(200, Math.max(8, base + delta));
    onPatch({ size: `${n}px` });
  };

  const onHex = (raw: string) => {
    setHex(raw);
    const v = raw.trim();
    if (v === "") onPatch({ color: null });
    else if (HEX_RE.test(v)) onPatch({ color: v });
  };

  if (!activeId || dismissed || !pos) return null;

  const sizePx = sizeToPx(style.size);
  const color = val("color");
  const weight = val("weight");
  const font = val("font");
  const size = val("size");

  return (
    <>
      <div
        className="cms-pop-backdrop"
        onClick={cancel}
        aria-hidden="true"
      />
      <div
        className="stylepop"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
      <div className="stylepop__bar">
        {/* Font */}
        <div className="stylepop__seg" role="group" aria-label="Font">
          {FONT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`stylepop__segbtn ${
                font === o.value ? "stylepop__segbtn--on" : ""
              }`}
              onClick={() => toggle("font", o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <span className="stylepop__sep" aria-hidden />

        {/* Size — number + steppers + presets */}
        <div className="stylepop__num">
          <input
            className="stylepop__numinput"
            type="number"
            min={8}
            max={200}
            placeholder="px"
            value={sizePx}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onPatch({ size: raw === "" ? null : `${raw}px` });
            }}
          />
          <div className="stylepop__steppers">
            <button
              type="button"
              className="stylepop__stepper"
              title="Larger"
              onClick={() => stepSize(1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="stylepop__stepper"
              title="Smaller"
              onClick={() => stepSize(-1)}
            >
              ▼
            </button>
          </div>
        </div>
        <div className="stylepop__seg" role="group" aria-label="Size preset">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.token}
              type="button"
              className={`stylepop__segbtn ${
                size === p.token ? "stylepop__segbtn--on" : ""
              }`}
              title={`${p.label} · ${STYLE_SIZE_PX[p.token]}px`}
              onClick={() => toggle("size", p.token)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <span className="stylepop__sep" aria-hidden />

        {/* Weight */}
        <div className="stylepop__seg" role="group" aria-label="Weight">
          {WEIGHT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`stylepop__segbtn ${
                weight === o.value ? "stylepop__segbtn--on" : ""
              }`}
              onClick={() => toggle("weight", o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <span className="stylepop__sep" aria-hidden />

        {/* Align */}
        <div className="stylepop__seg" role="group" aria-label="Alignment">
          {ALIGN_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`stylepop__segbtn ${
                val("align") === o.value ? "stylepop__segbtn--on" : ""
              }`}
              title={o.label}
              onClick={() => toggle("align", o.value)}
            >
              {o.icon}
            </button>
          ))}
        </div>

        <span className="stylepop__sep" aria-hidden />

        {/* Colour */}
        <div className="stylepop__colors">
          <button
            type="button"
            className={`stylepop__swatch stylepop__swatch--none ${
              color === "" ? "stylepop__swatch--on" : ""
            }`}
            title="Default colour"
            onClick={() => {
              setHex("");
              onPatch({ color: null });
            }}
          >
            ∅
          </button>
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`stylepop__swatch ${
                color === c.value ? "stylepop__swatch--on" : ""
              }`}
              style={{ background: c.hex }}
              title={c.label}
              onClick={() => {
                setHex("");
                onPatch({ color: c.value });
              }}
            />
          ))}
          <input
            className="stylepop__hex"
            value={hex}
            placeholder="#hex"
            spellCheck={false}
            onChange={(e) => onHex(e.target.value)}
          />
        </div>

        <span className="stylepop__spacer" />

        <button
          type="button"
          className={`stylepop__more ${more ? "stylepop__more--on" : ""}`}
          aria-pressed={more}
          onClick={() => setMore((o) => !o)}
        >
          More…
        </button>
        <button type="button" className="btn btn--sm btn--green" onClick={done}>
          Done
        </button>
        {onEditText && (
          <button
            type="button"
            className="btn btn--sm stylepop__edittext"
            title="Edit text content"
            onClick={onEditText}
          >
            ✏️ Edit text
          </button>
        )}
      </div>

      {more && (
        <div className="stylepop__drawer">
          <StylePanel key={activeId} style={style} onPatch={onPatch} hideColors />
        </div>
      )}

      <div className="stylepop__hint">Esc reverts · Done saves</div>
    </div>
    </>
  );
});

export default BlockStylePop;
