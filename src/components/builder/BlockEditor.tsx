"use client";

import { useState } from "react";
import InlinePreview from "@/components/InlinePreview";
import ImageField from "@/components/ImageField";
import LinkPicker from "@/components/builder/LinkPicker";
import { ItemPicker, ItemMultiPicker } from "@/components/builder/ItemPicker";
import {
  isSecKind,
  parseStats,
  statsToBody,
  parseCards,
  cardsToBody,
  parseBullets,
  bulletsToBody,
  parseButton,
  buttonToBody,
  BUTTON_VARIANTS,
  BAND_STYLES,
  SPACER_SIZES,
  SHAPE_FORMS,
  CARD_STYLES,
  ICON_TONES,
  BADGE_TONES,
  AVATAR_SHAPES,
  ICON_NAMES,
  type StatRow,
  type CardRow,
  type ButtonVariant,
} from "@/lib/blocks";
import {
  isHexColor,
  hasStyle,
  COLOR_SWATCHES,
  SIZE_OPTIONS,
  WEIGHT_OPTIONS,
  ALIGN_OPTIONS,
  FONT_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
  TRANSFORM_OPTIONS,
  BACKGROUND_OPTIONS,
  PADDING_OPTIONS,
  MARGIN_OPTIONS,
  RADIUS_OPTIONS,
  BORDER_OPTIONS,
  SHADOW_OPTIONS,
  MAX_WIDTH_OPTIONS,
  HIDE_ON_OPTIONS,
  POSITION_OPTIONS,
  type StyleOption,
} from "@/lib/blockstyle";

/**
 * The rich editor for one block, split into two tabs:
 *
 *   Content — the per-kind fields (stats as number/label rows, cards as
 *             titled mini-forms, bullets as a list) plus the Layout fieldset.
 *   Style   — the token-driven style panel every block now gets, text and
 *             box props alike, each control able to clear back to Default.
 *
 * Typed settings (heading size, spacer size, band background, button link,
 * testimonial count, gallery slot) are written to BOTH `props` and the legacy
 * plain-text `body`, so the site renders correctly before AND after the
 * pending migration.
 *
 * Mount with key={block.id} so the structured editors' local state — and the
 * chosen tab — reset when the selection changes.
 */

export type BlockDraft = {
  kind: string;
  heading: string;
  body: string;
  media_url: string;
  /** Grid layout jsonb: {span?, align?, shape?, size?} — {} = defaults. */
  layout?: Record<string, unknown>;
  /** Per-element style jsonb (BlockStyle) — {} = no styling. */
  style?: Record<string, unknown>;
  /** Typed per-kind settings jsonb — {} = fall back to the body string. */
  props?: Record<string, unknown>;
};

