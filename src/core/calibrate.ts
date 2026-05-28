import { type Gray16Image, generateDepthMap } from "./depth";
import { interlace, type RgbFrame } from "./interlace";
import { type OutputSpec } from "./spec";

export interface CalibrationLabel {
  /** Pixel x of the label anchor in the grid coordinate system. */
  readonly x: number;
  /** Pixel y of the label anchor in the grid coordinate system. */
  readonly y: number;
  readonly text: string;
}

export interface CalibrationGrid {
  readonly interlaced: RgbFrame;
  readonly depth: Gray16Image;
  /** Where the UI layer should render text on a Canvas overlay. */
  readonly labels: readonly CalibrationLabel[];
}

export interface CalibrationOptions {
  readonly baseSpec: OutputSpec;
  readonly lpis: readonly number[];
  readonly phases: readonly number[];
  readonly maxDepthValue?: number;
  /** Height of the solid gloss bar reserved for label readability. */
  readonly labelBarPx?: number;
}

const DEFAULT_LABEL_BAR_PX = 12;

/**
 * Mirror of Python `build_calibration_grid`: rows = lpis, cols = phases.
 * Each block uses `(baseSpec.widthPx, baseSpec.heightPx)`. The top
 * `labelBarPx` rows of every depth block are filled with `maxDepthValue`
 * to provide a smooth gloss area for the printed text label.
 *
 * Text labels are not rasterized here — `labels[]` returns the anchor and
 * string per block; the UI layer renders them on a Canvas before encoding.
 */
export function buildCalibrationGrid(
  frames: readonly RgbFrame[],
  opts: CalibrationOptions,
): CalibrationGrid {
  const { baseSpec, lpis, phases } = opts;
  if (lpis.length === 0) throw new Error("lpis must not be empty");
  if (phases.length === 0) throw new Error("phases must not be empty");
  if (frames.length === 0) throw new Error("at least one frame is required");

  const labelBarPx = opts.labelBarPx ?? DEFAULT_LABEL_BAR_PX;
  const maxDepthValue = opts.maxDepthValue ?? 65535;

  const blockW = baseSpec.widthPx;
  const blockH = baseSpec.heightPx;
  const cols = phases.length;
  const rows = lpis.length;
  const gridW = blockW * cols;
  const gridH = blockH * rows;

  for (const f of frames) {
    if (f.width !== blockW || f.height !== blockH) {
      throw new Error(
        `frame ${f.width}x${f.height} does not match block ${blockW}x${blockH}; ` +
          "resample frames before calling buildCalibrationGrid()",
      );
    }
  }

  const interlacedData = new Uint8Array(gridW * gridH * 3);
  const depthData = new Uint16Array(gridW * gridH);
  const labels: CalibrationLabel[] = [];

  for (let row = 0; row < rows; row++) {
    const lpi = lpis[row] as number;
    for (let col = 0; col < cols; col++) {
      const phase = phases[col] as number;
      const blockSpec: OutputSpec = {
        ...baseSpec,
        lpi,
        phasePitch: phase,
      };

      const blockInterlaced = interlace(frames, blockSpec);
      const blockDepth = generateDepthMap(blockSpec, { maxValue: maxDepthValue });

      // Paste interlaced block.
      const ox = col * blockW;
      const oy = row * blockH;
      for (let y = 0; y < blockH; y++) {
        const srcStart = y * blockW * 3;
        const dstStart = ((oy + y) * gridW + ox) * 3;
        interlacedData.set(
          blockInterlaced.data.subarray(srcStart, srcStart + blockW * 3),
          dstStart,
        );
      }

      // Paste depth block.
      for (let y = 0; y < blockH; y++) {
        const srcStart = y * blockW;
        const dstStart = (oy + y) * gridW + ox;
        depthData.set(
          blockDepth.data.subarray(srcStart, srcStart + blockW),
          dstStart,
        );
      }

      // Fill solid-gloss label bar in depth (top `labelBarPx` rows of block).
      const barRows = Math.min(labelBarPx, blockH);
      for (let y = 0; y < barRows; y++) {
        const dstStart = (oy + y) * gridW + ox;
        depthData.fill(maxDepthValue, dstStart, dstStart + blockW);
      }

      labels.push({
        x: ox + 2,
        y: oy + 2,
        text: formatLabel(lpi, phase),
      });
    }
  }

  return {
    interlaced: { width: gridW, height: gridH, data: interlacedData },
    depth: { width: gridW, height: gridH, data: depthData },
    labels,
  };
}

/** "60lpi φ=+0.000" — matches Python `f"{lpi:g}lpi \u03c6={phase:+.3f}"`. */
export function formatLabel(lpi: number, phase: number): string {
  const lpiStr = formatGeneralFloat(lpi);
  const sign = phase >= 0 ? "+" : "";
  return `${lpiStr}lpi \u03c6=${sign}${phase.toFixed(3)}`;
}

/** Approximation of Python `f"{x:g}"`: strip trailing zeros, no exponent in normal range. */
function formatGeneralFloat(x: number): string {
  if (Number.isInteger(x)) return x.toString();
  const s = x.toPrecision(6);
  return s.replace(/\.?0+$/, "");
}
