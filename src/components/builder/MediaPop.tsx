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
import type { Rect } from "@/components/builder/TextPop";

/**
 * Floating editor for image and video blocks. Anchors over the clicked block
 * in the live preview (same positioning mechanics as TextPop and BlockStylePop).
 * Shows a URL input with a live thumbnail preview for images, and a URL input
 * for videos. Dismiss by clicking outside, Esc, or Save/Cancel.
 */

export type MediaPopHandle = {
  setRect: (id: string, rect: Rect) => void;
  notifyReady: () => void;
};

type Pos = { top: number; left: number; width: number };

const MediaPop = forwardRef<
  MediaPopHandle,
  {
    iframeRef: RefObject<HTMLIFrameElement | null>;
    activeId: string | null;
    activeKind: string | null; // "image" | "video"
    initialUrl: string;
    initialCaption: string;
    onSave: (id: string, url: string, caption: string) => void;
    onClose: () => void;
  }
>(function MediaPop(
  { iframeRef, activeId, activeKind, initialUrl, initialCaption, onSave, onClose },
  ref
) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [imgOk, setImgOk] = useState(false);

  const anchor = useRef<Rect | null>(null);
  const stashedRect = useRef<{ id: string; rect: Rect } | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const urlRef = useRef("");
  const captionRef = useRef("");
  activeIdRef.current = activeId;
  urlRef.current = url;
  captionRef.current = caption;

  // Position the pop over the anchored block.
  const reposition = useCallback(() => {
    const a = anchor.current;
    const frame = iframeRef.current;
    if (!a || !frame) { setPos(null); return; }
    const box = frame.getBoundingClientRect();
    const width = Math.min(Math.max(a.width, 340), 480);
    let left = box.left + a.left;
    left = Math.min(left, box.right - width - 8);
    left = Math.max(box.left + 8, Math.max(8, left));
    const elTop = box.top + a.top;
    const elBottom = elTop + a.height;
    const EST_H = 220;
    let top = elBottom + 8;
    if (top + EST_H > window.innerHeight) {
      top = elTop - 8 - EST_H;
      if (top < 8) top = Math.max(8, window.innerHeight - EST_H - 8);
    }
    setPos({ top, left, width });
  }, [iframeRef]);

  const setAnchor = useCallback(
    (r: Rect | null) => { anchor.current = r; reposition(); },
    [reposition]
  );

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

  // React to the builder selecting/clearing a block.
  useEffect(() => {
    if (!activeId) { setAnchor(null); setUrl(""); setCaption(""); return; }
    setUrl(initialUrl);
    setCaption(initialCaption);
    setImgOk(false);
    const stash = stashedRect.current;
    setAnchor(stash && stash.id === activeId ? stash.rect : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useImperativeHandle(
    ref,
    () => ({
      setRect(id, rect) {
        stashedRect.current = { id, rect };
        if (id === activeIdRef.current) setAnchor(rect);
      },
      notifyReady() { /* nothing to re-apply */ },
    }),
    [setAnchor]
  );

  const save = useCallback(() => {
    if (!activeIdRef.current) return;
    onSave(activeIdRef.current, urlRef.current, captionRef.current);
    onClose();
  }, [onSave, onClose]);

  const cancel = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, cancel, save]);

  if (!activeId || !pos) return null;

  const isImage = activeKind === "image";
  const trimmed = url.trim();

  return (
    <>
      <div className="cms-pop-backdrop" onClick={cancel} aria-hidden="true" />
      <div className="cms-pop mediapop" style={{ top: pos.top, left: pos.left, width: pos.width }}>
        <div className="cms-pop__head">
          <div className="cms-pop__label">
            {isImage ? "🖼 Image URL" : "🎬 Video URL"}
          </div>
        </div>

        {/* Thumbnail preview for images */}
        {isImage && trimmed && (
          <div className="mediapop__thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trimmed}
              alt="Preview"
              className={`mediapop__img ${imgOk ? "mediapop__img--ok" : ""}`}
              onLoad={() => setImgOk(true)}
              onError={() => setImgOk(false)}
            />
          </div>
        )}

        <input
          type="url"
          autoFocus
          className="cms-pop__input mediapop__urlinput"
          value={url}
          placeholder={isImage ? "https://… or /path/to/image.jpg" : "https://… video URL or embed"}
          onChange={(e) => { setUrl(e.target.value); setImgOk(false); }}
        />

        {isImage && (
          <input
            type="text"
            className="cms-pop__input mediapop__captioninput"
            value={caption}
            placeholder="Caption (optional)"
            onChange={(e) => setCaption(e.target.value)}
          />
        )}

        <div className="cms-pop__foot">
          <span className="cms-pop__hint">Enter to save · Esc to cancel</span>
          <div className="cms-pop__btns">
            <button className="btn btn--sm" onClick={cancel}>Cancel</button>
            <button className="btn btn--sm btn--green" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </>
  );
});

export default MediaPop;
