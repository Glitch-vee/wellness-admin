/**
 * Pure data: which tables/columns the admin may edit, and how to render
 * their form fields. Shared by server API routes and client pages.
 */

import { cleanStyle, isStyleColor } from "./blockstyle";
import { ICON_NAMES } from "./icons";

export type FieldType =
  | "text"
  | "textarea"
  | "lines"
  | "boolean"
  | "number"
  | "select"
  /** Upload/pick an image; stores the public URL. */
  | "image"
  /** Foreign key to another managed table; stores that row's id. */
  | "parent";

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** For type "parent": which table to pick a row from. */
  parentTable?: string;
  /** Small helper line shown under the input. */
  hint?: string;
};

export type TableSpec = {
  label: string;
  orderBy: string;
  fields: FieldSpec[];
};

export const TABLES: Record<string, TableSpec> = {
  offers: {
    label: "Offers",
    orderBy: "sort_order",
    fields: [
      {
        name: "category",
        label: "Category",
        type: "select",
        options: ["free", "starter", "retainer", "leadgen"],
      },
      { name: "title", label: "Title", type: "text" },
      {
        name: "slug",
        label: "Page address",
        type: "text",
      },
      {
        name: "outcome",
        label: "Outcome",
        type: "text",
      },
      { name: "price", label: "Price", type: "text" },
      { name: "period", label: "Period", type: "text" },
      { name: "note", label: "Note", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "features", label: "Features", type: "lines" },
      { name: "badge", label: "Badge", type: "text" },
      { name: "cta_label", label: "Button label", type: "text" },
      { name: "cta_href", label: "Button link", type: "text" },
      { name: "highlight", label: "Highlighted", type: "boolean" },
      { name: "featured", label: "On landing page", type: "boolean" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },

      // ---- the offer's own page at /offers/<slug> ----
      {
        name: "hero_image_url",
        label: "Hero image",
        type: "image",
      },
      {
        name: "video_url",
        label: "Video link",
        type: "text",
      },
      {
        name: "long_description",
        label: "Page intro",
        type: "textarea",
      },
      {
        name: "seo_description",
        label: "Link preview",
        type: "textarea",
      },
      {
        name: "page_enabled",
        label: "Has own page",
        type: "boolean",
      },
    ],
  },
  offer_sections: {
    label: "Offer Pages",
    orderBy: "sort_order",
    fields: [
      {
        name: "offer_id",
        label: "Offer",
        type: "parent",
        parentTable: "offers",
      },
      {
        name: "kind",
        label: "Type",
        type: "select",
        options: ["text", "bullets", "image", "video", "quote", "faq", "stats", "split", "cta", "cards", "button", "divider", "testimonials", "gallery", "eyebrow", "heading", "lede", "spacer", "row", "subheading", "script", "icon", "avatar", "ghostlink", "ctanote", "shape", "badge", "callout", "card", "counter", "testimonial", "faqgroup", "offercard", "magnet"],
      },
      {
        name: "heading",
        label: "Heading",
        type: "text",
      },
      {
        name: "body",
        label: "Body",
        type: "textarea",
        hint: "Text/FAQ: paragraphs · Bullets: one per line · Stats: one per line as “number | label” · Split: text (image goes in Media) · Cards: one card per blank line (first line = title)",
      },
      {
        name: "media_url",
        label: "Media",
        type: "image",
      },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },
    ],
  },
  testimonials: {
    label: "Testimonials",
    orderBy: "sort_order",
    fields: [
      { name: "quote", label: "Quote", type: "textarea" },
      { name: "author", label: "Name", type: "text" },
      { name: "role", label: "Role / company", type: "text" },
      { name: "image_url", label: "Photo", type: "image" },
      { name: "initials", label: "Initials", type: "text" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },
    ],
  },
  faqs: {
    label: "FAQs",
    orderBy: "sort_order",
    fields: [
      { name: "question", label: "Question", type: "text" },
      { name: "answer", label: "Answer", type: "textarea" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },
    ],
  },
  lead_magnets: {
    label: "Lead Magnets",
    orderBy: "sort_order",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      {
        name: "href",
        label: "Link",
        type: "text",
      },
      { name: "cta_label", label: "Link label", type: "text" },
      {
        name: "image_url",
        label: "Cover image",
        type: "image",
      },
      {
        name: "icon",
        label: "Icon",
        type: "select",
        options: ["target", "calendar", "check", "gift", "file", "star"],
      },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },
    ],
  },
  gallery_images: {
    label: "Gallery",
    orderBy: "sort_order",
    fields: [
      {
        name: "slot",
        label: "Shows on",
        type: "select",
        options: ["gallery", "about", "before-after"],
      },
      { name: "alt", label: "Alt text", type: "text" },
      { name: "caption", label: "Caption", type: "text" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },
    ],
  },
  pages: {
    label: "Pages",
    orderBy: "sort_order",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "slug", label: "Page address", type: "text" },
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "subtitle", label: "Intro paragraph", type: "textarea" },
      { name: "seo_description", label: "Link preview", type: "textarea" },
      { name: "nav", label: "Show in top menu", type: "boolean" },
      { name: "nav_label", label: "Menu label (optional)", type: "text" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },
    ],
  },
  page_sections: {
    label: "Page Blocks",
    orderBy: "sort_order",
    fields: [
      { name: "page_id", label: "Page", type: "parent", parentTable: "pages" },
      {
        name: "kind",
        label: "Type",
        type: "select",
        // Generic blocks first, then the designed site sections (sec-*) —
        // valid on page_sections ONLY, never offer_sections.
        options: [
          "text", "bullets", "image", "video", "quote", "faq", "stats", "split", "cta", "cards", "button", "divider", "testimonials", "gallery", "eyebrow", "heading", "lede", "spacer", "band", "row",
          "subheading", "script", "icon", "avatar", "ghostlink", "ctanote", "shape", "badge", "callout", "card", "counter", "testimonial", "faqgroup", "offercard", "magnet",
          "sec-hero", "sec-proof", "sec-journey", "sec-spotlight", "sec-testimonials", "sec-scoreband", "sec-finalcta", "sec-bookband", "sec-faq", "sec-subhero", "sec-about-intro", "sec-about-gallery", "sec-offers-catalog", "sec-guarantees", "sec-results-metrics", "sec-results-ba", "sec-results-timeline", "sec-how-pillars", "sec-how-steps", "sec-gallery-grid", "sec-magnets",
        ],
      },
      { name: "heading", label: "Heading", type: "text" },
      {
        name: "body",
        label: "Body",
        type: "textarea",
        hint: "Text/FAQ: paragraphs · Bullets: one per line · Stats: one per line as “number | label” · Split: text (image goes in Media) · Cards: one card per blank line (first line = title)",
      },
      { name: "media_url", label: "Media", type: "image" },
      { name: "sort_order", label: "Order", type: "number" },
      { name: "active", label: "Visible", type: "boolean" },
    ],
  },
};

