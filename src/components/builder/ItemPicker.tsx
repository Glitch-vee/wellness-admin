"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Pickers that bind a library element to real rows in a managed table.
 * `ItemPicker` chooses one item (stored as props.itemId); `ItemMultiPicker`
 * chooses an ordered set (props.ids). Both lazily fetch `/api/table/<table>`
 * once and tolerate failure — a library element with no pick just renders
 * nothing on the site.
 */

type Row = Record<string, unknown> & { id: string };

/** A short human label for a row, per table. */
function labelOf(table: string, r: Row): string {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (table === "testimonials") {
    const author = s(r.author) || "Testimonial";
    const quote = s(r.quote).slice(0, 40);
    return quote ? `${author} — ${quote}…` : author;
  }
  if (table === "faqs") return s(r.question) || "(question)";
  if (table === "offers") return s(r.title) || "(offer)";
  if (table === "lead_magnets") return s(r.title) || "(magnet)";
  if (table === "gallery_images")
    return s(r.caption) || s(r.alt) || s(r.url) || r.id;
  return s(r.title) || s(r.question) || r.id;
}

/** Shared lazy loader for a table's rows. */
function useRows(table: string) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    api<{ rows: Row[] }>(`/api/table/${table}`)
      .then((d) => alive && setRows(d.rows))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [table]);
  return { rows, err };
}

export function ItemPicker({
  table,
  value,
  onChange,
  label,
}: {
  table: string;
  value: string | undefined;
  onChange: (id: string) => void;
  label: string;
}) {
  const { rows, err } = useRows(table);
  const chosen = rows?.find((r) => r.id === value);
  return (
    <div className="field">
      <label>{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={!rows && !err}
      >
        <option value="">— none —</option>
        {rows?.map((r) => (
          <option key={r.id} value={r.id}>
            {labelOf(table, r)}
          </option>
        ))}
      </select>
      {err && (
        <span className="hint">Couldn&rsquo;t load {table.replace(/_/g, " ")}.</span>
      )}
      {chosen && (
        <div className="itempick__preview">{labelOf(table, chosen)}</div>
      )}
    </div>
  );
}

export function ItemMultiPicker({
  table,
  value,
  onChange,
  label,
}: {
  table: string;
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const { rows, err } = useRows(table);
  const chosen = value
    .map((id) => rows?.find((r) => r.id === id))
    .filter((r): r is Row => Boolean(r));

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="field">
      <label>{label}</label>
      {err && (
        <span className="hint">Couldn&rsquo;t load {table.replace(/_/g, " ")}.</span>
      )}
      {chosen.length > 0 && (
        <ol className="itempick__chosen">
          {chosen.map((r, i) => (
            <li key={r.id}>
              <span className="itempick__cl">{labelOf(table, r)}</span>
              <div className="itempick__ord">
                <button
                  type="button"
                  className="sorter__btn"
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="sorter__btn"
                  title="Move down"
                  disabled={i === chosen.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="ibtn ibtn--del"
                  title="Remove"
                  onClick={() => toggle(r.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="itempick__list">
        {rows?.map((r) => (
          <label key={r.id} className="itempick__opt">
            <input
              type="checkbox"
              checked={value.includes(r.id)}
              onChange={() => toggle(r.id)}
            />
            <span>{labelOf(table, r)}</span>
          </label>
        ))}
        {!rows && !err && <span className="hint">Loading…</span>}
      </div>
    </div>
  );
}
