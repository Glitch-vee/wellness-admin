/**
 * "Break into elements": recipes that decompose a designed site section
 * (sec-*) into a stack of tiny generic blocks — band, eyebrow, heading,
 * intro text, stats, cards, buttons… — pre-filled with the section's REAL
 * current copy (pulled from keyed page text and site settings at explode
 * time). After exploding, every piece is an ordinary block, editable at
 * the tiny level; the designed original stays available in the palette.
 *
 * Recipes approximate: bespoke widgets (portrait video, before/after
 * slider, offer catalog logic) become their nearest generic elements.
 */

export type ExplodedRow = {
  kind: string;
  heading: string;
  body: string;
  media_url: string;
};

export type ExplodeCtx = {
  /** Keyed page text: content_blocks key → current value ('' if unknown). */
  text: (key: string) => string;
  /** Site settings: key → value ('' if unknown). */
  setting: (key: string) => string;
  /** Site FAQs, newest ordering as served by the admin API. */
  faqs: { question: string; answer: string }[];
};

const row = (
  kind: string,
  heading = "",
  body = "",
  media_url = ""
): ExplodedRow => ({ kind, heading, body, media_url });

/** eyebrow + heading(+big) + lede from a key prefix — the subhero shape. */
function introRows(
  c: ExplodeCtx,
  eyebrowKey: string,
  headlineKey: string,
  ledeKey: string,
  big = true
): ExplodedRow[] {
  const out: ExplodedRow[] = [];
  if (c.text(eyebrowKey)) out.push(row("eyebrow", c.text(eyebrowKey)));
  if (c.text(headlineKey))
    out.push(row("heading", c.text(headlineKey), big ? "big" : ""));
  if (ledeKey && c.text(ledeKey)) out.push(row("lede", "", c.text(ledeKey)));
  return out;
}

/** settings stat1..4 as a stats block body. */
function settingsStats(c: ExplodeCtx): string {
  const lines: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const num = c.setting(`stat${i}_num`);
    const label = c.setting(`stat${i}_label`);
    if (num || label) lines.push(`*${num}* | ${label}`);
  }
  return lines.join("\n");
}

/** Numbered key families (journey_s1_title…) as a cards block body. */
function familyCards(
  c: ExplodeCtx,
  make: (i: number) => { title: string; text: string } | null,
  max: number
): string {
  const groups: string[] = [];
  for (let i = 1; i <= max; i++) {
    const g = make(i);
    if (!g || (!g.title && !g.text)) continue;
    groups.push(`${g.title}\n${g.text}`.trim());
  }
  return groups.join("\n\n");
}

const RECIPES: Record<
  string,
  (c: ExplodeCtx, body: string) => ExplodedRow[]