/** Keep only allowlisted fields; coerce types defensively. */
export function sanitizeRow(
  table: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const spec = TABLES[table];
  if (!spec) return {};
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (!(f.name in payload)) continue;
    const v = payload[f.name];
    switch (f.type) {
      case "boolean":
        out[f.name] = Boolean(v);
        break;
      case "number":
        out[f.name] = Number(v) || 0;
        break;
      case "lines":
        out[f.name] = Array.isArray(v)
          ? v.map(String).filter((s) => s.trim() !== "")
          : [];
        break;
      case "select":
        out[f.name] = f.options?.includes(String(v))
          ? String(v)
          : (f.options?.[0] ?? "");
        break;
      case "parent":
        // A foreign key must be a real id or nothing — never an empty string,
        // which Postgres rejects as an invalid uuid.
        if (!v) continue;
        out[f.name] = String(v);
        break;
      default:
        out[f.name] = String(v ?? "");
    }
  }

  // An offer's / page's slug is NOT NULL and unique — derive one from the
  // title rather than letting a blank field fail the insert.
  if (table === "offers" || table === "pages") {
    const slug = slugify(String(out.slug ?? ""));
    out.slug = slug || slugify(String(out.title ?? payload.title ?? ""));
  }

  // Section blocks carry four extra columns beyond their form fields: the
  // grid `layout`, the per-element `style`, the typed `props` and a `parent_id`
  // container link. Each only flows through when the payload sends it,
  // validated against its contract — always an object, possibly {} (which
  // clears it). `style`, `props` and `parent_id` land with a pending
  // migration, so callers must survive the column not existing yet.
  if (table === "page_sections" || table === "offer_sections") {
    if ("layout" in payload) out.layout = sanitizeLayout(payload.layout);
    if ("style" in payload) out.style = sanitizeStyle(payload.style);
    if ("props" in payload) out.props = sanitizeProps(payload.props);
    if ("parent_id" in payload) {
      // A container link must be a real id, an explicit null (which detaches
      // the block back to top level — "move out of columns"), or absent.
      // An empty string is never sent through: Postgres rejects it as an
      // invalid uuid.
      if (payload.parent_id === null) {
        out.parent_id = null;
      } else {
        const pid =
          typeof payload.parent_id === "string" ? payload.parent_id.trim() : "";
        if (pid !== "") out.parent_id = pid;
      }
    }
  }

  return out;
}

