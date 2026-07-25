/**
 * The admin's MIRROR of the site's per-block style contract (BlockStyle).
 *
 * Every block row carries an optional `style` jsonb — a small, token-driven
 * map the site turns into real CSS. The admin never imports site code, so the
 * token lists live here twice on purpose: this file is the single source of
 * truth for what the Style panel offers and what the API is willing to store.
 *
 * Everything is optional and allowlisted. An unknown value is dropped, never
 * passed through — a bad style degrades to "no styling", never to broken CSS.
 * Colors accept a token OR a plain #hex; nothing else.
 */

export type BlockStyle = Record<string, string | boolean>;

/** One entry of a Style-panel select — the empty value clears the prop. */
export type StyleOption = { value: string; label: string };

/* ---------- typography tokens ---------- */

/** size token → font-size in px (labels show the px so the choice is real). */
export const STYLE_SIZE_PX: Record<string, number> = {
  xs: 14,
  s: 16,
  m: 18,
  l: 24,
  xl: 32,
  xxl: 44,
  xxxl: 60,
};

export const STYLE_WEIGHTS = ["400", "500", "600", "700", "800", "900"];
export const STYLE_ALIGNS = ["left", "center", "right"];
export const STYLE_FONTS = ["display", "body", "script"];
export const STYLE_LINE_HEIGHTS = ["tight", "snug", "normal", "relaxed"];
export const STYLE_LETTER_SPACINGS = ["tight", "normal", "wide", "wider"];
export const STYLE_TRANSFORMS = ["none", "uppercase", "capitalize"];

/** color token → the hex the admin paints its swatch with. */
export const STYLE_COLOR_HEX: Record<string, string> = {
  ink: "#111111",
  body: "#444444",
  muted: "#8a8a82",
  green: "#5cb800",
  "green-dark": "#256600",
  "green-bright": "#7acc22",
  white: "#ffffff",
  red: "#cc2200",
};

/* ---------- box tokens ---------- */

export const STYLE_BACKGROUNDS = [
  "none",
  "white",
  "canvas",
  "ink",
  "mist",
  "green",
];
export const STYLE_PADDINGS = ["none", "s", "m", "l", "xl"];
export const STYLE_MARGINS = ["none", "s", "m", "l"];
export const STYLE_RADII = ["none", "s", "m", "l", "pill", "circle"];
export const STYLE_BORDERS = ["none", "hairline", "green"];
export const STYLE_SHADOWS = ["none", "card", "float", "glow"];
export const STYLE_MAX_WIDTHS = ["none", "narrow", "medium", "wide"];

/**
 * #rgb through #rrggbbaa — the only free-form value the contract allows.
 * Must match the site engine's range exactly, or a colour the admin rejects
 * (or accepts) would disagree with what actually renders.
 */
const HEX_RE = /^#[0-9a-f]{3,8}$/i;

/** Every enum prop and the values it accepts. Colors are handled apart. */
const STYLE_ENUMS: Record<string, string[]> = {
  size: Object.keys(STYLE_SIZE_PX),
  weight: STYLE_WEIGHTS,
  align: STYLE_ALIGNS,
  font: STYLE_FONTS,
  lineHeight: STYLE_LINE_HEIGHTS,
  letterSpacing: STYLE_LETTER_SPACINGS,
  transform: STYLE_TRANSFORMS,
  padding: STYLE_PADDINGS,
  marginTop: STYLE_MARGINS,
  marginBottom: STYLE_MARGINS,
  radius: STYLE_RADII,
  border: STYLE_BORDERS,
  shadow: STYLE_SHADOWS,
  maxWidth: STYLE_MAX_WIDTHS,
};

/* ---------- free-value contract (mirrors the site engine EXACTLY) ---------- */

/**
 * A handful of props accept a FREE value as well as a token: a bare pixel
 * count, a unitless line-height, an em/px letter-spacing, a numeric weight.
 * These patterns + ranges are copied verbatim from the site's style engine —
 * if they drift, a value the on-canvas toolbar sets would be accepted here but
 * dropped there (or the reverse), and the preview would lie. Out of range is
 * clamped and kept; a value that doesn't match its pattern is dropped.
 */
