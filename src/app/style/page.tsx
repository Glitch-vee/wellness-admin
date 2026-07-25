"use client";

import { useEffect, useMemo, useState } from "react";
import { api, saveMsg, type Publish } from "@/lib/api";
import {
  PRESETS,
  presetRows,
  THEME_DEFAULTS,
  COLOR_CONTROLS,
  DISPLAY_FONTS,
  BODY_FONTS,
  SCRIPT_FONTS,
  FONTS,
  fontCss,
  previewFontHref,
  mix,
  safeHex,
  type Preset,
} from "@/lib/theme";

type Row = { key: string; value: string };

export default function StylePage() {
  const [draft, setDraft] = useState<Record<string, string>>(THEME_DEFAULTS);
  const [saved, setSaved] = useState<Record<string, string>>(THEME_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);

  // Load current theme_* rows; fall back to defaults for any missing key.
  useEffect(() => {
    api<{ rows: Row[] }>("/api/settings")
      .then((d) => {
        const map = { ...THEME_DEFAULTS };
        for (const r of d.rows) if (r.key.startsWith("theme_")) map[r.key] = r.value ?? "";
        setDraft(map);
        setSaved(map);
      })
      .catch((e) => setMsg(`⚠️ ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  // Load the selected fonts into the admin page so the preview is accurate.
  useEffect(() => {
    const href = previewFontHref([
      draft.theme_font_display,
      draft.theme_font_body,
      draft.theme_font_script,
    ]);
    let link = document.getElementById("theme-preview-fonts") as HTMLLinkElement | null;
    if (!href) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.id = "theme-preview-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [draft.theme_font_display, draft.theme_font_body, draft.theme_font_script]);

  const dirty = useMemo(
    () => Object.keys(draft).some((k) => draft[k] !== saved[k]),
    [draft, saved],
  );

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const persist = async (rows: Row[]) => {
    if (rows.length === 0) return;
    setBusy(true);
    setMsg("");
    try {
      const d = await api<{ ok: boolean; publish?: Publish }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ rows }),
      });
      setSaved((s) => ({ ...s, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }));
      const m = saveMsg(d.publish);
      setFlash(m);
      setTimeout(() => setFlash(null), m.tone === "warn" ? 6000 : 2400);
    } catch (e) {
      setMsg(
        `Couldn't save — nothing changed. ${e instanceof Error ? e.message : "Save failed"}`
      );
    } finally {
      setBusy(false);
    }
  };

  const saveChanges = () =>
    persist(Object.keys(draft).filter((k) => draft[k] !== saved[k]).map((k) => ({ key: k, value: draft[k] })));

  const resetChanges = () => setDraft(saved);

  const applyPreset = async (p: Preset) => {
    const rows = presetRows(p);
    setDraft((d) => ({ ...d, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }));
    await persist(rows);
  };

  if (loading) {
    return (
      <>
        <div className="page-head">
          <h1>Page Style</h1>
        </div>
        <div className="card">Loading…</div>
      </>
    );
  }

  // ---- resolved preview values ----
  const canvas = safeHex(draft.theme_color_canvas, THEME_DEFAULTS.theme_color_canvas);
  const ink = safeHex(draft.theme_color_ink, THEME_DEFAULTS.theme_color_ink);
  const bodyCol = safeHex(draft.theme_color_body, THEME_DEFAULTS.theme_color_body);
  const muted = safeHex(draft.theme_color_muted, THEME_DEFAULTS.theme_color_muted);
  const accent = safeHex(draft.theme_color_accent, THEME_DEFAULTS.theme_color_accent);
  const accentDeep = safeHex(draft.theme_color_accent_deep, THEME_DEFAULTS.theme_color_accent_deep);
  const red = safeHex(draft.theme_color_red, THEME_DEFAULTS.theme_color_red);
  const radius = Math.max(0, Math.min(40, Number(draft.theme_radius) || 18));
  const gradient = `linear-gradient(120deg, ${accent}, ${accentDeep})`;
  const brightGrad = `linear-gradient(120deg, ${mix(accent, "#ffffff", 0.2)}, ${accent})`;
  const displayCss = fontCss(draft.theme_font_display);
  const bodyCss = fontCss(draft.theme_font_body);
  const scriptCss = draft.theme_font_script === "none" ? bodyCss : fontCss(draft.theme_font_script);
  const clip: React.CSSProperties = {
    backgroundImage: gradient,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: accent,
  };

  return (
    <>
      <div className="page-head">
        <h1>Page Style</h1>
        <p>
          One place for the whole site&rsquo;s look — colors, fonts, corners and favicon. Pick a
          vibe, then fine-tune. Changes go live within seconds of saving.
        </p>
      </div>

      {msg && <div className="msg msg--err">{msg}</div>}
      {flash && (
        <div className={`cms-flash ${flash.tone === "warn" ? "cms-flash--warn" : ""}`}>
          {flash.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)", gap: 20, alignItems: "start" }}>
        {/* ================= CONTROLS ================= */}
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          {/* Presets */}
          <div className="card">
            <div className="row-title" style={{ marginBottom: 10 }}>
              <strong>Vibe presets</strong>
              <span style={{ color: "var(--muted, #8a8a82)", fontSize: 13 }}>one click sets everything</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 }}>
              {PRESETS.map((p) => {
                const active = draft.theme_preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    disabled={busy}
                    title={p.blurb}
                    style={{
                      textAlign: "left",
                      borderRadius: 12,
                      padding: 10,
                      background: p.values.color_canvas,
                      border: active ? `2px solid ${p.values.color_accent}` : "1px solid rgba(0,0,0,.12)",
                      boxShadow: active ? `0 6px 18px ${p.values.color_accent}33` : "0 1px 3px rgba(0,0,0,.06)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                      {[p.values.color_ink, p.values.color_accent, p.values.color_accent_deep, p.values.color_muted].map((c, i) => (
                        <span key={i} style={{ width: 18, height: 18, borderRadius: 5, background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
                      ))}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: p.values.color_ink }}>{p.label}</div>
                    <div style={{ fontSize: 11, lineHeight: 1.3, color: p.values.color_body, marginTop: 2 }}>{p.blurb}</div>
                    {active && (
                      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: p.values.color_accent }}>✓ Active</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colors */}
          <div className="card">
            <div className="row-title" style={{ marginBottom: 10 }}>
              <strong>Colors</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12 }}>
              {COLOR_CONTROLS.map(({ key, label, hint }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={safeHex(draft[key], "#000000")}
                    onChange={(e) => set(key, e.target.value)}
                    style={{ width: 40, height: 40, padding: 0, border: "1px solid rgba(0,0,0,.15)", borderRadius: 8, background: "none", cursor: "pointer", flex: "0 0 auto" }}
                    aria-label={label}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <input
                      value={draft[key] ?? ""}
                      onChange={(e) => set(key, e.target.value)}
                      spellCheck={false}
                      style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: "3px 6px", marginTop: 2 }}
                    />
                    <div style={{ fontSize: 11, color: "#8a8a82" }}>{hint}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="card">
            <div className="row-title" style={{ marginBottom: 10 }}>
              <strong>Typography</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12 }}>
              <FontSelect label="Display / headlines" value={draft.theme_font_display} keys={DISPLAY_FONTS} onChange={(v) => set("theme_font_display", v)} />
              <FontSelect label="Body text" value={draft.theme_font_body} keys={BODY_FONTS} onChange={(v) => set("theme_font_body", v)} />
              <FontSelect label="Script accent" value={draft.theme_font_script} keys={SCRIPT_FONTS} onChange={(v) => set("theme_font_script", v)} allowNone />
            </div>

            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                Advanced — use any Google Font
              </summary>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Font family name</label>
                <input
                  placeholder="e.g. Bricolage Grotesque"
                  value={draft.theme_font_custom_family ?? ""}
                  onChange={(e) => set("theme_font_custom_family", e.target.value)}
                />
                <label style={{ fontSize: 12, fontWeight: 600 }}>Google Fonts stylesheet URL</label>
                <input
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  value={draft.theme_font_custom_url ?? ""}
                  onChange={(e) => set("theme_font_custom_url", e.target.value)}
                  spellCheck={false}
                  style={{ fontFamily: "monospace", fontSize: 12 }}
                />
                <div style={{ fontSize: 11, color: "#8a8a82" }}>
                  When both are filled, this overrides the display font. Leave blank to use the curated fonts above.
                </div>
              </div>
            </details>
          </div>

          {/* Shape */}
          <div className="card">
            <div className="row-title" style={{ marginBottom: 10 }}>
              <strong>Corners</strong>
              <span style={{ fontSize: 13, color: "#8a8a82" }}>{radius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={radius}
              onChange={(e) => set("theme_radius", e.target.value)}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8a8a82" }}>
              <span>Sharp</span>
              <span>Soft</span>
            </div>
          </div>
        </div>

        {/* ================= PREVIEW ================= */}
        <div style={{ position: "sticky", top: 16, display: "grid", gap: 12 }}>
          <div
            style={{
              background: canvas,
              borderRadius: 16,
              padding: 20,
              border: "1px solid rgba(0,0,0,.1)",
              boxShadow: "0 10px 30px rgba(0,0,0,.08)",
              overflow: "hidden",
            }}
          >
            {/* eyebrow */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: bodyCol, background: "rgba(0,0,0,.03)", border: "1px solid rgba(0,0,0,.06)", borderRadius: 8, padding: "4px 9px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
              For wellness leaders
            </div>

            {/* headline */}
            <h2 style={{ fontFamily: displayCss, textTransform: "uppercase", fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.01em", fontSize: 34, margin: "12px 0 0", color: ink }}>
              Build the <span style={clip}>brand</span> that books itself
            </h2>
            <div style={{ fontFamily: scriptCss, fontSize: 22, color: accent, marginTop: 2 }}>— booked out.</div>

            {/* body */}
            <p style={{ fontFamily: bodyCss, color: bodyCol, fontSize: 13.5, lineHeight: 1.6, margin: "12px 0 0" }}>
              I turn experts into authorities with positioning and content that
              converts — no more posting into a calendar that stays{" "}
              <span style={{ color: red }}>empty</span>.
            </p>

            {/* buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <span style={{ background: gradient, color: "#fff", fontFamily: bodyCss, fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 9999, boxShadow: `0 8px 22px ${accent}44` }}>
                Book my free audit
              </span>
              <span style={{ color: ink, fontFamily: bodyCss, fontWeight: 600, fontSize: 13, borderBottom: `2px solid ${accent}` }}>
                See the work
              </span>
            </div>

            {/* ink sheet */}
            <div style={{ background: ink, borderRadius: radius + 10, padding: 16, marginTop: 18 }}>
              <h3 style={{ fontFamily: displayCss, textTransform: "uppercase", fontWeight: 900, fontSize: 20, margin: 0, color: "#fff" }}>
                One dark <span style={{ backgroundImage: brightGrad, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>sheet</span> per page
              </h3>
              <p style={{ fontFamily: bodyCss, color: muted, fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}>
                Real numbers, honest copy, one accent color used sparingly.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <span style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: radius, padding: "8px 12px", color: "#fff", fontFamily: displayCss, fontWeight: 800, fontSize: 15 }}>300+</span>
                <span style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: radius, padding: "8px 12px", color: "#fff", fontFamily: displayCss, fontWeight: 800, fontSize: 15 }}>48h</span>
              </div>
            </div>
          </div>

          {/* favicon + save */}
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 100 100" style={{ flex: "0 0 auto" }}>
              <circle cx="50" cy="50" r="48" fill={ink} />
              <circle cx="50" cy="50" r="44" fill="none" stroke={accent} strokeWidth="7" />
              <text x="50" y="64" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="38" fill={canvas}>AA</text>
            </svg>
            <div style={{ fontSize: 12, color: "#8a8a82" }}>
              Favicon updates to match your Ink &amp; Accent colors automatically.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn--green" disabled={busy || !dirty} onClick={saveChanges}>
              {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
            {dirty && (
              <button className="btn btn--sm" disabled={busy} onClick={resetChanges}>
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FontSelect({
  label,
  value,
  keys,
  onChange,
  allowNone,
}: {
  label: string;
  value: string;
  keys: (string)[];
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }}>
        {keys.map((k) => (
          <option key={k} value={k}>
            {k === "none" ? "None" : FONTS[k as keyof typeof FONTS]?.label ?? k}
          </option>
        ))}
      </select>
      {value !== "none" && FONTS[value as keyof typeof FONTS] && (
        <div style={{ fontFamily: fontCss(value), fontSize: 18, marginTop: 6 }}>Aa Bb Cc 123</div>
      )}
      {allowNone && value === "none" && (
        <div style={{ fontSize: 11, color: "#8a8a82", marginTop: 6 }}>No script accent</div>
      )}
    </div>
  );
}
