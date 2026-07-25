/**
 * Everything the visual Page Builder knows about block kinds: how they're
 * named and described in the palette, what starter content a fresh block
 * gets, and how the structured editors (stats rows, card groups, bullet
 * lists) map to the plain-text `body` format the site renders.
 *
 * The body formats mirror src/components/OfferSections.tsx on the site:
 *   bullets — one per line · stats — "number | label" per line ·
 *   cards — one card per blank-line group, first line is the title.
 */

import { ICON_NAMES } from "./icons";

export { ICON_NAMES };

export type BlockKind =
  | "text"
  | "bullets"
  | "image"
  | "video"
  | "quote"
  | "faq"
  | "stats"
  | "split"
  | "cta"
  | "cards"
  | "button"
  | "divider"
  | "testimonials"
  | "gallery"
  | "eyebrow"
  | "heading"
  | "lede"
  | "spacer"
  | "band"
  // --- layout container (Phase 3): rows split into columns ---
  | "row"
  // --- molecular atoms + composites (Phase 2) ---
  | "subheading"
  | "script"
  | "icon"
  | "avatar"
  | "ghostlink"
  | "ctanote"
  | "shape"
  | "badge"
  | "callout"
  | "card"
  | "counter"
  // --- library elements (Phase 4): pull items from managed tables ---
  | "testimonial"
  | "faqgroup"
  | "offercard"
  | "magnet";

/** Designed site sections — pages-table only, rendered by the site itself. */
export type SecKind =
  | "sec-hero"
  | "sec-proof"
  | "sec-journey"
  | "sec-spotlight"
  | "sec-testimonials"
  | "sec-scoreband"
  | "sec-finalcta"
  | "sec-bookband"
  | "sec-faq"
  | "sec-subhero"
  | "sec-about-intro"
  | "sec-about-gallery"
  | "sec-offers-catalog"
  | "sec-guarantees"
  | "sec-results-metrics"
  | "sec-results-ba"
  | "sec-results-timeline"
  | "sec-how-pillars"
  | "sec-how-steps"
  | "sec-gallery-grid"
  | "sec-magnets";

/** Which palette tab a kind lives under (drives the tabbed "Add block" sheet). */
export type PaletteGroup =
  | "layout"
  | "text"
  | "media"
  | "buttons"
  | "shapes"
  | "library";

export type KindMeta = {
  kind: BlockKind | SecKind;
  icon: string;
  label: string;
  desc: string;
  /** The palette tab this kind is filed under. */
  group: PaletteGroup;
  /**
   * Starter content a fresh block gets. `props` seeds the typed per-kind
   * settings (e.g. shape form, card style, icon name) so a just-added block
   * renders sensibly before the author touches anything.
   */
  starter: {
    heading: string;
    body: string;
    props?: Record<string, string | number | boolean>;
  };
};

/** The palette tabs, in display order. */
export const PALETTE_GROUPS: { id: PaletteGroup; label: string }[] = [
  { id: "layout", label: "Layout" },
  { id: "text", label: "Text" },
  { id: "media", label: "Media" },
  { id: "buttons", label: "Buttons" },
  { id: "shapes", label: "Shapes" },
  { id: "library", label: "Library" },
];

