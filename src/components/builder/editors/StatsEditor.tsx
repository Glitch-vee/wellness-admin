"use client";

import { useState } from "react";
import { parseStats, statsToBody, type StatRow } from "@/lib/blocks";

/* ---------- stats: number + label rows ---------- */

export function StatsEditor({
  body,
  onBody,
}: {
  body: string;
  onBody: (b: string) => void;
}) {
  const [rows, setRows] = useState<StatRow[]>(() => {
    const r = parseStats(body);
    return r.length > 0 ? r : [{ num: "", label: "" }];
  });

  const commit = (next: StatRow[]) => {
    setRows(next);
    onBody(statsToBody(next));
  };

  const patch = (i: number, p: Partial<StatRow>) =>
    commit(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <div className="field">
      <label>Stats</label>
      <div className="bkedit__list">
        {rows.map((r, i) => (
          <div className="bkedit__srow" key={i}>
            <input
              className="bkedit__num"
              value={r.num}
              placeholder="300+"
              onChange={(e) => patch(i, { num: e.target.value })}
            />
            <input
              value={r.label}
              placeholder="Happy clients"
              onChange={(e) => patch(i, { label: e.target.value })}
            />
            <button
              type="button"
              className="ibtn ibtn--del"
              title="Remove stat"
              onClick={() => commit(rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <span className="hint">
        Wrap a number in *stars* to give it the green accent.
      </span>
      <button
        type="button"
        className="bkedit__add"
        onClick={() => commit([...rows, { num: "", label: "" }])}
      >
        + Add stat
      </button>
    </div>
  );
}
