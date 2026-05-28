export const MM_PER_INCH = 25.4;

/**
 * Pixels per lenticular pitch. Matches Python `lens_period_px(ppi, lpi)`:
 * `max(1, round(ppi / lpi))`.
 */
export function lensPeriodPx(opts: { ppi: number; lpi: number }): number {
  if (opts.ppi <= 0) throw new Error("ppi must be positive");
  if (opts.lpi <= 0) throw new Error("lpi must be positive");
  return Math.max(1, Math.round(opts.ppi / opts.lpi));
}

/**
 * Convert physical millimeters to pixel dimensions at the given PPI.
 * Matches Python `size_px_from_mm`. Returns `[widthPx, heightPx]`.
 */
export function sizePxFromMm(
  widthMm: number,
  heightMm: number,
  ppi: number,
): [number, number] {
  if (widthMm <= 0 || heightMm <= 0) {
    throw new Error("physical dimensions must be positive");
  }
  if (ppi <= 0) throw new Error("ppi must be positive");
  return [
    Math.round((widthMm / MM_PER_INCH) * ppi),
    Math.round((heightMm / MM_PER_INCH) * ppi),
  ];
}

/** Non-negative modulo. Mirrors Python/numpy `%` semantics for positive `n`. */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