/** Allowlist a block-layout payload: {span?, col?, align?, shape?, size?}. */
function sanitizeLayout(value: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const l = value as Record<string, unknown>;
  // 1…5 (a 6-span block is full width and carries no class at all). This used
  // to allowlist [2,3,4,6]: spans 1 and 5 are offered by the rail AND by the
  // canvas resize handle, previewed live — and then silently dropped here, so
  // a ⅙/⅚ block snapped back to full width on the next reload.
  const span = Number(l.span);
  if (span >= 1 && span <= 5) out.span = Math.round(span);
  // Which of the 6 columns the block starts in — only meaningful alongside a
  // span, and it can never push the block past the last column.
  const col = Number(l.col);
  if (out.span && col >= 1 && col <= 7 - (out.span as number)) out.col = Math.round(col);
  if (["left", "center", "right"].includes(String(l.align))) {
    out.align = String(l.align);
  }
  if (["rounded", "circle", "feather"].includes(String(l.shape))) {
    out.shape = String(l.shape);
  }
  if (l.size === "big") out.size = "big";
  return out;
}

/**
 * Allowlist a block-style payload against the BlockStyle contract — the same
 * token maps the Style panel builds its selects from.
 */
export function sanitizeStyle(value: unknown): Record<string, unknown> {
  return cleanStyle(value);
}

/**
 * Allowlist a block-props payload — the typed per-kind settings that replace
 * the old "body line 1" smuggling. Kinds share one object and never collide on
 * a single row, so the allowlist is the flat UNION of every kind's props:
 *   heading {size} · spacer {size} · band {background} · button {href, variant}
 *   testimonials {count} · gallery {slot} · icon {name, size, tone, bubble}
 *   avatar {shape} · ghostlink {href} · shape {form, size, fill, label}
 *   badge {tone} · callout {sig} · card {style, icon, num, tag}
 *   counter {value, label, suffix}
 */
