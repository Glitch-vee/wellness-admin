/**
 * "Break into elements" recipes: turn one designed site section (sec-*) into a
 * stack of ordinary molecule elements, carrying the section's REAL current text
 * (copied from content_blocks / site_settings at convert time) AND explicit
 * style / props / row structure so the result looks like the original.
 *
 * This is the opt-in, per-section conversion for the seven built-in pages. It
 * only covers sections that map cleanly onto existing molecules; genuinely
 * bespoke widgets (hero, journey, offers catalog, before/after slider…) have
 * no recipe and keep rendering as designed. Reversal is page-level: the
 * builder's "Reset to designed layout" restores the whole designed composition.
 *
 * The earlier attempt lost styling because it emitted bare atoms; these recipes
 * set alignment, band backgrounds and card variants explicitly, so a converted
 * section reads like its designed twin — then every piece is individually
 * editable.
 */

export type ConvertSpec = {
  kind: string;
  heading?: string;
  body?: string;
  media_url?: string;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  /** Only a `row` carries children; they become parent_id rows on insert. */
  children?: ConvertSpec[];
};

export type ConvertCtx = {
  /** content_blocks value for a key ('' when absent). */
  text: (key: string) => string;
  /** site_settings value for a key ('' when absent). */
  setting: (key: string) => string;
  /** sec-subhero / sec-bookband body line 1 (the key prefix). */
  prefix: string;
  /** sec-subhero flag lines (e.g. "setup", "reveal"). */
  flags: string[];
};

/** Alignment helper — most built-in headers are centred. */
const CENTER = { align: "center" };

const el = (kind: string, extra: Partial<ConvertSpec> = {}): ConvertSpec => ({
  kind,
  ...extra,
});

/** A card element of a given designed variant. */
const card = (
  style: string,
  heading: string,
  body: string,
  props: Record<string, unknown> = {}
): ConvertSpec => el("card", { heading, body, props: { style, ...props } });

