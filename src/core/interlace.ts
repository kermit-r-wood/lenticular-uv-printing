import { lensPeriodPx } from "./geom";
import { frameIndices } from "./profiles";
import { type OutputSpec, validateSpec } from "./spec";

/**
 * A frame buffer pre-resampled to the output spec dimensions.
 *
 * `data` is tightly packed RGB bytes (length = width * height * 3) where row
 * stride = width * 3. Use this format because it matches what a custom PNG
 * encoder needs and avoids carrying alpha through the interlace step.
 */
export interface RgbFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export function makeSolidFrame(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): RgbFrame {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return { width, height, data };
}

/**
 * Build a Uint8ClampedArray (RGBA) from an RgbFrame, suitable for putImageData.
 * Used only for browser preview, not for PNG encoding.
 */
export function rgbToRgba(frame: RgbFrame): Uint8ClampedArray {
  const { width, height, data } = frame;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    out[j] = data[i] as number;
    out[j + 1] = data[i + 1] as number;
    out[j + 2] = data[i + 2] as number;
    out[j + 3] = 255;
  }
  return out;
}

/**
 * Interlace `frames` into a single output of the spec dimensions.
 *
 * All frames must already be resampled to (spec.widthPx, spec.heightPx).
 * For vertical orientation, every output column picks one frame; for
 * horizontal, every row picks one frame.
 *
 * Mirrors Python `interlace_images`.
 */
export function interlace(frames: readonly RgbFrame[], spec: OutputSpec): RgbFrame {
  validateSpec(spec);
  if (frames.length === 0) throw new Error("at least one frame is required");

  const w = spec.widthPx;
  const h = spec.heightPx;
  for (const f of frames) {
    if (f.width !== w || f.height !== h) {
      throw new Error(
        `frame ${f.width}x${f.height} does not match spec ${w}x${h}; ` +
          "resample frames before calling interlace()",
      );
    }
  }

  const period = lensPeriodPx({ ppi: spec.ppi, lpi: spec.lpi });
  const out = new Uint8Array(w * h * 3);

  if (spec.orientation === "vertical") {
    const idx = frameIndices(w, period, frames.length, spec.phasePitch);
    // For each output column, copy that column's bytes from the chosen frame.
    for (let x = 0; x < w; x++) {
      const f = frames[idx[x] as number] as RgbFrame;
      for (let y = 0; y < h; y++) {
        const src = (y * w + x) * 3;
        const dst = src;
        out[dst] = f.data[src] as number;
        out[dst + 1] = f.data[src + 1] as number;
        out[dst + 2] = f.data[src + 2] as number;
      }
    }
  } else {
    // horizontal: each output row picks a frame.
    const idx = frameIndices(h, period, frames.length, spec.phasePitch);
    for (let y = 0; y < h; y++) {
      const f = frames[idx[y] as number] as RgbFrame;
      const rowStart = y * w * 3;
      // Whole row copy from the chosen frame.
      out.set(f.data.subarray(rowStart, rowStart + w * 3), rowStart);
    }
  }

  return { width: w, height: h, data: out };
}
