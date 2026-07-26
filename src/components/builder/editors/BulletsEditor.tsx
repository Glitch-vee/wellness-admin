"use client";

import { useState } from "react";
import { parseBullets, bulletsToBody } from "@/lib/blocks";

/* ---------- bullets: a list of single-line inputs ---------- */

export function BulletsEditor({
  body,
  onBody,
}: {
  body: string;
  onBody: (b: string) => void;
}) {
  const [lines, setLines] = useState<string[]>(() => {
    const l = parseBullets(body);
    return l.length > 0 ? l : [""];
  });

  const commit = (next: string[]) => {
    setLines(next);
    onBody(bulletsToBody(next));
  };

  return (
    <div className="field">
      <label>Bullets</label>
      <div className="bkedit__list">
        {lines.map((line, i) => (
          <div className="bkedit__lrow" key={i}>
            <span className="bkedit__dot" aria-hidden>
              •
            </span>
            <input
              value={line}
              placeholder="A short point"
              onChange={(e) =>
                commit(lines.map((l, j) => (j === i ? e.target.value : l)))
              }
            />
            <button
              type="button"
              className="ibtn ibtn--del"
              title="Remove bullet"
              onClick={() => commit(lines.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bkedit__add"
        onClick={() => commit([...lines, ""])}
      >
        + Add bullet
      </button>
    </div>
  );
}