const RECIPES: Record<string, (c: ConvertCtx) => ConvertSpec[]> = {
  // Glow band → feathered portrait → headline → (video) → lede → booking
  // button (haloed) → ghost link → dot note, centred (reuses the hero CSS).
  "sec-hero": (c) => [
    el("band", { props: { background: "plain", glow: true } }),
    ...(c.setting("portrait_url")
      ? [
          el("image", {
            media_url: c.setting("portrait_url"),
            layout: { shape: "feather", align: "center" },
          }),
        ]
      : []),
    el("heading", {
      heading: c.text("hero_headline"),
      props: { size: "big" },
      layout: CENTER,
      style: { maxWidth: "medium" },
    }),
    ...(c.setting("hero_video_url")
      ? [el("video", { media_url: c.setting("hero_video_url") })]
      : []),
    el("lede", {
      body: c.text("hero_lede"),
      layout: CENTER,
      style: { maxWidth: "medium" },
    }),
    el("button", {
      heading: c.text("hero_cta"),
      props: { variant: "book", halo: true },
      layout: { size: "big", align: "center" },
    }),
    ...(c.text("hero_cta_alt")
      ? [
          el("ghostlink", {
            heading: c.text("hero_cta_alt"),
            props: { href: "/scorecard" },
            layout: CENTER,
          }),
        ]
      : []),
    ...(c.text("hero_note")
      ? [el("ctanote", { body: c.text("hero_note"), layout: CENTER })]
      : []),
  ],

  // eyebrow → (setup) → big headline → lede, all centred.
  "sec-subhero": (c) => {
    const p = c.prefix;
    const out: ConvertSpec[] = [];
    if (c.text(`${p}_eyebrow`))
      out.push(el("eyebrow", { heading: c.text(`${p}_eyebrow`), layout: CENTER }));
    if (c.flags.includes("setup") && c.text(`${p}_setup`))
      out.push(el("subheading", { heading: c.text(`${p}_setup`), layout: CENTER }));
    if (c.text(`${p}_headline`))
      out.push(
        el("heading", {
          heading: c.text(`${p}_headline`),
          props: { size: "big" },
          layout: CENTER,
        })
      );
    if (c.text(`${p}_intro`))
      out.push(el("lede", { body: c.text(`${p}_intro`), layout: CENTER }));
    return out;
  },

  // The booking banner: one cta element with the band's title + line.
  "sec-bookband": (c) => {
    const p = c.prefix;
    const k = (s: string) => (p ? c.text(`${p}_book_${s}`) : c.text(`book_${s}`));
    return [el("cta", { heading: k("title"), body: k("line") })];
  },

  // Mist band: eyebrow, headline, line, scorecard button — centred.
  "sec-scoreband": (c) => [
    el("band", { props: { background: "mist" } }),
    el("eyebrow", { heading: c.text("score_eyebrow"), layout: CENTER }),
    el("heading", { heading: c.text("score_headline"), layout: CENTER }),
    el("lede", { body: c.text("scoreband_line"), layout: CENTER }),
    ...(c.text("score_cta")
      ? [
          el("button", {
            heading: c.text("score_cta"),
            props: { href: "/scorecard", variant: "dark" },
            layout: CENTER,
          }),
        ]
      : []),
  ],

  // Headline + a 3-column row of guarantee cards.
  "sec-guarantees": (c) => [
    el("heading", { heading: c.text("offers_guarantee_headline"), layout: CENTER }),
    el("row", {
      props: { columns: 3 },
      children: [1, 2, 3]
        .filter((i) => c.text(`offers_g${i}_title`) || c.text(`offers_g${i}_body`))
        .map((i) =>
          card("guarantee", c.text(`offers_g${i}_title`), c.text(`offers_g${i}_body`))
        ),
    }),
  ],

  // Eyebrow + headline, then a row of animated counters from the site stats.
  "sec-proof": (c) => {
    const counters = [1, 2, 3, 4]
      .filter((i) => c.setting(`stat${i}_num`))
      .map((i) =>
        el("counter", {
          props: {
            value: c.setting(`stat${i}_num`),
            label: c.setting(`stat${i}_label`),
          },
        })
      );
    return [
      ...(c.text("proof_eyebrow")
        ? [el("eyebrow", { heading: c.text("proof_eyebrow"), layout: CENTER })]
        : []),
      el("heading", { heading: c.text("proof_headline"), layout: CENTER }),
      el("row", {
        props: { columns: Math.max(2, Math.min(4, counters.length)) },
        children: counters,
      }),
    ];
  },

  // Eyebrow + headline + the real testimonials list + a link to results.
  "sec-testimonials": (c) => [
    el("eyebrow", { heading: c.text("testi_eyebrow"), layout: CENTER }),
    el("heading", { heading: c.text("testi_headline"), layout: CENTER }),
    el("testimonials", { props: { count: 2 } }),
    ...(c.text("testi_more")
      ? [
          el("ghostlink", {
            heading: c.text("testi_more"),
            props: { href: "/results" },
            layout: CENTER,
          }),
        ]
      : []),
  ],

  // White band: eyebrow, headline, a 3-column row of numbered step cards, note.
  "sec-how-steps": (c) => [
    el("band", { props: { background: "white" } }),
    el("eyebrow", { heading: c.text("how_start_eyebrow"), layout: CENTER }),
    el("heading", { heading: c.text("how_start_headline"), layout: CENTER }),
    el("row", {
      props: { columns: 3 },
      children: [1, 2, 3]
        .filter((i) => c.text(`how_s${i}_title`))
        .map((i) =>
          card("step", c.text(`how_s${i}_title`), c.text(`how_s${i}_body`), {
            num: String(i),
          })
        ),
    }),
    ...(c.text("how_expect")
      ? [el("callout", { body: c.text("how_expect") })]
      : []),
  ],

  // A 3-column row of pillar cards, then the bridge line as a script accent.
  "sec-how-pillars": (c) => [
    el("row", {
      props: { columns: 3 },
      children: [1, 2, 3]
        .filter((i) => c.text(`how_p${i}_title`))
        .map((i) =>
          card(
            "pillar",
            c.text(`how_p${i}_title`),
            [c.text(`how_p${i}_hook`), c.text(`how_p${i}_body`)]
              .filter(Boolean)
              .join("\n\n"),
            { num: `0${i}`, tag: c.text(`how_p${i}_tag`) }
          )
        ),
    }),
    ...(c.text("how_bridge")
      ? [el("script", { body: c.text("how_bridge"), layout: CENTER })]
      : []),
  ],

  // Eyebrow + headline + the About gallery images.
  "sec-about-gallery": (c) => [
    el("eyebrow", { heading: c.text("about_bts_eyebrow"), layout: CENTER }),
    el("heading", { heading: c.text("about_bts_headline"), layout: CENTER }),
    el("gallery", { props: { slot: "about" } }),
  ],

  // A row of metric counters + the testimonials + the note.
  "sec-results-metrics": (c) => {
    const metrics = [1, 2, 3]
      .filter((i) => c.text(`results_m${i}_num`))
      .map((i) =>
        el("counter", {
          props: {
            value: c.text(`results_m${i}_num`),
            label: c.text(`results_m${i}_label`),
          },
        })
      );
    return [
      el("row", {
        props: { columns: Math.max(2, Math.min(3, metrics.length || 3)) },
        children: metrics,
      }),
      el("testimonials", { props: { count: 3 } }),
      ...(c.text("results_note")
        ? [el("text", { body: c.text("results_note"), layout: CENTER })]
        : []),
    ];
  },

  // Eyebrow + headline, the timeline as a card grid, then the closing note.
  "sec-results-timeline": (c) => {
    const cards = [1, 2, 3, 4, 5, 6]
      .filter((i) => c.text(`results_t${i}_title`) || c.text(`results_t${i}_when`))
      .map((i) => {
        const when = c.text(`results_t${i}_when`);
        const title = c.text(`results_t${i}_title`);
        return `${[when, title].filter(Boolean).join(" — ")}\n${c.text(
          `results_t${i}_body`
        )}`.trim();
      });
    return [
      el("eyebrow", { heading: c.text("results_expect_eyebrow"), layout: CENTER }),
      el("heading", { heading: c.text("results_expect_headline"), layout: CENTER }),
      el("cards", { body: cards.join("\n\n") }),
      ...(c.text("results_expect_you")
        ? [el("callout", { body: c.text("results_expect_you") })]
        : []),
    ];
  },
};

