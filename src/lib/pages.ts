/**
 * Maps a content block's `page` value to a friendly name, the URL it renders
 * at, and where it sits in the site's running order. Unknown pages (e.g. a
 * page added later) fall back to a sensible default and sort to the end, so
 * new pages appear in Page Text automatically without a code change here.
 */
export type PageMeta = { label: string; path: string; order: number };

const PAGE_META: Record<string, PageMeta> = {
  home: { label: "Home", path: "/", order: 0 },
  about: { label: "About", path: "/about", order: 1 },
  offers: { label: "Offers", path: "/offers", order: 2 },
  results: { label: "Results", path: "/results", order: 3 },
  how: { label: "How it Works", path: "/how-it-works", order: 4 },
  gallery: { label: "Gallery", path: "/gallery", order: 5 },
  resources: { label: "Resources", path: "/resources", order: 6 },
};

export function pageMeta(page: string): PageMeta {
  return (
    PAGE_META[page] ?? { label: titleize(page), path: `/${page}`, order: 99 }
  );
}

/**
 * Realistic wireframe strips for each hand-built page, derived from the
 * site's actual page composition (src/app/<page>/page.tsx + home components).
 * The hub renders these as the card thumbnail, below the hero bar.
 */
const PAGE_SECTIONS: Record<string, string[]> = {
  home: ["Proof", "Journey", "Offer spotlight", "Testimonials", "Score band", "Final CTA"],
  about: ["Portrait & facts", "Story", "Promise", "Behind the scenes", "Booking CTA"],
  offers: ["Start free", "Quick wins", "Partnerships", "Lead-gen engine", "Guarantees", "FAQ", "Booking CTA"],
  results: ["Metrics", "Client quotes", "Before / after", "30-day timeline", "Booking CTA"],
  how: ["Three pillars", "Bridge line", "Getting started", "Booking CTA"],
  gallery: ["Photo grid", "Booking CTA"],
  resources: ["Magnet grid", "Booking CTA"],
};

/**
 * The site's seven hand-built pages, in running order — the Pages hub lists
 * them as cards and the command palette offers "Edit <label>" jumps.
 */
export const STATIC_PAGES: {
  key: string;
  label: string;
  path: string;
  sections: string[];
}[] = Object.entries(PAGE_META)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key, m]) => ({
    key,
    label: m.label,
    path: m.path,
    sections: PAGE_SECTIONS[key] ?? [],
  }));

function titleize(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
