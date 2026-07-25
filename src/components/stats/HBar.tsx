"use client";

import type { ReactNode } from "react";

/**
 * Horizontal ratio bar: label + meta on top, an 8px meter underneath. The
 * unfilled track is a lighter step of the same green ramp; the neutral tone
 * (a trailing A/B variant, for instance) drops to gray so the leader reads.
 */

export default function HBar({
  label,
  meta,
  value,
  max,
  tone = "green",
  title,
}: {
  label: ReactNode;
  /** Small right-aligned figure, e.g. "214 views · 80 visitors" or "4.1%". */
  meta?: string;
  value: number;
  max: number;
  tone?: "green" | "neutral";
  title?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      className={`gw-hbar ${tone === "neutral" ? "gw-hbar--neutral" : ""}`}
      title={title}
    >
      <div className="gw-hbar__top">
        <span className="gw-hbar__label">{label}</span>
        {meta && <span className="gw-hbar__meta">{meta}</span>}
      </div>
      <div className="gw-hbar__track">
        {value > 0 && <i className="gw-hbar__fill" style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}