export const BLOCK_KINDS: KindMeta[] = [
  {
    kind: "text",
    icon: "📝",
    label: "Text",
    desc: "Heading plus one or more paragraphs.",
    group: "text",
    starter: {
      heading: "New section",
      body: "Write your paragraph here. You can use **bold**, *green* and [links](/page).",
    },
  },
  {
    kind: "eyebrow",
    icon: "🏷️",
    label: "Eyebrow",
    desc: "The small green label that tops a section.",
    group: "text",
    starter: { heading: "Section label", body: "" },
  },
  {
    kind: "heading",
    icon: "🔤",
    label: "Heading",
    desc: "A standalone heading — normal or big.",
    group: "text",
    starter: { heading: "A headline that earns attention", body: "" },
  },
  {
    kind: "subheading",
    icon: "🔡",
    label: "Subheading",
    desc: "The soft display line that sits above or below a headline.",
    group: "text",
    starter: { heading: "A line that adds a little nuance", body: "" },
  },
  {
    kind: "lede",
    icon: "✍️",
    label: "Intro text",
    desc: "The large intro-paragraph style.",
    group: "text",
    starter: {
      heading: "",
      body: "One or two lines that set the section up.",
    },
  },
  {
    kind: "script",
    icon: "🖋️",
    label: "Script accent",
    desc: "A short cursive green accent line.",
    group: "text",
    starter: { heading: "written with heart", body: "" },
  },
  {
    kind: "split",
    icon: "📰",
    label: "Text + Image",
    desc: "Copy on the left, an image on the right.",
    group: "media",
    starter: {
      heading: "Section title",
      body: "Pair this text with an image — upload one in the Media field.",
    },
  },
  {
    kind: "image",
    icon: "🖼️",
    label: "Image",
    desc: "A full-width photo with an optional caption.",
    group: "media",
    starter: { heading: "", body: "" },
  },
  {
    kind: "gallery",
    icon: "🖼️",
    label: "Photo grid",
    desc: "A grid of your gallery photos.",
    group: "media",
    starter: { heading: "", body: "gallery" },
  },
  {
    kind: "video",
    icon: "🎬",
    label: "Video",
    desc: "An embedded video player.",
    group: "media",
    starter: { heading: "", body: "" },
  },
  {
    kind: "icon",
    icon: "⭐",
    label: "Icon",
    desc: "One stroke icon — tint it, or wrap it in a green bubble.",
    group: "media",
    starter: { heading: "", body: "", props: { name: "star", size: 28 } },
  },
  {
    kind: "avatar",
    icon: "🙂",
    label: "Avatar",
    desc: "A headshot circle, or initials when there's no photo.",
    group: "media",
    starter: { heading: "AB", body: "", props: { shape: "circle" } },
  },
  {
    kind: "bullets",
    icon: "✅",
    label: "Bullet list",
    desc: "Quick, scannable points.",
    group: "text",
    starter: {
      heading: "Highlights",
      body: "First point\nSecond point\nThird point",
    },
  },
  {
    kind: "stats",
    icon: "📊",
    label: "Stats",
    desc: "Big numbers in a row.",
    group: "text",
    starter: {
      heading: "",
      body: "*300+* | Happy clients\n*12* | Years of experience\n*98%* | Satisfaction",
    },
  },
  {
    kind: "counter",
    icon: "🔢",
    label: "Counter",
    desc: "One animated metric that counts up on scroll.",
    group: "text",
    starter: {
      heading: "",
      body: "",
      props: { value: "300", label: "Happy clients", suffix: "+" },
    },
  },
  {
    kind: "cards",
    icon: "🗂️",
    label: "Card grid",
    desc: "A grid of titled mini-cards.",
    group: "library",
    starter: {
      heading: "What you get",
      body: "✨ First card\nA short description.\n\n🎯 Second card\nA short description.\n\n📈 Third card\nA short description.",
    },
  },
  {
    kind: "card",
    icon: "🃏",
    label: "Card",
    desc: "A single designed card — plain, step, pillar, guarantee or metric.",
    group: "library",
    starter: {
      heading: "Card title",
      body: "A short description of this card.",
      props: { style: "plain" },
    },
  },
  {
    kind: "quote",
    icon: "💬",
    label: "Quote",
    desc: "A pull-quote with attribution.",
    group: "text",
    starter: {
      heading: "Client name",
      body: "Add the quote here — a line that makes people stop and read.",
    },
  },
  {
    kind: "testimonials",
    icon: "🌟",
    label: "Testimonials",
    desc: "Real client testimonials, pulled in automatically.",
    group: "library",
    starter: { heading: "What clients say", body: "3" },
  },
  {
    kind: "faq",
    icon: "❓",
    label: "FAQ item",
    desc: "An expandable question & answer.",
    group: "library",
    starter: {
      heading: "Frequently asked question?",
      body: "The answer goes here.",
    },
  },
  {
    kind: "testimonial",
    icon: "🗣️",
    label: "Testimonial (one)",
    desc: "One specific testimonial from your library.",
    group: "library",
    starter: { heading: "", body: "" },
  },
  {
    kind: "faqgroup",
    icon: "📚",
    label: "FAQ group",
    desc: "A chosen set of FAQs, shown as one chunk.",
    group: "library",
    starter: { heading: "Questions, answered", body: "" },
  },
  {
    kind: "offercard",
    icon: "💳",
    label: "Offer card",
    desc: "One offer's card, pulled from your offers.",
    group: "library",
    starter: { heading: "", body: "" },
  },
  {
    kind: "magnet",
    icon: "🧲",
    label: "Lead magnet",
    desc: "One lead-magnet card from your library.",
    group: "library",
    starter: { heading: "", body: "" },
  },
  {
    kind: "cta",
    icon: "📣",
    label: "Call to action",
    desc: "A booking banner with the green button.",
    group: "buttons",
    starter: {
      heading: "Ready when you are.",
      body: "Book a free call and let's talk it through.",
    },
  },
  {
    kind: "ctanote",
    icon: "📍",
    label: "CTA note",
    desc: "The pulsing-dot status line that sits under a booking button.",
    group: "buttons",
    starter: { heading: "", body: "No pressure — cancel anytime." },
  },
  {
    kind: "button",
    icon: "🔘",
    label: "Button",
    desc: "A standalone button linking anywhere.",
    group: "buttons",
    starter: { heading: "Book a call", body: "/\ngreen" },
  },
  {
    kind: "ghostlink",
    icon: "🔗",
    label: "Ghost link",
    desc: "An underlined text link with a trailing arrow.",
    group: "buttons",
    starter: { heading: "Learn more", body: "", props: { href: "/" } },
  },
  {
    kind: "shape",
    icon: "🟢",
    label: "Shape",
    desc: "A decorative circle, box, line, ring, blob or pill.",
    group: "shapes",
    starter: { heading: "", body: "", props: { form: "circle", size: 64 } },
  },
  {
    kind: "badge",
    icon: "🏅",
    label: "Badge",
    desc: "A small uppercase pill badge.",
    group: "shapes",
    starter: { heading: "New", body: "", props: { tone: "green" } },
  },
  {
    kind: "callout",
    icon: "📌",
    label: "Callout",
    desc: "A boxed, green-edged highlighted note.",
    group: "shapes",
    starter: {
      heading: "Our promise",
      body: "We stand behind every session — if it isn't a fit, you don't pay.",
    },
  },
  {
    kind: "row",
    icon: "🧱",
    label: "Columns",
    desc: "A row split into 2–4 columns — drop blocks inside each one.",
    group: "layout",
    starter: { heading: "", body: "", props: { columns: 2 } },
  },
  {
    kind: "divider",
    icon: "➖",
    label: "Divider",
    desc: "A thin line between sections.",
    group: "layout",
    starter: { heading: "", body: "" },
  },
  {
    kind: "spacer",
    icon: "↕️",
    label: "Spacer",
    desc: "Vertical breathing room — small, medium or large.",
    group: "layout",
    starter: { heading: "", body: "m" },
  },
  {
    kind: "band",
    icon: "🖌️",
    label: "Section background",
    desc: "Starts a new full-width band — white, dark, mist or plain — for the blocks after it.",
    group: "layout",
    starter: { heading: "", body: "ink" },
  },
];

