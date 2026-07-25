"use client";

import { useEffect, useState } from "react";
import {
  BLOCK_KINDS,
  PALETTE_GROUPS,
  isSecKind,
  type KindMeta,
  type PaletteGroup,
} from "@/lib/blocks";

/**
 * The "Add block" sheet: a tab strip (Layout / Text / Media / Buttons / Shapes
 * / Library) over a grid of visual tiles, each with a tiny CSS-drawn wireframe
 * of what the block looks like on the page. Pick a tab to filter, click a tile
 * to drop that block onto the page.
 */

/** Tiny CSS wireframe of a block kind (also used by tiles elsewhere). */
export function KindThumb({ kind }: { kind: string }) {
  // Every designed site section shares one wireframe: a hero bar + strips.
  if (isSecKind(kind)) {
    return (
      <span className="kthumb kthumb--sec" aria-hidden>
        <i className="kt-secband" />
        <i className="kt-l" />
        <i className="kt-l kt-l--short" />
      </span>
    );
  }
  return (
    <span className={`kthumb kthumb--${kind}`} aria-hidden>
      {kind === "text" && (
        <>
          <i className="kt-h" />
          <i className="kt-l" />
          <i className="kt-l" />
          <i className="kt-l kt-l--short" />
        </>
      )}
      {kind === "split" && (
        <>
          <span className="kt-side">
            <i className="kt-h" />
            <i className="kt-l" />
            <i className="kt-l kt-l--short" />
          </span>
          <i className="kt-img" />
        </>
      )}
      {kind === "image" && <i className="kt-img kt-img--big" />}
      {kind === "video" && (
        <span className="kt-frame">
          <i className="kt-play" />
        </span>
      )}
      {kind === "bullets" && (
        <>
          <span className="kt-brow">
            <i className="kt-dot" />
            <i className="kt-l" />
          </span>
          <span className="kt-brow">
            <i className="kt-dot" />
            <i className="kt-l kt-l--short" />
          </span>
          <span className="kt-brow">
            <i className="kt-dot" />
            <i className="kt-l" />
          </span>
        </>
      )}
      {kind === "stats" && (
        <>
          <span className="kt-col">
            <i className="kt-big" />
            <i className="kt-l kt-l--short" />
          </span>
          <span className="kt-col">
            <i className="kt-big" />
            <i className="kt-l kt-l--short" />
          </span>
          <span className="kt-col">
            <i className="kt-big" />
            <i className="kt-l kt-l--short" />
          </span>
        </>
      )}
      {kind === "cards" && (
        <>
          <span className="kt-cardlet">
            <i className="kt-h" />
            <i className="kt-l" />
          </span>
          <span className="kt-cardlet">
            <i className="kt-h" />
            <i className="kt-l" />
          </span>
          <span className="kt-cardlet">
            <i className="kt-h" />
            <i className="kt-l" />
          </span>
        </>
      )}
      {kind === "quote" && (
        <>
          <i className="kt-q">“</i>
          <span className="kt-side">
            <i className="kt-l" />
            <i className="kt-l kt-l--short" />
          </span>
        </>
      )}
      {kind === "faq" && (
        <>
          <span className="kt-frow">
            <i className="kt-l" />
            <i className="kt-chev">▾</i>
          </span>
          <span className="kt-frow">
            <i className="kt-l kt-l--short" />
            <i className="kt-chev">▾</i>
          </span>
        </>
      )}
      {kind === "cta" && (
        <span className="kt-band">
          <i className="kt-l kt-l--light" />
          <i className="kt-pill" />
        </span>
      )}
      {kind === "button" && <i className="kt-pill kt-pill--solo" />}
      {kind === "row" && (
        <span className="kt-cols">
          <i className="kt-colbox" />
          <i className="kt-colbox" />
        </span>
      )}
      {kind === "divider" && <i className="kt-hairline" />}
      {kind === "eyebrow" && (
        <>
          <i className="kt-eyebrow" />
          <i className="kt-l" />
          <i className="kt-l kt-l--short" />
        </>
      )}
      {kind === "heading" && (
        <>
          <i className="kt-h kt-h--big" />
          <i className="kt-l kt-l--short" />
        </>
      )}
      {kind === "lede" && (
        <>
          <i className="kt-l kt-l--thick" />
          <i className="kt-l kt-l--thick" />
          <i className="kt-l kt-l--thick kt-l--short" />
        </>
      )}
      {kind === "spacer" && (
        <>
          <i className="kt-l kt-l--short" />
          <i className="kt-gap" />
          <i className="kt-l kt-l--short" />
        </>
      )}
      {kind === "band" && (
        <span className="kt-bandpick">
          <i className="kt-swatch kt-swatch--white" />
          <i className="kt-swatch kt-swatch--ink" />
          <i className="kt-swatch kt-swatch--mist" />
        </span>
      )}
      {kind === "testimonials" && (
        <>
          <span className="kt-cardlet">
            <i className="kt-q kt-q--sm">“</i>
            <i className="kt-l" />
          </span>
          <span className="kt-cardlet">
            <i className="kt-q kt-q--sm">“</i>
            <i className="kt-l" />
          </span>
          <span className="kt-cardlet">
            <i className="kt-q kt-q--sm">“</i>
            <i className="kt-l" />
          </span>
        </>
      )}
      {kind === "gallery" && (
        <>
          <i className="kt-ph" />
          <i className="kt-ph" />
          <i className="kt-ph" />
          <i className="kt-ph" />
        </>
      )}
      {kind === "testimonial" && (
        <span className="kt-cardlet">
          <i className="kt-q kt-q--sm">“</i>
          <i className="kt-l" />
          <i className="kt-l kt-l--short" />
        </span>
      )}
      {kind === "faqgroup" && (
        <>
          <span className="kt-frow">
            <i className="kt-l" />
            <i className="kt-chev">▾</i>
          </span>
          <span className="kt-frow">
            <i className="kt-l kt-l--short" />
            <i className="kt-chev">▾</i>
          </span>
          <span className="kt-frow">
            <i className="kt-l" />
            <i className="kt-chev">▾</i>
          </span>
        </>
      )}
      {kind === "offercard" && (
        <span className="kt-cardlet">
          <i className="kt-h" />
          <i className="kt-l" />
          <i className="kt-pill" />
        </span>
      )}
      {kind === "magnet" && (
        <span className="kt-cardlet">
          <i className="kt-glyph" />
          <i className="kt-l" />
        </span>
      )}
      {kind === "subheading" && (
        <>
          <i className="kt-l kt-l--short" />
          <i className="kt-h" />
        </>
      )}
      {kind === "script" && <i className="kt-scriptline" />}
      {kind === "icon" && <i className="kt-glyph" />}
      {kind === "avatar" && <i className="kt-avatar" />}
      {kind === "ghostlink" && <i className="kt-ghost" />}
      {kind === "ctanote" && (
        <span className="kt-note">
          <i className="kt-dot" />
          <i className="kt-l kt-l--short" />
        </span>
      )}
      {kind === "shape" && <i className="kt-shape" />}
      {kind === "badge" && <i className="kt-badge" />}
      {kind === "callout" && (
        <span className="kt-callout">
          <i className="kt-h" />
          <i className="kt-l" />
          <i className="kt-l kt-l--short" />
        </span>
      )}
      {kind === "card" && (
        <span className="kt-cardlet kt-cardlet--solo">
          <i className="kt-glyph kt-glyph--sm" />
          <i className="kt-h" />
          <i className="kt-l" />
        </span>
      )}
      {kind === "counter" && (
        <span className="kt-counter">
          <i className="kt-num">42</i>
          <i className="kt-l kt-l--short" />
        </span>
      )}
    </span>
  );
}