> = {
  "sec-hero": (c) => [
    row("band", "", "plain"),
    row("heading", c.text("hero_headline"), "big"),
    row("lede", "", c.text("hero_lede")),
    ...(c.setting("portrait_url")
      ? [row("image", "", "Portrait", c.setting("portrait_url"))]
      : []),
    row("cta", c.text("hero_headline") ? c.text("hero_cta") : "", c.text("hero_note")),
  ],

  "sec-proof": (c) => [
    ...introRows(c, "proof_eyebrow", "proof_headline", "", false),
    row("stats", "", settingsStats(c)),
  ],

  "sec-journey": (c) => [
    row("band", "", "ink"),
    ...introRows(c, "journey_eyebrow", "journey_headline", "journey_setup", false),
    row(
      "cards",
      "",
      familyCards(
        c,
        (i) => ({
          title: `${c.text(`journey_s${i}_day`)} — ${c.text(`journey_s${i}_title`)}`,
          text: c.text(`journey_s${i}_line`),
        }),
        4
      )
    ),
    ...(c.text("journey_cta")
      ? [row("button", c.text("journey_cta"), "/how-it-works\noutline")]
      : []),
  ],

  "sec-spotlight": (c) => [
    ...introRows(c, "spotlight_eyebrow", "spotlight_headline", "", false),
    row("text", "", c.text("spotlight_note")),
    ...(c.text("spotlight_cta")
      ? [row("button", c.text("spotlight_cta"), "/offers")]
      : []),
  ],

  "sec-testimonials": (c) => [
    ...introRows(c, "testi_eyebrow", "testi_headline", "", false),
    row("testimonials", "", "2"),
    ...(c.text("testi_more")
      ? [row("button", c.text("testi_more"), "/results\noutline")]
      : []),
  ],

  "sec-scoreband": (c) => [
    row("band", "", "mist"),
    ...introRows(c, "score_eyebrow", "score_headline", "scoreband_line", false),
    ...(c.text("score_cta")
      ? [row("button", c.text("score_cta"), "/scorecard\ndark")]
      : []),
  ],

  "sec-finalcta": (c) => [
    row("band", "", "ink"),
    row("heading", c.text("final_headline"), "big"),
    row("lede", "", c.text("final_lede")),
    row("cta", c.text("final_setup"), c.text("final_lede") ? "" : c.text("final_setup")),
  ],

  "sec-bookband": (c, body) => {
    const p = (body ?? "").split("\n")[0]?.trim();
    const k = (suffix: string) =>
      p ? c.text(`${p}_book_${suffix}`) : c.text(`book_${suffix}`);
    return [row("cta", k("title"), k("line"))];
  },

  "sec-faq": (c) => [
    row("heading", "Questions, answered", ""),
    ...c.faqs
      .slice(0, 8)
      .map((f) => row("faq", f.question, f.answer)),
  ],

  "sec-subhero": (c, body) => {
    const lines = (body ?? "").split("\n").map((l) => l.trim());
    const p = lines[0] ?? "";
    const withSetup = lines.includes("setup");
    return [
      ...(withSetup && c.text(`${p}_setup`)
        ? [row("text", "", c.text(`${p}_setup`))]
        : []),
      ...introRows(c, `${p}_eyebrow`, `${p}_headline`, `${p}_intro`, true),
    ];
  },

  "sec-about-intro": (c) => [
    ...introRows(c, "about_eyebrow", "about_headline", "about_p1", true),
    row("split", "", c.text("about_p2"), c.setting("portrait_url")),
    row("text", "", c.text("about_p3")),
    row("quote", "", c.text("about_promise")),
  ],

  "sec-about-gallery": (c) => [
    ...introRows(c, "about_bts_eyebrow", "about_bts_headline", "", false),
    row("gallery", "", "about"),
  ],

  "sec-offers-catalog": (c) => [
    row("heading", c.text("offers_step1_title") || "The offers", ""),
    row(
      "text",
      "",
      "This replaces the designed offers catalog — add Text, Cards and Button blocks to lay out your offers, or re-add the designed “Offers catalog” section from the palette."
    ),
    row("button", "See every offer", "/offers"),
  ],

  "sec-guarantees": (c) => [
    row("heading", c.text("offers_guarantee_headline"), ""),
    row(
      "cards",
      "",
      familyCards(
        c,
        (i) => ({
          title: c.text(`offers_g${i}_title`),
          text: c.text(`offers_g${i}_body`),
        }),
        3
      )
    ),
  ],

  "sec-results-metrics": (c) => [
    row(
      "stats",
      "",
      [1, 2, 3]
        .map((i) => `*${c.text(`results_m${i}_num`)}* | ${c.text(`results_m${i}_label`)}`)
        .filter((l) => l !== "** | ")
        .join("\n")
    ),
    row("testimonials", "", "3"),
    row("text", "", c.text("results_note")),
  ],

  "sec-results-ba": (c) => [
    ...introRows(c, "results_ba_eyebrow", "results_ba_headline", "", false),
    row("gallery", "", "before-after"),
  ],

  "sec-results-timeline": (c) => [
    ...introRows(c, "results_expect_eyebrow", "results_expect_headline", "", false),
    row(
      "cards",
      "",
      familyCards(
        c,
        (i) => ({
          title: `${c.text(`results_t${i}_when`)} — ${c.text(`results_t${i}_title`)}`,
          text: c.text(`results_t${i}_body`),
        }),
        6
      )
    ),
    row("text", "", c.text("results_expect_you")),
  ],

  "sec-how-pillars": (c) => [
    row(
      "cards",
      "",
      familyCards(
        c,
        (i) => ({
          title: `${c.text(`how_p${i}_tag`)} ${c.text(`how_p${i}_title`)}`.trim(),
          text: [c.text(`how_p${i}_hook`), c.text(`how_p${i}_body`)]
            .filter(Boolean)
            .join(" "),
        }),
        3
      )
    ),
    row("quote", "", c.text("how_bridge")),
  ],

  "sec-how-steps": (c) => [
    row("band", "", "white"),
    ...introRows(c, "how_start_eyebrow", "how_start_headline", "", false),
    row(
      "cards",
      "",
      familyCards(
        c,
        (i) => ({
          title: c.text(`how_s${i}_title`),
          text: c.text(`how_s${i}_body`),
        }),
        3
      )
    ),
    row("text", "", c.text("how_expect")),
  ],

  "sec-gallery-grid": () => [row("gallery", "", "gallery")],

  "sec-magnets": (c) => [
    row(
      "text",
      "",
      "This replaces the designed lead-magnet grid — your magnets still live under Lead Magnets; link them here with Button or Cards blocks, or re-add the designed section from the palette."
    ),
    row("cta", c.text("resources_cta_title"), c.text("resources_cta_body")),
  ],
};

export function canExplode(kind: string): boolean {
  return Object.hasOwn(RECIPES, kind);
}

/** Build the replacement rows; empty-content rows are dropped. */
export function explodeSection(
  kind: string,
  body: string,
  ctx: ExplodeCtx
): ExplodedRow[] {
  if (!Object.hasOwn(RECIPES, kind)) return [];
  return RECIPES[kind](ctx, body).filter((r) => {
    if (r.kind === "band" || r.kind === "divider" || r.kind === "spacer")
      return true;
    if (r.kind === "gallery" || r.kind === "testimonials") return true;
    return (
      r.heading.trim() !== "" || r.body.trim() !== "" || r.media_url !== ""
    );
  });
}
