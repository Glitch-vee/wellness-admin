/* ---------- typed settings: props first, legacy body as the fallback ---------- */

import { parseButton, BUTTON_VARIANTS, type ButtonVariant } from "@/lib/blocks";

/** A props value when it's a usable string, else the legacy body reading. */
export function propOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** Testimonials count: props.count, else body line 1, clamped 1–6 (default 3). */
export function countValue(body: string, props: Record<string, unknown>): number {
  const n = Number(props.count);
  if (Number.isFinite(n) && n > 0) return Math.min(6, Math.max(1, Math.round(n)));
  return clampCount(body);
}

/** Testimonials count: body line 1, clamped 1–6, default 3. */
export function clampCount(body: string): number {
  const n = parseInt(body.split("\n")[0]?.trim() ?? "", 10);
  return Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 3;
}

/** Gallery slot: body line 1, default "gallery". */
export function gallerySlot(body: string): string {
  const s = body.split("\n")[0]?.trim() ?? "";
  return s === "about" || s === "before-after" ? s : "gallery";
}

/** Button link + variant: props first, the "href\nvariant" body as fallback. */
export function buttonValue(
  body: string,
  props: Record<string, unknown>
): { href: string; variant: ButtonVariant } {
  const fallback = parseButton(body);
  const variant = String(props.variant ?? "");
  return {
    href: typeof props.href === "string" ? props.href : fallback.href,
    variant: BUTTON_VARIANTS.some((v) => v.value === variant)
      ? (variant as ButtonVariant)
      : fallback.variant,
  };
}
