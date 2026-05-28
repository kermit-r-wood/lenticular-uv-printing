import {
  buildCalibrationGrid,
  type CalibrationLabel,
} from "../core/calibrate";
import { generateDepthMap } from "../core/depth";
import { sizePxFromMm } from "../core/geom";
import { interlace, type RgbFrame } from "../core/interlace";
import {
  checkSoftLimit,
  EUFYMAKE_E1_PRESET,
  type OutputSpec,
  type SoftLimitInfo,
  validateAgainstPreset,
} from "../core/spec";
import { encodeGray16, encodeRgb8 } from "../png/encode";
import type { CalibrateParams, MakeParams } from "./forms";
import { t } from "./i18n";
import { drawLabelsOnRgb } from "./labels";
import { decodeFile, resampleToRgb } from "./resample";

/** Either a make-summary or a calibrate-summary; carries enough data to re-format on locale change. */
export type SummaryData =
  | {
      readonly kind: "make";
      readonly wmm: number;
      readonly hmm: number;
      readonly wpx: number;
      readonly hpx: number;
      readonly lpi: number;
      readonly orientation: "vertical" | "horizontal";
      readonly profile: "sine" | "arc";
    }
  | {
      readonly kind: "calib";
      readonly rows: number;
      readonly cols: number;
      readonly blockMm: number;
      readonly blockPx: number;
      readonly labels: number;
    };

export interface RenderResult {
  readonly interlacedPng: Uint8Array;
  readonly depthPng: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly ppi: number;
  /** Structured summary for live re-translation. */
  readonly summary: SummaryData;
  /** Soft-limit info, if any. */
  readonly softLimit: SoftLimitInfo | null;
}

export type ProgressFn = (text: string) => void;

export async function renderMake(
  files: File[],
  params: MakeParams,
  progress: ProgressFn = () => undefined,
): Promise<RenderResult> {
  const [widthPx, heightPx] = sizePxFromMm(params.widthMm, params.heightMm, params.ppi);
  const spec: OutputSpec = {
    widthPx,
    heightPx,
    ppi: params.ppi,
    lpi: params.lpi,
    orientation: params.orientation,
    phasePitch: params.phasePitch,
    depthProfile: params.depthProfile,
  };
  validateAgainstPreset(spec, EUFYMAKE_E1_PRESET);
  const softLimit = checkSoftLimit(spec);

  progress(t("status.decoding", { n: files.length }));
  const bitmaps = await Promise.all(files.map(decodeFile));

  progress(t("status.resampling", { w: widthPx, h: heightPx }));
  const frames: RgbFrame[] = [];
  for (let i = 0; i < bitmaps.length; i++) {
    progress(t("status.resamplingProgress", { i: i + 1, n: bitmaps.length }));
    const f = await resampleToRgb(bitmaps[i] as ImageBitmap, widthPx, heightPx);
    frames.push(f);
    (bitmaps[i] as ImageBitmap).close();
  }

  progress(t("status.makingInterlaced"));
  const interlaced = interlace(frames, spec);
  progress(t("status.makingDepth"));
  const depth = generateDepthMap(spec, { maxValue: params.maxDepthValue });

  progress(t("status.encoding"));
  const interlacedPng = encodeRgb8(interlaced.data, widthPx, heightPx, { ppi: params.ppi });
  const depthPng = encodeGray16(depth.data, widthPx, heightPx, { ppi: params.ppi });

  return {
    interlacedPng,
    depthPng,
    widthPx,
    heightPx,
    widthMm: params.widthMm,
    heightMm: params.heightMm,
    ppi: params.ppi,
    summary: {
      kind: "make",
      wmm: params.widthMm,
      hmm: params.heightMm,
      wpx: widthPx,
      hpx: heightPx,
      lpi: params.lpi,
      orientation: params.orientation,
      profile: params.depthProfile,
    },
    softLimit,
  };
}

export async function renderCalibrate(
  files: File[],
  params: CalibrateParams,
  progress: ProgressFn = () => undefined,
): Promise<RenderResult> {
  const [blockPx] = sizePxFromMm(params.blockMm, params.blockMm, params.ppi);
  const baseSpec: OutputSpec = {
    widthPx: blockPx,
    heightPx: blockPx,
    ppi: params.ppi,
    lpi: params.lpis[0] as number,
    orientation: params.orientation,
    phasePitch: 0,
    depthProfile: params.depthProfile,
  };

  // Validate the FULL grid size against the E1 bed and the soft limit.
  const fullSpec: OutputSpec = {
    ...baseSpec,
    widthPx: blockPx * params.phases.length,
    heightPx: blockPx * params.lpis.length,
  };
  validateAgainstPreset(fullSpec, EUFYMAKE_E1_PRESET);
  const softLimit = checkSoftLimit(fullSpec);

  progress(t("status.decoding", { n: files.length }));
  const bitmaps = await Promise.all(files.map(decodeFile));

  progress(t("status.resampling", { w: blockPx, h: blockPx }));
  const frames: RgbFrame[] = [];
  for (let i = 0; i < bitmaps.length; i++) {
    progress(t("status.resamplingProgress", { i: i + 1, n: bitmaps.length }));
    const f = await resampleToRgb(bitmaps[i] as ImageBitmap, blockPx, blockPx);
    frames.push(f);
    (bitmaps[i] as ImageBitmap).close();
  }

  progress(
    t("status.makingCalibGrid", { rows: params.lpis.length, cols: params.phases.length }),
  );
  const grid = buildCalibrationGrid(frames, {
    baseSpec,
    lpis: params.lpis,
    phases: params.phases,
    maxDepthValue: params.maxDepthValue,
  });

  progress(t("status.drawingLabels"));
  const labeled = drawLabelsOnRgb(grid.interlaced, grid.labels);

  progress(t("status.encoding"));
  const interlacedPng = encodeRgb8(labeled.data, labeled.width, labeled.height, {
    ppi: params.ppi,
  });
  const depthPng = encodeGray16(grid.depth.data, grid.depth.width, grid.depth.height, {
    ppi: params.ppi,
  });

  return {
    interlacedPng,
    depthPng,
    widthPx: labeled.width,
    heightPx: labeled.height,
    widthMm: (labeled.width / params.ppi) * 25.4,
    heightMm: (labeled.height / params.ppi) * 25.4,
    ppi: params.ppi,
    summary: {
      kind: "calib",
      rows: params.lpis.length,
      cols: params.phases.length,
      blockMm: params.blockMm,
      blockPx,
      labels: grid.labels.length,
    },
    softLimit,
  };
}

/** Format a SummaryData into a localized one-line description. */
export function formatSummary(s: SummaryData): string {
  if (s.kind === "make") {
    return t("summary.make", {
      wmm: s.wmm,
      hmm: s.hmm,
      wpx: s.wpx,
      hpx: s.hpx,
      lpi: s.lpi,
      orient: t(s.orientation === "vertical" ? "orient.vertical" : "orient.horizontal"),
      profile: t(s.profile === "sine" ? "profile.sine" : "profile.arc"),
    });
  }
  return t("summary.calib", {
    rows: s.rows,
    cols: s.cols,
    block: s.blockMm,
    px: s.blockPx,
    labels: s.labels,
  });
}

// Suppress unused-import warning for CalibrationLabel; it is part of the public
// types of buildCalibrationGrid we depend on.
export type { CalibrationLabel };