export function sanitizeProps(value: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const p = value as Record<string, unknown>;

  // `size` is overloaded: heading/spacer use an enum (big|section|s|m|l);
  // icon/shape use a raw pixel number (clamped). A row is only ever one kind,
  // so accept whichever form validates and store it verbatim.
  if (["big", "section", "s", "m", "l"].includes(String(p.size))) {
    out.size = String(p.size);
  } else if (p.size !== undefined) {
    const n = Number(p.size);
    if (Number.isFinite(n)) out.size = Math.min(320, Math.max(8, Math.round(n)));
  }
  if (["white", "ink", "mist", "plain"].includes(String(p.background))) {
    out.background = String(p.background);
  }
  // Same allowlist the site renderer applies — an unsafe href there drops the
  // whole link silently, so reject it here where the editor can still say so.
  if (typeof p.href === "string") {
    const href = p.href.trim();
    if (href === "" || /^(https?:\/\/|\/|#|mailto:)/i.test(href)) out.href = href;
  }
  if (["green", "dark", "outline", "book"].includes(String(p.variant))) {
    out.variant = String(p.variant);
  }
  if (typeof p.glow === "boolean") out.glow = p.glow;
  if (typeof p.halo === "boolean") out.halo = p.halo;
  const count = Number(p.count);
  if (p.count !== undefined && Number.isFinite(count)) {
    out.count = Math.min(6, Math.max(1, Math.round(count)));
  }
  if (["gallery", "about", "before-after"].includes(String(p.slot))) {
    out.slot = String(p.slot);
  }
  // Stacking order / grouping tag. This was missing entirely, so EVERY write
  // of props.layer — the rail's Layer field, the on-canvas ⏮◀▶⏭ buttons, the
  // [ / ] shortcuts — was silently discarded on save while the side effects it
  // triggered were persisted. Numeric values become z-index at render time; a
  // non-numeric tag groups adjacent blocks instead (see groupByLayer).
  if (typeof p.layer === "string" || typeof p.layer === "number") {
    const raw = String(p.layer).trim().slice(0, 24);
    const n = Number(raw);
    if (raw === "") {
      /* cleared — drop it */
    } else if (Number.isFinite(n)) {
      out.layer = String(Math.min(999, Math.max(0, Math.round(n))));
    } else if (/^[\w-]+$/.test(raw)) {
      out.layer = raw;
    }
  }

  // --- layout container (Phase 3): the `row` kind's column settings ---
  const columns = Number(p.columns);
  if ([2, 3, 4].includes(columns)) out.columns = columns;
  if (["s", "m", "l"].includes(String(p.gap))) out.gap = String(p.gap);
  if (["top", "center", "stretch"].includes(String(p.valign))) {
    out.valign = String(p.valign);
  }
  if (["phone", "tablet", "never"].includes(String(p.stack))) {
    out.stack = String(p.stack);
  }

  // --- molecular atoms + composites (Phase 2) ---
  // Glyph names for the icon atom and the card composite — both gated by the
  // shared ICON_NAMES so the admin can't set a glyph the site won't render.
  if (ICON_NAMES.includes(String(p.name))) out.name = String(p.name);
  if (ICON_NAMES.includes(String(p.icon))) out.icon = String(p.icon);
  // tone: union of the icon set (green|ink|white|muted) and the badge set
  // (green|red|dark).
  if (["green", "ink", "white", "muted", "red", "dark"].includes(String(p.tone))) {
    out.tone = String(p.tone);
  }
  if (typeof p.bubble === "boolean") out.bubble = p.bubble;
  // avatar shape (circle|square) — distinct from the box `shape` in layout.
  if (["circle", "square"].includes(String(p.shape))) out.shape = String(p.shape);
  if (["circle", "box", "line", "ring", "blob", "pill"].includes(String(p.form))) {
    out.form = String(p.form);
  }
  // shape fill: one of the 8 colour tokens OR a #hex — the exact colour gate
  // the site's shapeFill uses.
  if (isStyleColor(p.fill)) out.fill = String(p.fill).trim();
  if (["plain", "step", "pillar", "guarantee", "metric"].includes(String(p.style))) {
    out.style = String(p.style);
  }
  // Short free-text slots. Trim and cap so a runaway paste can't bloat the row.
  const cap = (v: unknown, max: number): string | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t === "" ? undefined : t.slice(0, max);
  };
  const label = cap(p.label, 120);
  if (label !== undefined) out.label = label;
  const num = cap(p.num, 40);
  if (num !== undefined) out.num = num;
  const tag = cap(p.tag, 80);
  if (tag !== undefined) out.tag = tag;
  const cvalue = cap(p.value, 40);
  if (cvalue !== undefined) out.value = cvalue;
  const suffix = cap(p.suffix, 16);
  if (suffix !== undefined) out.suffix = suffix;
  const sig = cap(p.sig, 120);
  if (sig !== undefined) out.sig = sig;

  // --- library elements (Phase 4): bindings to managed-table rows ---
  // itemId = one picked row; ids = an ordered set. Keep only non-empty
  // strings; the site skips any id whose row is gone.
  const itemId = cap(p.itemId, 64);
  if (itemId !== undefined) out.itemId = itemId;
  if (Array.isArray(p.ids)) {
    const ids = p.ids
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 24);
    if (ids.length > 0) out.ids = ids;
  }

  return out;
}

/** Same rule the migration and the public site use. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
