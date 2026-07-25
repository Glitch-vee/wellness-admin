"use client";

/**
 * Recent-activity feed: one row per site event with a type icon, an optional
 * label (CTA name, lead email), the path as a quiet chip, and a relative time.
 */

export type FeedItem = {
  at: string;
  type: string;
  path: string;
  label?: string;
};

const TYPE_META: Record<string, { icon: string; verb: string }> = {
  pageview: { icon: "👁", verb: "Page view" },
  cta_click: { icon: "🎯", verb: "CTA click" },
  lead: { icon: "📥", verb: "New lead" },
  ab_expose: { icon: "🧪", verb: "A/B exposure" },
};

/** "just now" · "5m ago" · "2h ago" · "3d ago" · "Jul 12" */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function Feed({
  items,
  empty = "Nothing yet.",
}: {
  items: FeedItem[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="gw-none">{empty}</p>;
  }
  return (
    <div className="gw-feed">
      {items.map((it, i) => {
        const meta = TYPE_META[it.type] ?? { icon: "•", verb: it.type };
        return (
          <div className="gw-feed__row" key={`${it.at}-${i}`}>
            <span className="gw-feed__icon" aria-hidden>
              {meta.icon}
            </span>
            <span className="gw-feed__text">
              <strong>{meta.verb}</strong>
              {it.label ? ` · ${it.label}` : ""}
            </span>
            {it.path && <span className="gw-feed__path">{it.path}</span>}
            <span className="gw-feed__time" title={new Date(it.at).toLocaleString()}>
              {timeAgo(it.at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
