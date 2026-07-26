"use client";

import { ICON_NAMES } from "@/lib/blocks";

/* ---------- icon picker: the 44 glyph names as a labelled grid ---------- */

export function IconPicker({
  value,
  onPick,
  label = "Icon",
}: {
  value: string;
  onPick: (name: string) => void;
  label?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="iconpick">
        <button
          type="button"
          className={`iconpick__chip iconpick__chip--none ${
            value === "" ? "iconpick__chip--on" : ""
          }`}
          onClick={() => onPick("")}
        >
          None
        </button>
        {ICON_NAMES.map((n) => (
          <button
            key={n}
            type="button"
            title={n}
            className={`iconpick__chip ${
              value === n ? "iconpick__chip--on" : ""
            }`}
            onClick={() => onPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
