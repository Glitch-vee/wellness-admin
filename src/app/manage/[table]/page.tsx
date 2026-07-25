"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, saveMsg, type Publish } from "@/lib/api";
import { TABLES, type FieldSpec } from "@/lib/schema";
import InlinePreview from "@/components/InlinePreview";
import FieldInput from "@/components/FieldInput";

type Row = Record<string, unknown> & { id: string };

/** Rows of these tables open in the visual builder. */
const BUILDER_OF: Record<string, (row: Row) => string> = {
  offers: (r) => `/builder/offer/${r.id}`,
  pages: (r) => `/builder/page/${r.id}`,
};

/** Tables the visual builder has replaced — nudge people there. */
const BUILDER_NOTICE: Record<string, string> = {
  pages: "/pages",
  page_sections: "/pages",
  offer_sections: "/manage/offers",
};

/** Which column gives the one-line muted preview under each row title. */
const PREVIEW_FIELD: Record<string, string> = {
  offers: "outcome",
  testimonials: "quote",
  faqs: "answer",
  lead_magnets: "description",
  gallery_images: "caption",
  offer_sections: "body",
  pages: "subtitle",
  page_sections: "body",
};

/** Textareas that get a live markup preview in the edit form. */
const LIVE_PREVIEW: Record<string, string[]> = {
  testimonials: ["quote"],
  faqs: ["answer"],
  offer_sections: ["body"],
  page_sections: ["body"],
};

/** Booleans that should start switched on when creating a row. */
const DEFAULT_ON = ["active", "page_enabled"];

