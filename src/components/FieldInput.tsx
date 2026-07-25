"use client";

import type { FieldSpec } from "@/lib/schema";
import InlinePreview from "@/components/InlinePreview";
import ImageField from "@/components/ImageField";

/**
 * Renders one editable field from a FieldSpec. Shared by the generic table
 * screens and the Page Builder's settings drawer, so every field type looks
 * and behaves the same everywhere.
 */
export default function FieldInput({
  spec,
  value,
  onChange,
  livePreview,
  parentOptions,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  livePreview?: boolean;
  parentOptions?: { id: string; label: string }[];
}) {
  if (spec.type === "image") {
    return (
      <div className="field field--wide">
        <ImageField
          label={spec.label}
          value={String(value ?? "")}
          onChange={onChange}
        />
      </div>
    );
  }

  if (spec.type === "parent") {
    return (
      <div className="field field--wide">
        <label>{spec.label}</label>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— pick one —</option>
          {parentOptions?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (spec.type === "boolean") {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {spec.label}
      </label>
    );
  }
  return (
    <div
      className={`field ${
        spec.type === "textarea" || spec.type === "lines" ? "field--wide" : ""
      }`}
    >
      <label>{spec.label}</label>
      {spec.type === "textarea" ? (
        <>
          <textarea
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
          {spec.hint && <span className="hint">{spec.hint}</span>}
          {livePreview && (
            <div className="erow__preview">
              <span className="erow__cap">Preview</span>
              <InlinePreview text={String(value ?? "")} />
            </div>
          )}
        </>
      ) : spec.type === "lines" ? (
        <textarea
          value={Array.isArray(value) ? (value as string[]).join("\n") : ""}
          onChange={(e) => onChange(e.target.value.split("\n"))}
          placeholder="One bullet per line"
        />
      ) : spec.type === "select" ? (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {spec.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={spec.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          onChange={(e) =>
            onChange(spec.type === "number" ? Number(e.target.value) : e.target.value)
          }
        />
      )}
    </div>
  );
}
