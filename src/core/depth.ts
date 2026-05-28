import { lensPeriodPx } from "./geom";
import { periodProfile } from "./profiles";
import { type OutputSpec, validateSpec } from "./spec";

/** Bare 16-bit grayscale buffer; row stride = width. */
export interface Gray16Image {
  readonly width: number;
  readonly height: number;
  readonly data: Uint16Array;
}

/**
 * Generate the standalone depth map for a spec, as a 16-bit grayscale buffer.
 *
 * Mirrors Python `generate_depth_map`. The 1D profile is computed once over
 * one pitch's worth of pixels along the lens axis, then tiled across the
 * other axis.
 */
export function generateDepthMap(
  spec: OutputSpec,
  opts: { maxValue?: number } = {},
): Gray16Image {
  validateSpec(spec);
  const maxValue = opts.maxValue ?? 65535;
  if (maxValue <= 0 || maxValue > 65535) {
    throw new Error("max depth value must be between 1 and 65535");
  }

  const w = spec.widthPx;
  const h = spec.heightPx;
  const period = lensPeriodPx({ ppi: spec.ppi, lpi: spec.lpi });

  // 1D periodic line along the lens axis.
  const profile = periodProfile(period, spec.phasePitch, spec.depthProfile);
  const lineLen = spec.orientation === "vertical" ? w : h;
  const line = new Uint16Array(lineLen);
  for (let i = 0; i < lineLen; i++) {
    const v = (profile[i % period] as number) * maxValue;
    let q = Math.round(v);
    if (q < 0) q = 0;
    else if (q > 65535) q = 65535;
    line[i] = q;
  }

  const data = new Uint16Array(w * h);
  if (spec.orientation === "vertical") {
    // Tile the same `line` across every row.
    for (let y = 0; y < h; y++) {
      data.set(line, y * w);
    }
  } else {
    // Each row gets the constant value line[y].
    for (let y = 0; y < h; y++) {
      const v = line[y] as number;
      const rowStart = y * w;
      data.fill(v, rowStart, rowStart + w);
    }
  }
  return { width: w, height: h, data };
}