const PX_RE = /^\d{1,3}px$/; //            size / padding / margin / radius
const PX4_RE = /^\d{2,4}px$/; //           maxWidth
const RATIO_RE = /^\d(?:\.\d{1,2})?$/; //  lineHeight
const LETTER_RE = /^(-?\d(?:\.\d{1,2})?)(em|px)$/; // letterSpacing
const WEIGHT_RE = /^[1-9]00$/; //          any 100…900

function clampPx(v: string, min: number, max: number): string {
  return `${Math.min(max, Math.max(min, parseInt(v, 10)))}px`;
}

/**
 * Clean ONE style value: a token stays, a free value is validated (and clamped)
 * against the frozen contract, anything else becomes null (drop the prop). This
 * is the single place the token-OR-free rule lives; `cleanStyle` delegates here
 * for every prop, so what the panel/toolbar can set and what the API stores can
 * never disagree.
 */
export function cleanValue(prop: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v === "") return null;

  // Colours are their own token-OR-#hex allowlist.
  if (prop === "color") return isStyleColor(v) ? v : null;
  if (prop === "background") return isStyleBackground(v) ? v : null;

  // A known token always wins.
  const tokens = STYLE_ENUMS[prop];
  if (tokens?.includes(v)) return v;

  // Otherwise, the prop's free form — or nothing.
  switch (prop) {
    case "size":
      return PX_RE.test(v) ? clampPx(v, 8, 200) : null;
    case "padding":
    case "marginTop":
    case "marginBottom":
    case "radius":
      return PX_RE.test(v) ? clampPx(v, 0, 200) : null;
    case "maxWidth":
      return PX4_RE.test(v) ? clampPx(v, 200, 1600) : null;
    case "weight":
      return WEIGHT_RE.test(v) ? v : null;
    case "lineHeight":
      return RATIO_RE.test(v)
        ? String(Math.min(3, Math.max(0.8, parseFloat(v))))
        : null;
    case "letterSpacing": {
      const m = LETTER_RE.exec(v);
      if (!m) return null;
      const n = parseFloat(m[1]);
      const unit = m[2];
      const clamped =
        unit === "em"
          ? Math.min(0.5, Math.max(-0.1, n))
          : Math.min(20, Math.max(-5, n));
      return `${clamped}${unit}`;
    }
    default:
      // A token-only prop (align, font, transform, border, shadow) with a
      // value that wasn't a known token.
      return null;
  }
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v.trim());
}

/** A text color: one of the ink/green/… tokens, or a #hex. */
export function isStyleColor(v: unknown): v is string {
  // Object.hasOwn, not `in`: a value like "toString" must not pass as a token.
  return (
    (typeof v === "string" && Object.hasOwn(STYLE_COLOR_HEX, v)) || isHexColor(v)
  );
}

/** A box background: one of the surface tokens, or a #hex. */
export function isStyleBackground(v: unknown): v is string {
  return (
    (typeof v === "string" && STYLE_BACKGROUNDS.includes(v)) || isHexColor(v)
  );
}

/**
 * Keep only contract props with contract values. Always returns an object —
 * `{}` means "no styling", which is exactly how a cleared panel saves.
 */
export function cleanStyle(input: unknown): BlockStyle {
  const out: BlockStyle = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const s = input as Record<string, unknown>;
  // Every enum prop plus colour/background flows through the one cleanValue
  // rule (token OR free value), so a free px/ratio the toolbar sets survives.
  for (const prop of Object.keys(STYLE_ENUMS)) {
    const cleaned = cleanValue(prop, s[prop]);
    if (cleaned !== null) out[prop] = cleaned;
  }
  const color = cleanValue("color", s.color);
  if (color !== null) out.color = color;
  const background = cleanValue("background", s.background);
  if (background !== null) out.background = background;
  if (s.italic === true) out.italic = true;
  return out;
}

