"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, saveMsg, type Publish } from "@/lib/api";

type Img = {
  id: string;
  url: string;
  alt: string;
  caption: string;
  slot: string;
  sort_order: number;
  active: boolean;
};

const SLOTS = ["gallery", "about", "before-after"] as const;

export default function GalleryPage() {
  const [rows, setRows] = useState<Img[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [slot, setSlot] = useState("gallery");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
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

  const load = useCallback(async () => {
    try {
      const d = await api<{ rows: Img[] }>("/api/table/gallery_images");
      setRows(d.rows);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Load failed"}`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("alt", alt);
      form.append("caption", caption);
      form.append("slot", slot);
      const d = await api<{ row: Img; publish?: Publish }>(
        "/api/gallery/upload",
        { method: "POST", body: form }
      );
      setFile(null);
      setAlt("");
      setCaption("");
      setSlot("gallery");
      (document.getElementById("gal-file") as HTMLInputElement).value = "";
      await load();
      showFlash(saveMsg(d.publish));
    } catch (err) {
      setMsg(
        `Couldn't save — nothing changed. ${err instanceof Error ? err.message : "Upload failed"}`
      );
    } finally {
      setBusy(false);
    }
  };

  const update = async (img: Img) => {
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ row: Img; publish?: Publish }>(
        `/api/table/gallery_images/${img.id}`,
        { method: "PUT", body: JSON.stringify(img) }
      );
      showFlash(saveMsg(d.publish));
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (img: Img) => {
    if (!window.confirm("Delete this image? The file is removed too.")) return;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ ok: boolean; publish?: Publish }>(
        `/api/table/gallery_images/${img.id}`,
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

  const setRow = (id: string, patch: Partial<Img>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const visible = tab === "all" ? rows : rows.filter((r) => r.slot === tab);
  const count = (s: string) =>
    s === "all" ? rows.length : rows.filter((r) => r.slot === s).length;

  return (
    <>
      <div className="page-head">
        <h1>Gallery</h1>
      </div>

      {msg && <div className="msg msg--err">{msg}</div>}
      {flash && (
        <div className={`cms-flash ${flash.tone === "warn" ? "cms-flash--warn" : ""}`}>
          {flash.text}
        </div>
      )}

      <form className="card" onSubmit={upload}>
        <div className="row-title">
          <strong>Upload</strong>
        </div>
        <div className="field">
          <label>Image file</label>
          <input
            id="gal-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field-grid">
          <div className="field">
            <label>Alt text</label>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
          <div className="field">
            <label>Caption</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="field">
            <label>Shows on</label>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-foot">
          <button className="btn btn--green" disabled={!file || busy}>
            {busy ? "Uploading…" : "Upload ↑"}
          </button>
        </div>
      </form>

      <div className="tabs" role="tablist" aria-label="Filter by slot">
        {["all", ...SLOTS].map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={tab === s}
            className={`tab ${tab === s ? "on" : ""}`}
            onClick={() => setTab(s)}
          >
            {s === "all" ? "All" : s}
            <span className="tab__count">{count(s)}</span>
          </button>
        ))}
      </div>

      <div className="gal-grid">
        {visible.map((img) => (
          <div className="gal-card" key={img.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt} loading="lazy" />
            <div className="pad">
              <div className="gal-card__slotline">
                <span className={`chip chip--slot chip--slot-${img.slot}`}>
                  {img.slot}
                </span>
                <select
                  className="gal-card__slotpick"
                  value={img.slot}
                  aria-label="Move to slot"
                  disabled={busy}
                  onChange={(e) => {
                    const next = { ...img, slot: e.target.value };
                    setRow(img.id, { slot: e.target.value });
                    update(next);
                  }}
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={img.alt}
                placeholder="Alt text"
                onChange={(e) => setRow(img.id, { alt: e.target.value })}
              />
              <input
                value={img.caption}
                placeholder="Caption"
                onChange={(e) => setRow(img.id, { caption: e.target.value })}
              />
              <div className="row-actions" style={{ marginLeft: 0, flexWrap: "wrap", gap: 6 }}>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    const cur = rows.find((r) => r.id === img.id);
                    if (cur) update(cur);
                  }}
                  disabled={busy}
                >
                  Save
                </button>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    const next = { ...img, active: !img.active };
                    setRow(img.id, { active: next.active });
                    update(next);
                  }}
                  disabled={busy}
                >
                  {img.active ? "Hide" : "Show"}
                </button>
                <button className="btn btn--sm btn--danger" onClick={() => remove(img)} disabled={busy}>
                  Delete
                </button>
              </div>
              <div
                style={{ fontSize: 11, color: "#8a8a82", marginTop: 8, wordBreak: "break-all" }}
              >
                {img.url}
              </div>
            </div>
          </div>
        ))}
      </div>
      {rows.length > 0 && visible.length === 0 && (
        <div className="card card--flat">Nothing in this slot yet.</div>
      )}
      {rows.length === 0 && (
        <div className="card card--flat">
          No images yet — upload your first one above. 📸
        </div>
      )}
    </>
  );
}