/** Kinds that can be broken into elements (the rest stay as designed widgets). */
export function canConvert(kind: string): boolean {
  return Object.hasOwn(RECIPES, kind);
}

/** Build the replacement element specs; empty-content elements are dropped. */
export function convertSection(kind: string, ctx: ConvertCtx): ConvertSpec[] {
  if (!Object.hasOwn(RECIPES, kind)) return [];
  const raw = RECIPES[kind](ctx);
  // Drop elements that have no content to show (keeps a converted section from
  // sprouting empty eyebrows/ledes when the source key was blank). Structural
  // kinds (band/row/gallery/testimonials/cta) always survive.
  const keep = (s: ConvertSpec): boolean => {
    // Structural + props-driven kinds have no heading/body to check — a counter
    // carries its number in props.value, so it must survive the content test.
    // (Recipes already omit counters whose source stat is blank.)
    if (
      [
        "band",
        "row",
        "gallery",
        "testimonials",
        "cta",
        "counter",
        "image",
        "video",
      ].includes(s.kind)
    )
      return true;
    return Boolean((s.heading ?? "").trim() || (s.body ?? "").trim());
  };
  return raw
    .map((s) =>
      s.children ? { ...s, children: s.children.filter(keep) } : s
    )
    .filter((s) => (s.kind === "row" ? (s.children?.length ?? 0) > 0 : keep(s)));
}
