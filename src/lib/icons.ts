/**
 * The admin's MIRROR of the site's icon set (src/components/Icon.tsx).
 *
 * The site's Icon component is the single source of truth for which glyphs
 * exist; this file re-states their NAMES so the admin never lets an author
 * pick an icon the site can't render. Names only — the picker shows each name
 * as a labelled chip, no glyph SVGs and no new dependencies.
 *
 * If a name is added on the site it MUST be mirrored here (and vice-versa),
 * or the admin and the renderer disagree about what's addable.
 */
export const ICON_NAMES: string[] = [
  "target",
  "calendar",
  "calendar-check",
  "check",
  "gift",
  "file",
  "star",
  "search",
  "sprout",
  "arrow-right",
  "heart",
  "leaf",
  "sun",
  "moon",
  "sparkle",
  "chart",
  "users",
  "message",
  "mail",
  "phone",
  "clock",
  "shield",
  "play",
  "camera",
  "image",
  "link",
  "bolt",
  "flag",
  "award",
  "compass",
  "lightbulb",
  "rocket",
  "pen",
  "book",
  "video",
  "map-pin",
  "quote",
  "plus",
  "minus",
  "chevron-right",
  "feather",
  "dumbbell",
  "activity",
  "apple",
];

/** True when a name is one the site can actually render. */
export function isIconName(v: unknown): v is string {
  return typeof v === "string" && ICON_NAMES.includes(v);
}
