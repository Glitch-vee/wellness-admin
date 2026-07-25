"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * Image picker: thumbnail + "Upload image" button (posts to /api/upload),
 * a Remove action, and a tucked-away "paste URL instead" fallback.
 * onChange fires only with committed values (upload done / removed / URL applied).
 */
/** Only render a thumbnail for things that actually are images. */
function isImage(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i.test(url);
}

export default function ImageField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const upload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      const d = await api<{ url: string }>("/api/upload", {
        method: "POST",
        body: form,
      });
      onChange(d.url);
      setShowUrl(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="imgfield">
      <label>{label}</label>
      <div className="imgfield__row">
        {value && isImage(value) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="imgfield__thumb" src={value} alt={label} />
        ) : value ? (
          // A pasted video/other link has no thumbnail to show.
          <div className="imgfield__thumb imgfield__thumb--empty" aria-hidden>
            🔗
          </div>
        ) : (
          <div className="imgfield__thumb imgfield__thumb--empty" aria-hidden>
            🖼
          </div>
        )}
        <div className="imgfield__actions">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            style={{ display: "none" }}
            onChange={(e) => upload(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn btn--sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          {value && !busy && (
            <button
              type="button"
              className="imgfield__text-btn"
              onClick={() => onChange("")}
            >
              Remove
            </button>
          )}
          <button
            type="button"
            className="imgfield__text-btn"
            onClick={() => {
              setUrlDraft(value);
              setShowUrl((s) => !s);
            }}
          >
            {showUrl ? "hide URL" : "paste URL instead"}
          </button>
        </div>
      </div>
      {showUrl && (
        <div className="imgfield__url">
          <input
            value={urlDraft}
            placeholder="https://…"
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              onChange(urlDraft.trim());
              setShowUrl(false);
            }}
          >
            Use URL
          </button>
        </div>
      )}
      {err && <div className="imgfield__err">⚠️ {err}</div>}
    </div>
  );
}