/** Shape forms the `shape` atom understands (props.form). */
export const SHAPE_FORMS: { value: string; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "box", label: "Box" },
  { value: "line", label: "Line" },
  { value: "ring", label: "Ring" },
  { value: "blob", label: "Blob" },
  { value: "pill", label: "Pill" },
];

/** The five designed card families (props.style on the `card` composite). */
export const CARD_STYLES: { value: string; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "step", label: "Step" },
  { value: "pillar", label: "Pillar" },
  { value: "guarantee", label: "Guarantee" },
  { value: "metric", label: "Metric" },
];

/** Icon tints (props.tone on the `icon` atom); "" leaves the inherited colour. */
export const ICON_TONES: { value: string; label: string }[] = [
  { value: "", label: "Default colour" },
  { value: "green", label: "Green" },
  { value: "ink", label: "Ink" },
  { value: "white", label: "White" },
  { value: "muted", label: "Muted" },
];

/** Badge tones (props.tone on the `badge` atom). */
export const BADGE_TONES: { value: string; label: string }[] = [
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
  { value: "dark", label: "Dark" },
];

/** Avatar shapes (props.shape on the `avatar` atom). */
export const AVATAR_SHAPES: { value: string; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
];

/** Band backgrounds the composer understands (body line 1). */
export const BAND_STYLES: { value: string; label: string }[] = [
  { value: "white", label: "White" },
  { value: "ink", label: "Dark ink" },
  { value: "mist", label: "Mist green" },
  { value: "plain", label: "Plain (page background)" },
];

