"use client";

/**
 * Single-series vertical bar chart in plain CSS. Columns cap at 24px wide with
 * a 4px rounded data-end, grow from a shared hairline baseline, and sit 2px
 * apart. Only the peak carries an inline value — every column answers on
 * hover via its title. Zero days show a 2px stub so the axis stays honest.
 */

export type BarDatum = {
  label: string;
  value: number;
  /** Tooltip text; defaults to "label — value". */
  title?: string;
};

export default function Bars({
  data,
  ariaLabel,
  height = 190,
}: {
  data: BarDatum[];
  ariaLabel: string;
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value));
  const peak = max > 0 ? data.findIndex((d) => d.value === max) : -1;
  // Thin the x-axis labels so they never collide: ~10 visible at most.
  const every = Math.max(1, Math.ceil(data.length / 10));

  return (
    <div className="gw-bars" role="img" aria-label={ariaLabel} style={{ height }}>
      {data.map((d, i) => {
        const pct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <div
            className="gw-bars__col"
            key={i}
            title={d.title ?? `${d.label} — ${d.value.toLocaleString("en-US")}`}
          >
            <div className="gw-bars__stack">
              {i === peak && (
                <span
                  className="gw-bars__val"
                  style={{ bottom: `calc(${pct}% + 4px)` }}
                >
                  {d.value.toLocaleString("en-US")}
                </span>
              )}
              <i
                className={`gw-bars__bar ${d.value === 0 ? "gw-bars__bar--zero" : ""}`}
                style={d.value > 0 ? { height: `${pct}%` } : undefined}
              />
            </div>
            <span className="gw-bars__lbl">
              {(data.length - 1 - i) % every === 0 ? d.label : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
