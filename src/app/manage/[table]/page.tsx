"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { TABLES, type FieldSpec } from "@/lib/schema";

type Row = Record<string, unknown> & { id: string };

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
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
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
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
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

  const form = (
    <div className="card" style={{ borderColor: "var(--green-deep)" }}>
      <div className="row-title">
        <strong>{creating ? `New ${spec.label.replace(/s$/, "")}` : "Edit"}</strong>
      </div>
      <div className="field-grid">
        {spec.fields.map((f) => (
          <Field
            key={f.name}
            spec={f}
            value={draft[f.name]}
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

      {rows.map((row) => (
        <div className="card" key={row.id}>
          <div className="row-title">
            <strong>
              {String(row.title ?? row.question ?? row.author ?? row.id)}
            </strong>
            {"price" in row && String(row.price) && (
              <span className="chip">{String(row.price)}{String(row.period ?? "")}</span>
            )}
            {"category" in row && <span className="chip">{String(row.category)}</span>}
            {Boolean(row.highlight) && <span className="chip chip--hl">Highlighted</span>}
            <span className={`chip ${row.active ? "" : "chip--off"}`}>
              {row.active ? "Live" : "Hidden"}
            </span>
            <div className="row-actions">
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
          {editing === row.id && form}
        </div>
      ))}

      {rows.length === 0 && !msg && <div className="card">Loading…</div>}
    </>
  );
}