function emptyRow(fields: FieldSpec[]): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const f of fields) {
    r[f.name] =
      f.type === "boolean"
        ? DEFAULT_ON.includes(f.name)
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

export default function ManageTablePage() {
  const params = useParams<{ table: string }>();
  const table = params.table;
  const spec = TABLES[table];

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [parents, setParents] = useState<{ id: string; label: string }[]>([]);
  const [filter, setFilter] = useState("");
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((m: { text: string; tone: "ok" | "warn" }) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(m);
    flashTimer.current = setTimeout(
      () => setFlash(null),
      m.tone === "warn" ? 6000 : 2400
    );
  }, []);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const parentSpec = spec?.fields.find((f) => f.type === "parent");

  const load = useCallback(async () => {
    try {
      const d = await api<{ rows: Row[] }>(`/api/table/${table}`);
      setRows(d.rows);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Load failed"}`);
    } finally {
      // Distinguishes "still fetching" from "fetched, and it's empty" —
      // without it an empty table shows "Loading…" forever.
      setLoaded(true);
    }
  }, [table]);

  useEffect(() => {
    if (spec) load();
  }, [spec, load]);

  // Options for the "belongs to" picker, and for the list filter above it.
  const parentTable = parentSpec?.parentTable;
  useEffect(() => {
    if (!parentTable) {
      setParents([]);
      return;
    }
    api<{ rows: Row[] }>(`/api/table/${parentTable}`)
      .then((d) => {
        const opts = d.rows.map((r) => ({
          id: r.id,
          label: String(r.title ?? r.question ?? r.id),
        }));
        setParents(opts);
        // Default to the first parent rather than "All": with a real parent
        // selected, the list is scoped and "Add new" attaches correctly.
        setFilter((f) => f || opts[0]?.id || "");
      })
      .catch(() => setParents([]));
  }, [parentTable]);

  // Reset per-section state when switching sections.
  useEffect(() => {
    setFilter("");
    setLoaded(false);
  }, [table]);

  if (!spec) {
    return (
      <div className="msg msg--err">Unknown section: {String(table)}</div>
    );
  }

  // When the list is filtered to one parent, new rows belong to it.
  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    const base = emptyRow(spec.fields);
    if (parentSpec && filter) base[parentSpec.name] = filter;
    setDraft(base);
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
      let publish: Publish | undefined;
      if (creating) {
        const d = await api<{ row: Row; publish?: Publish }>(
          `/api/table/${table}`,
          { method: "POST", body: JSON.stringify(draft) }
        );
        publish = d.publish;
      } else if (editing) {
        const d = await api<{ row: Row; publish?: Publish }>(
          `/api/table/${table}/${editing}`,
          { method: "PUT", body: JSON.stringify(draft) }
        );
        publish = d.publish;
      }
      setCreating(false);
      setEditing(null);
      await load();
      showFlash(saveMsg(publish));
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Row) => {
    const title = String(row.title ?? row.question ?? row.author ?? "this item");
    if (!window.confirm(`Delete “${title}”? This can’t be undone.`)) return;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ ok: boolean; publish?: Publish }>(
        `/api/table/${table}/${row.id}`,
        { method: "DELETE" }
      );
      await load();
      showFlash(saveMsg(d.publish));
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Delete failed"}`
      );
    } finally {
      setBusy(false);
    }
  };

  /** Flip active on the spot — optimistic, no form. */
  const toggleActive = async (row: Row) => {
    const next = { ...row, active: !row.active };
    setRows((rs) => rs.map((r) => (r.id === row.id ? next : r)));
    try {
      const d = await api<{ row: Row; publish?: Publish }>(
        `/api/table/${table}/${row.id}`,
        { method: "PUT", body: JSON.stringify(next) }
      );
      if (d.publish?.ok === false) showFlash(saveMsg(d.publish));
    } catch (e) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? row : r)));
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    }
  };

  /**
   * Swap sort_order with the neighbour above/below and PUT both rows.
   * Operates on the visible list, so reordering inside a filtered view
   * moves a block past its real neighbour on that offer's page.
   */
  const move = async (list: Row[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= list.length || busy) return;
    const a = list[index];
    const b = list[j];
    let aOrder = Number(b.sort_order ?? 0);
    let bOrder = Number(a.sort_order ?? 0);
    if (aOrder === bOrder) {
      // identical orders — nudge so the swap actually sticks
      aOrder += dir;
      bOrder -= dir;
    }
    const nextA = { ...a, sort_order: aOrder };
    const nextB = { ...b, sort_order: bOrder };
    // Patch by id (the visible list may be a filtered subset of `rows`),
    // then re-sort so the swap shows immediately.
    setRows((rs) =>
      rs
        .map((r) => (r.id === a.id ? nextA : r.id === b.id ? nextB : r))
        .sort((x, y) => Number(x.sort_order ?? 0) - Number(y.sort_order ?? 0))
    );
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
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Reorder failed"}`
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  const previewField = PREVIEW_FIELD[table];
  const livePreviewFields = LIVE_PREVIEW[table] ?? [];
  const parentName = (id: unknown) =>
    parents.find((p) => p.id === String(id))?.label ?? "— unassigned —";
  const visible =
    parentSpec && filter
      ? rows.filter((r) => String(r[parentSpec.name] ?? "") === filter)
      : rows;

  const form = (
    <div className="card" style={{ borderColor: "var(--green-dark)" }}>
      <div className="row-title">
        <strong>{creating ? `New ${spec.label.replace(/s$/, "")}` : "Edit"}</strong>
      </div>
      <div className="field-grid">
        {spec.fields.map((f) => (
          <FieldInput
            key={f.name}
            spec={f}
            value={draft[f.name]}
            livePreview={livePreviewFields.includes(f.name)}
            parentOptions={parents}
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

      {msg && <div className="msg msg--err">{msg}</div>}
      {flash && (
        <div className={`cms-flash ${flash.tone === "warn" ? "cms-flash--warn" : ""}`}>
          {flash.text}
        </div>
      )}

      {BUILDER_NOTICE[table] && (
        <div className="msg">
          ✨ There's a nicer way to do this now — the visual builder.{" "}
          <Link href={BUILDER_NOTICE[table]} style={{ textDecoration: "underline" }}>
            Open the builder
          </Link>
        </div>
      )}

      {parentSpec && (
        <div className="card parent-bar">
          <label className="parent-bar__label">Building the page for</label>
          <select
            className="parent-bar__select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="">Show all</option>
          </select>
          <span className="parent-bar__hint">
            Each block becomes a section on that page.
          </span>
        </div>
      )}

      {creating && form}

      {visible.map((row, i) => (
        <div className="card card--row" key={row.id}>
          <div className="row-title">
            <div className="sorter">
              <button
                type="button"
                className="sorter__btn"
                title="Move up"
                aria-label="Move up"
                disabled={i === 0 || busy}
                onClick={() => move(visible, i, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="sorter__btn"
                title="Move down"
                aria-label="Move down"
                disabled={i === visible.length - 1 || busy}
                onClick={() => move(visible, i, 1)}
              >
                ▼
              </button>
            </div>
            <strong>
              {String(
                row.title ??
                  row.question ??
                  row.author ??
                  row.heading ??
                  (row.kind ? `${String(row.kind)} block` : row.id)
              )}
            </strong>
            {parentSpec && (
              <span className="chip">{parentName(row[parentSpec.name])}</span>
            )}
            {"kind" in row && <span className="chip">{String(row.kind)}</span>}
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
              {BUILDER_OF[table] && (
                <Link className="btn btn--sm btn--dark" href={BUILDER_OF[table](row)}>
                  🏗️ Build page
                </Link>
              )}
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

      {!loaded && <div className="card">Loading…</div>}
      {loaded && visible.length === 0 && (
        <div className="card empty-hint">
          {parentSpec && filter ? (
            <>
              No sections on{" "}
              <strong>
                {parents.find((p) => p.id === filter)?.label ?? "this offer"}
              </strong>
              &rsquo;s page yet.
              <button className="btn btn--green btn--sm" onClick={startCreate}>
                + Add the first block
              </button>
            </>
          ) : (
            "Nothing here yet."
          )}
        </div>
      )}
    </>
  );
}