/** Spacer sizes (body line 1). */
export const SPACER_SIZES: { value: string; label: string }[] = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
];

/**
 * The site's designed sections, addable as blocks on pages. They carry no
 * editable heading/body of their own (their text lives in keyed page text) —
 * except sec-subhero and sec-bookband, whose body line 1 is a text key
 * prefix. Only valid on page_sections, never offer_sections.
 *
 * They never appear in the tabbed palette (which lists BLOCK_KINDS only), so
 * a single `group` is injected below to satisfy KindMeta — "library", the tab
 * designed sections would belong to if they were ever offered there.
 */
const SEC_META: Omit<KindMeta, "group">[] = [
  {
    kind: "sec-hero",
    icon: "🏔️",
    label: "Home hero",
    desc: "The big landing headline with the booking button.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-proof",
    icon: "📊",
    label: "Proof numbers",
    desc: "The row of credibility stats.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-journey",
    icon: "🛤️",
    label: "Journey strip",
    desc: "The step-by-step client journey band.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-spotlight",
    icon: "💡",
    label: "Featured offer spotlight",
    desc: "Highlights the featured offer with its pricing card.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-testimonials",
    icon: "🌟",
    label: "Testimonials band",
    desc: "The designed band of client testimonials.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-scoreband",
    icon: "🎯",
    label: "Scorecard band",
    desc: "The Authority Scorecard promo band.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-finalcta",
    icon: "📣",
    label: "Final CTA",
    desc: "The closing call-to-action before the footer.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-bookband",
    icon: "📅",
    label: "Booking band",
    desc: "The green booking banner with the Calendly button.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-faq",
    icon: "❓",
    label: "FAQ list",
    desc: "All your FAQs, pulled in automatically.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-subhero",
    icon: "🏷️",
    label: "Page intro",
    desc: "The page-top intro header with eyebrow and title.",
    starter: { heading: "", body: "offers" },
  },
  {
    kind: "sec-about-intro",
    icon: "👤",
    label: "About intro",
    desc: "The portrait, story and quick facts.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-about-gallery",
    icon: "📷",
    label: "About photos",
    desc: "The behind-the-scenes photo strip.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-offers-catalog",
    icon: "🛍️",
    label: "Offers catalog",
    desc: "Every offer, grouped by category with pricing cards.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-guarantees",
    icon: "🛡️",
    label: "Guarantees",
    desc: "The risk-reversal guarantees band.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-results-metrics",
    icon: "📈",
    label: "Results metrics",
    desc: "The headline results numbers.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-results-ba",
    icon: "🔀",
    label: "Before & after",
    desc: "The before / after comparison.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-results-timeline",
    icon: "🗓️",
    label: "Results timeline",
    desc: "The 30-day results timeline.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-how-pillars",
    icon: "🏛️",
    label: "Method pillars",
    desc: "The three pillars of the method.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-how-steps",
    icon: "🪜",
    label: "Getting-started steps",
    desc: "The numbered getting-started steps.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-gallery-grid",
    icon: "🖼️",
    label: "Gallery grid",
    desc: "The designed grid of gallery photos.",
    starter: { heading: "", body: "" },
  },
  {
    kind: "sec-magnets",
    icon: "🧲",
    label: "Lead magnets",
    desc: "The grid of free downloadable resources.",
    starter: { heading: "", body: "" },
  },
];

