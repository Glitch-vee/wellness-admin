import { NextResponse } from "next/server";
import { sb } from "@/lib/db";
import { STATIC_PAGES, pageMeta } from "@/lib/pages";

/**
 * GET /api/sitemap — the whole site as a graph.
 *
 * Nodes are every page the site can serve (hand-built routes, CMS pages,
 * offer pages) plus deduped external targets (Calendly, WhatsApp, LinkedIn,
 * lead-magnet files). Edges are how a visitor can get from one to another:
 * the header menu, the footer, markdown links inside content, button blocks,
 * offer cards, booking CTAs and lead magnets. Unresolvable internal links
 * become "missing" stub nodes with a broken edge, so dead links surface.
 */

// Always reflect the current CMS — never a build-time snapshot.
export const dynamic = "force-dynamic";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://alvee-wellness.vercel.app"
).replace(/\/+$/, "");

// The site's Calendly fallback (mirrors src/lib/defaults.ts) — the live site
// uses it whenever the setting is blank, so the map should too.
const CALENDLY_FALLBACK = "https://calendly.com/alveealam/free-audit";

type NodeKind = "site" | "page" | "offer" | "external" | "missing";

type Node = {
  id: string;
  kind: NodeKind;
  title: string;
  path: string;
  active?: boolean;
  nav?: boolean;
  builderHref?: string;
  pageEnabled?: boolean;
};

type Edge = {
  from: string;
  to: string;
  via: string;
  label?: string;
  broken?: boolean;
};

