"use client";

import { useState } from "react";
import { BUTTON_VARIANTS, type ButtonVariant } from "@/lib/blocks";
import LinkPicker from "@/components/builder/LinkPicker";

export function ButtonEditor({
  initial,
  onCommit,
}: {
  initial: { href: string; variant: ButtonVariant };
  onCommit: (href: string, variant: ButtonVariant) => void;
}) {
  const [btn, setBtn] = useState(initial);

  const commit = (next: { href: string; variant: ButtonVariant }) => {
    setBtn(next);
    onCommit(next.href, next.variant);
  };

  return (
    <>
      <LinkPicker
        value={btn.href}
        onChange={(href) => commit({ ...btn, href })}
      />
      <div className="field">
        <label>Style</label>
        <select
          value={btn.variant}
          onChange={(e) =>
            commit({ ...btn, variant: e.target.value as ButtonVariant })
          }
        >
          {BUTTON_VARIANTS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
