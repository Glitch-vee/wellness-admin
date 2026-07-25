import type { TextRow } from "@/components/builder/TextPop";

/**
 * Which keyed page text (content_blocks) a designed site section (sec-*)
 * actually renders — expressed as key prefixes, so the builder can show a
 * section's text rows under its card ("Text in this section") and jump the
 * floating editor straight to any of them.
 *
 * The mapping mirrors the site's section components. Two sections carry a
 * dynamic prefix in body line 1 (sec-subhero, sec-bookband); where families
 * overlap (about_ vs about_bts_/about_gallery_) the broader section lists
 * the narrower prefixes in `exclude` so each row appears exactly once.
 */

type SecText = { prefixes: string[]; exclude?: string[] };

const SEC_TEXT: Record<string, SecText | null> = {
  "sec-hero": { prefixes: ["hero_"] },
  "sec-proof": { prefixes: ["proof_"] },
  "sec-journey": { prefixes: ["journey_"] },
  "sec-spotlight": { prefixes: ["spotlight_"] },
  "sec-testimonials": { prefixes: ["testi_"] },
  "sec-scoreband": { prefixes: ["score_", "scoreband_"] },
  "sec-finalcta": { prefixes: ["final_"] },
  // FAQs live in the FAQs library, not keyed page text.
  "sec-faq": null,
  "sec-about-intro": {
    prefixes: ["about_"],
    exclude: ["about_bts_", "about_gallery_"],
  },
  "sec-about-gallery": { prefixes: ["about_bts_", "about_gallery_"] },
  "sec-offers-catalog": {
    prefixes: ["offers_step", "offers_tier", "offers_leadgen"],
  },
  "sec-guarantees": { prefixes: ["offers_guarantee", "offers_g"] },
  "sec-results-metrics": { prefixes: ["results_m", "results_note"] },
  "sec-results-ba": { prefixes: ["results_ba_"] },
  "sec-results-timeline": { prefixes: ["results_expect", "results_t"] },
  "sec-how-pillars": { prefixes: ["how_p", "how_bridge"] },
  "sec-how-steps": { prefixes: ["how_s", "how_start", "how_expect"] },
  "sec-gallery-grid": { prefixes: ["gallery_empty"] },
  "sec-magnets": { prefixes: ["resources_cta"] },
};

/** Body line 1 — sec-subhero / sec-bookband use it as a text key prefix. */
function bodyPrefix(body: string): string {
  return (body.split("\n")[0] ?? "").trim();
}

/**
 * The content_blocks key prefixes a section renders, or null when it has no
 * keyed text of its own (sec-faq, unknown kinds).
 */
export function sectionTextPrefixes(kind: string, body: string): string[] | null {
  if (kind === "sec-bookband") {
    const p = bodyPrefix(body);
    return p ? [`${p}_book_`] : ["book_"];
  }
  if (kind === "sec-subhero") {
    const p = bodyPrefix(body);
    return p ? [`${p}_`] : null;
  }
  return SEC_TEXT[kind]?.prefixes ?? null;
}

/**
 * The text rows a section renders: keys matching any of its prefixes (minus
 * its excludes), de-duped and sorted by key. Empty for non-sec kinds.
 */
export function sectionTextRows(
  kind: string,
  body: string,
  rows: TextRow[]
): TextRow[] {
  const prefixes = sectionTextPrefixes(kind, body);
  if (!prefixes || prefixes.length === 0) return [];
  const exclude = SEC_TEXT[kind]?.exclude ?? [];
  const seen = new Set<string>();
  const out: TextRow[] = [];
  for (const r of rows) {
    if (seen.has(r.key)) continue;
    if (!prefixes.some((p) => r.key.startsWith(p))) continue;
    if (exclude.some((p) => r.key.startsWith(p))) continue;
    seen.add(r.key);
    out.push(r);
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