/** The fixed header links, exactly as src/components/Nav.tsx hard-codes them. */
const NAV_LINKS = [
  { href: "/offers", label: "Offers" },
  { href: "/results", label: "Results" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
  { href: "/resources", label: "Free Resources" },
];

/** Footer links, exactly as src/components/Footer.tsx hard-codes them. */
const FOOTER_LINKS = [
  { href: "/offers", label: "Offers" },
  { href: "/results", label: "Results" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About Alvee" },
  { href: "/gallery", label: "Gallery" },
  { href: "/scorecard", label: "Authority Scorecard" },
  { href: "/resources", label: "All Free Resources" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

/** Static routes beyond the 7 hub pages — verified present in src/app. */
const EXTRA_ROUTES = [
  { path: "/scorecard", title: "Authority Scorecard" },
  { path: "/privacy", title: "Privacy Policy" },
  { path: "/terms", title: "Terms of Service" },
];

const MD_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

type Resolved =
  | { type: "internal"; id: string }
  | { type: "external"; id: string }
  | { type: "skip" };

/** Strip the site origin, fragments and trailing slashes; classify the href. */
function resolveHref(raw: string): Resolved {
  let h = (raw ?? "").trim();
  if (!h) return { type: "skip" };
  if (h.startsWith(SITE_ORIGIN)) h = h.slice(SITE_ORIGIN.length) || "/";
  if (/^(mailto:|tel:)/i.test(h)) return { type: "skip" };
  if (/^https?:\/\//i.test(h)) {
    return { type: "external", id: h.replace(/\/+$/, "") };
  }
  if (h.startsWith("#")) return { type: "skip" }; // same-page anchor
  h = h.split("#")[0].split("?")[0];
  if (!h) return { type: "skip" };
  if (!h.startsWith("/")) h = `/${h}`;
  if (h.length > 1) h = h.replace(/\/+$/, "");
  return { type: "internal", id: h };
}

/** A friendly name for an external target, from its hostname. */
function externalTitle(href: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    if (host.includes("calendly")) return "Calendly booking";
    if (host.includes("wa.me") || host.includes("whatsapp")) return "WhatsApp";
    if (host.includes("linkedin")) return "LinkedIn";
    return host;
  } catch {
    return href;
  }
}

/** Fetch a table; a missing/broken table just contributes nothing. */
async function rows<T>(table: string, select: string): Promise<T[]> {
  try {
    const { data, error } = await sb().from(table).select(select);
    if (error || !data) return [];
    return data as T[];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    type PageRow = {
      id: string;
      title: string;
      slug: string;
      nav: boolean;
      nav_label: string | null;
      active: boolean;
      /** True on the built-in site pages (column absent pre-migration). */
      system?: boolean;
    };
    type SectionRow = {
      page_id?: string;
      offer_id?: string;
      kind: string;
      heading: string | null;
      body: string | null;
      active: boolean;
    };
    type OfferRow = {
      id: string;
      title: string;
      slug: string;
      page_enabled: boolean;
      active: boolean;
    };
    type BlockRow = { key: string; page: string | null; value: string | null };
    type SettingRow = { key: string; value: string };
    type MagnetRow = { title: string; href: string; active: boolean };

    const [pages, pageSections, offers, offerSections, blocks, settings, magnets] =
      await Promise.all([
        // Select * — the `system` column only exists post-migration, and an
        // explicit select naming it would error the whole query before then.
        rows<PageRow>("pages", "*"),
        rows<SectionRow>("page_sections", "page_id,kind,heading,body,active"),
        rows<OfferRow>("offers", "id,title,slug,page_enabled,active"),
        rows<SectionRow>("offer_sections", "offer_id,kind,heading,body,active"),
        rows<BlockRow>("content_blocks", "key,page,value"),
        rows<SettingRow>("site_settings", "key,value"),
        rows<MagnetRow>("lead_magnets", "title,href,active"),
      ]);

    const setting = (key: string) =>
      (settings.find((s) => s.key === key)?.value ?? "").trim();

    const nodes = new Map<string, Node>();
    const edges: Edge[] = [];
    const seenEdges = new Set<string>();

    // ---------- nodes ----------
    for (const p of STATIC_PAGES) {
      nodes.set(p.path, {
        id: p.path,
        kind: "site",
        title: p.label,
        path: p.path,
        nav: NAV_LINKS.some((l) => l.href === p.path),
        builderHref: `/builder/site/${p.key}`,
      });
    }
    for (const r of EXTRA_ROUTES) {
      nodes.set(r.path, { id: r.path, kind: "site", title: r.title, path: r.path });
    }
    // The "home" system page renders at the site root.
    const pagePathOf = (slug: string) => (slug === "home" ? "/" : `/${slug}`);
    for (const p of pages) {
      const path = pagePathOf(p.slug);
      if (p.system === true) {
        // The static site node already covers this path — no duplicate node;
        // just point its builder link at the row's full page builder.
        const site = nodes.get(path);
        if (site) site.builderHref = `/builder/page/${p.id}`;
        continue;
      }
      nodes.set(path, {
        id: path,
        kind: "page",
        title: p.title,
        path,
        active: p.active !== false,
        nav: Boolean(p.nav),
        builderHref: `/builder/page/${p.id}`,
      });
    }
    for (const o of offers) {
      const path = `/offers/${o.slug}`;
      nodes.set(path, {
        id: path,
        kind: "offer",
        title: o.title,
        path,
        active: o.active !== false && o.page_enabled !== false,
        pageEnabled: o.page_enabled !== false,
        builderHref: `/builder/offer/${o.id}`,
      });
    }

    const ensureExternal = (href: string, title?: string): string | null => {
      const r = resolveHref(href);
      if (r.type !== "external") return null;
      if (!nodes.has(r.id)) {
        nodes.set(r.id, {
          id: r.id,
          kind: "external",
          title: title || externalTitle(r.id),
          path: r.id,
        });
      }
      return r.id;
    };

    // ---------- edges ----------
    const addEdge = (from: string, rawTo: string, via: string, label?: string) => {
      if (!nodes.has(from)) return;
      const r = resolveHref(rawTo);
      if (r.type === "skip") return;
      let to = r.id;
      let broken = false;
      if (r.type === "external") {
        ensureExternal(rawTo);
      } else if (!nodes.has(to)) {
        // Dead internal link — stub it so the map shows where it points.
        nodes.set(to, { id: to, kind: "missing", title: to, path: to });
        broken = true;
      } else if (nodes.get(to)!.kind === "missing") {
        broken = true;
      }
      const key = `${from}→${to}·${via}`;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      edges.push({ from, to, via, ...(label ? { label } : {}), ...(broken ? { broken: true } : {}) });
    };

    // Externals that exist regardless of what the scan finds.
    const calendlyId = ensureExternal(
      setting("calendly_url") || CALENDLY_FALLBACK,
      "Calendly booking"
    );
    const whatsapp = setting("whatsapp_url");
    const whatsappId = whatsapp ? ensureExternal(whatsapp, "WhatsApp") : null;
    const linkedin = setting("linkedin_url");

    // "menu" — the real header: fixed links + burger's scorecard + nav pages.
    for (const l of NAV_LINKS) addEdge("/", l.href, "menu", l.label);
    addEdge("/", "/scorecard", "menu", "Authority Scorecard");
    for (const p of pages) {
      // System pages' menu links are the fixed NAV_LINKS above.
      if (p.system === true) continue;
      if (p.nav && p.active !== false) {
        addEdge("/", pagePathOf(p.slug), "menu", p.nav_label || p.title);
      }
    }

    // "footer" — the real footer links (+ LinkedIn from settings).
    for (const l of FOOTER_LINKS) addEdge("/", l.href, "footer", l.label);
    if (linkedin) addEdge("/", linkedin, "footer", "LinkedIn");

    // "text link" — [label](href) inside keyed page text (content_blocks).
    for (const b of blocks) {
      const from = pageMeta(b.page ?? "").path;
      if (!nodes.has(from)) continue;
      for (const m of (b.value ?? "").matchAll(MD_LINK)) {
        addEdge(from, m[2], "text link", m[1]);
      }
    }

    // "section link" — markdown links + button blocks inside page/offer blocks.
    const pagePath = new Map(pages.map((p) => [p.id, pagePathOf(p.slug)]));
    const offerPath = new Map(offers.map((o) => [o.id, `/offers/${o.slug}`]));
    const scanSections = (
      sections: SectionRow[],
      parentPath: (s: SectionRow) => string | undefined
    ) => {
      for (const s of sections) {
        if (s.active === false) continue;
        const from = parentPath(s);
        if (!from) continue;
        for (const m of (s.body ?? "").matchAll(MD_LINK)) {
          addEdge(from, m[2], "section link", m[1]);
        }
        if (s.kind === "button") {
          // Mirror the site renderer's guards: no label or an unsafe href
          // means the button never renders, so it isn't a real connection.
          const href = (s.body ?? "").split("\n")[0]?.trim() ?? "";
          const safe = /^(https?:\/\/|\/|#|mailto:)/i.test(href);
          if (safe && s.heading?.trim()) {
            addEdge(from, href, "section link", s.heading);
          }
        }
      }
    };
    scanSections(pageSections, (s) => pagePath.get(s.page_id ?? ""));
    scanSections(offerSections, (s) => offerPath.get(s.offer_id ?? ""));

    // "offer card" — the /offers page links every offer that has a page.
    for (const o of offers) {
      if (o.page_enabled !== false) {
        addEdge("/offers", `/offers/${o.slug}`, "offer card", o.title);
      }
    }

    // "booking CTA" — BookBand on every CMS page, the home hero, offer pages.
    if (calendlyId) {
      addEdge("/", calendlyId, "booking CTA", "Book a call");
      for (const p of pages) {
        addEdge(pagePathOf(p.slug), calendlyId, "booking CTA", "Book a call");
      }
      for (const o of offers) {
        if (o.page_enabled !== false) {
          addEdge(`/offers/${o.slug}`, calendlyId, "booking CTA", "Book a call");
        }
      }
    }

    // WhatsApp floating chat button (site-wide; anchored to home on the map).
    if (whatsappId) addEdge("/", whatsappId, "chat button", "WhatsApp chat");

    // "lead magnet" — every magnet on /resources points at its target.
    for (const m of magnets) {
      if (m.active === false) continue;
      if (m.href) addEdge("/resources", m.href, "lead magnet", m.title);
    }

    // ---------- stats ----------
    const inbound = new Map<string, number>();
    for (const e of edges) inbound.set(e.to, (inbound.get(e.to) ?? 0) + 1);

    const nodeList = [...nodes.values()];
    const internalKinds: NodeKind[] = ["site", "page", "offer"];
    const orphans = nodeList
      .filter(
        (n) =>
          internalKinds.includes(n.kind) &&
          n.id !== "/" &&
          (inbound.get(n.id) ?? 0) === 0
      )
      .map((n) => n.id);
    const broken = edges
      .filter((e) => e.broken)
      .map((e) => ({ from: e.from, to: e.to, label: e.label ?? e.via }));

    const stats = {
      pages: nodeList.filter((n) => internalKinds.includes(n.kind)).length,
      links: edges.length,
      orphans,
      broken,
    };

    return NextResponse.json({ nodes: nodeList, edges, stats });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sitemap failed" },
      { status: 500 }
    );
  }
}
