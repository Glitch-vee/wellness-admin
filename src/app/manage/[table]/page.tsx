"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { TABLES, type FieldSpec } from "@/lib/schema";
import InlinePreview from "@/components/InlinePreview";

type Row = Record<string, unknown> & { id: string };

/** Which column gives the one-line muted preview under each row title. */
const PREVIEW_FIELD: Record<string, string> = {
  offers: "outcome",
  testimonials: "quote",
  faqs: "answer",
  lead_magnets: "description",
  gallery_images: "caption",
};

/** Textareas that get a live markup preview in the edit form. */
const LIVE_PREVIEW: Record<string, string[]> = {
  testimonials: ["quote"],
  faqs: ["answer"],
};

function emptyRow(fields: FieldSpec[]): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const f of fields) {
    r[f.name] =
      f.type === "boolean"
        ? f.name === "active"
        : f.type === "number"
        ? 0
        : f.type === "lines"
        ? []
        : f.type === "select"
        ? f.options?.[0] ?? ""
        : "";
  }
  return r;
}

function Field({
  spec,
  value,
  onChange,
  livePreview,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  livePreview?: boolean;
}) {
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
      {spec.hint && <div className="hint">{spec.hint}</div>}
    </div>
  );
}

export default function ManageTablePage() {
  const params = useParams<{ table: string }>();
  const table = params.table;
  const spec = TABLES[table];

  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ rows: Row[] }>(`/api/table/${table}`);
      setRows(d.rows);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Load failed"}`);
    }
  }, [table]);

  useEffect(() => {
    if (spec) load();
  }, [spec, load]);

  if (!spec) {
    return (
      <div className="msg msg--err">Unknown section: {String(table)}</div>
    );
  }

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setDraft(emptyRow(spec.fields));
  };

  const startEdit = (row: Row) => {
    setEditing(row.id);
    setCreating(false);
    setDraft({ ...row });
  };

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (creating) {
        await api(`/api/table/${table}`, {
          method: "POST",
          body: JSON.stringify(draft),
        });
      } else if (editing) {
        await api(`/api/table/${table}/${editing}`, {
          method: "PUT",
          body: JSON.stringify(draft),
        });
      }
      setCreating(false);
      setEditing(null);
      await load();
      setMsg("✅ Saved & publishing to the live site.");
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Save failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Row) => {
    const title = String(row.title ?? row.question ?? row.author ?? "this item");
    if (!window.confirm(`Delete “${title}”? This can’t be undone.`)) return;
    setBusy(true);
    try {
      await api(`/api/table/${table}/${row.id}`, { method: "DELETE" });
      await load();
      setMsg("✅ Deleted & publishing to the live site.");
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Delete failed"}`);
    } finally {
      setBusy(false);
    }
  };

  /** Flip active on the spot — optimistic, no form. */
  const toggleActive = async (row: Row) => {
    const next = { ...row, active: !row.active };
    setRows((rs) => rs.map((r) => (r.id === row.id ? next : r)));
    try {
      await api(`/api/table/${table}/${row.id}`, {
        method: "PUT",
        body: JSON.stringify(next),
      });
    } catch (e) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? row : r)));
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Save failed"}`);
    }
  };

  /** Swap sort_order with the neighbour above/below and PUT both rows. */
  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length || busy) return;
    const a = rows[index];
    const b = rows[j];
    let aOrder = Number(b.sort_order ?? 0);
    let bOrder = Number(a.sort_order ?? 0);
    if (aOrder === bOrder) {
      // identical orders — nudge so the swap actually sticks
      aOrder += dir;
      bOrder -= dir;
    }
    const nextA = { ...a, sort_order: aOrder };
    const nextB = { ...b, sort_order: bOrder };
    const next = [...rows];
    next[index] = nextB;
    next[j] = nextA;
    setRows(next);
    setBusy(true);
    try {
      await api(`/api/table/${table}/${a.id}`, {
        method: "PUT",
        body: JSON.stringify(nextA),
      });
      await api(`/api/table/${table}/${b.id}`, {
        method: "PUT",
        body: JSON.stringify(nextB),
      });
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Reorder failed"}`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const previewField = PREVIEW_FIELD[table];
  const livePreviewFields = LIVE_PREVIEW[table] ?? [];

  const form = (
    <div className="card" style={{ borderColor: "var(--green-dark)" }}>
      <div className="row-title">
        <strong>{creating ? `New ${spec.label.replace(/s$/, "")}` : "Edit"}</strong>
      </div>
      <div className="field-grid">
        {spec.fields.map((f) => (
          <Field
            key={f.name}
            spec={f}
            value={draft[f.name]}
            livePreview={livePreviewFields.includes(f.name)}
            onChange={(v) => setDraft((d) => ({ ...d, [f.name]: v }))}
          />
        ))}
      </div>
      <div className="form-foot">
        <button className="btn btn--green" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          className="btn"
          onClick={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <h1>{spec.label}</h1>
        <button className="btn btn--dark" onClick={startCreate}>
          + Add new
        </button>
      </div>

      {msg && <div className={`msg ${msg.startsWith("⚠️") ? "msg--err" : ""}`}>{msg}</div>}
      {creating && form}

      {rows.map((row, i) => (
        <div className="card card--row" key={row.id}>
          <div className="row-title">
            <div className="sorter">
              <button
                type="button"
                className="sorter__btn"
                title="Move up"
                aria-label="Move up"
                disabled={i === 0 || busy}
                onClick={() => move(i, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="sorter__btn"
                title="Move down"
                aria-label="Move down"
                disabled={i === rows.length - 1 || busy}
                onClick={() => move(i, 1)}
              >
                ▼
              </button>
            </div>
            <strong>
              {String(row.title ?? row.question ?? row.author ?? row.id)}
            </strong>
            {"price" in row && String(row.price) && (
              <span className="chip">{String(row.price)}{String(row.period ?? "")}</span>
            )}
            {"category" in row && <span className="chip">{String(row.category)}</span>}
            {Boolean(row.highlight) && <span className="chip chip--hl">Highlighted</span>}
            <div className="row-actions">
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(row.active)}
                aria-label={row.active ? "Visible on site" : "Hidden from site"}
                title={row.active ? "Visible on site — click to hide" : "Hidden — click to show"}
                className={`switch ${row.active ? "switch--on" : ""}`}
                onClick={() => toggleActive(row)}
              >
                <span className="switch__knob" />
              </button>
              <button className="btn btn--sm" onClick={() => startEdit(row)}>
                Edit
              </button>
              <button
                className="btn btn--sm btn--danger"
                onClick={() => remove(row)}
              >
                Delete
              </button>
            </div>
          </div>
          {previewField && editing !== row.id && (
            <InlinePreview
              className="preview preview--row"
              text={String(row[previewField] ?? "")}
            />
          )}
          {editing === row.id && form}
        </div>
      ))}

      {rows.length === 0 && !msg && <div className="card">Loading…</div>}
    </>
  );
}
