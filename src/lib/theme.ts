/**
 * Page Style panel — metadata and preview helpers.
 *
 * The admin only ever reads/writes `theme_*` rows in site_settings (via the
 * existing /api/settings route). The *authoritative* CSS is built on the main
 * site (src/lib/theme.ts). This file mirrors the presets and font list so the
 * panel can offer one-click vibes and render an accurate live preview. Keep
 * the preset values here in sync with the main site's PRESETS.
 */

export type FontKey =
  | "barlow"
  | "archivo"
  | "playfair"
  | "poppins"
  | "space"
  | "dmsans"
  | "inter"
  | "lora"
  | "satisfy";

type FontDef = {
  label: string;
  /** Google Fonts "family:spec" fragment used to build the preview <link>. */
  google: string;
  /** font-family value used in the preview. */
  css: string;
};

export const FONTS: Record<FontKey, FontDef> = {
  barlow: { label: "Barlow Condensed", google: "Barlow+Condensed:wght@600;700;900", css: "'Barlow Condensed', sans-serif" },
  archivo: { label: "Archivo", google: "Archivo:wght@400;600;800", css: "'Archivo', sans-serif" },
  playfair: { label: "Playfair Display", google: "Playfair+Display:wght@400;700;900", css: "'Playfair Display', serif" },
  poppins: { label: "Poppins", google: "Poppins:wght@400;600;800", css: "'Poppins', sans-serif" },
  space: { label: "Space Grotesk", google: "Space+Grotesk:wght@400;600;700", css: "'Space Grotesk', sans-serif" },
  dmsans: { label: "DM Sans", google: "DM+Sans:wght@400;600;700", css: "'DM Sans', sans-serif" },
  inter: { label: "Inter", google: "Inter:wght@400;600;800", css: "'Inter', sans-serif" },
  lora: { label: "Lora", google: "Lora:wght@400;600;700", css: "'Lora', serif" },
  satisfy: { label: "Satisfy", google: "Satisfy", css: "'Satisfy', cursive" },
};

export const DISPLAY_FONTS: FontKey[] = ["barlow", "archivo", "playfair", "poppins", "space", "inter"];
export const BODY_FONTS: FontKey[] = ["dmsans", "inter", "poppins", "lora"];
export const SCRIPT_FONTS: (FontKey | "none")[] = ["satisfy", "none"];

export function fontCss(key: string): string {
  return FONTS[key as FontKey]?.css ?? FONTS.dmsans.css;
}

/** Build a Google Fonts stylesheet URL loading exactly the fonts in use. */
export function previewFontHref(keys: (string | undefined)[]): string {
  const specs = Array.from(
    new Set(
      keys
        .map((k) => (k && k !== "none" ? FONTS[k as FontKey]?.google : null))
        .filter((x): x is string => Boolean(x)),
    ),
  );
  if (specs.length === 0) return "";
  return "https://fonts.googleapis.com/css2?" + specs.map((s) => `family=${s}`).join("&") + "&display=swap";
}

// --- Color controls exposed in the panel (order = display order) -----------

export const COLOR_CONTROLS: { key: string; label: string; hint: string }[] = [
  { key: "theme_color_canvas", label: "Canvas", hint: "Page background" },
  { key: "theme_color_ink", label: "Ink", hint: "Dark sections & headings" },
  { key: "theme_color_body", label: "Body text", hint: "Paragraph copy" },
  { key: "theme_color_muted", label: "Muted", hint: "Captions & fine print" },
  { key: "theme_color_accent", label: "Accent", hint: "The brand color (was green)" },
  { key: "theme_color_accent_deep", label: "Accent deep", hint: "Gradient tail & hovers" },
  { key: "theme_color_red", label: "Alert", hint: "The ~red~ emphasis word" },
];

// --- Presets (mirror of src/lib/theme.ts PRESETS) --------------------------

export type ThemeValues = {
  color_canvas: string;
  color_ink: string;
  color_body: string;
  color_muted: string;
  color_accent: string;
  color_accent_deep: string;
  color_red: string;
  radius: string;
  font_display: string;
  font_body: string;
  font_script: string;
};

export type Preset = { id: string; label: string; blurb: string; values: ThemeValues };