/** Merge a patch into a jsonb map; empty / null values clear their prop. */
function merge(
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

export default function BlockEditor({
  draft,
  onPatch,
}: {
  draft: BlockDraft;
  onPatch: (patch: Partial<BlockDraft>) => void;
}) {
  const { kind, heading, body, media_url } = draft;
  const layout = draft.layout ?? {};
  const props = draft.props ?? {};
  const style = draft.style ?? {};
  const [tab, setTab] = useState<"content" | "style">("content");

  const patchLayout = (patch: Record<string, unknown>) =>
    onPatch({ layout: merge(layout, patch) });

  /** A typed setting plus the legacy body string it mirrors, written together. */
  const patchProps = (patch: Record<string, unknown>, nextBody: string) =>
    onPatch({ props: merge(props, patch), body: nextBody });

  /** The new molecular kinds are props-only — no legacy body to keep in sync. */
  const setProps = (patch: Record<string, unknown>) =>
    onPatch({ props: merge(props, patch) });

  const pStr = (key: string) =>
    typeof props[key] === "string" ? String(props[key]) : "";
  /** A string-array prop (e.g. picked library ids); [] when unset. */
  const pIds = (key: string): string[] =>
    Array.isArray(props[key])
      ? (props[key] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  /** A number prop shown in a text field: "" when unset. */
  const pNumStr = (key: string) =>
    typeof props[key] === "number" && Number.isFinite(props[key] as number)
      ? String(props[key])
      : typeof props[key] === "string"
        ? String(props[key])
        : "";
  /** Parse a number field: blank clears the prop, otherwise store the number. */
  const numOrNull = (raw: string) =>
    raw.trim() === "" ? null : Number(raw);

  const patchStyle = (patch: Record<string, unknown>) =>
    onPatch({ style: merge(style, patch) });

  const headingField = (label: string, placeholder = "") => (
    <div className="field">
      <label>{label}</label>
      <input
        value={heading}
        placeholder={placeholder}
        onChange={(e) => onPatch({ heading: e.target.value })}
      />
    </div>
  );

  const bodyArea = (label: string, opts?: { hint?: string; preview?: boolean }) => (
    <div className="field">
      <label>{label}</label>
      <textarea
        value={body}
        onChange={(e) => onPatch({ body: e.target.value })}
      />
      {opts?.hint && <span className="hint">{opts.hint}</span>}
      {opts?.preview !== false && body.trim() !== "" && (
        <div className="erow__preview">
          <span className="erow__cap">Preview</span>
          <InlinePreview text={body} />
        </div>
      )}
    </div>
  );

  // Designed site sections: nothing generic to edit — their text lives in
  // keyed page text. Only sec-subhero / sec-bookband read body line 1 as a
  // text key prefix; any later lines (e.g. "setup") must round-trip intact.
  // They get no Layout fieldset (they're full-width by design) but they DO
  // get the Style tab like every other block.
  const secFields = isSecKind(kind)
    ? (() => {
        const hasPrefix = kind === "sec-subhero" || kind === "sec-bookband";
        const nl = body.indexOf("\n");
        const prefix = nl === -1 ? body : body.slice(0, nl);
        const rest = nl === -1 ? "" : body.slice(nl);
        return (
          <>
            <p className="bkedit__note">
              This is a designed site section — edit its text below or by
              clicking it in the live preview.
            </p>
            {hasPrefix && (
              <div className="field">
                <label>Text key prefix</label>
                <input
                  value={prefix}
                  placeholder={
                    kind === "sec-bookband"
                      ? "Blank = the generic booking text"
                      : "e.g. offers"
                  }
                  onChange={(e) => onPatch({ body: e.target.value + rest })}
                />
                <span className="hint">
                  Which set of keyed page text this section shows.
                </span>
              </div>
            )}
          </>
        );
      })()
    : null;

  // The per-kind fields, followed by the shared Layout fieldset below.
  const kindFields = (() => {
  switch (kind) {
    case "text":
      return (
        <>
          {headingField("Heading", "Section heading")}
          {bodyArea("Text", {
            hint: "Blank line = new paragraph · **bold** · *green* · [link](/page)",
          })}
        </>
      );

    case "eyebrow":
      return headingField("Label", "e.g. THE PROCESS");

    case "heading": {
      const big = propOr(props.size, (body.split("\n")[0] ?? "").trim()) === "big";
      return (
        <>
          {headingField("Heading", "The headline")}
          <div className="field">
            <label>Size</label>
            <select
              value={big ? "big" : "section"}
              onChange={(e) => {
                const v = e.target.value === "big" ? "big" : "section";
                patchProps({ size: v }, v === "big" ? "big" : "");
              }}
            >
              <option value="section">Section heading</option>
              <option value="big">Big display headline</option>
            </select>
          </div>
        </>
      );
    }

    case "lede":
      return bodyArea("Intro text", {
        hint: "Rendered in the large intro-paragraph style.",
      });

    case "spacer": {
      const size = propOr(props.size, (body.split("\n")[0] ?? "").trim());
      return (
        <div className="field">
          <label>Amount of space</label>
          <select
            value={["s", "m", "l"].includes(size) ? size : "m"}
            onChange={(e) =>
              patchProps({ size: e.target.value }, e.target.value)
            }
          >
            {SPACER_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case "band": {
      const band = propOr(props.background, (body.split("\n")[0] ?? "").trim());
      return (
        <>
          <div className="field">
            <label>Background</label>
            <select
              value={BAND_STYLES.some((b) => b.value === band) ? band : "white"}
              onChange={(e) =>
                patchProps({ background: e.target.value }, e.target.value)
              }
            >
              {BAND_STYLES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <label className="bkedit__laycheck">
            <input
              type="checkbox"
              checked={props.glow === true}
              onChange={(e) => setProps({ glow: e.target.checked || null })}
            />
            Green glow
          </label>
          <p className="bkedit__note">
            Every block after this one sits on the chosen background, until
            the next Section background or designed section.
          </p>
        </>
      );
    }

    case "bullets":
      return (
        <>
          {headingField("Heading", "List heading")}
          <BulletsEditor body={body} onBody={(b) => onPatch({ body: b })} />
        </>
      );

    case "image":
      return (
        <>
          <ImageField
            label="Image"
            value={media_url}
            onChange={(url) => onPatch({ media_url: url })}
          />
          {!media_url && (
            <p className="bkedit__note">
              Upload an image — the block only shows once it has one.
            </p>
          )}
          {headingField("Caption (optional)", "Shown under the image")}
          <div className="field">
            <label>Alt text (accessibility)</label>
            <input
              value={body}
              placeholder="Describe the image for screen readers"
              onChange={(e) => onPatch({ body: e.target.value })}
            />
          </div>
        </>
      );

    case "video":
      return (
        <>
          {headingField("Heading (optional)", "Shown above the video")}
          <div className="field">
            <label>Video link</label>
            <input
              value={media_url}
              placeholder="YouTube, Vimeo or .mp4 link"
              onChange={(e) => onPatch({ media_url: e.target.value })}
            />
            {!media_url && (
              <span className="hint">
                The block only shows once it has a link.
              </span>
            )}
          </div>
        </>
      );

    case "quote":
      return (
        <>
          {bodyArea("Quote")}
          {headingField("Who said it (optional)", "e.g. Sarah, retreat guest")}
        </>
      );

    case "faq":
      return (
        <>
          {headingField("Question", "The question people ask")}
          {bodyArea("Answer")}
        </>
      );

    case "stats":
      return (
        <>
          {headingField("Heading (optional)", "e.g. The numbers")}
          <StatsEditor body={body} onBody={(b) => onPatch({ body: b })} />
        </>
      );

    case "split":
      return (
        <>
          {headingField("Heading", "Section heading")}
          {bodyArea("Text", {
            hint: "Shown beside the image · blank line = new paragraph",
          })}
          <ImageField
            label="Image"
            value={media_url}
            onChange={(url) => onPatch({ media_url: url })}
          />
        </>
      );

    case "cta":
      return (
        <>
          {headingField("Headline", "Ready when you are.")}
          {bodyArea("Supporting line (optional)")}
          <p className="bkedit__note">
            The green “Book my free audit” button is added automatically and
            opens your Calendly.
          </p>
        </>
      );

    case "cards":
      return (
        <>
          {headingField("Heading (optional)", "e.g. What you get")}
          <CardsEditor body={body} onBody={(b) => onPatch({ body: b })} />
        </>
      );

    case "button":
      return (
        <>
          {headingField("Button label", "Book a call")}
          <ButtonEditor
            initial={buttonValue(body, props)}
            onCommit={(href, variant) =>
              patchProps({ href, variant }, buttonToBody(href, variant))
            }
          />
          <label className="bkedit__laycheck">
            <input
              type="checkbox"
              checked={props.halo === true}
              onChange={(e) => setProps({ halo: e.target.checked || null })}
            />
            Green halo ring
          </label>
        </>
      );

    case "divider":
      return (
        <p className="bkedit__note">
          A thin horizontal line that separates the sections above and below —
          there&apos;s nothing to fill in.
        </p>
      );

    case "testimonials":
      return (
        <>
          {headingField("Heading (optional)", "What clients say")}
          <div className="field">
            <label>How many</label>
            <select
              value={String(countValue(body, props))}
              onChange={(e) =>
                patchProps({ count: Number(e.target.value) }, e.target.value)
              }
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="hint">
              Shows your real client testimonials automatically.
            </span>
          </div>
          <ItemMultiPicker
            table="testimonials"
            value={pIds("ids")}
            onChange={(ids) => setProps({ ids: ids.length ? ids : null })}
            label="Or pick specific testimonials (overrides the count)"
          />
        </>
      );

    case "gallery":
      return (
        <>
          {headingField("Heading (optional)", "Shown above the photos")}
          <div className="field">
            <label>Photos from</label>
            <select
              value={gallerySlot(propOr(props.slot, body))}
              onChange={(e) =>
                patchProps({ slot: e.target.value }, e.target.value)
              }
            >
              <option value="gallery">Gallery photos</option>
              <option value="about">About photos</option>
              <option value="before-after">Before &amp; after photos</option>
            </select>
            <span className="hint">
              Pulls the photos straight from your Media library.
            </span>
          </div>
          <ItemMultiPicker
            table="gallery_images"
            value={pIds("ids")}
            onChange={(ids) => setProps({ ids: ids.length ? ids : null })}
            label="Or pick specific images (overrides the slot)"
          />
        </>
      );

    case "subheading":
      return headingField("Text", "A line that adds a little nuance");

    case "script":
      return headingField("Text", "written with heart");

    case "ctanote":
      return bodyArea("Note", {
        hint: "The pulsing-dot status line under a booking button.",
      });

    case "icon":
      return (
        <>
          <IconPicker value={pStr("name")} onPick={(n) => setProps({ name: n })} />
          <div className="field">
            <label>Tone</label>
            <select
              value={
                ICON_TONES.some((t) => t.value === pStr("tone"))
                  ? pStr("tone")
                  : ""
              }
              onChange={(e) => setProps({ tone: e.target.value })}
            >
              {ICON_TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Size (px)</label>
            <input
              type="number"
              value={pNumStr("size")}
              placeholder="28"
              onChange={(e) => setProps({ size: numOrNull(e.target.value) })}
            />
          </div>
          <label className="bkedit__laycheck">
            <input
              type="checkbox"
              checked={props.bubble === true}
              onChange={(e) => setProps({ bubble: e.target.checked || null })}
            />
            Green bubble
          </label>
        </>
      );

    case "avatar":
      return (
        <>
          <div className="field">
            <label>Shape</label>
            <select
              value={
                AVATAR_SHAPES.some((s) => s.value === pStr("shape"))
                  ? pStr("shape")
                  : "circle"
              }
              onChange={(e) => setProps({ shape: e.target.value })}
            >
              {AVATAR_SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <ImageField
            label="Photo"
            value={media_url}
            onChange={(url) => onPatch({ media_url: url })}
          />
          {headingField("Initials (if no photo)", "e.g. AB")}
        </>
      );

    case "ghostlink":
      return (
        <>
          {headingField("Label", "Learn more")}
          <LinkPicker
            value={pStr("href")}
            onChange={(href) => setProps({ href })}
          />
        </>
      );

    case "shape":
      return (
        <>
          <div className="field">
            <label>Shape</label>
            <select
              value={
                SHAPE_FORMS.some((f) => f.value === pStr("form"))
                  ? pStr("form")
                  : "circle"
              }
              onChange={(e) => setProps({ form: e.target.value })}
            >
              {SHAPE_FORMS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Size (px)</label>
            <input
              type="number"
              value={pNumStr("size")}
              placeholder="64"
              onChange={(e) => setProps({ size: numOrNull(e.target.value) })}
            />
          </div>
          <FillSwatches
            value={pStr("fill")}
            onChange={(v) => setProps({ fill: v })}
          />
          <div className="field">
            <label>Label (optional)</label>
            <input
              value={pStr("label")}
              placeholder="Text inside the shape"
              onChange={(e) => setProps({ label: e.target.value })}
            />
          </div>
        </>
      );

    case "badge":
      return (
        <>
          {headingField("Text", "New")}
          <div className="field">
            <label>Tone</label>
            <select
              value={
                BADGE_TONES.some((t) => t.value === pStr("tone"))
                  ? pStr("tone")
                  : "green"
              }
              onChange={(e) => setProps({ tone: e.target.value })}
            >
              {BADGE_TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </>
      );

    case "callout":
      return (
        <>
          {headingField("Lead", "Our promise")}
          {bodyArea("Note")}
          <div className="field">
            <label>Signature (optional)</label>
            <input
              value={pStr("sig")}
              placeholder="— Coach name"
              onChange={(e) => setProps({ sig: e.target.value })}
            />
          </div>
        </>
      );

    case "card":
      return (
        <>
          <div className="field">
            <label>Card style</label>
            <select
              value={
                CARD_STYLES.some((s) => s.value === pStr("style"))
                  ? pStr("style")
                  : "plain"
              }
              onChange={(e) => setProps({ style: e.target.value })}
            >
              {CARD_STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {headingField("Title", "Card title")}
          {bodyArea("Text", { hint: "A short description." })}
          <div className="field">
            <label>Number / step (optional)</label>
            <input
              value={pStr("num")}
              placeholder="e.g. 01"
              onChange={(e) => setProps({ num: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Tag (optional)</label>
            <input
              value={pStr("tag")}
              placeholder="e.g. Foundation"
              onChange={(e) => setProps({ tag: e.target.value })}
            />
          </div>
          <IconPicker
            value={pStr("icon")}
            onPick={(n) => setProps({ icon: n })}
            label="Icon (optional)"
          />
        </>
      );

    case "counter":
      return (
        <>
          <div className="field">
            <label>Value</label>
            <input
              value={pStr("value")}
              placeholder="300"
              onChange={(e) => setProps({ value: e.target.value })}
            />
            <span className="hint">
              Numbers count up on scroll; anything else stays as typed.
            </span>
          </div>
          <div className="field">
            <label>Label</label>
            <input
              value={pStr("label")}
              placeholder="Happy clients"
              onChange={(e) => setProps({ label: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Suffix (optional)</label>
            <input
              value={pStr("suffix")}
              placeholder="+"
              onChange={(e) => setProps({ suffix: e.target.value })}
            />
          </div>
        </>
      );

    case "row": {
      const columns = [2, 3, 4].includes(Number(props.columns))
        ? Number(props.columns)
        : 2;
      const gap = ["s", "m", "l"].includes(pStr("gap")) ? pStr("gap") : "m";
      const valign = ["top", "center", "stretch"].includes(pStr("valign"))
        ? pStr("valign")
        : "stretch";
      const stack = ["phone", "tablet", "never"].includes(pStr("stack"))
        ? pStr("stack")
        : "phone";
      return (
        <>
          <div className="field">
            <label>Columns</label>
            <select
              value={String(columns)}
              onChange={(e) => setProps({ columns: Number(e.target.value) })}
            >
              <option value="2">2 columns</option>
              <option value="3">3 columns</option>
              <option value="4">4 columns</option>
            </select>
          </div>
          <div className="field">
            <label>Column ratios (optional)</label>
            <input
              type="text"
              value={pStr("ratios")}
              placeholder="e.g. 2,1 for 66/33"
              onChange={(e) => setProps({ ratios: e.target.value || null })}
            />
            <span className="hint">
              Comma-separated weights, one per column (must match the count
              above) — e.g. "2,1" makes the first column twice as wide.
              Leave blank for equal columns.
            </span>
          </div>
          <div className="field">
            <label>Gap between columns</label>
            <select
              value={gap}
              onChange={(e) => setProps({ gap: e.target.value })}
            >
              <option value="s">Small</option>
              <option value="m">Medium</option>
              <option value="l">Large</option>
            </select>
          </div>
          <div className="field">
            <label>Vertical align</label>
            <select
              value={valign}
              onChange={(e) => setProps({ valign: e.target.value })}
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="stretch">Stretch</option>
            </select>
          </div>
          <div className="field">
            <label>Stack on</label>
            <select
              value={stack}
              onChange={(e) => setProps({ stack: e.target.value })}
            >
              <option value="phone">Phone</option>
              <option value="tablet">Tablet</option>
              <option value="never">Never</option>
            </select>
            <span className="hint">
              When the columns collapse to a single stacked list.
            </span>
          </div>
          <p className="bkedit__note">
            Add blocks inside each column with “＋ Add inside” on the row card.
          </p>
        </>
      );
    }

    case "testimonial":
      return (
        <ItemPicker
          table="testimonials"
          value={pStr("itemId")}
          onChange={(itemId) => setProps({ itemId })}
          label="Testimonial"
        />
      );

    case "faqgroup":
      return (
        <>
          {headingField("Heading (optional)", "Questions, answered")}
          <ItemMultiPicker
            table="faqs"
            value={pIds("ids")}
            onChange={(ids) => setProps({ ids: ids.length ? ids : null })}
            label="FAQs in this group"
          />
        </>
      );

    case "offercard":
      return (
        <ItemPicker
          table="offers"
          value={pStr("itemId")}
          onChange={(itemId) => setProps({ itemId })}
          label="Offer"
        />
      );

    case "magnet":
      return (
        <ItemPicker
          table="lead_magnets"
          value={pStr("itemId")}
          onChange={(itemId) => setProps({ itemId })}
          label="Lead magnet"
        />
      );

    default:
      return (
        <>
          {headingField("Heading")}
          {bodyArea("Body")}
        </>
      );
  }
  })();

  const layoutFieldset = (
    <fieldset className="bkedit__layout">
      <legend>Layout</legend>
        <div className="bkedit__layoutrow">
          <div className="field">
            <label>Width</label>
            <select
              value={String(layout.span ?? "")}
              onChange={(e) =>
                patchLayout({
                  span: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Full width</option>
              <option value="5">Five sixths</option>
              <option value="4">Two thirds</option>
              <option value="3">Half</option>
              <option value="2">One third</option>
              <option value="1">One sixth</option>
            </select>
          </div>
          <div className="field">
            <label>Alignment</label>
            <select
              value={String(layout.align ?? "")}
              onChange={(e) => patchLayout({ align: e.target.value || null })}
            >
              <option value="">Default</option>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          {kind === "image" && (
            <div className="field">
              <label>Shape</label>
              <select
                value={
                  ["circle", "feather"].includes(String(layout.shape))
                    ? String(layout.shape)
                    : ""
                }
                onChange={(e) => patchLayout({ shape: e.target.value || null })}
              >
                <option value="">Rounded</option>
                <option value="circle">Circle</option>
                <option value="feather">Feather (soft fade)</option>
              </select>
            </div>
          )}
          {kind === "button" && (
            <label className="bkedit__laycheck">
              <input
                type="checkbox"
                checked={layout.size === "big"}
                onChange={(e) =>
                  patchLayout({ size: e.target.checked ? "big" : null })
                }
              />
              Big button
            </label>
          )}
        </div>
    </fieldset>
  );

  return (
    <>
      <div className="bkedit__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "content"}
          className={`bkedit__tab ${tab === "content" ? "bkedit__tab--on" : ""}`}
          onClick={() => setTab("content")}
        >
          Content
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "style"}
          className={`bkedit__tab ${tab === "style" ? "bkedit__tab--on" : ""}`}
          onClick={() => setTab("style")}
        >
          Style
          {hasStyle(style) && <i className="bkedit__tabdot" aria-hidden />}
        </button>
      </div>
      {tab === "content" ? (
        secFields ?? (
          <>
            {kindFields}
            {layoutFieldset}
          </>
        )
      ) : (
        <StylePanel style={style} onPatch={patchStyle} />
      )}
    </>
  );
}

/* ---------- the Style tab ---------- */

/**
 * Every BlockStyle prop, grouped Text / Box. Each control's first option is
 * "Default", which CLEARS the prop rather than storing a value — an unstyled
 * block saves `{}` and inherits the site's own design.
 */
export function StylePanel({
  style,
  onPatch,
  hideColors = false,
}: {
  style: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  hideColors?: boolean;
}) {
  const val = (prop: string) =>
    typeof style[prop] === "string" ? String(style[prop]) : "";

  /** A signed px field for overlay offsets — freeNum assumes an unsigned
   * token+unit pair, which doesn't fit top/left/right/bottom's negative range. */
  const offsetNum = (label: string, prop: string) => {
    const m = /^(-?\d{1,4})px$/.exec(val(prop));
    return (
      <div className="field bkstyle__field">
        <label>{label}</label>
        <input
          className="bkstyle__num"
          type="number"
          placeholder="±px"
          value={m ? m[1] : ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onPatch({ [prop]: raw === "" ? null : `${raw}px` });
          }}
        />
      </div>
    );
  };

  /** A bare "N%" field — width doesn't fit freeNum's token+unit pairing
   * (there's no token form, just a 5-100 range) any more than offsets do. */
  const widthNum = () => {
    const m = /^(\d{1,3})%$/.exec(val("width"));
    return (
      <div className="field bkstyle__field">
        <label>Width %</label>
        <input
          className="bkstyle__num"
          type="number"
          min={5}
          max={100}
          placeholder="5-100"
          value={m ? m[1] : ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onPatch({ width: raw === "" ? null : `${raw}%` });
          }}
        />
      </div>
    );
  };

  /** A bare-number field (opacity/rotate/scale) — the value has no unit
   * suffix, unlike freeNum's token+unit pairs or offsetNum's px fields. */
  const numField = (
    label: string,
    prop: string,
    min: number,
    max: number,
    ph: string
  ) => (
    <div className="field bkstyle__field">
      <label>{label}</label>
      <input
        className="bkstyle__num"
        type="number"
        min={min}
        max={max}
        placeholder={ph}
        value={val(prop)}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onPatch({ [prop]: raw === "" ? null : raw });
        }}
      />
    </div>
  );

  /** Stack order — shared by overlay and sticky. */
  const zField = () => (
    <div className="field bkstyle__field">
      <label>Stack order (z)</label>
      <input
        className="bkstyle__num"
        type="number"
        min={0}
        max={999}
        placeholder="0-999"
        value={val("z")}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onPatch({ z: raw === "" ? null : raw });
        }}
      />
    </div>
  );
  /** Bring to front / send to back / step one layer — nudges the block's OWN
   * z rather than reading sibling values (no plumbing needed for that, and
   * DOM order already breaks ties for same-z siblings in practice). */
  const bumpZ = (dir: -1 | 1) => {
    const cur = Number(val("z")) || 0;
    onPatch({ z: String(Math.min(999, Math.max(0, cur + dir))) });
  };
  const layerButtons = () => (
    <div className="field bkstyle__field bkstyle__field--wide">
      <label>Layer order</label>
      <div className="bkstyle__row" style={{ gap: 4 }}>
        <button
          type="button"
          className="btn btn--sm"
          title="Send to back"
          onClick={() => onPatch({ z: "0" })}
        >
          ⏮
        </button>
        <button
          type="button"
          className="btn btn--sm"
          title="Backward one"
          onClick={() => bumpZ(-1)}
        >
          ◀
        </button>
        <button
          type="button"
          className="btn btn--sm"
          title="Forward one"
          onClick={() => bumpZ(1)}
        >
          ▶
        </button>
        <button
          type="button"
          className="btn btn--sm"
          title="Bring to front"
          onClick={() => onPatch({ z: "999" })}
        >
          ⏭
        </button>
      </div>
    </div>
  );
  const [hex, setHex] = useState(() =>
    isHexColor(style.color) ? String(style.color) : ""
  );
  const [bgHex, setBgHex] = useState(() =>
    isHexColor(style.background) ? String(style.background) : ""
  );

  const sel = (label: string, prop: string, opts: StyleOption[]) => (
    <div className="field bkstyle__field">
      <label>{label}</label>
      <select
        value={val(prop)}
        onChange={(e) => onPatch({ [prop]: e.target.value || null })}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  /**
   * A token select PLUS a free-numeric box that writes the contract's free
   * form ("<n>px", a unitless ratio, or "<n>em"). The box only clears the prop
   * when it currently holds a value of its OWN free kind — a token stays put.
   */
  const freeNum = (
    label: string,
    prop: string,
    opts: StyleOption[],
    unit: "px" | "" | "em",
    ph: string,
    step = 1
  ) => {
    const re =
      unit === "px"
        ? /^\d{1,4}px$/
        : unit === "em"
          ? /^-?\d(?:\.\d{1,2})?em$/
          : /^\d(?:\.\d{1,2})?$/;
    const cur = val(prop);
    const numVal = re.test(cur) ? cur.replace(/(px|em)$/, "") : "";
    return (
      <div className="field bkstyle__field">
        <label>{label}</label>
        <div className="bkstyle__freerow">
          <select
            value={re.test(cur) ? "" : cur}
            onChange={(e) => onPatch({ [prop]: e.target.value || null })}
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            className="bkstyle__num"
            type="number"
            step={step}
            placeholder={ph}
            value={numVal}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                if (re.test(cur)) onPatch({ [prop]: null });
              } else {
                onPatch({ [prop]: `${raw}${unit}` });
              }
            }}
          />
        </div>
      </div>
    );
  };

  /** A hex box that only commits valid #hex, and only clears its own hex. */
  const onHex = (
    prop: "color" | "background",
    raw: string,
    set: (v: string) => void
  ) => {
    set(raw);
    const v = raw.trim();
    if (v === "") {
      if (isHexColor(style[prop])) onPatch({ [prop]: null });
    } else if (isHexColor(v)) {
      onPatch({ [prop]: v });
    }
  };

  const color = val("color");
  const background = val("background");

  return (
    <div className="bkstyle">
      <fieldset className="bkstyle__group">
        <legend>Text</legend>
        <div className="bkstyle__row">
          {sel("Size", "size", SIZE_OPTIONS)}
          {sel("Weight", "weight", WEIGHT_OPTIONS)}
          {sel("Align", "align", ALIGN_OPTIONS)}
        </div>
        <div className="bkstyle__row">
          {sel("Font", "font", FONT_OPTIONS)}
          {freeNum("Line height", "lineHeight", LINE_HEIGHT_OPTIONS, "", "1.4", 0.1)}
          {freeNum("Letter spacing", "letterSpacing", LETTER_SPACING_OPTIONS, "em", "0.02", 0.01)}
        </div>
        <div className="bkstyle__row">
          {sel("Capitalisation", "transform", TRANSFORM_OPTIONS)}
          <label className="bkedit__laycheck">
            <input
              type="checkbox"
              checked={style.italic === true}
              onChange={(e) => onPatch({ italic: e.target.checked || null })}
            />
            Italic
          </label>
        </div>
        {!hideColors && (
          <div className="field bkstyle__field bkstyle__field--wide">
            <label>Colour</label>
            <div className="bkstyle__swatches">
              <button
                type="button"
                className={`bkstyle__swatch bkstyle__swatch--none ${
                  color === "" ? "bkstyle__swatch--on" : ""
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
                  className={`bkstyle__swatch ${
                    color === c.value ? "bkstyle__swatch--on" : ""
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
                className="bkstyle__hex"
                value={hex}
                placeholder="#hex"
                spellCheck={false}
                onChange={(e) => onHex("color", e.target.value, setHex)}
              />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Box</legend>
        <div className="bkstyle__row">
          {sel("Background", "background", BACKGROUND_OPTIONS)}
          <div className="field bkstyle__field">
            <label>Background hex</label>
            <input
              className="bkstyle__hex bkstyle__hex--wide"
              value={bgHex}
              placeholder="#hex"
              spellCheck={false}
              onChange={(e) => onHex("background", e.target.value, setBgHex)}
            />
          </div>
        </div>
        {isHexColor(background) && (
          <span className="hint">Using the custom colour {background}.</span>
        )}
        <div className="bkstyle__row">
          {freeNum("Padding", "padding", PADDING_OPTIONS, "px", "px")}
          {freeNum("Space above", "marginTop", MARGIN_OPTIONS, "px", "px")}
          {freeNum("Space below", "marginBottom", MARGIN_OPTIONS, "px", "px")}
        </div>
        <div className="bkstyle__row">
          {freeNum("Corners", "radius", RADIUS_OPTIONS, "px", "px")}
          {sel("Border", "border", BORDER_OPTIONS)}
          {sel("Shadow", "shadow", SHADOW_OPTIONS)}
        </div>
        <div className="bkstyle__row">
          {freeNum("Max width", "maxWidth", MAX_WIDTH_OPTIONS, "px", "px")}
          {widthNum()}
        </div>
        {val("width") !== "" && (
          <p className="hint">
            Width % keeps the block&apos;s full grid row and narrows it inside —
            set Align (Text section above) to center or right it, or it stays
            flush left.
          </p>
        )}
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Freedom (beyond the presets)</legend>
        <div className="bkstyle__row">
          {numField("Opacity %", "opacity", 0, 100, "0-100")}
          {numField("Rotate °", "rotate", -360, 360, "±deg")}
          {numField("Scale %", "scale", 10, 300, "100 = normal")}
        </div>
        <div className="bkstyle__row">
          {(() => {
            const m = /^(\d{1,2})px$/.exec(val("borderWidth"));
            return (
              <div className="field bkstyle__field">
                <label>Custom border width</label>
                <input
                  className="bkstyle__num"
                  type="number"
                  min={0}
                  max={20}
                  placeholder="px"
                  value={m ? m[1] : ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    onPatch({ borderWidth: raw === "" ? null : `${raw}px` });
                  }}
                />
              </div>
            );
          })()}
          {sel("Border style", "borderStyle", [
            { value: "", label: "Solid (default)" },
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ])}
          <div className="field bkstyle__field">
            <label>Border colour hex</label>
            <input
              className="bkstyle__hex"
              value={val("borderColor")}
              placeholder="#hex"
              spellCheck={false}
              onChange={(e) => {
                const raw = e.target.value.trim();
                onPatch({ borderColor: raw === "" ? null : raw });
              }}
            />
          </div>
        </div>
        {(val("borderWidth") !== "" || val("borderColor") !== "") && (
          <p className="hint">
            A custom width or colour here replaces the Border preset above
            entirely.
          </p>
        )}
        <div className="bkstyle__row">
          <div className="field bkstyle__field bkstyle__field--wide">
            <label>Background image URL</label>
            <input
              value={val("bgImage")}
              placeholder="https://... or /path"
              spellCheck={false}
              onChange={(e) => {
                const raw = e.target.value.trim();
                onPatch({ bgImage: raw === "" ? null : raw });
              }}
            />
          </div>
        </div>
        <p className="hint">
          Fills the block behind its content, cropped to cover — combine with
          Background colour above as a fallback while it loads.
        </p>
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Phone (≤700px)</legend>
        <div className="bkstyle__row">
          {freeNum("Size", "sizeSm", SIZE_OPTIONS, "px", "px")}
          {freeNum("Padding", "paddingSm", PADDING_OPTIONS, "px", "px")}
        </div>
        <div className="bkstyle__row">
          {freeNum("Space above", "marginTopSm", MARGIN_OPTIONS, "px", "px")}
          {freeNum("Space below", "marginBottomSm", MARGIN_OPTIONS, "px", "px")}
        </div>
        <p className="hint">Overrides the values above only on phones. Leave blank to inherit.</p>
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Position</legend>
        <div className="bkstyle__row">
          {sel("Visibility", "hideOn", HIDE_ON_OPTIONS)}
          {sel("Layout mode", "position", POSITION_OPTIONS)}
        </div>
        {val("position") === "overlay" && (
          <>
            <div className="bkstyle__row">
              {offsetNum("Top", "top")}
              {offsetNum("Left", "left")}
            </div>
            <div className="bkstyle__row">
              {offsetNum("Right", "right")}
              {offsetNum("Bottom", "bottom")}
            </div>
            {zField()}
            {layerButtons()}
            <p className="hint">
              Overlay takes the block out of normal flow — set at least two of
              top/left/right/bottom or it collapses to the section&apos;s corner.
            </p>
          </>
        )}
        {val("position") === "sticky" && (
          <>
            <div className="bkstyle__row">
              {offsetNum("Sticks at (top)", "top")}
              {zField()}
            </div>
            {layerButtons()}
            <p className="hint">
              Sticky pins the block at this distance from the top of the
              viewport once you scroll past it. Left/right/bottom don&apos;t
              apply — the block keeps its normal-flow width and side.
            </p>
          </>
        )}
      </fieldset>

      <p className="bkedit__note">
        Every control starts at “Default”, which uses the site&apos;s own
        design — pick a value only where you want to override it.
      </p>
    </div>
  );
}

/* ---------- typed settings: props first, legacy body as the fallback ---------- */

/** A props value when it's a usable string, else the legacy body reading. */
function propOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** Testimonials count: props.count, else body line 1, clamped 1–6 (default 3). */
function countValue(body: string, props: Record<string, unknown>): number {
  const n = Number(props.count);
  if (Number.isFinite(n) && n > 0) return Math.min(6, Math.max(1, Math.round(n)));
  return clampCount(body);
}

/** Testimonials count: body line 1, clamped 1–6, default 3. */
function clampCount(body: string): number {
  const n = parseInt(body.split("\n")[0]?.trim() ?? "", 10);
  return Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 3;
}

/** Gallery slot: body line 1, default "gallery". */
function gallerySlot(body: string): string {
  const s = body.split("\n")[0]?.trim() ?? "";
  return s === "about" || s === "before-after" ? s : "gallery";
}

/** Button link + variant: props first, the "href\nvariant" body as fallback. */
function buttonValue(
  body: string,
  props: Record<string, unknown>
): { href: string; variant: ButtonVariant } {
  const fallback = parseButton(body);
  const variant = String(props.variant ?? "");
  return {
    href: typeof props.href === "string" ? props.href : fallback.href,
    variant: BUTTON_VARIANTS.some((v) => v.value === variant)
      ? (variant as ButtonVariant)
      : fallback.variant,
  };
}

function ButtonEditor({
  initial,
  onCommit,
}: {
  initial: { href: string; variant: ButtonVariant };
  onCommit: (href: string, variant: ButtonVariant) => void;
}) {
  const [btn, setBtn] = useState(initial);

  const commit = (next: { href: string; variant: ButtonVariant }) => {
    setBtn(next);
    onCommit(next.href, next.variant);
  };

  return (
    <>
      <LinkPicker
        value={btn.href}
        onChange={(href) => commit({ ...btn, href })}
      />
      <div className="field">
        <label>Style</label>
        <select
          value={btn.variant}
          onChange={(e) =>
            commit({ ...btn, variant: e.target.value as ButtonVariant })
          }
        >
          {BUTTON_VARIANTS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

/* ---------- bullets: a list of single-line inputs ---------- */

function BulletsEditor({
  body,
  onBody,
}: {
  body: string;
  onBody: (b: string) => void;
}) {
  const [lines, setLines] = useState<string[]>(() => {
    const l = parseBullets(body);
    return l.length > 0 ? l : [""];
  });

  const commit = (next: string[]) => {
    setLines(next);
    onBody(bulletsToBody(next));
  };

  return (
    <div className="field">
      <label>Bullets</label>
      <div className="bkedit__list">
        {lines.map((line, i) => (
          <div className="bkedit__lrow" key={i}>
            <span className="bkedit__dot" aria-hidden>
              •
            </span>
            <input
              value={line}
              placeholder="A short point"
              onChange={(e) =>
                commit(lines.map((l, j) => (j === i ? e.target.value : l)))
              }
            />
            <button
              type="button"
              className="ibtn ibtn--del"
              title="Remove bullet"
              onClick={() => commit(lines.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bkedit__add"
        onClick={() => commit([...lines, ""])}
      >
        + Add bullet
      </button>
    </div>
  );
}

/* ---------- stats: number + label rows ---------- */

function StatsEditor({
  body,
  onBody,
}: {
  body: string;
  onBody: (b: string) => void;
}) {
  const [rows, setRows] = useState<StatRow[]>(() => {
    const r = parseStats(body);
    return r.length > 0 ? r : [{ num: "", label: "" }];
  });

  const commit = (next: StatRow[]) => {
    setRows(next);
    onBody(statsToBody(next));
  };

  const patch = (i: number, p: Partial<StatRow>) =>
    commit(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <div className="field">
      <label>Stats</label>
      <div className="bkedit__list">
        {rows.map((r, i) => (
          <div className="bkedit__srow" key={i}>
            <input
              className="bkedit__num"
              value={r.num}
              placeholder="300+"
              onChange={(e) => patch(i, { num: e.target.value })}
            />
            <input
              value={r.label}
              placeholder="Happy clients"
              onChange={(e) => patch(i, { label: e.target.value })}
            />
            <button
              type="button"
              className="ibtn ibtn--del"
              title="Remove stat"
              onClick={() => commit(rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <span className="hint">
        Wrap a number in *stars* to give it the green accent.
      </span>
      <button
        type="button"
        className="bkedit__add"
        onClick={() => commit([...rows, { num: "", label: "" }])}
      >
        + Add stat
      </button>
    </div>
  );
}

/* ---------- cards: title + text mini-forms ---------- */

function CardsEditor({
  body,
  onBody,
}: {
  body: string;
  onBody: (b: string) => void;
}) {
  const [cards, setCards] = useState<CardRow[]>(() => {
    const c = parseCards(body);
    return c.length > 0 ? c : [{ title: "", text: "" }];
  });

  const commit = (next: CardRow[]) => {
    setCards(next);
    onBody(cardsToBody(next));
  };

  const patch = (i: number, p: Partial<CardRow>) =>
    commit(cards.map((c, j) => (j === i ? { ...c, ...p } : c)));

  return (
    <div className="field">
      <label>Cards</label>
      <div className="bkedit__cards">
        {cards.map((c, i) => (
          <div className="bkedit__card" key={i}>
            <div className="bkedit__cardhead">
              <input
                value={c.title}
                placeholder="✨ Card title (emoji welcome)"
                onChange={(e) => patch(i, { title: e.target.value })}
              />
              <button
                type="button"
                className="ibtn ibtn--del"
                title="Remove card"
                onClick={() => commit(cards.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
            <textarea
              value={c.text}
              placeholder="A short description"
              rows={2}
              onChange={(e) => patch(i, { text: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bkedit__add"
        onClick={() => commit([...cards, { title: "", text: "" }])}
      >
        + Add card
      </button>
    </div>
  );
}

/* ---------- icon picker: the 44 glyph names as a labelled grid ---------- */

function IconPicker({
  value,
  onPick,
  label = "Icon",
}: {
  value: string;
  onPick: (name: string) => void;
  label?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="iconpick">
        <button
          type="button"
          className={`iconpick__chip iconpick__chip--none ${
            value === "" ? "iconpick__chip--on" : ""
          }`}
          onClick={() => onPick("")}
        >
          None
        </button>
        {ICON_NAMES.map((n) => (
          <button
            key={n}
            type="button"
            title={n}
            className={`iconpick__chip ${
              value === n ? "iconpick__chip--on" : ""
            }`}
            onClick={() => onPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- shape fill: the style-panel swatch row, writing props.fill ---------- */

function FillSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string | null) => void;
}) {
  const [hex, setHex] = useState(() => (isHexColor(value) ? value : ""));

  const onHex = (raw: string) => {
    setHex(raw);
    const v = raw.trim();
    if (v === "") {
      if (isHexColor(value)) onChange(null);
    } else if (isHexColor(v)) {
      onChange(v);
    }
  };

  return (
    <div className="field bkstyle__field bkstyle__field--wide">
      <label>Fill</label>
      <div className="bkstyle__swatches">
        <button
          type="button"
          className={`bkstyle__swatch bkstyle__swatch--none ${
            value === "" ? "bkstyle__swatch--on" : ""
          }`}
          title="Default (green)"
          onClick={() => {
            setHex("");
            onChange(null);
          }}
        >
          ∅
        </button>
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`bkstyle__swatch ${
              value === c.value ? "bkstyle__swatch--on" : ""
            }`}
            style={{ background: c.hex }}
            title={c.label}
            onClick={() => {
              setHex("");
              onChange(c.value);
            }}
          />
        ))}
        <input
          className="bkstyle__hex"
          value={hex}
          placeholder="#hex"
          spellCheck={false}
          onChange={(e) => onHex(e.target.value)}
        />
      </div>
    </div>
  );
}
