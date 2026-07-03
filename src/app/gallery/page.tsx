"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Img = {
  id: string;
  url: string;
  alt: string;
  caption: string;
  sort_order: number;
  active: boolean;
};

export default function GalleryPage() {
  const [rows, setRows] = useState<Img[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [slot, setSlot] = useState("gallery");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

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
      await api("/api/gallery/upload", { method: "POST", body: form });
      setFile(null);
      setAlt("");
      setCaption("");
      setSlot("gallery");
      (document.getElementById("gal-file") as HTMLInputElement).value = "";
      await load();
      setMsg("✅ Uploaded & publishing to the live site.");
    } catch (err) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : "Upload failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const update = async (img: Img) => {
    setBusy(true);
    try {
      await api(`/api/table/gallery_images/${img.id}`, {
        method: "PUT",
        body: JSON.stringify(img),
      });
      setMsg("✅ Saved & publishing to the live site.");
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Save failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (img: Img) => {
    if (!window.confirm("Delete this image? The file is removed too.")) return;
    setBusy(true);
    try {
      await api(`/api/table/gallery_images/${img.id}`, { method: "DELETE" });
      await load();
      setMsg("✅ Deleted & publishing to the live site.");
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Delete failed"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Gallery</h1>
        <p>
          Photos appear on the site’s <strong>/gallery</strong> page. Each
          image also gets a public URL — handy for lead magnets or anywhere
          else. Max 4 MB per image (jpg, png, webp, gif, avif).
        </p>
      </div>

      {msg && <div className={`msg ${msg.startsWith("⚠️") ? "msg--err" : ""}`}>{msg}</div>}

      <form className="card" onSubmit={upload}>
        <div className="row-title">
          <strong>Upload a new image</strong>
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
            <label>Alt text (describe it)</label>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
          <div className="field">
            <label>Caption (shown under the photo)</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="field">
            <label>Where it shows</label>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="gallery">gallery</option>
              <option value="about">about</option>
              <option value="before-after">before-after</option>
            </select>
            <div className="hint">
              gallery = /gallery wall · about = About page grid · before-after
              = Results page proof section
            </div>
          </div>
        </div>
        <div className="form-foot">
          <button className="btn btn--green" disabled={!file || busy}>
            {busy ? "Uploading…" : "Upload ↑"}
          </button>
        </div>
      </form>

      <div className="gal-grid">
        {rows.map((img, i) => (
          <div className="gal-card" key={img.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt} loading="lazy" />
            <div className="pad">
              <input
                value={img.alt}
                placeholder="Alt text"
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...img, alt: e.target.value };
                  setRows(next);
                }}
              />
              <input
                value={img.caption}
                placeholder="Caption"
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...img, caption: e.target.value };
                  setRows(next);
                }}
              />
              <div className="row-actions" style={{ marginLeft: 0, flexWrap: "wrap", gap: 6 }}>
                <button className="btn btn--sm" onClick={() => update(rows[i])} disabled={busy}>
                  Save
                </button>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    const next = [...rows];
                    next[i] = { ...img, active: !img.active };
                    setRows(next);
                    update(next[i]);
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
      {rows.length === 0 && (
        <div className="card card--flat">
          No images yet — upload your first one above. 📸
        </div>
      )}
    </>
  );
}