export default function BlockPalette({
  onPick,
  onClose,
  extraGroup,
  exclude,
}: {
  onPick: (kind: string) => void;
  onClose: () => void;
  /**
   * Optional second group of kinds, rendered under its own heading. Nothing
   * passes one today (designed sections left the palette) — the prop stays
   * for the container/molecule groups a later phase adds. An empty group is
   * treated as no group at all, so the sheet is just the molecule grid.
   */
  extraGroup?: { label: string; kinds: KindMeta[] };
  /** Kinds to hide (e.g. "band" makes no sense on offer pages). */
  exclude?: string[];
}) {
  const extra =
    extraGroup && extraGroup.kinds.length > 0 ? extraGroup : undefined;

  // Text is the friendliest landing tab — most blocks people reach for live
  // there.
  const [group, setGroup] = useState<PaletteGroup>("text");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tiles = BLOCK_KINDS.filter(
    (k) => k.group === group && !exclude?.includes(k.kind)
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-label="Add a block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette__head">
          <strong>Add a block</strong>
          <span>Pick a section type — it lands at the bottom of the page.</span>
          <button
            type="button"
            className="ibtn palette__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="palette__tabs" role="tablist" aria-label="Block groups">
          {PALETTE_GROUPS.map((g) => (
            <button
              type="button"
              key={g.id}
              role="tab"
              aria-selected={group === g.id}
              className={`palette__tab ${
                group === g.id ? "palette__tab--on" : ""
              }`}
              onClick={() => setGroup(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="palette__grid">
          {tiles.map((k) => (
            <button
              type="button"
              key={k.kind}
              className="ptile"
              onClick={() => onPick(k.kind)}
            >
              <KindThumb kind={k.kind} />
              <strong>
                {k.icon} {k.label}
              </strong>
              <span>{k.desc}</span>
            </button>
          ))}
          {tiles.length === 0 && (
            <p className="palette__empty">Nothing in this group yet.</p>
          )}
        </div>
        {extra && (
          <>
            <div className="palette__ghead">{extra.label}</div>
            <div className="palette__grid">
              {extra.kinds.map((k) => (
                <button
                  type="button"
                  key={k.kind}
                  className="ptile"
                  onClick={() => onPick(k.kind)}
                >
                  <KindThumb kind={k.kind} />
                  <strong>
                    {k.icon} {k.label}
                  </strong>
                  <span>{k.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
