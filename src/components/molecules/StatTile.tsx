"use client";

/**
 * KPI stat tile: label · big value · % delta vs the previous period · a small
 * sparkline of the series (muted bars, the current period in the accent green).
 * Numbers wear ink, never the data color; the delta alone carries direction.
 */

function fmt(n: number): string {
  if (Math.abs(n) >= 10_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return n.toLocaleString("en-US");
}

export default function StatTile({
  label,
  value,
  prev,
  series,
}: {
  label: string;
  value: number;
  /** Same metric over the previous period; null/undefined hides the delta. */
  prev?: number | null;
  /** Per-day values for the sparkline (last entry = current period). */
  series?: number[];
}) {
  const delta =
    prev == null || prev === 0 ? null : Math.round(((value - prev) / prev) * 100);
  const max = series && series.length > 0 ? Math.max(...series) : 0;

  return (
    <div className="gw-tile">
      <span className="gw-tile__lbl">{label}</span>
      <div className="gw-tile__row">
        <span className="gw-tile__num" title={value.toLocaleString("en-US")}>
          {fmt(value)}
        </span>
        {delta === null ? (
          <span className="gw-delta gw-delta--flat" title="No data in the previous period">
            —
          </span>
        ) : delta > 0 ? (
          <span className="gw-delta gw-delta--up" title="vs previous period">
            ▲ {delta}%
          </span>
        ) : delta < 0 ? (
          <span className="gw-delta gw-delta--down" title="vs previous period">
            ▼ {Math.abs(delta)}%
          </span>
        ) : (
          <span className="gw-delta gw-delta--flat" title="vs previous period">
            0%
          </span>
        )}
      </div>
      {series && series.length > 1 && (
        <div className="gw-spark" aria-hidden>
          {series.map((v, i) => (
            <i
              key={i}
              className={i === series.length - 1 ? "on" : ""}
              style={{ height: max > 0 ? `${Math.max((v / max) * 100, 7)}%` : "7%" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
