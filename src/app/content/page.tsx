"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import InlinePreview from "@/components/InlinePreview";

type Block = { key: string; label: string; page: string; value: string };

export default function ContentPage() {
  const [rows, setRows] = useState<Block[]>([]);
  const [openPages, setOpenPages] = useState<string[]>([]);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api<{ rows: Block[] }>("/api/blocks")
      .then((d) => {
        setRows(d.rows);
        // only the first page group starts open
        if (d.rows.length > 0) setOpenPages([d.rows[0].page]);
      })
      .catch((e) => setMsg(`⚠️ ${e.message}`));
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const pages = Array.from(new Set(rows.map((r) => r.page)));

  const togglePage = (page: string) =>
    setOpenPages((open) =>
      open.includes(page) ? open.filter((p) => p !== page) : [...open, page]
    );

  const startEdit = (b: Block) => {
    setEditKey(b.key);
    setDraft(b.value);
  };

  const save = async (b: Block) => {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/blocks", {
        method: "PUT",
        body: JSON.stringify({ rows: [{ key: b.key, value: draft }] }),
      });
      setRows((rs) =>
        rs.map((r) => (r.key === b.key ? { ...r, value: draft } : r))
      );
      setEditKey(null);
      setSavedKey(b.key);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedKey(null), 2000);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Save failed"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Page Text</h1>
        <p>
          Click any line to edit it. Markup: <code>**bold**</code> ·{" "}
          <code>*word*</code> turns green · <code>~word~</code> turns red ·{" "}
          <code>[text](/page)</code> makes a link. Keep green to ONE word per
          headline — it’s the brand rule.
        </p>
      </div>

      {msg && <div className="msg msg--err">{msg}</div>}

      {pages.map((page) => {
        const blocks = rows.filter((r) => r.page === page);
        const open = openPages.includes(page);
        return (
          <div className={`acc ${open ? "acc--open" : ""}`} key={page}>
            <button
              type="button"
              className="acc__head"
              onClick={() => togglePage(page)}
              aria-expanded={open}
            >
              <span className="acc__chev" aria-hidden>
                ▸
              </span>
              <strong style={{ textTransform: "capitalize" }}>
                {page} page
              </strong>
              <span className="acc__count">{blocks.length}</span>
            </button>
            {open && (
              <div className="acc__body">
                {blocks.map((b) => {
                  const editing = editKey === b.key;
                  return (
                    <div
                      className={`erow ${editing ? "erow--open" : ""}`}
                      key={b.key}
                    >
                      {!editing ? (
                        <button
                          type="button"
                          className="erow__line"
                          onClick={() => startEdit(b)}
                        >
                          <span className="erow__label">{b.label}</span>
                          <InlinePreview className="preview" text={b.value} />
                          {savedKey === b.key && (
                            <span className="erow__saved" aria-live="polite">
                              ✓ Saved
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="erow__edit">
                          <span className="erow__label">{b.label}</span>
                          <textarea
                            autoFocus
                            rows={Math.min(
                              6,
                              Math.max(2, Math.ceil(draft.length / 90))
                            )}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                          />
                          <div className="erow__preview">
                            <span className="erow__cap">Preview</span>
                            <InlinePreview text={draft} />
                          </div>
                          <div className="form-foot" style={{ marginTop: 10 }}>
                            <button
                              className="btn btn--sm btn--green"
                              onClick={() => save(b)}
                              disabled={busy}
                            >
                              {busy ? "Saving…" : "Save"}
                            </button>
                            <button
                              className="btn btn--sm"
                              onClick={() => setEditKey(null)}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {rows.length === 0 && !msg && <div className="card">Loading…</div>}
    </>
  );
}
