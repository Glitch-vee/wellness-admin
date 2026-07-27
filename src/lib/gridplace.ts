/**
 * A block's placement in the page grid.
 *
 * `.offer-body` is a 12-column grid. Twelve divides by 2, 3, 4 and 6, so a row
 * splits exactly between two, three, four or six blocks — and uneven pairs
 * (⅔+⅓, ¾+¼, 7/12+5/12) are expressible too, which the old six columns could
 * not do.
 *
 * `span`/`col` are the LEGACY sixths fields. They are still read, as their
 * 12ths equivalent, so pages authored before the change keep their layout —
 * but nothing writes them any more, and any write of `cols`/`colStart` clears
 * them, so a block can never carry two conflicting widths at once.
 *
 * This must stay in step with placementOf() in the site's OfferSections.tsx.
 * If the two disagree, the rail and the canvas disagree about how wide a
 * block is.
 */
export const GRID_COLS = 12;
export const MAX_ROWS = 6;

export function placementOf(layout: Record<string, unknown> | undefined): {
  cols: number;
  colStart: number | null;
  rows: number;
} {
  const l = layout ?? {};
  const rawCols = Number(l.cols);
  const legacySpan = Number(l.span);
  const cols =
    rawCols >= 1 && rawCols <= GRID_COLS
      ? Math.round(rawCols)
      : legacySpan >= 1 && legacySpan <= 5
        ? Math.round(legacySpan) * 2
        : GRID_COLS;
  const rawStart = Number(l.colStart);
  const legacyStart = Number(l.col);
  const start =
    rawStart >= 1 && rawStart <= GRID_COLS
      ? Math.round(rawStart)
      : legacyStart >= 1 && legacyStart <= 6
        ? Math.round(legacyStart) * 2 - 1
        : NaN;
  const rawRows = Number(l.rows);
  return {
    cols,
    colStart: start >= 1 && start <= GRID_COLS + 1 - cols ? start : null,
    rows: rawRows >= 1 && rawRows <= MAX_ROWS ? Math.round(rawRows) : 1,
  };
}