/** The designed site sections, every one filed under the Library group. */
export const SEC_KINDS: KindMeta[] = SEC_META.map((m) => ({
  ...m,
  group: "library",
}));

/** Every kind the builder can name — generic blocks plus site sections. */
export const ALL_KINDS: KindMeta[] = [...BLOCK_KINDS, ...SEC_KINDS];

/** True for the designed site sections (sec-*). */
export function isSecKind(kind: string): boolean {
  return kind.startsWith("sec-");
}

export function kindMeta(kind: string): KindMeta {
  return (
    ALL_KINDS.find((k) => k.kind === kind) ?? {
      kind: "text",
      icon: "🧱",
      label: kind,
      desc: "",
      group: "text",
      starter: { heading: "", body: "" },
    }
  );
}

/* ---------- stats: "number | label" per line ---------- */

export type StatRow = { num: string; label: string };

export function parseStats(body: string): StatRow[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [num, ...rest] = l.split("|");
      return { num: num.trim(), label: rest.join("|").trim() };
    });
}

export function statsToBody(rows: StatRow[]): string {
  return rows
    .filter((r) => r.num.trim() !== "" || r.label.trim() !== "")
    .map((r) => `${r.num.trim()} | ${r.label.trim()}`)
    .join("\n");
}

/* ---------- cards: blank-line groups, first line = title ---------- */

export type CardRow = { title: string; text: string };

export function parseCards(body: string): CardRow[] {
  return body
    .split(/\n{2,}/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => {
      const [title, ...rest] = g.split("\n");
      return { title: title.trim(), text: rest.join("\n").trim() };
    });
}

export function cardsToBody(cards: CardRow[]): string {
  return cards
    .filter((c) => c.title.trim() !== "" || c.text.trim() !== "")
    // A card's own text must stay one group — strip internal blank lines.
    .map((c) => `${c.title.trim()}\n${c.text.replace(/\n{2,}/g, "\n").trim()}`.trim())
    .join("\n\n");
}

/* ---------- button: body = "href\nvariant" (variant omitted = green) ---------- */

export type ButtonVariant = "green" | "dark" | "outline" | "book";
export const BUTTON_VARIANTS: { value: ButtonVariant; label: string }[] = [
  { value: "green", label: "Green (default)" },
  { value: "dark", label: "Dark" },
  { value: "outline", label: "Outline" },
  { value: "book", label: "Booking (opens Calendly)" },
];

export function parseButton(body: string): { href: string; variant: ButtonVariant } {
  const [href = "", v = ""] = body.split("\n").map((l) => l.trim());
  const variant: ButtonVariant =
    v === "dark" || v === "outline" ? v : "green";
  return { href, variant };
}

export function buttonToBody(href: string, variant: ButtonVariant): string {
  const h = href.trim();
  return variant === "green" ? h : `${h}\n${variant}`;
}

/* ---------- bullets: one per line ---------- */

export function parseBullets(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function bulletsToBody(lines: string[]): string {
  return lines.filter((l) => l.trim() !== "").join("\n");
}