/** True when a row/draft carries any styling at all (drives the card chip). */
export function hasStyle(input: unknown): boolean {
  return Object.keys(cleanStyle(input)).length > 0;
}

/* ---------- option lists for the Style panel ---------- */

const DEFAULT_OPTION: StyleOption = { value: "", label: "Default" };

/** Build a list from tokens, always led by the clearing "Default" entry. */
function options(pairs: [string, string][]): StyleOption[] {
  return [DEFAULT_OPTION, ...pairs.map(([value, label]) => ({ value, label }))];
}

export const SIZE_OPTIONS = options(
  Object.entries(STYLE_SIZE_PX).map(([token, px]) => [
    token,
    `${token.toUpperCase()} · ${px}px`,
  ])
);

export const WEIGHT_OPTIONS = options([
  ["400", "Normal"],
  ["500", "Medium"],
  ["600", "Semibold"],
  ["700", "Bold"],
  ["800", "Extra bold"],
  ["900", "Black"],
]);

export const ALIGN_OPTIONS = options([
  ["left", "Left"],
  ["center", "Center"],
  ["right", "Right"],
]);

export const FONT_OPTIONS = options([
  ["display", "Display"],
  ["body", "Body"],
  ["script", "Script"],
]);

export const LINE_HEIGHT_OPTIONS = options([
  ["tight", "Tight"],
  ["snug", "Snug"],
  ["normal", "Normal"],
  ["relaxed", "Relaxed"],
]);

export const LETTER_SPACING_OPTIONS = options([
  ["tight", "Tight"],
  ["normal", "Normal"],
  ["wide", "Wide"],
  ["wider", "Wider"],
]);

export const TRANSFORM_OPTIONS = options([
  ["none", "As typed"],
  ["uppercase", "UPPERCASE"],
  ["capitalize", "Capitalize"],
]);

export const BACKGROUND_OPTIONS = options([
  ["none", "None"],
  ["white", "White"],
  ["canvas", "Canvas"],
  ["ink", "Dark ink"],
  ["mist", "Mist green"],
  ["green", "Green"],
]);

export const PADDING_OPTIONS = options([
  ["none", "None"],
  ["s", "Small"],
  ["m", "Medium"],
  ["l", "Large"],
  ["xl", "Extra large"],
]);

export const MARGIN_OPTIONS = options([
  ["none", "None"],
  ["s", "Small"],
  ["m", "Medium"],
  ["l", "Large"],
]);

export const RADIUS_OPTIONS = options([
  ["none", "Square"],
  ["s", "Slightly rounded"],
  ["m", "Rounded"],
  ["l", "Very rounded"],
  ["pill", "Pill"],
  ["circle", "Circle"],
]);

export const BORDER_OPTIONS = options([
  ["none", "None"],
  ["hairline", "Hairline"],
  ["green", "Green"],
]);

export const SHADOW_OPTIONS = options([
  ["none", "None"],
  ["card", "Card"],
  ["float", "Floating"],
  ["glow", "Green glow"],
]);

export const MAX_WIDTH_OPTIONS = options([
  ["none", "Full width"],
  ["narrow", "Narrow"],
  ["medium", "Medium"],
  ["wide", "Wide"],
]);

/** The colour swatch row: token, its hex and a human label. */
export const COLOR_SWATCHES: { value: string; hex: string; label: string }[] = [
  { value: "ink", hex: STYLE_COLOR_HEX.ink, label: "Ink" },
  { value: "body", hex: STYLE_COLOR_HEX.body, label: "Body" },
  { value: "muted", hex: STYLE_COLOR_HEX.muted, label: "Muted" },
  { value: "green", hex: STYLE_COLOR_HEX.green, label: "Green" },
  { value: "green-dark", hex: STYLE_COLOR_HEX["green-dark"], label: "Dark green" },
  {
    value: "green-bright",
    hex: STYLE_COLOR_HEX["green-bright"],
    label: "Bright green",
  },
  { value: "white", hex: STYLE_COLOR_HEX.white, label: "White" },
  { value: "red", hex: STYLE_COLOR_HEX.red, label: "Red" },
];
