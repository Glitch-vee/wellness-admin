"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Block = { key: string; label: string; page: string; value: string };

export default function ContentPage() {
  const [rows, setRows] = useState<Block[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ rows: Block[] }>("/api/blocks")
      .then((d) => setRows(d.rows))
      .catch((e) => setMsg(`⚠️ ${e.message}`));
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/blocks", {
        method: "PUT",
        body: JSON.stringify({ rows }),
      });
      setMsg("✅ Saved & publishing to the live site.");
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Save failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const pages = Array.from(new Set(rows.map((r) => r.page)));

  return (
    <>
      <div className="page-head">
        <h1>Page Text</h1>
        <button className="btn btn--green" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save all"}
        </button>
        <p>
          Markup: <code>**bold**</code> · <code>*word*</code> turns green ·{" "}
          <code>~word~</code> turns red · <code>[text](/page)</code> makes a
          link. Keep green to ONE word per headline — it’s the brand rule.
        </p>
      </div>

      {msg && <div className={`msg ${msg.startsWith("⚠️") ? "msg--err" : ""}`}>{msg}</div>}

      {pages.map((page) => (
        <div className="card" key={page}>
          <div className="row-title">
            <strong style={{ textTransform: "capitalize" }}>{page} page</strong>
          </div>
          {rows
            .filter((r) => r.page === page)
            .map((r) => {
              const i = rows.findIndex((x) => x.key === r.key);
              return (
                <div className="field" key={r.key}>
                  <label>{r.label}</label>
                  <textarea
                    rows={Math.min(6, Math.max(2, Math.ceil(r.value.length / 90)))}
                    value={r.value}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...r, value: e.target.value };
                      setRows(next);
                    }}
                  />
                </div>
              );
            })}
        </div>
      ))}
      {rows.length === 0 && !msg && <div className="card">Loading…</div>}
    </>
  );
}