export const PRESETS: Preset[] = [
  {
    id: "premium-organic", label: "Premium Organic",
    blurb: "The signature look — off-white canvas, ink sheets, precious green.",
    values: { color_canvas: "#f8f8f4", color_ink: "#111111", color_body: "#444444", color_muted: "#8a8a82", color_accent: "#5cb800", color_accent_deep: "#2e6b00", color_red: "#cc2200", radius: "18", font_display: "barlow", font_body: "dmsans", font_script: "satisfy" },
  },
  {
    id: "minimal-mono", label: "Minimal Mono",
    blurb: "Near-monochrome, tight radii, quiet ink accent. Editorial restraint.",
    values: { color_canvas: "#ffffff", color_ink: "#0a0a0a", color_body: "#3a3a3a", color_muted: "#999999", color_accent: "#1a1a1a", color_accent_deep: "#000000", color_red: "#cc2200", radius: "8", font_display: "archivo", font_body: "inter", font_script: "none" },
  },
  {
    id: "warm-editorial", label: "Warm Editorial",
    blurb: "Terracotta on paper, serif display. Print-magazine warmth.",
    values: { color_canvas: "#f7f3ec", color_ink: "#2a2420", color_body: "#4a423a", color_muted: "#9a8f80", color_accent: "#b5651d", color_accent_deep: "#7a3e10", color_red: "#b32d1e", radius: "6", font_display: "playfair", font_body: "lora", font_script: "satisfy" },
  },
  {
    id: "ocean-calm", label: "Ocean Calm",
    blurb: "Cool teal, soft rounded surfaces. Clinical, trustworthy, fresh.",
    values: { color_canvas: "#f4f8f8", color_ink: "#0f1e26", color_body: "#3a4a52", color_muted: "#8098a0", color_accent: "#0d9488", color_accent_deep: "#065f56", color_red: "#c2410c", radius: "22", font_display: "poppins", font_body: "inter", font_script: "none" },
  },
  {
    id: "indigo-modern", label: "Indigo Modern",
    blurb: "Tech-forward indigo, geometric type. Confident and current.",
    values: { color_canvas: "#f5f5f7", color_ink: "#16181d", color_body: "#40434a", color_muted: "#8a8d96", color_accent: "#6366f1", color_accent_deep: "#3730a3", color_red: "#e11d48", radius: "14", font_display: "space", font_body: "inter", font_script: "none" },
  },
  {
    id: "sunset-bold", label: "Sunset Bold",
    blurb: "Warm orange energy, big rounded pills. Friendly and loud.",
    values: { color_canvas: "#fff7f2", color_ink: "#241812", color_body: "#4a3a30", color_muted: "#a08a7a", color_accent: "#f97316", color_accent_deep: "#b1420a", color_red: "#dc2626", radius: "22", font_display: "archivo", font_body: "dmsans", font_script: "satisfy" },
  },
];

/** Convert a preset into the flat theme_* rows the settings API expects. */
export function presetRows(p: Preset): { key: string; value: string }[] {
  const v = p.values;
  return [
    { key: "theme_preset", value: p.id },
    { key: "theme_color_canvas", value: v.color_canvas },
    { key: "theme_color_ink", value: v.color_ink },
    { key: "theme_color_body", value: v.color_body },
    { key: "theme_color_muted", value: v.color_muted },
    { key: "theme_color_accent", value: v.color_accent },
    { key: "theme_color_accent_deep", value: v.color_accent_deep },
    { key: "theme_color_red", value: v.color_red },
    { key: "theme_radius", value: v.radius },
    { key: "theme_font_display", value: v.font_display },
    { key: "theme_font_body", value: v.font_body },
    { key: "theme_font_script", value: v.font_script },
  ];
}

/** Flat default map for every theme_* key (Premium Organic + empty custom). */
export const THEME_DEFAULTS: Record<string, string> = {
  ...Object.fromEntries(presetRows(PRESETS[0]).map((r) => [r.key, r.value])),
  theme_font_custom_url: "",
  theme_font_custom_family: "",
};

// --- Color math for accurate preview swatches (mirror of site) -------------

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function safeHex(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  if (!HEX.test(v)) return fallback;
  if (v.length === 4) return "#" + v.slice(1).split("").map((c) => c + c).join("");
  return v.toLowerCase();
}
function toRgb(hex: string): [number, number, number] {
  const h = safeHex(hex, "#000000").slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
}
export function mix(a: string, b: string, amount: number): string {
  const ra = toRgb(a), rb = toRgb(b);
  return toHex([ra[0] + (rb[0] - ra[0]) * amount, ra[1] + (rb[1] - ra[1]) * amount, ra[2] + (rb[2] - ra[2]) * amount]);
}
