"use client";

import { useState } from "react";
import {
  isHexColor,
  COLOR_SWATCHES,
  SIZE_OPTIONS,
  WEIGHT_OPTIONS,
  ALIGN_OPTIONS,
  FONT_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LETTER_SPACING_OPTIONS,
  TRANSFORM_OPTIONS,
  BACKGROUND_OPTIONS,
  PADDING_OPTIONS,
  MARGIN_OPTIONS,
  RADIUS_OPTIONS,
  BORDER_OPTIONS,
  SHADOW_OPTIONS,
  MAX_WIDTH_OPTIONS,
  HIDE_ON_OPTIONS,
  POSITION_OPTIONS,
  type StyleOption,
} from "@/lib/blockstyle";

/** Merge a patch into a jsonb map; empty / null values clear their prop. */
export function merge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "" || v === undefined) delete next[k];
    else next[k] = v;
  }
  return next;
}

/**
 * Every BlockStyle prop, grouped Text / Box. Each control's first option is
 * "Default", which CLEARS the prop rather than storing a value — an unstyled
 * block saves `{}` and inherits the site's own design.
 */
export function StylePanel({
  style,
  onPatch,
  hideColors = false,
}: {
  style: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  hideColors?: boolean;
}) {
  const val = (prop: string) =>
    typeof style[prop] === "string" ? String(style[prop]) : "";

  /** A signed px field for overlay offsets — freeNum assumes an unsigned
   * token+unit pair, which doesn't fit top/left/right/bottom's negative range. */
  const offsetNum = (label: string, prop: string) => {
    const m = /^(-?\d{1,4})px$/.exec(val(prop));
    return (
      <div className="field bkstyle__field">
        <label>{label}</label>
        <input
          className="bkstyle__num"
          type="number"
          placeholder="±px"
          value={m ? m[1] : ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onPatch({ [prop]: raw === "" ? null : `${raw}px` });
          }}
        />
      </div>
    );
  };

  /** A bare "N%" field — width doesn't fit freeNum's token+unit pairing
   * (there's no token form, just a 5-100 range) any more than offsets do. */
  const widthNum = () => {
    const m = /^(\d{1,3})%$/.exec(val("width"));
    return (
      <div className="field bkstyle__field">
        <label>Width %</label>
        <input
          className="bkstyle__num"
          type="number"
          min={5}
          max={100}
          placeholder="5-100"
          value={m ? m[1] : ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onPatch({ width: raw === "" ? null : `${raw}%` });
          }}
        />
      </div>
    );
  };

  /** A bare-number field (opacity/rotate/scale) — the value has no unit
   * suffix, unlike freeNum's token+unit pairs or offsetNum's px fields. */
  const numField = (
    label: string,
    prop: string,
    min: number,
    max: number,
    ph: string
  ) => (
    <div className="field bkstyle__field">
      <label>{label}</label>
      <input
        className="bkstyle__num"
        type="number"
        min={min}
        max={max}
        placeholder={ph}
        value={val(prop)}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onPatch({ [prop]: raw === "" ? null : raw });
        }}
      />
    </div>
  );

  /** Stack order — shared by overlay and sticky. */
  const zField = () => (
    <div className="field bkstyle__field">
      <label>Stack order (z)</label>
      <input
        className="bkstyle__num"
        type="number"
        min={0}
        max={999}
        placeholder="0-999"
        value={val("z")}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onPatch({ z: raw === "" ? null : raw });
        }}
      />
    </div>
  );
  /** Bring to front / send to back / step one layer — nudges the block's OWN
   * z rather than reading sibling values (no plumbing needed for that, and
   * DOM order already breaks ties for same-z siblings in practice). */
  const bumpZ = (dir: -1 | 1) => {
    const cur = Number(val("z")) || 0;
    onPatch({ z: String(Math.min(999, Math.max(0, cur + dir))) });
  };
  const layerButtons = () => (
    <div className="field bkstyle__field bkstyle__field--wide">
      <label>Layer order</label>
      <div className="bkstyle__row" style={{ gap: 4 }}>
        <button
          type="button"
          className="btn btn--sm"
          title="Send to back"
          onClick={() => onPatch({ z: "0" })}
        >
          ⏮
        </button>
        <button
          type="button"
          className="btn btn--sm"
          title="Backward one"
          onClick={() => bumpZ(-1)}
        >
          ◀
        </button>
        <button
          type="button"
          className="btn btn--sm"
          title="Forward one"
          onClick={() => bumpZ(1)}
        >
          ▶
        </button>
        <button
          type="button"
          className="btn btn--sm"
          title="Bring to front"
          onClick={() => onPatch({ z: "999" })}
        >
          ⏭
        </button>
      </div>
    </div>
  );
  const [hex, setHex] = useState(() =>
    isHexColor(style.color) ? String(style.color) : ""
  );
  const [bgHex, setBgHex] = useState(() =>
    isHexColor(style.background) ? String(style.background) : ""
  );

  const sel = (label: string, prop: string, opts: StyleOption[]) => (
    <div className="field bkstyle__field">
      <label>{label}</label>
      <select
        value={val(prop)}
        onChange={(e) => onPatch({ [prop]: e.target.value || null })}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  /**
   * A token select PLUS a free-numeric box that writes the contract's free
   * form ("<n>px", a unitless ratio, or "<n>em"). The box only clears the prop
   * when it currently holds a value of its OWN free kind — a token stays put.
   */
  const freeNum = (
    label: string,
    prop: string,
    opts: StyleOption[],
    unit: "px" | "" | "em",
    ph: string,
    step = 1
  ) => {
    const re =
      unit === "px"
        ? /^\d{1,4}px$/
        : unit === "em"
          ? /^-?\d(?:\.\d{1,2})?em$/
          : /^\d(?:\.\d{1,2})?$/;
    const cur = val(prop);
    const numVal = re.test(cur) ? cur.replace(/(px|em)$/, "") : "";
    return (
      <div className="field bkstyle__field">
        <label>{label}</label>
        <div className="bkstyle__freerow">
          <select
            value={re.test(cur) ? "" : cur}
            onChange={(e) => onPatch({ [prop]: e.target.value || null })}
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            className="bkstyle__num"
            type="number"
            step={step}
            placeholder={ph}
            value={numVal}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                if (re.test(cur)) onPatch({ [prop]: null });
              } else {
                onPatch({ [prop]: `${raw}${unit}` });
              }
            }}
          />
        </div>
      </div>
    );
  };

  /** A hex box that only commits valid #hex, and only clears its own hex. */
  const onHex = (
    prop: "color" | "background",
    raw: string,
    set: (v: string) => void
  ) => {
    set(raw);
    const v = raw.trim();
    if (v === "") {
      if (isHexColor(style[prop])) onPatch({ [prop]: null });
    } else if (isHexColor(v)) {
      onPatch({ [prop]: v });
    }
  };

  const color = val("color");
  const background = val("background");

  return (
    <div className="bkstyle">
      <fieldset className="bkstyle__group">
        <legend>Text</legend>
        <div className="bkstyle__row">
          {sel("Size", "size", SIZE_OPTIONS)}
          {sel("Weight", "weight", WEIGHT_OPTIONS)}
          {sel("Align", "align", ALIGN_OPTIONS)}
        </div>
        <div className="bkstyle__row">
          {sel("Font", "font", FONT_OPTIONS)}
          {freeNum("Line height", "lineHeight", LINE_HEIGHT_OPTIONS, "", "1.4", 0.1)}
          {freeNum("Letter spacing", "letterSpacing", LETTER_SPACING_OPTIONS, "em", "0.02", 0.01)}
        </div>
        <div className="bkstyle__row">
          {sel("Capitalisation", "transform", TRANSFORM_OPTIONS)}
          <label className="bkedit__laycheck">
            <input
              type="checkbox"
              checked={style.italic === true}
              onChange={(e) => onPatch({ italic: e.target.checked || null })}
            />
            Italic
          </label>
        </div>
        {!hideColors && (
          <div className="field bkstyle__field bkstyle__field--wide">
            <label>Colour</label>
            <div className="bkstyle__swatches">
              <button
                type="button"
                className={`bkstyle__swatch bkstyle__swatch--none ${
                  color === "" ? "bkstyle__swatch--on" : ""
                }`}
                title="Default colour"
                onClick={() => {
                  setHex("");
                  onPatch({ color: null });
                }}
              >
                ∅
              </button>
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`bkstyle__swatch ${
                    color === c.value ? "bkstyle__swatch--on" : ""
                  }`}
                  style={{ background: c.hex }}
                  title={c.label}
                  onClick={() => {
                    setHex("");
                    onPatch({ color: c.value });
                  }}
                />
              ))}
              <input
                className="bkstyle__hex"
                value={hex}
                placeholder="#hex"
                spellCheck={false}
                onChange={(e) => onHex("color", e.target.value, setHex)}
              />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Box</legend>
        <div className="bkstyle__row">
          {sel("Background", "background", BACKGROUND_OPTIONS)}
          <div className="field bkstyle__field">
            <label>Background hex</label>
            <input
              className="bkstyle__hex bkstyle__hex--wide"
              value={bgHex}
              placeholder="#hex"
              spellCheck={false}
              onChange={(e) => onHex("background", e.target.value, setBgHex)}
            />
          </div>
        </div>
        {isHexColor(background) && (
          <span className="hint">Using the custom colour {background}.</span>
        )}
        <div className="bkstyle__row">
          {freeNum("Padding", "padding", PADDING_OPTIONS, "px", "px")}
          {freeNum("Space above", "marginTop", MARGIN_OPTIONS, "px", "px")}
          {freeNum("Space below", "marginBottom", MARGIN_OPTIONS, "px", "px")}
        </div>
        <div className="bkstyle__row">
          {freeNum("Corners", "radius", RADIUS_OPTIONS, "px", "px")}
          {sel("Border", "border", BORDER_OPTIONS)}
          {sel("Shadow", "shadow", SHADOW_OPTIONS)}
        </div>
        <div className="bkstyle__row">
          {freeNum("Max width", "maxWidth", MAX_WIDTH_OPTIONS, "px", "px")}
          {widthNum()}
        </div>
        {val("width") !== "" && (
          <p className="hint">
            Width % keeps the block&apos;s full grid row and narrows it inside —
            set Align (Text section above) to center or right it, or it stays
            flush left.
          </p>
        )}
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Freedom (beyond the presets)</legend>
        <div className="bkstyle__row">
          {numField("Opacity %", "opacity", 0, 100, "0-100")}
          {numField("Rotate °", "rotate", -360, 360, "±deg")}
          {numField("Scale %", "scale", 10, 300, "100 = normal")}
        </div>
        <div className="bkstyle__row">
          {(() => {
            const m = /^(\d{1,2})px$/.exec(val("borderWidth"));
            return (
              <div className="field bkstyle__field">
                <label>Custom border width</label>
                <input
                  className="bkstyle__num"
                  type="number"
                  min={0}
                  max={20}
                  placeholder="px"
                  value={m ? m[1] : ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    onPatch({ borderWidth: raw === "" ? null : `${raw}px` });
                  }}
                />
              </div>
            );
          })()}
          {sel("Border style", "borderStyle", [
            { value: "", label: "Solid (default)" },
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ])}
          <div className="field bkstyle__field">
            <label>Border colour hex</label>
            <input
              className="bkstyle__hex"
              value={val("borderColor")}
              placeholder="#hex"
              spellCheck={false}
              onChange={(e) => {
                const raw = e.target.value.trim();
                onPatch({ borderColor: raw === "" ? null : raw });
              }}
            />
          </div>
        </div>
        {(val("borderWidth") !== "" || val("borderColor") !== "") && (
          <p className="hint">
            A custom width or colour here replaces the Border preset above
            entirely.
          </p>
        )}
        <div className="bkstyle__row">
          <div className="field bkstyle__field bkstyle__field--wide">
            <label>Background image URL</label>
            <input
              value={val("bgImage")}
              placeholder="https://... or /path"
              spellCheck={false}
              onChange={(e) => {
                const raw = e.target.value.trim();
                onPatch({ bgImage: raw === "" ? null : raw });
              }}
            />
          </div>
        </div>
        <p className="hint">
          Fills the block behind its content, cropped to cover — combine with
          Background colour above as a fallback while it loads.
        </p>
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Phone (≤700px)</legend>
        <div className="bkstyle__row">
          {freeNum("Size", "sizeSm", SIZE_OPTIONS, "px", "px")}
          {freeNum("Padding", "paddingSm", PADDING_OPTIONS, "px", "px")}
        </div>
        <div className="bkstyle__row">
          {freeNum("Space above", "marginTopSm", MARGIN_OPTIONS, "px", "px")}
          {freeNum("Space below", "marginBottomSm", MARGIN_OPTIONS, "px", "px")}
        </div>
        <p className="hint">Overrides the values above only on phones. Leave blank to inherit.</p>
      </fieldset>

      <fieldset className="bkstyle__group">
        <legend>Position</legend>
        <div className="bkstyle__row">
          {sel("Visibility", "hideOn", HIDE_ON_OPTIONS)}
          {sel("Layout mode", "position", POSITION_OPTIONS)}
        </div>
        {val("position") === "overlay" && (
          <>
            <div className="bkstyle__row">
              {offsetNum("Top", "top")}
              {offsetNum("Left", "left")}
            </div>
            <div className="bkstyle__row">
              {offsetNum("Right", "right")}
              {offsetNum("Bottom", "bottom")}
            </div>
            {zField()}
            {layerButtons()}
            <p className="hint">
              Overlay takes the block out of normal flow — set at least two of
              top/left/right/bottom or it collapses to the section&apos;s corner.
            </p>
          </>
        )}
        {val("position") === "sticky" && (
          <>
            <div className="bkstyle__row">
              {offsetNum("Sticks at (top)", "top")}
              {zField()}
            </div>
            {layerButtons()}
            <p className="hint">
              Sticky pins the block at this distance from the top of the
              viewport once you scroll past it. Left/right/bottom don&apos;t
              apply — the block keeps its normal-flow width and side.
            </p>
          </>
        )}
      </fieldset>

      <p className="bkedit__note">
        Every control starts at "Default", which uses the site&apos;s own
        design — pick a value only where you want to override it.
      </p>
    </div>
  );
}
