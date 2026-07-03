"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import InlinePreview from "@/components/InlinePreview";
import ImageField from "@/components/ImageField";

type Setting = { key: string; value: string; label: string };

const CONTACT: { key: string; icon: string; label: string }[] = [
  { key: "calendly_url", icon: "📅", label: "Calendly link" },
  { key: "contact_email", icon: "✉️", label: "Contact email" },
  { key: "linkedin_url", icon: "💼", label: "LinkedIn" },
  { key: "whatsapp_url", icon: "💬", label: "WhatsApp link" },
];

export default function SettingsPage() {
  const [rows, setRows] = useState<Setting[]>([]);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api<{ rows: Setting[] }>("/api/settings")
      .then((d) => setRows(d.rows))
      .catch((e) => setMsg(`⚠️ ${e.message}`));
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? "";

  const flash = (key: string) => {
    setSavedKey(key);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedKey(null), 2000);
  };

  /** PUT only the changed rows, mirror them into local state. */
  const saveRows = async (changed: { key: string; value: string }[]) => {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ rows: changed }),
      });
      setRows((rs) =>
        rs.map((r) => {
          const c = changed.find((x) => x.key === r.key);
          return c ? { ...r, value: c.value } : r;
        })
      );
      setEditKey(null);
      flash(changed[0].key);
      return true;
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Save failed"}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (keys: string[], id: string) => {
    const d: Record<string, string> = {};
    for (const k of keys) d[k] = get(k);
    setDraft(d);
    setEditKey(id);
  };

  if (rows.length === 0) {
    return (
      <>
        <div className="page-head">
          <h1>Site Settings</h1>
        </div>
        {msg ? <div className="msg msg--err">{msg}</div> : <div className="card">Loading…</div>}
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Site Settings</h1>
        <p>
          Click a row to change it — each save publishes to the live site on
          its own.
        </p>
      </div>

      {msg && <div className="msg msg--err">{msg}</div>}

      {/* ------- Your photo ------- */}
      <div className="card">
        <div className="row-title">
          <strong>Your Photo</strong>
          {savedKey === "portrait_url" && (
            <span className="erow__saved">✓ Saved</span>
          )}
        </div>
        <ImageField
          label="Portrait"
          value={get("portrait_url")}
          onChange={(url) => saveRows([{ key: "portrait_url", value: url }])}
        />
        <div className="hint" style={{ marginTop: 8 }}>
          This photo appears in the hero, the nav corner and the About page.
          A square-ish shot works best.
        </div>
      </div>

      {/* ------- Contact & booking ------- */}
      <div className="card">
        <div className="row-title" style={{ marginBottom: 6 }}>
          <strong>Contact &amp; Booking</strong>
        </div>
        {CONTACT.map(({ key, icon, label }) => {
          const row = rows.find((r) => r.key === key);
          if (!row) return null;
          const editing = editKey === key;
          return (
            <div className={`erow ${editing ? "erow--open" : ""}`} key={key}>
              {!editing ? (
                <button
                  type="button"
                  className="erow__line"
                  onClick={() => startEdit([key], key)}
                >
                  <span className="erow__label">
                    <span aria-hidden style={{ marginRight: 6 }}>{icon}</span>
                    {row.label || label}
                  </span>
                  <span className="preview">
                    {row.value || <em>not set</em>}
                  </span>
                  {savedKey === key && (
                    <span className="erow__saved">✓ Saved</span>
                  )}
                </button>
              ) : (
                <div className="erow__edit">
                  <span className="erow__label">
                    <span aria-hidden style={{ marginRight: 6 }}>{icon}</span>
                    {row.label || label}
                  </span>
                  <input
                    autoFocus
                    value={draft[key] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [key]: e.target.value }))
                    }
                  />
                  <div className="form-foot" style={{ marginTop: 10 }}>
                    <button
                      className="btn btn--sm btn--green"
                      disabled={busy}
                      onClick={() =>
                        saveRows([{ key, value: draft[key] ?? "" }])
                      }
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      className="btn btn--sm"
                      disabled={busy}
                      onClick={() => setEditKey(null)}
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

      {/* ------- Stats ------- */}
      <div className="card">
        <div className="row-title" style={{ marginBottom: 10 }}>
          <strong>Stats</strong>
          <span className="hint" style={{ margin: 0 }}>
            The four proof numbers in the hero. <code>*text*</code> = green.
          </span>
        </div>
        <div className="stat-grid">
          {[1, 2, 3, 4].map((n) => {
            const numKey = `stat${n}_num`;
            const lblKey = `stat${n}_label`;
            const id = `stat${n}`;
            const editing = editKey === id;
            return (
              <div
                className={`stat-mini ${editing ? "stat-mini--edit" : ""}`}
                key={id}
              >
                {!editing ? (
                  <button
                    type="button"
                    className="stat-mini__face"
                    onClick={() => startEdit([numKey, lblKey], id)}
                  >
                    <InlinePreview
                      className="stat-mini__num"
                      text={get(numKey)}
                    />
                    <span className="stat-mini__lbl">{get(lblKey)}</span>
                    {savedKey === numKey && (
                      <span className="erow__saved">✓ Saved</span>
                    )}
                  </button>
                ) : (
                  <div className="stat-mini__form">
                    <label className="erow__label">Number</label>
                    <input
                      autoFocus
                      value={draft[numKey] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [numKey]: e.target.value }))
                      }
                    />
                    <label className="erow__label" style={{ marginTop: 8 }}>
                      Label
                    </label>
                    <input
                      value={draft[lblKey] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [lblKey]: e.target.value }))
                      }
                    />
                    <div className="form-foot" style={{ marginTop: 10 }}>
                      <button
                        className="btn btn--sm btn--green"
                        disabled={busy}
                        onClick={() =>
                          saveRows([
                            { key: numKey, value: draft[numKey] ?? "" },
                            { key: lblKey, value: draft[lblKey] ?? "" },
                          ])
                        }
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button
                        className="btn btn--sm"
                        disabled={busy}
                        onClick={() => setEditKey(null)}
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
      </div>
    </>
  );
}
