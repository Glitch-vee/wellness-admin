/**
 * Pure data: which tables/columns the admin may edit, and how to render
 * their form fields. Shared by server API routes and client pages.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "lines"
  | "boolean"
  | "number"
  | "select";

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
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
        hint: "free = big cards up top · starter = small price cards · retainer = monthly tiers · leadgen = dark banner",
      },
      { name: "title", label: "Title", type: "text" },
      {
        name: "outcome",
        label: "Outcome (the RESULT this buys — shown as the big line)",
        type: "text",
        hint: "Lead with what changes for the client, not what you do. e.g. “Calls land on your calendar while you serve clients.”",
      },
      { name: "price", label: "Price (e.g. $250, or $0 — free)", type: "text" },
      { name: "period", label: "Period (e.g. /mo — empty for one-time)", type: "text" },
      { name: "note", label: "Small note line (e.g. Month-to-month · cancel anytime)", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "features", label: "Feature bullets (one per line)", type: "lines" },
      { name: "badge", label: "Badge (e.g. Founding Rate — 5 Spots)", type: "text" },
      { name: "cta_label", label: "Button label", type: "text" },
      { name: "cta_href", label: "Button link (empty = opens Calendly)", type: "text" },
      { name: "highlight", label: "Highlighted (flagship style)", type: "boolean" },
      { name: "featured", label: "Feature on landing page", type: "boolean" },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "active", label: "Visible on site", type: "boolean" },
    ],
  },
  testimonials: {
    label: "Testimonials",
    orderBy: "sort_order",
    fields: [
      { name: "quote", label: "Quote (**text** = highlighted)", type: "textarea" },
      { name: "author", label: "Name", type: "text" },
      { name: "role", label: "Role / company", type: "text" },
      { name: "initials", label: "Initials (avatar circle)", type: "text" },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "active", label: "Visible on site", type: "boolean" },
    ],
  },
  faqs: {
    label: "FAQs",
    orderBy: "sort_order",
    fields: [
      { name: "question", label: "Question", type: "text" },
      { name: "answer", label: "Answer ([text](/link) makes a link)", type: "textarea" },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "active", label: "Visible on site", type: "boolean" },
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
        label: "Link (site path like /scorecard, or full URL)",
        type: "text",
        hint: "Tip: upload a PDF in Gallery first, then paste its URL here to offer it as a download.",
      },
      { name: "cta_label", label: "Link label (e.g. Open it →)", type: "text" },
      {
        name: "icon",
        label: "Icon",
        type: "select",
        options: ["target", "calendar", "check", "gift", "file", "star"],
      },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "active", label: "Visible on site", type: "boolean" },
    ],
  },
  gallery_images: {
    label: "Gallery",
    orderBy: "sort_order",
    fields: [
      {
        name: "slot",
        label: "Where it shows",
        type: "select",
        options: ["gallery", "about", "before-after"],
        hint: "gallery = /gallery wall · about = About page grid · before-after = Results page proof section",
      },
      { name: "alt", label: "Alt text (describe the image)", type: "text" },
      { name: "caption", label: "Caption", type: "text" },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "active", label: "Visible on site", type: "boolean" },
    ],
  },
};

/** Keep only allowlisted fields; coerce types defensively. */
export function sanitizeRow(
  table: string,
  payload: Record<string, unknown>
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
          : f.options?.[0] ?? "";
        break;
      default:
        out[f.name] = String(v ?? "");
    }
  }
  return out;
}
