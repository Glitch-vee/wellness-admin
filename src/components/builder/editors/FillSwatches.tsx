"use client";

import { useState } from "react";
import { isHexColor, COLOR_SWATCHES } from "@/lib/blockstyle";

/* ---------- shape fill: the style-panel swatch row, writing props.fill ---------- */

export function FillSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string | null) => void;
}) {
  const [hex, setHex] = useState(() => (isHexColor(value) ? value : ""));

  const onHex = (raw: string) => {
    setHex(raw);
    const v = raw.trim();
    if (v === "") {
      if (isHexColor(value)) onChange(null);
    } else if (isHexColor(v)) {
      onChange(v);
    }
  };

  return (
    <div className="field bkstyle__field bkstyle__field--wide">
      <label>Fill</label>
      <div className="bkstyle__swatches">
        <button
          type="button"
          className={`bkstyle__swatch bkstyle__swatch--none ${
            value === "" ? "bkstyle__swatch--on" : ""
          }`}
          title="Default (green)"
          onClick={() => {
            setHex("");
            onChange(null);
          }}
        >
          ∅
        </button>
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`bkstyle__swatch ${
              value === c.value ? "bkstyle__swatch--on" : ""
            }`}
            style={{ background: c.hex }}
            title={c.label}
            onClick={() => {
              setHex("");
              onChange(c.value);
            }}
          />
        ))}
        <input
          className="bkstyle__hex"
          value={hex}
          placeholder="#hex"
          spellCheck={false}
          onChange={(e) => onHex(e.target.value)}
        />
      </div>
    </div>
  );
}
