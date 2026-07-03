"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Setting = { key: string; value: string; label: string };

export default function SettingsPage() {
  const [rows, setRows] = useState<Setting[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ rows: Setting[] }>("/api/settings")
      .then((d) => setRows(d.rows))
      .catch((e) => setMsg(`⚠️ ${e.message}`));
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/settings", {
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

  return (
    <>
      <div className="page-head">
        <h1>Site Settings</h1>
        <button className="btn btn--green" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save all"}
        </button>
        <p>
          The Calendly link powers <strong>every</strong> booking button on the
          site — swap it once here and the whole site updates.
        </p>
      </div>

      {msg && <div className={`msg ${msg.startsWith("⚠️") ? "msg--err" : ""}`}>{msg}</div>}

      <div className="card">
        {rows.map((r, i) => (
          <div className="field" key={r.key}>
            <label>{r.label || r.key}</label>
            <input
              value={r.value}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...r, value: e.target.value };
                setRows(next);
              }}
            />
          </div>
        ))}
        {rows.length === 0 && !msg && <p>Loading…</p>}
      </div>
    </>
  );
}
